---
name: commit
description: Đóng gói thay đổi hiện tại của repo FE (user/, admin/) thành commit theo Conventional Commits, push lên remote và tạo Pull Request vào develop. Chỉ chạy khi người dùng gõ /commit.
argument-hint: "[gợi ý nội dung/scope] [--base <nhánh>] [--no-pr]"
disable-model-invocation: true
---

# /commit — commit, push và tạo PR theo Conventional Commits

Tham số từ người dùng (có thể rỗng): `$ARGUMENTS`

- `--base <nhánh>`: nhánh đích của PR. Mặc định **`develop`**.
- `--no-pr`: chỉ commit + push, không tạo PR.
- Phần chữ còn lại: gợi ý type/scope/subject cho commit.

Mục tiêu: kiểm tra → gom thay đổi thành commit đúng convention → push → **output cuối cùng là một PR** vào nhánh base. Dừng và báo lại ngay khi một bước chặn thất bại; không tìm cách lách.

Repo có **hai app độc lập**, mỗi app có `package.json` riêng: `user/` và `admin/`. Không có `package.json` ở gốc, nên mọi lệnh npm chạy trong thư mục app.

## 1. Khảo sát

Chạy song song:
- `git fetch origin --prune`
- `git status --porcelain=v1 -b`
- `git diff --stat HEAD` và `git ls-files --others --exclude-standard`
- `git log --oneline -10` (tham khảo cách đặt scope gần đây)
- `git rev-parse --abbrev-ref --symbolic-full-name @{u}` (nhánh đã có upstream chưa)
- `git config user.name` / `git config user.email`. Chưa có thì hỏi người dùng danh tính, kèm hai lựa chọn: lưu vào config của repo, hay chỉ truyền qua `git -c user.name=… -c user.email=… commit` cho phiên này. Không tự ghi config.

Nếu không có thay đổi chưa commit **và** không có commit nào chưa vào `origin/<base>` → báo "không có gì để commit/PR" rồi dừng. Nếu không có thay đổi nhưng còn commit chưa có PR → bỏ qua bước 3–6, đi thẳng bước 7.

Từ danh sách file thay đổi, xác định **app bị ảnh hưởng**:
- Có file dưới `user/` → app `user`
- Có file dưới `admin/` → app `admin`
- Chỉ có file ở gốc (`Jenkinsfile`, `README.md`, `.gitignore`, `.claude/`) → không app nào; bỏ qua bước 4.1

## 2. Chọn nhánh

- Đang ở `main` hoặc `<base>` (mặc định `develop`) → **không commit thẳng**. Tạo nhánh mới `<type>/<slug-ngắn>` (vd. `fix/message-retry`) **từ `origin/<base>`**, mang theo thay đổi đang làm:
  `git switch -c <type>/<slug> origin/<base>`.
  Lệnh lỗi vì xung đột với thay đổi local → dừng và báo người dùng. Không tự stash hay reset.
- Đang ở nhánh tính năng (`feat/...`, `fix/...`, `refactor/...`, …) → dùng nhánh hiện tại. Kiểm tra `git log --oneline origin/<base>..HEAD`: nếu có commit không thuộc thay đổi này (vd. commit chỉ có ở `main`) → cảnh báo trong báo cáo và trong mô tả PR.
- Đang giữa rebase/merge/cherry-pick hoặc detached HEAD → dừng, báo người dùng.

## 3. Chặn file không được commit

Không bao giờ stage: `.env`, `.env.*` (trừ `.env.example`), `*.bak`, `*.pem`, `*.key`, `dist/`, `node_modules/`, `coverage/`, `*.local`, file trong scratchpad, `Chat-Community-FE-Review.md` và các file `.md` khác bị `.gitignore` chặn.

Quét diff sắp commit (kể cả file untracked) tìm secret. Chỉ in tên file và số dòng, **không** in giá trị:
- `-----BEGIN .*PRIVATE KEY-----`
- `AIza[0-9A-Za-z_-]{35}` (Google API key)
- token Telegram `\d{8,10}:[A-Za-z0-9_-]{35}`
- `AKIA[0-9A-Z]{16}`
- `gh[pousr]_[A-Za-z0-9]{36}`
- `VITE_TURN_CREDENTIAL=\S+` hoặc `VITE_TURN_USERNAME=\S+` có giá trị trong `.env.example`. File mẫu chỉ được để trống; mọi `VITE_*` đều vào bundle nên credential thật không được nằm trong repo.

Có kết quả → dừng, báo người dùng.

## 4. Kiểm tra chất lượng (giống CI Jenkins)

### 4.1 Lệnh kiểm tra
Với **từng app bị ảnh hưởng**, chạy lần lượt trong thư mục app. Dừng ở lỗi đầu tiên và báo nguyên văn phần lỗi.

