# Chat Community User Frontend

Giao diện chat cho user với tone màu hồng pastel, được xây dựng bằng React + TypeScript + Vite

## Cấu trúc Project

```
src/
├── components/          # UI Components
│   ├── ChatHeader.tsx
│   ├── LoginPanel.tsx
│   ├── ChatPanel.tsx
│   ├── MessageList.tsx
│   ├── MessageItem.tsx
│   ├── MessageComposer.tsx
│   └── index.ts
├── hooks/              # Custom Hooks
│   └── useChat.ts
├── types/              # TypeScript Types
│   └── index.ts
├── utils/              # Utilities
│   ├── api.ts
│   └── socket.ts
├── App.tsx             # Main App Component
├── main.tsx            # Entry Point
├── styles.css          # Global Styles
└── vite-env.d.ts       # Vite Type Declarations
```

## Tính năng

- **Authentication**: Đăng nhập bằng nickname
- **Real-time Chat**: Socket.IO cho chat realtime
- **Responsive UI**: Giao diện responsive với tone hồng pastel
- **Session Management**: Quản lý session và reconnect
- **Error Handling**: Xử lý lỗi kết nối và gửi tin nhắn

## Cài đặt và Chạy

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## API Integration

Project được cấu hình proxy tới backend tại `http://localhost:3000`:

- `/api/*` → `http://localhost:3000/api/*`
- `/socket.io/*` → `http://localhost:3000/socket.io/*`

## Kiến trúc

- **Components**: Tách biệt UI thành các component nhỏ, dễ test và maintain
- **Custom Hook**: `useChat` chứa toàn bộ logic chat, state management
- **Type Safety**: TypeScript types cho tất cả data structures
- **Separation of Concerns**: API calls, socket logic tách riêng trong utils

## Flow Chat

1. User nhập nickname
2. Gọi `POST /api/auth/start` để lấy accessToken
3. Connect Socket.IO với token
4. Emit `user:join` để join room
5. Gửi/nhận messages realtime
6. Handle disconnect/reconnect theo backend logic