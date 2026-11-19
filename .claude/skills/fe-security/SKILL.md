---
name: fe-security
description: Rà soát và sửa bảo mật phía client cho Chat-Community-User - XSS, URL scheme trong href/src, lưu token và lịch sử chat, env VITE_*, reCAPTCHA, CSP, nội dung unsafe. Dùng khi được yêu cầu kiểm tra bảo mật FE, khi đụng tới auth/token/storage, hiển thị URL hay file từ server, hoặc trước khi release.
---

# FE Security

Áp dụng cùng với `fe-standards`. Mặc định coi mọi dữ liệu từ server và từ người dùng khác là **không tin cậy**.

## Mô hình mối đe doạ
- User gửi tin nhắn hoặc file độc hại tới admin. Một lỗ XSS ở admin đồng nghĩa với mất quyền admin.
- Token bị đánh cắp từ storage qua XSS hoặc qua extension.
- Giả mạo danh tính qua các trường trong payload (`sender`).

## Rule và cách sửa chuẩn

### 1. Render nội dung
- Chỉ render dạng text trong JSX. Cấm `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`.

### 2. URL động
Mọi giá trị gắn vào `href`, `src`, `window.open`, `location` phải qua:
```ts
const ALLOWED_PROTOCOLS = new Set(['https:', 'http:', 'blob:']);
export const safeUrl = (raw: unknown): string | undefined => {
  if (typeof raw !== 'string' || !raw) return undefined;
  try {
    const url = new URL(raw, window.location.origin);
    return ALLOWED_PROTOCOLS.has(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
};
```
- `safeUrl` trả `undefined` thì không render link hoặc ảnh, chỉ hiện tên file.
- Link ngoài phải có `target="_blank" rel="noopener noreferrer"`.
- Cân nhắc whitelist host (Drive, domain BE) nếu URL luôn đến từ nguồn đã biết.

### 3. Token và dữ liệu phiên
- Đích đến: refresh token nằm trong cookie `HttpOnly; Secure; SameSite=Strict` do BE đặt, access token chỉ giữ trong memory.
- Trong lúc chờ BE: dùng `sessionStorage` thay `localStorage`, **không lưu `messages`**, mọi truy cập bọc `try/catch`.
- Khi thoát: gọi `POST /auth/:userId/end`, xoá storage, ngắt socket.

### 4. Danh tính
- "Tin của mình" xác định bằng `sender === userId` lấy từ token hoặc session, không chấp nhận giá trị đặc biệt như `'user'`.
- UI không bao giờ là lớp phân quyền. Kiểm tra quyền phải nằm ở BE.

### 5. Env và build
- Mọi `VITE_*` đều bị nhúng vào bundle, nên chỉ chứa giá trị công khai (site key, URL). Không bao giờ chứa secret.
- `.env` không được commit. `dist/` không được commit.
- `.env.example` chỉ có placeholder hoặc key test, kèm ghi chú rõ đó là key test.

### 6. reCAPTCHA
- Token chỉ dùng một lần: gọi `recaptchaRef.current?.reset()` sau mỗi lần submit, kể cả khi thành công lẫn thất bại.
- Xử lý `onExpired` và `onErrored` bằng cách xoá token và hiện thông báo.
- Nhắc trong báo cáo: BE phải verify token bằng secret key.

### 7. Nội dung unsafe (ảnh nhạy cảm)
- Blur bằng CSS chỉ là UX, không phải bảo mật, vì ảnh gốc vẫn được tải. Lý tưởng là BE không trả URL gốc cho ảnh unsafe.
- Ảnh unsafe không mở được ở chế độ phóng to nếu chưa có thao tác xác nhận rõ ràng.

### 8. Header phía Nginx (đề xuất, nằm ngoài repo)
`Content-Security-Policy` (`default-src 'self'; img-src 'self' blob: https://drive.google.com https://*.googleusercontent.com; connect-src 'self' wss:; frame-src https://www.google.com/recaptcha/; script-src 'self' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/`), cùng `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.

## Quy trình audit
1. Grep các điểm nóng:
   ```
   dangerouslySetInnerHTML|innerHTML|eval\(|new Function
   href=\{|src=\{|window\.open|location\.
   localStorage|sessionStorage
   import\.meta\.env
   === 'user'|=== 'admin'
   ```
2. Với mỗi điểm: nguồn dữ liệu có tin cậy không, đã qua `safeUrl` hoặc parse chưa?
3. Kiểm tra cả `user/` và `admin/`. Ưu tiên admin vì đặc quyền cao hơn.
4. Báo cáo theo mức 🔴 kèm `file:line`, kịch bản tấn công cụ thể, cách sửa, và phần nào cần BE hoặc Nginx.
