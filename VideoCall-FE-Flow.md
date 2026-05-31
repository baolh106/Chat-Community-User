# Video Call Feature

## BE cần hỗ trợ

- Xác thực socket bằng JWT như realtime chat hiện tại.
- Duy trì room realtime:
  - Admin join `admin`.
  - User join `user:{userId}`.
- Định tuyến signaling WebRTC qua Socket.IO:
  - Offer khi bắt đầu cuộc gọi.
  - Answer khi người nhận chấp nhận.
  - ICE candidate trong quá trình thiết lập peer connection.
  - Reject, cancel, end cho vòng đời cuộc gọi.
- Giới hạn quyền gọi theo mô hình chat hiện tại:
  - User chỉ gọi admin với `receiver: "admin"`.
  - Admin gọi một user cụ thể với `receiver: "{userId}"`.
- Không truyền audio/video qua BE. Media stream đi qua WebRTC giữa client với
  client hoặc qua TURN/SFU nếu sau này bổ sung.
- Không lưu lịch sử cuộc gọi trong bản hiện tại. Nếu cần lịch sử missed call,
  duration hoặc billing thì tạo thêm module persistence riêng.
- Redis Socket.IO adapter hiện tại vẫn dùng được để broadcast signaling giữa
  nhiều instance.

## Socket Events

Tất cả event yêu cầu client đã connect Socket.IO bằng token hợp lệ và đã emit
`admin:join` hoặc `user:join` trước đó.

### `call:invite`

Client gọi gửi:

```json
{
  "receiver": "admin",
  "mediaType": "video",
  "offer": {}
}
```

Hoặc admin gọi user:

```json
{
  "receiver": "user-id",
  "mediaType": "video",
  "offer": {}
}
```

BE trả cho caller:

```json
{
  "ok": true,
  "callId": "uuid",
  "delivered": 1
}
```

Người nhận nhận `call:incoming`:

```json
{
  "callId": "uuid",
  "caller": "admin",
  "receiver": "user-id",
  "mediaType": "video",
  "createdAt": "2026-05-29T00:00:00.000Z",
  "offer": {}
}
```

### `call:accept`

Người nhận gửi:

```json
{
  "callId": "uuid",
  "receiver": "admin",
  "answer": {}
}
```

Caller nhận `call:accepted`.

### `call:ice-candidate`

Mỗi bên gửi ICE candidate cho bên còn lại:

```json
{
  "callId": "uuid",
  "receiver": "user-id",
  "candidate": {}
}
```

Bên còn lại nhận cùng event `call:ice-candidate`.

### `call:reject`

Người nhận từ chối:

```json
{
  "callId": "uuid",
  "receiver": "admin",
  "reason": "declined"
}
```

Caller nhận `call:rejected`.

### `call:cancel`

Caller hủy khi người nhận chưa bắt máy:

```json
{
  "callId": "uuid",
  "receiver": "user-id",
  "reason": "cancelled"
}
```

Người nhận nhận `call:cancelled`.

### `call:end`

Một bên kết thúc cuộc gọi:

```json
{
  "callId": "uuid",
  "receiver": "admin",
  "reason": "completed"
}
```

Bên còn lại nhận `call:ended`.

### `call:error`

BE trả khi payload sai hoặc không đủ quyền:

```json
{
  "ok": false,
  "reason": "receiver_not_allowed",
  "callId": "uuid"
}
```

Các reason chính:

- `unauthorized`
- `invalid_payload`
- `receiver_not_allowed`
- `call_id_required`

## FE Flow

### Caller

1. Connect Socket.IO bằng JWT.
2. Emit `user:join` nếu là user hoặc `admin:join` nếu là admin.
3. Tạo `RTCPeerConnection`.
4. Xin quyền camera/microphone bằng `getUserMedia`.
5. Add local tracks vào peer connection.
6. Tạo offer bằng `createOffer`, gọi `setLocalDescription`.
7. Emit `call:invite` kèm `receiver`, `mediaType: "video"` và offer.
8. Lắng nghe `call:accepted`, lấy answer và gọi `setRemoteDescription`.
9. Khi có `icecandidate`, emit `call:ice-candidate`.
10. Khi nhận `call:ice-candidate`, gọi `addIceCandidate`.
11. Khi user bấm kết thúc, emit `call:end`.

### Receiver

1. Connect Socket.IO bằng JWT.
2. Emit `user:join` hoặc `admin:join`.
3. Lắng nghe `call:incoming`.
4. Hiển thị màn hình incoming call với caller và media type.
5. Nếu từ chối, emit `call:reject`.
6. Nếu chấp nhận:
   - Tạo `RTCPeerConnection`.
   - Xin quyền camera/microphone.
   - Add local tracks.
   - Gọi `setRemoteDescription` với offer.
   - Tạo answer bằng `createAnswer`.
   - Gọi `setLocalDescription`.
   - Emit `call:accept` kèm answer.
7. Hai bên tiếp tục trao đổi `call:ice-candidate`.
8. Khi nhận `call:cancelled`, đóng màn hình incoming call.
9. Khi nhận `call:ended`, đóng peer connection và clear local/remote stream.

## Ghi chú triển khai FE

- FE nên tự quản lý timeout ringing, ví dụ 30-60 giây không có `call:accepted`
  thì emit `call:cancel`.
- Nếu `call:invite:ack.delivered` bằng `0`, hiển thị người nhận đang offline
  hoặc không sẵn sàng.
- Mỗi tab/device có thể nhận signaling; FE cần tránh hiển thị trùng bằng cách
  quản lý theo `callId`.
- Production nên cấu hình STUN/TURN server cho WebRTC để hỗ trợ NAT/firewall.
