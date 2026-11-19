---
name: fe-bugfix
description: Quy trình debug và sửa bug front-end trong Chat-Community-User - tái hiện, tìm root cause, sửa tối thiểu, đồng bộ user/admin, viết regression test. Dùng khi người dùng báo lỗi UI, tin nhắn mất/kẹt/trùng, socket rớt, video call hỏng, hoặc lỗi build/tsc.
---

# FE Bugfix

Áp dụng cùng với `fe-standards`. Sửa đúng **gốc**, không vá triệu chứng bằng cách thêm nhánh `if` hay heuristic.

## Quy trình

1. **Hiểu triệu chứng.** Ghi lại các bước tái hiện, kết quả mong đợi và kết quả thực tế. Bug xảy ra ở app nào?
2. **Đối chiếu bug đã biết.** Tra `Chat-Community-FE-Review.md` (mục 4.2 và 4.3). Nhiều bug đã được phân tích sẵn ở đó, ví dụ: mất tin khi gửi trùng nội dung, tin kẹt ở "Sending…", ICE candidate bị rơi, reCAPTCHA không reset, stale closure trong `tryRefreshSession`.
3. **Khoanh vùng.** Lần theo luồng dữ liệu: event hoặc input → handler trong hook → `setState` → render. Dùng `grep` tìm tên event, tên state. Đọc đúng đoạn liên quan, không đọc lan man cả file 1.000 dòng.
4. **Xác định root cause.** Diễn đạt thành một câu: "X xảy ra vì Y trong `file:line`". Các nhóm nguyên nhân hay gặp ở repo này:
   - Stale closure: listener hoặc callback đọc state của lần render cũ
   - Khớp tin bằng heuristic nội dung và thời gian thay vì `id`/`tempId`
   - Thiếu cleanup, dẫn tới listener nhân đôi sau reconnect
   - Cờ trạng thái reset sai thời điểm (`isSending`)
   - Thứ tự async sai (gán ref sau `await`)
   - Lệch hành vi giữa `user/` và `admin/` do copy-paste
   - Nhiều định dạng dữ liệu cũ và mới (`imageURL`, `fileURL`, `attachments`)
5. **Viết test tái hiện trước** nếu logic là hàm thuần (`fe-testing`). Test phải fail trước khi sửa.
6. **Sửa tối thiểu tại gốc.** Không refactor kèm. Nếu cần BE đổi hợp đồng (ví dụ trả `tempId`), sửa phía FE sao cho tương thích và ghi yêu cầu cho BE.
7. **Đồng bộ app còn lại.** Chạy `diff user/src/<file> admin/src/<file>`, áp cùng bản sửa hoặc giải thích vì sao không cần.
8. **Verify.** Test pass, `npm run build` pass ở các app đã sửa. Nếu bug thuộc UI hoặc realtime mà không chạy được trình duyệt, ghi rõ các bước để người dùng tự kiểm tra tay.

## Debug realtime
- Log tạm có tiền tố `[debug]` và bọc `import.meta.env.DEV`. Gỡ hết trước khi xong.
- Socket: kiểm tra số lần `on` so với `off` (listener nhân đôi), thứ tự `connect` → `user:join` → `user:joined`.
- WebRTC: theo dõi `signalingState`, `iceConnectionState`, `connectionState`. Gợi ý xem `chrome://webrtc-internals`.

## Báo cáo
```
Bug: <triệu chứng>
Root cause: <một câu, file:line>
Sửa: <đã đổi gì> (user/ ✅, admin/ ✅ hoặc lý do)
Verify: <test / build / bước tay>
Còn lại: <rủi ro, việc BE cần làm>
```
