---
name: fe-realtime
description: Làm việc với realtime trong Chat-Community-User - Socket.IO event (user:join, message:send, message:new, message:send:ack, call:*), hợp đồng event có type, optimistic UI với tempId, ack/timeout/retry, upload file, và video call WebRTC (offer/answer, ICE, TURN, cleanup). Dùng khi sửa socket, gửi tin, đính kèm file hoặc VideoCallPanel/useVideoCall.
---

# FE Realtime: Socket.IO và WebRTC

Áp dụng cùng với `fe-standards` và `fe-hooks`.

## Hợp đồng event

Các event đang dùng (cả hai app):

- **Client gửi lên server:** `user:join` (user), `admin:join` (admin), `message:send`, `call:invite`, `call:accept`, `call:reject`, `call:cancel`, `call:end`
- **Server gửi xuống client:** `connect`, `disconnect`, `connect_error`, `user:joined`, `user:join_denied`, `admin:joined`, `user:left`, `message:new`, `message:send:ack`, `message:uploading`, `message:upload:error`, `message:error`, `call:incoming`, `call:accepted`, `call:rejected`, `call:cancelled`, `call:ended`, `call:error`

Rule:
- Mọi event và payload khai báo một chỗ trong `types/socket.ts`:
  ```ts
  export interface ServerToClientEvents {
    'message:new': (payload: MessageDTO) => void;
    'message:send:ack': (payload: { tempId: string; message: MessageDTO }) => void;
    // ...
  }
  export interface ClientToServerEvents {
    'message:send': (payload: SendMessagePayload, ack: (res: AckResult) => void) => void;
    // ...
  }
  export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
  ```
- Thêm hoặc đổi event: cập nhật type trước, rồi mới code. Nếu cần BE đổi, ghi rõ vào báo cáo.
- Payload nhận được vẫn phải parse hoặc narrow ở biên (`parseMessage`), không tin type tĩnh một cách mù quáng.
- Đăng ký listener trong effect và `off` đúng handler khi cleanup. Không gọi `socket.off(event)` không kèm handler, vì nó gỡ luôn listener của nơi khác.

## Tin nhắn optimistic
1. Tạo `tempId = crypto.randomUUID()`, thêm tin vào list với `status: 'sending'`.
2. Gửi kèm ack có timeout:
   ```ts
   socket.timeout(SEND_TIMEOUT_MS).emit('message:send', payload, (err, res) => {
     if (err || !res?.ok) markFailed(tempId, err ? 'timeout' : res.reason);
     else confirm(tempId, res.message);
   });
   ```
3. Khớp tin trả về **chỉ theo `id` hoặc `tempId`**. Cấm gộp theo nội dung và thời gian (đây là nguyên nhân bug mất tin khi gửi hai tin giống nhau).
4. Tin `failed` có nút "Gửi lại", dùng lại cùng `tempId`.
5. `message:error` và `message:upload:error` phải đánh dấu đúng tin theo `tempId`. Nếu BE chưa trả `tempId`, ghi lại thành yêu cầu gửi BE.
6. Mỗi tin gửi đi gắn đúng một `tempId`, và mỗi tin pending chỉ khớp một lần.

## Kết nối
- `createSocket(token)` dùng `transports: ['websocket']`, truyền auth qua `auth: { token }`.
- Khi token được refresh: cập nhật `socket.auth` rồi reconnect, không tạo socket mới song song.
- `disconnect` hay `connect_error`: hiện trạng thái trên UI, không xoá tin đang có. Lỗi auth thì đi qua luồng refresh token một lần, nếu vẫn lỗi thì về màn đăng nhập.
- Khi reset session thì `socket.disconnect()`, `setSocketConnected(false)`, và gọi `POST /auth/:userId/end`.

## Upload file
- Kiểm tra size (`MAX_ATTACHMENT_SIZE_MB`) và kiểu file **trước** khi đọc.
- Hiện tại gửi base64 qua socket. Hướng đi đúng là upload multipart qua REST (có `onprogress`) rồi chỉ emit metadata. Không mở rộng thêm luồng base64.
- Preview bằng `URL.createObjectURL` phải `revokeObjectURL` khi tin được xác nhận hoặc khi unmount.

## WebRTC video call
Trình tự đúng cho `startCall`:
1. Chặn gọi trùng: nếu đã có `pcRef.current` hoặc đang `calling` thì return.
2. Gán `callIdRef.current = createCallId()` **trước** khi tạo `RTCPeerConnection`, để ICE candidate sớm không bị rơi. Ack từ server không được ghi đè `callId`.
3. `getUserMedia({ video: true, audio: true })`. Lỗi `NotFoundError` hoặc `NotReadableError` thì thử lại chỉ với audio. Báo lỗi cho người dùng theo `err.name`.
4. Tạo PC với `iceServers` lấy từ env (STUN + **TURN**: `VITE_TURN_URL`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL`).
5. Lắng nghe `onicecandidate`, `ontrack`, `onconnectionstatechange` (trạng thái `failed` hoặc `disconnected` thì cập nhật UI hoặc kết thúc cuộc gọi).
6. Có timeout không ai bắt máy (khoảng 30s): tự `call:cancel`.
7. ICE candidate đến trước `remoteDescription` thì xếp hàng chờ (giữ pattern hàng đợi hiện có).

`cleanupCall()` là đường thoát duy nhất, phải idempotent: dừng mọi track, `pc.close()`, reset các ref, dừng chuông, xoá timer. Gọi nó ở mọi nhánh kết thúc (`ended`, `rejected`, `cancelled`, `error`, unmount).

Chỉ log debug WebRTC khi `import.meta.env.DEV`.

## Checklist
- [ ] Event mới hoặc sửa đã có type trong `types/socket.ts`
- [ ] `emit` cần phản hồi có ack và timeout, có trạng thái `failed` và retry
- [ ] Khớp tin chỉ theo `id` hoặc `tempId`
- [ ] Listener được `off` đúng handler
- [ ] Call: chặn gọi trùng, `callId` gán sớm, có TURN, có `connectionstatechange`, `cleanupCall` idempotent
- [ ] Đã xét app còn lại (admin có thêm luồng nhiều user)
