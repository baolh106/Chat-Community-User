---
name: fe-tooling
description: Hạ tầng và vệ sinh repo front-end cho Chat-Community-User - ESLint, Prettier, tsc, script npm, Vite config/env, .gitignore, dist/ bị commit, file lạc ở gốc, pipeline Jenkins (lint/test/build/deploy). Dùng khi cài lint/format, sửa build, cấu hình Vite, dọn repo hoặc chỉnh Jenkinsfile.
---

# FE Tooling & Repo Hygiene

Áp dụng cùng với `fe-standards`. Mọi thay đổi dependency, CI hoặc xoá file **phải được xác nhận với người dùng trước**.

## Hiện trạng
- Mỗi app có script `dev`, `build` (`tsc && vite build`), `preview`. Chưa có lint, format, test.
- `tsconfig` đã bật `strict`. Giữ nguyên và không nới lỏng.
- `vite.config.ts`: `loadEnv(mode, process.cwd())` mặc định chỉ đọc biến có tiền tố `VITE_`, nên `PORT` trong `.env` không có tác dụng. Muốn đọc thì dùng `loadEnv(mode, process.cwd(), '')`.
- Bản build gọi `/api` và `/socket.io` cùng origin, nên **bắt buộc có Nginx reverse proxy** khi deploy.
- `user/dist/` và `admin/dist/` đang bị commit. Gốc repo có file lạc (`package.json`, `package-lock.json`, `main.tsx`, `index.html`).
- `.gitignore` chặn `*.md` (trừ `README.md` và `.claude/skills/**/*.md`).

## ESLint + Prettier (mỗi app)
```bash
npm i -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh eslint-plugin-jsx-a11y prettier eslint-config-prettier globals
```
`eslint.config.js` (flat config) tối thiểu gồm:
- `js.configs.recommended`, `tseslint.configs.strictTypeChecked` (hoặc `recommendedTypeChecked` nếu quá nhiều lỗi lúc đầu)
- `react-hooks` với `rules-of-hooks: error` và `exhaustive-deps: error`
- `jsx-a11y` recommended
- Rule riêng của repo:
  - `@typescript-eslint/no-explicit-any: error`
  - `no-console: ['error', { allow: ['warn', 'error'] }]`
  - `react/no-danger` (hoặc `no-restricted-syntax` chặn `dangerouslySetInnerHTML`)
  - `no-restricted-globals` chặn `alert` và `confirm`
- `eslint-config-prettier` đặt cuối cùng.

`.prettierrc`: `{ "singleQuote": true, "semi": true, "printWidth": 100, "trailingComma": "all" }`.

Script: `"lint": "eslint ."`, `"format": "prettier --write src"`, `"typecheck": "tsc --noEmit"`.

Khi bật lint lần đầu trên code cũ: commit format riêng (chỉ Prettier), tách khỏi commit sửa lỗi lint. Lỗi nhiều thì tạm hạ một số rule xuống `warn` và ghi rõ là nợ kỹ thuật, không `eslint-disable` tràn lan.

## Dọn repo
- Thêm `dist/` vào `.gitignore` và chạy `git rm -r --cached user/dist admin/dist`.
- Xoá file lạc ở gốc sau khi xác nhận không có gì tham chiếu chúng.
- Cập nhật `README.md`: có hai app, cách chạy từng app, biến môi trường, yêu cầu Nginx proxy.

## Jenkins (`Jenkinsfile`)
Hướng cải thiện (tham chiếu mục 17 của file review):
- Thêm stage `lint` và `test` trước `build` cho mỗi app. Fail thì dừng deploy.
- Dùng `when { changeset "user/**" }` và `when { changeset "admin/**" }` để chỉ build app có thay đổi.
- Chạy user và admin bằng `parallel`.
- Không nội suy credential vào chuỗi Groovy (`"${TELEGRAM_TOKEN}"`). Dùng shell env với nháy đơn: `sh 'curl ... "$TELEGRAM_TOKEN"'`.

## Env
- Biến mới phải có trong `.env.example` kèm comment, và khai báo type trong `vite-env.d.ts`:
  ```ts
  interface ImportMetaEnv { readonly VITE_API_BASE: string; readonly VITE_RECAPTCHA_SITE_KEY: string; }
  ```
- Truy cập env qua một module `src/config.ts`, validate khi khởi động, không đọc `import.meta.env` rải rác.

## Verify
Sau mọi thay đổi tooling: `npm ci && npm run lint && npm test && npm run build` ở cả hai app.
