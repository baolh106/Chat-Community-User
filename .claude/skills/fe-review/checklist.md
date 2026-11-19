# FE Review Checklist

Bỏ qua những mục không áp dụng.

## 🔴 Bảo mật (`fe-security`)
- [ ] URL động trong `href`/`src`/`window.open` đã qua `safeUrl()`?
- [ ] Không có `dangerouslySetInnerHTML`, `innerHTML`, `eval`?
- [ ] Không lưu token hay tin nhắn vào `localStorage`? Truy cập storage có `try/catch`?
- [ ] `VITE_*` mới chỉ chứa giá trị công khai? Không commit `.env` hay `dist/`?
- [ ] Không xác định "của mình" hay quyền dựa trên trường payload do client khác gửi?

## 🟠 Đúng đắn (`fe-hooks`, `fe-realtime`)
- [ ] Khớp hoặc hợp nhất tin nhắn chỉ theo `id`/`tempId`?
- [ ] `emit` cần phản hồi có ack và timeout, có trạng thái `failed` và retry?
- [ ] `useEffect` đủ dependency, không có stale closure?
- [ ] Có cleanup cho listener (`off` đúng handler), timer, object URL, media track, PeerConnection?
- [ ] Cờ loading reset đúng lúc, kể cả ở nhánh lỗi?
- [ ] Race condition: bấm hai lần, unmount giữa chừng, reconnect, token refresh đồng thời?
- [ ] WebRTC: `callId` gán trước khi tạo PC, chặn gọi trùng, `cleanupCall` gọi ở mọi nhánh?
- [ ] Bản copy ở app còn lại đã được sửa tương ứng?

## 🟡 Hiệu năng & độ bền
- [ ] Item list dài có `memo`, `key` ổn định (không `index`), handler ổn định?
- [ ] Không tạo object hay array mới gây render lại cả cây (đặc biệt state nhiều user ở admin)?
- [ ] Auto-scroll chỉ khi đang ở sát đáy?
- [ ] File lớn không bị đọc toàn bộ vào RAM khi tránh được?
- [ ] Có xử lý mất mạng, socket rớt, getUserMedia bị từ chối?

## 🔵 Kiến trúc & chất lượng (`fe-standards`, `fe-component`)
- [ ] Không có `any`/`as any` mới? Dữ liệu ngoài parse từ `unknown`?
- [ ] Component chỉ hiển thị, logic ở hook hoặc util thuần?
- [ ] Không thêm trách nhiệm mới vào `useChat`?
- [ ] Không thêm style inline mới? Chuỗi UI nằm trong file constants?
- [ ] Không có `console.log`, code chết, comment kiểu nhật ký?
- [ ] A11y: phần tử bấm được là `button`/`a`, modal có `role`, `Esc` và focus, icon button có `aria-label`?
- [ ] Đặt tên theo quy ước (`onXxx`/`handleXxx`, `is/has/can`)?

## ⚙️ Repo, CI, test (`fe-tooling`, `fe-testing`)
- [ ] Hàm thuần mới hoặc đã sửa có test? Bug fix có regression test?
- [ ] Thêm dependency có lý do và đã được đồng ý?
- [ ] Biến env mới có trong `.env.example` và `vite-env.d.ts`?
- [ ] `npm run build` pass ở mọi app bị ảnh hưởng?
