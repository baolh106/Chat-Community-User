---
name: fe-review
description: Review code front-end như một Senior FE cho Chat-Community-User - review diff hiện tại, một PR, một nhánh hoặc một file/thư mục trong user/ hoặc admin/. Phân loại phát hiện theo mức 🔴 Bảo mật, 🟠 Bug, 🟡 Hiệu năng, 🔵 Kiến trúc, ⚙️ Repo/CI. Dùng khi được yêu cầu review, kiểm tra trước merge, hoặc đánh giá chất lượng code FE.
---

# FE Review

Review theo chuẩn của `fe-standards` và các skill `fe-*` chuyên sâu. Mục tiêu là tìm vấn đề **có thật và hành động được**, không bắt bẻ phong cách.

## Xác định phạm vi
- Không có tham số: review `git diff` (gồm staged) so với `main`.
- Số PR: `gh pr diff <n>` và `gh pr view <n>`.
- Đường dẫn: review file hoặc thư mục đó.

## Quy trình
1. Đọc diff, rồi đọc **ngữ cảnh xung quanh** của từng hunk (hàm chứa nó, chỗ gọi, type liên quan). Không review chỉ dựa trên diff.
2. Với mỗi file đổi ở `user/`, kiểm tra file tương ứng ở `admin/` và ngược lại. Một bản sửa chỉ có ở một bên là một phát hiện.
3. Đi qua checklist ở [checklist.md](checklist.md).
4. **Tự kiểm chứng** từng phát hiện: lần theo luồng dữ liệu để chắc kịch bản lỗi xảy ra được. Phát hiện không chứng minh được thì bỏ, hoặc ghi rõ là "cần xác nhận".
5. Nếu được thì chạy `npm run build` (và lint, test nếu đã có) ở các app bị ảnh hưởng.

## Định dạng báo cáo

```
## Tóm tắt
<2-3 câu: thay đổi làm gì, đánh giá chung, có chặn merge không>

## Phát hiện
### 🔴 <tiêu đề ngắn>: `path/file.tsx:42`
- **Vấn đề:** ...
- **Kịch bản:** input hoặc trạng thái cụ thể dẫn tới kết quả sai
- **Đề xuất:** đoạn code hoặc hướng sửa

### 🟠 ...

## Điểm tốt
<những gì nên giữ, ngắn gọn>

## Verify
<build/lint/test đã chạy và kết quả, hoặc lý do không chạy>
```

- Sắp xếp theo mức độ: 🔴 → 🟠 → 🟡 → 🔵 → ⚙️.
- 🔴 và 🟠 chặn merge. 🟡 và 🔵 là đề xuất. Lỗi có sẵn từ trước (không do diff gây ra) ghi riêng vào mục "Có sẵn trước đó".
- Không liệt kê lỗi format mà Prettier tự sửa được.
- Viết bằng tiếng Việt, ngắn gọn, có `file:line` để bấm được.
