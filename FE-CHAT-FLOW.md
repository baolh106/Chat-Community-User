# Frontend Chat Flow

Tài liệu này mô tả cách FE triển khai chat từ đầu tới cuối theo backend hiện tại.

---

## 1. Tổng quan

Backend hiện tại có:
- REST API bắt đầu session user bằng `nickname` duy nhất.
- Socket.IO để giao tiếp realtime.
- Cơ chế disconnect/reconnect 30s: nếu user mất kết nối và không reconnect trong 30s thì backend sẽ finalize session, lưu message cache vào DB và xóa session cache.
- Mỗi lần user bắt đầu lại cùng `nickname` sau khi session cũ bị finalize là một session hoàn toàn mới.

---

## 2. API base

- Prefix REST API: `/api`
- Auth routes: `/api/auth`
- Message REST routes: `/api/message`

> Lưu ý: frontend cần dùng `accessToken` trả về từ `/api/auth/start` để kết nối Socket.IO.

---

## 3. Bắt đầu user session

### 3.1 Endpoint

- Method: `POST`
- URL: `/api/auth/start`
- Body JSON:
  ```json
  {
    "nickname": "<nickname>"
  }
  ```

### 3.2 Response

Trả về object:
- `accessToken`: JWT access token
- `refreshToken`: JWT refresh token
- `expiresIn`: lifetime của access token (s)

### 3.3 Luồng FE

1. Người dùng nhập `nickname`.
2. Gọi `POST /api/auth/start`.
3. Lưu `accessToken` vào state/local storage.
4. Dùng `accessToken` để connect Socket.IO.

---

## 4. Kết nối Socket.IO

### 4.1 Khởi tạo kết nối

Socket.IO cần token được gửi trong `auth.token` hoặc `authorization` header.

Ví dụ JavaScript:

```ts
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
  auth: {
    token: accessToken,
  },
});
```

Hoặc với header:

```ts
const socket = io("http://localhost:3000", {
  extraHeaders: {
    Authorization: `Bearer ${accessToken}`,
  },
});
```

### 4.2 Xác thực socket

Backend dùng middleware kiểm tra JWT và bắt buộc payload phải có `role` và `userId`.
Nếu thiếu hoặc token invalid/expired, socket sẽ bị reject.

---

## 5. User socket flow

### 5.1 Đăng ký user

Sau khi kết nối thành công, frontend phải emit:

```ts
socket.emit("user:join");
```

### 5.2 Events trả về

- `user:joined`
  - Khi join thành công.
  - Payload:
    ```json
    {
      "ok": true,
      "userId": "<session-userId>"
    }
    ```
- `user:join_denied`
  - Khi join bị từ chối.
  - Payload chứa `ok: false` và `reason`.

### 5.3 Khi join thành công

FE nên dùng `userId` trả về làm định danh session local.

---

## 6. Gửi tin nhắn

### 6.1 Event gửi

Frontend gửi message bằng event Socket.IO:

```ts
socket.emit("message:send", {
  content: "Xin chào",
  receiver: "admin",
  imageURL: "https://...", // tuỳ chọn
});
```

### 6.2 Xử lý kết quả

- `message:sent`
  - Khi backend nhận và đẩy message cache thành công.
- `message:error`
  - Khi gửi thất bại.
  - Payload:
    ```json
    {
      "ok": false,
      "reason": "<error_reason>"
    }
    ```

### 6.3 Quy ước `receiver`

- Với chat user -> admin, `receiver` có thể là `admin`.
- Backend sẽ lưu message sender là `userId` và receiver là giá trị bạn cung cấp.

---

## 7. Nhận tin nhắn realtime

### 7.1 Event nhận

- `message:new`

Payload event gửi từ backend có dạng:

```json
{
  "content": "...",
  "imageURL": "...", // optional
  "createdAt": "2026-05-08T...Z",
  "sender": "<userId> hoặc admin",
  "receiver": "<admin hoặc userId>"
}
```

### 7.2 Luồng FE

- Lắng nghe `message:new` để hiển thị chat realtime.
- Dùng `sender`/`receiver` để phân biệt message gửi/nhận.

---

## 8. Reconnect / disconnect

### 8.1 Cơ chế backend

- Khi socket user disconnect và không còn socket nào của user đó online, backend bắt timer 30s.
- Nếu trong 30s không reconnect lại, backend:
  1. lấy lại message cache của user
  2. lưu vào DB
  3. xóa cache session
- Nếu reconnect trong 30s, backend hủy timer và giữ session đang mở.