Nếu chưa có `node_modules` thì chạy `npm ci` trước. Không dùng `npm install`, vì nó sửa lockfile.

1. `npm run typecheck`
2. `npm run lint` (phải 0 error; warning a11y đang được chấp nhận tạm, báo số lượng trong báo cáo)
3. `npm test`
4. `npm run build`

Không dùng `--no-verify`, không tắt test hay lint, không thêm `eslint-disable` để cho qua.

### 4.2 Quét dòng thêm mới
Quét các dòng **thêm mới** (`^\+`) trong file `.ts`/`.tsx`, kể cả file untracked (qua `git diff --no-index /dev/null <file>`):
- `\.only\(` hoặc `\.skip\(` trong file test → xóa, chạy lại 4.1.
- `debugger;` → xóa.
- `console\.log\(` → đổi sang `debugLog` (`utils/logger.ts`) hoặc xóa. Lint cũng bắt lỗi này, nhưng có thể bị `eslint-disable` che đi.

### 4.3 File dùng chung giữa hai app
Các file sau đang được giữ **giống hệt nhau** ở `user/src` và `admin/src`, chờ gom vào `packages/shared`:
- `hooks/`: tất cả, **trừ** `useChat.ts`, `useChat.test.ts`, `useMessages.ts`, `useConversations.ts`, `useVideoCall.ts`
- `utils/`: tất cả, **trừ** `api.ts`
- `types/socket.ts`
- `test/`

Với mỗi file loại này có trong diff, chạy `cmp user/src/<f> admin/src/<f>`. Nếu khác nhau thì dừng và hỏi người dùng: đồng bộ bản còn lại, hay cố ý để lệch. Nếu cố ý lệch thì ghi rõ trong body commit và mô tả PR.

## 5. Gom thành commit

Mỗi commit là một thay đổi logic, và **mỗi commit phải tự build được** ở mọi app nó chạm vào. Nếu diff gồm nhiều mối quan tâm độc lập (vd. sửa bug tin nhắn + Jenkinsfile + skill), tách thành nhiều commit, stage theo file (`git add <paths>`; không dùng `git add -p`). Một thay đổi áp cho cả hai app (thường gặp) → **một commit chung**, không tách theo app. Test đi cùng commit của code nó kiểm tra. `package.json` và `package-lock.json` của cùng app luôn đi cùng nhau.

Luôn stage theo đường dẫn cụ thể, không dùng `git add -A` hay `git add .`.

## 6. Viết commit message

```
<type>(<scope>): <subject>

<body>

<footer>
```

- **type** (bắt buộc): `feat` · `fix` · `refactor` · `perf` · `test` · `docs` · `chore` · `ci` · `build` · `style` · `revert`
  - `build`: package.json / lockfile / vite.config · `ci`: Jenkinsfile · `chore`: eslint/prettier config, .gitignore, .env.example, skill trong `.claude/`
  - `style` chỉ dành cho format thuần (Prettier). Đổi CSS giao diện là `feat`/`fix` với scope `ui`.
  - Dùng `docs` (không dùng `doc`), không viết sai type (`faet`).
- **scope** (nên có, chữ thường):
  - `user`, `admin` — chỉ một app bị ảnh hưởng và không thuộc module bên dưới
  - `message` (soạn/gửi/hiển thị tin, attachment), `socket` (kết nối, hợp đồng event), `call` (WebRTC, chuông), `auth` (đăng nhập, phiên, reCAPTCHA), `ui` (component, CSS, a11y), `shared` (file dùng chung hai app), `deps`, `config`, `ci`, `skills`
  - Nhiều module thì chọn module chính hoặc bỏ scope.
- **subject**: tiếng Anh, thể mệnh lệnh, chữ thường đầu câu, không có dấu chấm cuối, ≤ 72 ký tự.
- **body** (khi thay đổi không hiển nhiên): gạch đầu dòng, nói *tại sao* và ảnh hưởng, ngắt dòng ~72 ký tự. Ghi rõ app nào bị ảnh hưởng nếu chỉ một app.
- **footer**:
  - Đổi hợp đồng socket/REST, biến env, hoặc yêu cầu deploy/Nginx/BE phải đổi theo → `BREAKING CHANGE: <mô tả>` và thêm `!`: `feat(socket)!: ...`.
  - Dòng attribution `Co-Authored-By: ...` theo hướng dẫn attribution của phiên hiện tại (nếu có).

Ghi message ra file tạm trong scratchpad rồi chạy `git commit -F <file>`. Sau mỗi commit chạy `git log -1 --format='%h %s'` để xác nhận.

## 7. Push

- Chưa có upstream → `git push -u origin HEAD`. Có rồi → `git push`.
- **Không bao giờ** dùng `--force`/`--force-with-lease`, không push thẳng `main` hay `<base>`.
- Push bị từ chối (non-fast-forward) → dừng, đề xuất `git pull --rebase`; không tự rebase.
- Lỗi xác thực/mạng → báo nguyên văn. Commit vẫn nằm local, không tạo PR.

