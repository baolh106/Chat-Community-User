---
name: fe-refactor
description: Lập kế hoạch và thực hiện refactor lớn cho front-end Chat-Community-User - gom code trùng giữa user/ và admin/ thành package dùng chung (npm workspaces), tách God hook useChat, chuẩn hoá type Message/attachments, xoá code chết. Dùng khi được yêu cầu refactor, dọn kiến trúc, giảm trùng lặp hoặc tách file lớn.
---

# FE Refactor

Áp dụng cùng với `fe-standards`, `fe-hooks` và `fe-testing`. Refactor nghĩa là **không đổi hành vi**. Nếu có sửa bug thì làm ở commit riêng.

## Nguyên tắc
1. **Có lưới an toàn trước.** Viết test cho hành vi sắp động vào (ít nhất các hàm thuần). Chưa có Vitest thì cài trước (`fe-testing`).
2. **Bước nhỏ, mỗi bước build xanh.** Mỗi bước là một commit có thể revert độc lập.
3. **Di chuyển trước, sửa sau.** Bước đầu chỉ chuyển code sang chỗ mới, giữ nguyên logic. Cải tiến làm ở bước sau.
4. **Không làm khi chưa có kế hoạch.** Với refactor nhiều file, trình kế hoạch theo từng bước cho người dùng duyệt trước.

## Lộ trình chuẩn (theo file review, mục 5)

**Bước A: Dọn code chết** (rủi ro rất thấp)
- `user/src/types/App.tsx` và `user/src/components/UserPage.tsx` (code chết), `admin/src/types/App.tsx` (rỗng). Grep xác nhận không còn import trước khi xoá.

**Bước B: Chuẩn hoá type**
- `Message` thêm `id?`, `tempId?`, `status?: MessageStatus`. `Attachment` thành type riêng.
- FE chỉ dùng `attachments[]`. Các trường cũ (`imageURL`, `fileURL`, `fileName`…) chỉ còn xuất hiện trong `parseMessage` ở biên.
- Thay `any` từng file, bắt đầu từ `utils/` rồi đến hooks.

**Bước C: Rút hàm thuần ra `utils/`**
- `normalizeMessage`, `upsertMessage`, `mapMessageError`, `toBase64`, `isImageFile`, `formatFileSize`, `getDisplayURL`, `getDownloadURL` chuyển sang `utils/messages.ts` và `utils/files.ts`, kèm test.

**Bước D: Tách `useChat`** (thứ tự rủi ro tăng dần)
`useRingtone` → `useAuthSession` → `useChatSocket` → `useMessages` → `useVideoCall`. Sau bước này `useChat` chỉ còn ghép các hook, API trả cho `App` giữ nguyên.

**Bước E: Gom code chung user và admin**
Cấu trúc đích:
```
package.json            # { "private": true, "workspaces": ["packages/*", "apps/*"] }
packages/shared/        # types, utils/messages, utils/files, safeUrl, createSocket, api,
                        # hooks dùng chung (useAuthSession, useChatSocket, useVideoCall, useRingtone),
                        # components dùng chung (MessageItem, ImageModal, MessageList)
apps/user/              # chỉ phần riêng của user
apps/admin/             # chỉ phần riêng của admin (danh sách user, dashboard)
```
- Trước khi gom một file, `diff` hai bản. Mỗi chỗ lệch phải quyết định rõ: giữ một bản, tham số hoá, hay để riêng. Ghi lại quyết định. Ví dụ đã biết: `normalizeMessage` ở admin thiếu nhánh `imageURL`.
- Gom theo thứ tự từ ít lệch nhất: `socket.ts` (giống hệt) → `ChatHeader` → `MessageList` → `MessageItem` → `utils` → hooks.
- Jenkins và Nginx đang trỏ vào `user/` và `admin/`, nên đổi thư mục thì phải cập nhật `Jenkinsfile` cùng lúc (`fe-tooling`). Muốn ít xáo trộn thì có thể giữ tên `user/` và `admin/`, chỉ thêm `packages/shared`.

## Với mỗi bước
- [ ] Test liên quan pass trước và sau
- [ ] `npm run build` pass ở cả hai app
- [ ] Không đổi API trả cho component (trừ khi đó là mục tiêu của bước)
- [ ] Báo cáo: file đã di chuyển hoặc xoá, chỗ lệch đã hợp nhất ra sao, bước tiếp theo
