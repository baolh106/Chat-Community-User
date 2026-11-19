---
name: fe-hooks
description: Thiết kế và sửa custom hook, state và side-effect React trong Chat-Community-User - useEffect, cleanup, stale closure, ref, storage, tách God hook useChat thành các hook nhỏ (useAuthSession, useChatSocket, useMessages, useVideoCall, useRingtone). Dùng khi đụng tới src/hooks hoặc logic state.
---

# FE Hooks & State

Áp dụng cùng với `fe-standards`.

## Mô hình mục tiêu

Hiện tại `useChat` làm 6 việc. Hướng tách (tương đương các service ở BE):

| Hook | Trách nhiệm | Phụ thuộc |
|---|---|---|
| `useAuthSession` | start, refresh, end session; giữ access token | `utils/api` |
| `useChatSocket` | tạo, kết nối, ngắt socket; trạng thái kết nối | token |
| `useMessages` | danh sách tin, gửi, ack, retry | socket, `utils/messages` |
| `useVideoCall` | vòng đời cuộc gọi WebRTC | socket |
| `useRingtone` | phát và dừng chuông | none |
| `useChat` | **chỉ ghép** các hook trên cho `App` | các hook trên |

- Code mới phải vào đúng hook theo trách nhiệm. Khi sửa `useChat`, nếu thấy phần cần sửa tách ra được gọn thì tách trước rồi mới sửa, nhưng chỉ khi làm vậy không phình phạm vi task.
- Logic thuần (`normalizeMessage`, `upsertMessage`, `mapMessageError`, `formatFileSize`…) chuyển sang `utils/` để test được.

## Rule cho effect
- Mỗi `useEffect` làm một việc và **luôn có cleanup** nếu có đăng ký:
  ```ts
  useEffect(() => {
    if (!socket) return;
    const handleNew = (raw: unknown) => setMessages(prev => upsertMessage(prev, parseMessage(raw)));
    socket.on('message:new', handleNew);
    return () => { socket.off('message:new', handleNew); };
  }, [socket]);
  ```
- Phải cleanup những thứ sau: socket listener (`off` đúng handler đó), `setTimeout`/`setInterval`, `URL.createObjectURL` → `revokeObjectURL`, `MediaStream` → `track.stop()`, `RTCPeerConnection.close()`, `AudioContext.close()`.
- Dependency đầy đủ. Không dùng `// eslint-disable` để né cảnh báo exhaustive-deps.
- **Stale closure**: callback async hoặc listener không được đọc state của lần render cũ. Cách xử lý:
  - Cập nhật dựa trên state trước thì dùng `setX(prev => …)`.
  - Giá trị cần đọc mới nhất trong listener sống lâu thì dùng `useRef` và đồng bộ `ref.current = value` trong effect.
- Không dùng effect để tính giá trị dẫn xuất. Tính khi render, dùng `useMemo` nếu tốn chi phí.

## State
- Một nguồn sự thật. Không giữ hai state cùng biểu diễn một thứ.
- Trạng thái dùng union (`ChatStatus`, `MessageStatus`), không tổ hợp nhiều boolean.
- Tách lỗi theo ngữ cảnh: `chatError`, `callError`, `authError`.
- Cờ async (`isSending`) chỉ reset trong `finally` hoặc khi ack về, không reset ngay sau `emit`.
- Hook trả về object có tên rõ ràng. Hàm trả ra ngoài phải ổn định (`useCallback`) nếu được truyền vào component đã `memo`.

## Storage
- Không lưu token hay `messages` vào `localStorage`. Access token giữ trong memory/ref. Nếu bắt buộc lưu thì dùng `sessionStorage`.
- Mọi lần truy cập storage đều đi qua helper có `try/catch` và parse từ `unknown`.
- Không lưu `blob:` URL.

## Async
- Chống gọi trùng bằng promise ref (như `refreshPromiseRef` hiện tại; giữ pattern này).
- Kiểm tra unmount hoặc hủy: dùng `AbortController` cho fetch, cờ `cancelled` trong effect.

## Checklist
- [ ] Mỗi effect có cleanup và đủ dependency
- [ ] Không có stale closure trong listener hoặc callback async
- [ ] Không thêm trách nhiệm mới vào `useChat`
- [ ] Logic thuần nằm ở `utils/` và có test (`fe-testing`)
- [ ] Hook tương ứng ở app còn lại đã được xét
