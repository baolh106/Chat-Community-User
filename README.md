# Chat Community – Frontend

Hai ứng dụng React 18 + TypeScript + Vite, deploy độc lập:

| App | Thư mục | Port dev | Mô tả |
|---|---|---|---|
| User | `user/` | 4000 | Người dùng chat và gọi video với admin (tone hồng pastel) |
| Admin | `admin/` | 5000 | Admin chat với nhiều user, nhận/gọi video nhiều cuộc cùng lúc |

## Chạy và kiểm tra

Trong từng thư mục `user/` hoặc `admin/`:

```bash
cp .env.example .env   # rồi điền giá trị thật
npm ci
npm run dev            # chạy dev server (proxy /api và /socket.io tới VITE_API_BASE)
npm run lint           # ESLint
npm test               # Vitest
npm run build          # tsc + vite build -> dist/
```

## Biến môi trường

| Biến | Ý nghĩa |
|---|---|
| `VITE_RECAPTCHA_SITE_KEY` | Site key reCAPTCHA v2. Key trong `.env.example` là key test công khai của Google, chỉ dùng cho dev. |
| `VITE_API_BASE` | Địa chỉ BE, **chỉ dùng cho proxy dev**. |
| `VITE_TURN_URL`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL` | TURN server cho video call (nên có ở production). |
| `PORT` | Port dev server (tuỳ chọn). |

Mọi biến `VITE_*` đều được nhúng vào bundle JS, nên không đặt secret vào đó.

## Deploy

Bản build gọi `/api` và `/socket.io` trên **cùng origin**, nên Nginx phải reverse proxy hai path này tới BE (kèm upgrade WebSocket cho `/socket.io`). Jenkins (`Jenkinsfile`) chạy `lint` → `test` → `build` rồi rsync `dist/` cho từng app.

## Cấu trúc mỗi app

```
src/
├── components/   # UI, chỉ hiển thị
├── hooks/
│   ├── useChat.ts            # ghép các hook dưới thành API cho App
│   ├── useAuthSession.ts     # token, sessionStorage, refresh có chống gọi trùng
│   ├── useChatSocket.ts      # vòng đời Socket.IO, join, refresh khi token hết hạn
│   ├── useMessageSender.ts   # soạn/gửi tin, optimistic UI, timeout, gửi lại
│   ├── useMessages.ts        # (user) hội thoại với admin
│   ├── useConversations.ts   # (admin) danh sách user, tin theo user, unread
│   ├── useVideoCall.ts       # WebRTC (user: 1 cuộc, admin: nhiều cuộc)
│   ├── useRingtone.ts        # chuông WebAudio
│   └── useSocketEvent.ts, useEventCallback.ts
├── types/        # Message, Attachment, hợp đồng socket (types/socket.ts)
├── utils/        # hàm thuần: parse tin nhắn, file, safeUrl, webrtc, http, storage
└── test/         # socket giả, setup Vitest
```

Các file trong `hooks/` (trừ `useChat`, `useMessages`/`useConversations`, `useVideoCall`), `utils/` (trừ `api.ts`) và `types/socket.ts` đang **giống hệt nhau** ở hai app, chờ gom vào `packages/shared`. Khi sửa một file loại này, sửa cả hai bên.

## Quy ước

- Dữ liệu từ socket/REST là `unknown`, được parse ở biên (`utils/messages.ts`, `utils/guards.ts`); không dùng `any`.
- Tin nhắn chỉ khớp theo `id` (server) hoặc `tempId` (client).
- Mọi URL từ server gắn vào `href`/`src` đều đi qua `safeUrl()`.
- Phiên đăng nhập nằm trong `sessionStorage` (đóng tab là mất); không lưu tin nhắn ở client.

Chi tiết chuẩn code nằm trong `.claude/skills/fe-*`; báo cáo review và lộ trình nằm trong `Chat-Community-FE-Review.md` (bản local, không commit).
