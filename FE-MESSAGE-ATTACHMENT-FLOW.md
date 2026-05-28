# FE Message Attachment Flow

Tài liệu này mô tả phần update cho FE để gửi message kèm image hoặc file. Backend hiện lưu file tạm trên Google Drive và trả metadata qua realtime event `message:new`.

## 1. Tổng Quan

Message hiện hỗ trợ 3 kiểu:

- Text only: chỉ có `content`.
- Image: upload file ảnh, backend lưu Google Drive và set cả `imageURL` lẫn metadata file.
- File thường: upload file bất kỳ, backend lưu Google Drive và set metadata file.

FE vẫn có thể dùng `imageURL` cũ nếu đã có URL sẵn. Cách mới nên dùng upload file để backend tự lưu vào Drive.

## 2. Message Model

Payload message FE nhận từ `message:new` hoặc từ `history` có dạng:

```ts
type Message = {
  content: string | null;
  imageURL?: string;
  fileURL?: string;
  fileDownloadURL?: string | null;
  fileName?: string;
  fileMimeType?: string;
  fileSize?: number;
  fileDriveId?: string;
  attachmentType?: "image" | "file";
  createdAt: string;
  sender: string;
  receiver: string;
};
```

Quy ước hiển thị:

- Nếu `attachmentType === "image"`: render ảnh từ `imageURL` hoặc `fileURL`.
- Nếu `attachmentType === "file"`: render file item với `fileName`, `fileSize`, link mở bằng `fileURL`, link tải bằng `fileDownloadURL` nếu có.
- Nếu `content` khác `null`: render text message kèm attachment nếu message có cả hai.

## 3. Gửi Bằng Socket.IO

Event vẫn là:

```ts
socket.emit("message:send", payload);
```

### 3.1 Text Only

```ts
socket.emit("message:send", {
  content: "Xin chào",
  receiver: "admin",
});
```

### 3.2 Gửi Image/File Bằng Base64

Backend nhận file qua field `file`:

```ts
type SocketFilePayload = {
  data: string; // base64 hoặc data URL
  name: string;
  mimeType: string;
};
```

Ví dụ:

```ts
const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const sendFileMessage = async (file: File, receiver: string, content = "") => {
  socket.emit("message:send", {
    content,
    receiver,
    file: {
      data: await toBase64(file),
      name: file.name,
      mimeType: file.type || "application/octet-stream",
    },
  });
};
```

Với user gửi cho admin:

```ts
await sendFileMessage(file, "admin");
```

Với admin gửi cho user:

```ts
await sendFileMessage(file, userId, "File bạn cần đây");
```

### 3.3 Gửi URL Có Sẵn

Nếu FE đã có URL từ nguồn khác:

```ts
socket.emit("message:send", {
  content: null,
  receiver: "admin",
  imageURL: "https://example.com/image.png",
});
```

Hoặc file URL:

```ts
socket.emit("message:send", {
  content: "Tài liệu",
  receiver: "admin",
  fileURL: "https://example.com/file.pdf",
});
```

## 4. Gửi Bằng REST

Endpoint cũ `/api/message/insert` giờ nhận thêm `multipart/form-data`.

### 4.1 Multipart Upload

```ts
const form = new FormData();
form.append("sender", senderId);
form.append("receiver", receiverId);
form.append("content", content);
form.append("file", file);

await fetch(`${baseUrl}/message/insert`, {
  method: "POST",
  body: form,
});
```

Field `file` là bắt buộc nếu muốn backend upload lên Drive.

### 4.2 JSON Cũ Vẫn Hoạt Động

```ts
await fetch(`${baseUrl}/message/insert`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    sender: senderId,
    receiver: receiverId,
    content: "Xin chào",
    imageURL: "https://example.com/image.png",
    createdAt: new Date().toISOString(),
  }),
});
```

## 5. Nhận Realtime

FE lắng nghe như cũ:

```ts
socket.on("message:new", (message: Message) => {
  renderMessage(message);
});
```

Ví dụ payload image:

```json
{
  "content": null,
  "imageURL": "https://drive.google.com/file/d/xxx/view?usp=drivesdk",
  "fileURL": "https://drive.google.com/file/d/xxx/view?usp=drivesdk",
  "fileDownloadURL": "https://drive.google.com/uc?id=xxx&export=download",
  "fileName": "avatar.png",
  "fileMimeType": "image/png",
  "fileSize": 123456,
  "fileDriveId": "xxx",
  "attachmentType": "image",
  "createdAt": "2026-05-26T10:00:00.000Z",
  "sender": "user-id",
  "receiver": "admin"
}
```

Ví dụ payload file:

```json
{
  "content": "Bạn xem file này nhé",
  "fileURL": "https://drive.google.com/file/d/xxx/view?usp=drivesdk",
  "fileDownloadURL": "https://drive.google.com/uc?id=xxx&export=download",
  "fileName": "report.pdf",
  "fileMimeType": "application/pdf",
  "fileSize": 456789,
  "fileDriveId": "xxx",
  "attachmentType": "file",
  "createdAt": "2026-05-26T10:00:00.000Z",
  "sender": "admin",
  "receiver": "user-id"
}
```

## 6. Error Handling

Khi socket gửi lỗi, backend emit:

```ts
socket.on("message:error", (payload) => {
  console.log(payload.reason);
});
```

Các `reason` FE nên xử lý:

- `unauthorized`: socket chưa auth hoặc thiếu role/user.
- `message service unavailable`: backend chưa sẵn sàng message service.
- `invalid_payload`: thiếu `receiver`.
- `invalid_file_payload`: thiếu `file.data`, `file.name`, hoặc `file.mimeType`.
- `file_too_large`: file vượt `UPLOAD_MAX_FILE_SIZE_MB`.
- `message content or file is required`: không có text và không có file/url.
- Lỗi Google Drive: hiển thị message chung kiểu upload thất bại.

## 7. FE Validation Đề Xuất

- Giới hạn size theo env backend hiện tại, mặc định `10MB`.
- Cho phép gửi message nếu có `content.trim()` hoặc có file.
- Với image preview: kiểm tra `file.type.startsWith("image/")`.
- Với file thường: hiển thị tên file, dung lượng, icon theo MIME type.
- Disable nút gửi trong lúc đang encode base64 hoặc chờ upload để tránh gửi trùng.

## 8. Lưu Ý Google Drive

Backend sẽ upload file lên folder Google Drive đã cấu hình. FE không cần gọi Google Drive trực tiếp.

Nếu backend bật public permission, link Drive có thể mở trực tiếp. Nếu link không mở được, kiểm tra cấu hình backend `GOOGLE_DRIVE_MAKE_PUBLIC` và quyền folder/service account.