### 8.2 FE cần làm

- Nếu socket disconnect, hiển thị trạng thái "mất kết nối".
- Nếu reconnect thành công trong 30s, emit lại `user:join`.
- Nếu quá 30s, session cũ bị xóa, người dùng cần bắt đầu lại flow `POST /api/auth/start` với nickname hoặc cùng nickname cũng tạo session mới.

> Backend tạo `userId` mới mỗi lần /auth/start, nên cùng nickname không giữ lại session cũ khi đã finalize.

---

## 9. Session mới khi dùng lại cùng nickname

Frontend có thể cho phép người dùng nhập lại cùng `nickname` cũ.

Do backend tự tạo `userId` mới với suffix unique mỗi lần gọi `/api/auth/start`, nên:
- session cũ đã hết hạn và finalize sẽ không tái sử dụng lại
- lần nhập lại cùng nickname là một session hoàn toàn mới

---

## 10. Admin flow

Admin sử dụng giao diện riêng để quản lý các cuộc trò chuyện và hỗ trợ người dùng ẩn danh.

### 10.1 Xác thực Admin

Khác với User (dùng `/api/auth/start`), Admin cần đăng nhập bằng tài khoản được khởi tạo trước trong hệ thống.
- **Endpoint**: `POST /api/auth/admin/login`
- **Body JSON**:
  ```json
  {
    "password": "<admin_password>"
  }
  ```
- **Response**: Trả về `accessToken` có chứa `role: "admin"`.

### 10.2 Đăng ký Admin Socket

Sau khi kết nối Socket.IO thành công với token của Admin, FE phải emit event để server đưa socket vào room quản trị:

```ts
socket.emit("admin:join");
```

### 10.2 Response

- `admin:joined`
  - `ok: true`
  - `userIds`: danh sách userId đang online
  - `history`: Object chứa lịch sử tin nhắn của từng user online dưới dạng `{ [userId: string]: Message[] }`
- `admin:join_denied`
  - `ok: false`
  - `reason`

### 10.3 Đồng bộ lịch sử (Sync History)

Khi Admin mới đăng nhập hoặc load lại trang, các box chat cần hiển thị lại nội dung hội thoại đang diễn ra.

**Cơ chế đồng bộ:**
Server tự động trả về toàn bộ tin nhắn trong cache của tất cả User đang online thông qua field `history` trong event `admin:joined`. FE không cần gọi thêm API REST để lấy lịch sử ban đầu.

**API dự phòng:**
Trong trường hợp cần lấy lại dữ liệu của một user cụ thể (ví dụ: refresh thủ công), FE có thể gọi `GET /api/message/cache/:userId`.

### 10.4 Gửi và Nhận tin nhắn

- **Nhận tin nhắn**: Admin lắng nghe event `message:new`. Dựa vào trường `sender` để biết tin nhắn từ User nào.
- **Gửi tin nhắn**: Admin dùng chung event `message:send` như User, nhưng truyền `receiver` là `userId` của khách hàng.

> **Lưu ý**: Chỉ khi session bị "finalize" (sau 30s user offline), tin nhắn mới được chuyển từ Redis vào Database. Lúc này session đó coi như kết thúc.

```ts
socket.emit("message:send", {
  content: "Chào bạn, tôi là Admin. Tôi có thể giúp gì cho bạn?",
  receiver: "userId-cua-khach-hang"
});
```

---

## 11. Các điểm cần lưu ý FE

- `nickname` là duy nhất trên UI input nhưng không phải là `userId` thực tế.
- `userId` session được backend cấp trong token và trả về ở event `user:joined`.
- Nếu socket disconnect, backend vẫn giữ session trong 30s để cho phép reconnect.
- Sau 30s không reconnect, backend finalize và xóa session cache.
- FE chỉ cần sử dụng `accessToken` để socket auth; refresh token hiện tại không có route public cho FE.

---

## 12. Ví dụ flow đơn giản

1. Người dùng nhập nickname.
2. FE gọi `POST /api/auth/start`.
3. FE nhận `accessToken`.
4. FE connect Socket.IO với token.
5. FE emit `user:join`.
6. FE lắng nghe `user:joined`, `message:new`, `message:error`, `message:sent`.
7. FE gửi tin nhắn bằng `message:send`.
8. Nếu mất kết nối, FE thử reconnect và emit lại `user:join`.
9. Nếu quá 30s, khởi tạo lại session bằng cách gọi lại `POST /api/auth/start`.
