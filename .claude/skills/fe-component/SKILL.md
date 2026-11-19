---
name: fe-component
description: Viết mới hoặc refactor React component trong user/ hoặc admin/ của Chat-Community-User - cấu trúc component, props, render list, memo, styling bằng CSS class, accessibility, modal, form. Dùng khi tạo hay sửa file trong src/components hoặc khi chuyển style inline sang CSS.
---

# FE Component

Áp dụng cùng với `fe-standards`.

## Khung một component

```tsx
import { memo } from 'react';
import type { Message } from '../types';

interface MessageItemProps {
  message: Message;
  isMine: boolean;
  onRetry?: (tempId: string) => void;
}

export const MessageItem = memo(function MessageItem({ message, isMine, onRetry }: MessageItemProps) {
  // 1. derived values (không cần useState cho giá trị tính được từ props)
  // 2. local UI state (mở/đóng, hover…)
  // 3. handlers: handleXxx
  // 4. return JSX
});
```

- Dùng named export và function component. Không dùng `React.FC`.
- Giá trị tính được từ props thì tính trực tiếp khi render, không sao chép vào state.
- Props callback nhận dữ liệu tối thiểu (`id`), không nhận cả object nếu không cần.
- Sub-component dùng riêng trong file (`ImageModal`, `AttachmentList`) chỉ để chung file khi dưới ~80 dòng. Lớn hơn thì tách file riêng.

## Render list
- `key` lấy theo id ổn định: `message.id ?? message.tempId`, `attachment.url`. **Không dùng `index`.**
- Item trong list dài (tin nhắn, danh sách user ở admin) phải `memo`. Handler truyền xuống item phải bọc `useCallback` ở component cha.
- `MessageList` chỉ tự cuộn xuống đáy khi người dùng đang ở sát đáy (cách đáy dưới ~80px).

## Styling
- Không thêm `style={{…}}`. Thêm class trong `styles.css` theo kiểu BEM nhẹ: `message-item`, `message-item--mine`, `message-item__meta`.
- Inline chỉ cho giá trị tính lúc runtime, ví dụ `transform` khi zoom ảnh.
- Màu và khoảng cách lặp lại thì khai báo biến CSS trong `:root` (`--color-primary`, `--radius-md`…). Giữ tone hồng pastel hiện có.
- Responsive: kiểm tra ở độ rộng 360px.
- Khi sửa một component có nhiều style inline, chuyển luôn phần đang chạm vào sang class. Phần không chạm thì để nguyên, không lan rộng.

## Accessibility (bắt buộc)
- Phần tử bấm được là `<button type="button">` hoặc `<a>`, không phải `<div onClick>`.
- Nút chỉ có icon phải có `aria-label`. Ảnh phải có `alt` mang nghĩa.
- Modal (`ImageModal`, cuộc gọi đến): có `role="dialog"` và `aria-modal="true"`, có `aria-labelledby`. Đóng được bằng `Esc`. Focus vào modal khi mở và trả focus về chỗ cũ khi đóng.
- Danh sách tin nhắn có `aria-live="polite"`. Trạng thái lỗi có `role="alert"`.
- Input phải có `<label>` (có thể ẩn bằng class `visually-hidden`).

## Form và input
- Input controlled. Submit qua `<form onSubmit>` để phím Enter hoạt động tự nhiên.
- Disable nút khi `!canSubmit`, và vẫn kiểm tra lại trong handler.
- Lỗi hiển thị bằng `error-box`. Không dùng `alert` hay `confirm`.

## Hiển thị dữ liệu từ server
- Text render dạng text. Không dùng `dangerouslySetInnerHTML`.
- URL đặt vào `href` hoặc `src` phải qua `safeUrl()` (xem `fe-security`).
- Thời gian format bằng helper chung có locale, không hardcode `'en-US'`.

## Checklist trước khi xong
- [ ] Không có `any` hay style inline mới, không dùng `key={index}`
- [ ] Đạt các mục a11y ở trên
- [ ] Component tương ứng ở app còn lại đã được xét
- [ ] `npm run build` pass