## 8. Tạo Pull Request vào `<base>` (bỏ qua nếu `--no-pr`)

### 8.1 Kiểm tra trước
- `git log --oneline origin/<base>..HEAD` rỗng → nhánh đã nằm trong base (PR cũ đã merge) → báo lại, không tạo PR.
- Đã có PR đang mở cho nhánh này → không tạo trùng. Cập nhật title/body nếu công cụ cho phép, nếu không thì đưa link PR có sẵn.

### 8.2 Title
- Đúng Conventional Commits, ≤ 72 ký tự, tiếng Anh, dễ hiểu với người không đọc code.
- Một commit → dùng subject của commit đó. Nhiều commit → chọn type/scope của thay đổi chính và tóm tắt cả nhóm (vd. `refactor: split useChat and fix message delivery per FE review`).
- Có breaking change → giữ `!`.

### 8.3 Description (tiếng Việt, ngắn gọn nhưng đủ)

```markdown
## Tóm tắt
<1–2 câu: thay đổi gì, vì sao>

## App bị ảnh hưởng
- user ✅/— · admin ✅/—

## Thay đổi chính
- <nhóm theo chủ đề: Bảo mật / Bug / Tính năng / Refactor / Hạ tầng…, mỗi gạch một ý>

## ⚠️ Breaking changes
- <chỉ khi có; ghi rõ BE/deploy/người dùng phải làm gì>

## Thay đổi hành vi người dùng thấy
- <vd. đóng tab là mất phiên, tin lỗi có nút gửi lại — bỏ mục nếu không có>

## Cần làm khi deploy
- <biến env mới (VITE_*), cấu hình Nginx, việc BE cần làm — bỏ mục nếu không có>

## Kiểm tra
- user: typecheck ✅/❌ · lint ✅/❌ (<n> warning) · test <pass>/<total> · build ✅/❌
- admin: typecheck ✅/❌ · lint ✅/❌ (<n> warning) · test <pass>/<total> · build ✅/❌
- <những gì CHƯA kiểm được, nói thẳng; vd. chưa chạy trên trình duyệt với BE thật>

## Commits
- `<hash>` <subject>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Bỏ mục không có nội dung. Dòng cuối là attribution PR theo hướng dẫn của phiên (nếu phiên quy định khác thì theo phiên). Ghi body ra file trong scratchpad.

### 8.4 Cách tạo (thử theo thứ tự)
1. **`gh` có sẵn và đã đăng nhập** (`gh auth status`):
   `gh pr create --base <base> --head <branch> --title "<title>" --body-file <file>`.
   Nếu PR đã tồn tại thì dùng `gh pr edit <branch> --title ... --body-file ...`.
2. **Biến môi trường `GH_TOKEN` hoặc `GITHUB_TOKEN` đã đặt** (chỉ kiểm tra có/không, không in giá trị): gọi API bằng `curl`
   `POST https://api.github.com/repos/<owner>/<repo>/pulls` với JSON `{ "title", "head": "<branch>", "base": "<base>", "body" }`. Dựng JSON bằng `node -e` để escape đúng. Header: `Authorization: Bearer $GH_TOKEN`, `Accept: application/vnd.github+json`. Lỗi 422 "A pull request already exists" → coi như PR đã có.
3. **Không có cả hai** → không tự lấy token từ credential manager. Tạo link mở form PR đã điền sẵn:
   `https://github.com/<owner>/<repo>/compare/<base>...<branch>?quick_pull=1&title=<urlencoded>&body=<urlencoded>`
   (encode bằng `node -e "console.log(encodeURIComponent(...))"`). Link dài hơn 8000 ký tự → rút gọn body (giữ Tóm tắt, Breaking changes, Kiểm tra) và đưa body đầy đủ trong báo cáo để dán. Gợi ý một lần: cài `gh` (`winget install GitHub.cli` rồi `gh auth login`) để lần sau PR được tạo tự động.

`<owner>/<repo>` lấy từ `git remote get-url origin`.

## 9. Báo cáo

Ngắn gọn, gồm:
- **PR**: link PR (hoặc link form đã điền sẵn, và nói rõ cần bấm "Create pull request"), base ← head.
- Danh sách commit (`hash subject`), kết quả push.
- Kết quả typecheck / lint / test / build theo từng app (số test pass, số warning lint).
- File cố ý KHÔNG commit (vd. `.env`, `Chat-Community-FE-Review.md`) nếu có.
- File dùng chung cố ý để lệch giữa hai app (bước 4.3) nếu có.
- Cảnh báo nếu PR kéo theo commit ngoài ý muốn (bước 2).
