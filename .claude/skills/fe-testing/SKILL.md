---
name: fe-testing
description: Thiết lập và viết test front-end cho Chat-Community-User bằng Vitest + React Testing Library - test hàm thuần (normalizeMessage, upsertMessage, safeUrl), test hook có socket giả, test component. Dùng khi cần thêm test, regression test cho bug, hoặc cài hạ tầng test cho user/ hoặc admin/.
---

# FE Testing

Áp dụng cùng với `fe-standards`. Repo **chưa có test**. Ưu tiên test thứ có giá trị cao nhất trước.

## Cài đặt (mỗi app, khi chưa có)

```bash
cd user   # hoặc admin
npm i -D vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

Thêm vào `vite.config.ts` (đặt trong object trả về):
```ts
test: {
  environment: 'jsdom',
  setupFiles: ['./src/test/setup.ts'],
  css: false,
},
```
Kèm `/// <reference types="vitest/config" />` ở đầu file.

Tạo `src/test/setup.ts` chứa `import '@testing-library/jest-dom/vitest';`. Thêm script `"test": "vitest run"` và `"test:watch": "vitest"`. Đây là thay đổi dependency, nên phải xác nhận với người dùng trước khi cài.

## Thứ tự ưu tiên
1. **Hàm thuần xử lý tin nhắn** (`normalizeMessage`, `upsertMessage`, `parseMessage`): đây là nơi có bug thật. Nếu chúng còn nằm trong `useChat.ts`, tách sang `utils/messages.ts` trước (đúng hướng của `fe-hooks`).
2. **Bảo mật**: `safeUrl` với `javascript:`, `data:`, URL tương đối, chuỗi rỗng, giá trị không phải string.
3. **Luồng refresh token**: gọi trùng chỉ refresh một lần, refresh thất bại thì về màn đăng nhập.
4. **Hook** với socket giả.
5. **Component** cho tương tác quan trọng: gửi tin, retry, mở/đóng modal bằng `Esc`.

## Quy ước
- File test đặt cạnh file nguồn: `messages.ts` đi kèm `messages.test.ts`.
- Tên test mô tả hành vi: `it('giữ cả hai tin khi gửi hai tin trùng nội dung liên tiếp')`.
- Theo cấu trúc Arrange, Act, Assert. Mỗi test một hành vi. Dùng factory `makeMessage(overrides)` thay cho object lớn copy-paste.
- Test component dùng query theo role hoặc label (`getByRole('button', { name: /gửi/i })`), không query theo class. Nếu query theo role khó, đó thường là dấu hiệu a11y kém.
- Dùng `userEvent` thay `fireEvent`.
- Không gọi mạng thật. Mock `fetch` bằng `vi.spyOn(globalThis, 'fetch')`.

## Mẫu: regression test cho bug mất tin
```ts
import { describe, expect, it } from 'vitest';
import { upsertMessage } from './messages';

const makeMessage = (o: Partial<Message> = {}): Message => ({
  content: 'hi', sender: 'u1', receiver: 'admin',
  createdAt: '2026-01-01T00:00:00.000Z', ...o,
});

describe('upsertMessage', () => {
  it('không gộp hai tin khác tempId dù trùng nội dung', () => {
    const first = makeMessage({ tempId: 'a', status: 'sending' });
    const second = makeMessage({ tempId: 'b', status: 'sending' });
    expect(upsertMessage([first], second)).toHaveLength(2);
  });

  it('thay tin pending khi ack có cùng tempId', () => {
    const pending = makeMessage({ tempId: 'a', status: 'sending' });
    const acked = makeMessage({ tempId: 'a', id: 'srv-1', status: 'sent' });
    expect(upsertMessage([pending], acked)).toEqual([expect.objectContaining({ id: 'srv-1', status: 'sent' })]);
  });
});
```

## Socket giả cho hook
```ts
type Handler = (...args: unknown[]) => void;
export const createFakeSocket = () => {
  const handlers = new Map<string, Set<Handler>>();
  return {
    on: vi.fn((e: string, h: Handler) => { (handlers.get(e) ?? handlers.set(e, new Set()).get(e)!).add(h); }),
    off: vi.fn((e: string, h: Handler) => { handlers.get(e)?.delete(h); }),
    emit: vi.fn(),
    timeout: vi.fn(function (this: unknown) { return this; }),
    serverEmit: (e: string, ...args: unknown[]) => handlers.get(e)?.forEach(h => h(...args)),
    listenerCount: (e: string) => handlers.get(e)?.size ?? 0,
  };
};
```
Mock `utils/socket` (`vi.mock('../utils/socket', …)`) để `createSocket` trả về socket giả. Sau `unmount()`, assert `listenerCount` bằng 0 để bắt lỗi thiếu cleanup.

## Xong khi
- [ ] Test mới fail trước khi sửa, pass sau khi sửa (với regression test)
- [ ] `npm test` và `npm run build` đều pass
- [ ] Không có test phụ thuộc thời gian thật (dùng `vi.useFakeTimers()` cho timeout)
