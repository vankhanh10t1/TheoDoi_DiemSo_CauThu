# FCON Performance Tracker

## Đội hình xuất phát và hiệu quả vị trí

Mỗi trận hỗ trợ lưu sơ đồ (`formation`) và ba tag tùy chọn `season`, `competition`, `matchType`; dữ liệu cũ không có tag hiển thị **Chưa phân loại**. Lịch sử và dashboard có thể lọc theo tag mà không làm dài flow nhập rating. Chạy `npm run db:migrate` để áp dụng các migration mới trước khi dùng tính năng.

## Tiếng Việt

Web app cá nhân để theo dõi phong độ cầu thủ bóng đá: quản lý đội hình, tạo trận, nhập rating, xem lịch sử phong độ và đưa ra khuyến nghị dựa trên dữ liệu trận đấu.

### Công nghệ

- Next.js 15 App Router, Route Handlers
- React 19, TypeScript strict
- Neon Postgres qua `@neondatabase/serverless`
- Vitest
- CSS trong `app/globals.css`

### Cơ sở dữ liệu

Runtime app hiện dùng Neon Postgres với 3 bảng chính:

- `players`: thông tin cầu thủ
- `matches`: thông tin trận đấu
- `match_ratings`: rating/thống kê của cầu thủ trong từng trận

View hỗ trợ:

- `v_player_match_history`: lịch sử phong độ theo cầu thủ, dùng cho status/recommendations

Mọi hoạt động database của backend đều dùng Neon/PostgreSQL. Repository không còn client, script hay dependency DynamoDB.

### Cài đặt local

```bash
npm install
```

Tạo `.env.local` từ `.env.example`:

```powershell
Copy-Item .env.example .env.local
```

Biến runtime bắt buộc:

```env
DATABASE_URL=postgresql://...
```

Chạy local:

```bash
npm run dev
```

Mở `http://localhost:3000`.

### Scripts

| Script | Công dụng |
| --- | --- |
| `npm run dev` | Chạy dev server |
| `npm test` | Chạy Vitest |
| `npm run build` | Build production và kiểm tra TypeScript |
| `npm start` | Chạy production sau khi build |
| `npm run db:migrate` | Áp dụng SQL migration chưa chạy |
| `npm run db:status` | Kiểm tra migration đã áp dụng/chờ chạy |
| `npm run db:seed` | Tạo dữ liệu mẫu ẩn danh với chốt an toàn dev/test |

### Vòng đời database

Schema có version nằm trong `database/migrations`. Với database mới, chạy `npm run db:migrate` rồi `npm run db:status` trước khi chạy app. Hướng dẫn index, view, seed an toàn, backup/restore, rollback và quy trình production nằm tại `database/README.md`. Không sửa migration đã áp dụng và không chạy thay đổi destructive khi chưa có backup đã kiểm thử.

### API chính

- Players: `/api/players`, `/api/players/{id}`, `/api/players/bulk-delete`, `/api/players/{id}/reset`
- Matches: `/api/matches`, `/api/matches/{id}`, `/api/matches/{id}/ratings`
- Analytics: `/api/player-status`, `/api/form-extremes`, `/api/recommendations`
- Player comparison: `POST /api/analytics/players/compare` nhận 2–4 `playerIds`, nhóm vị trí, cửa sổ 5/10/20 trận và khoảng ngày tùy chọn. Tab so sánh có radar SVG 0–100, metric theo trận, cỡ mẫu và cảnh báo dữ liệu yếu.

`POST /api/rating` là endpoint cũ và trả `410 Gone`.

### Luồng nhập và chỉnh sửa rating

- Form nhập rating gồm 3 bước: chọn cầu thủ, nhập chỉ số và xác nhận trước khi lưu.
- Rating mặc định để trống; chỉ chấp nhận giá trị từ 1 đến 10 với tối đa 1 chữ số thập phân.
- Bản nháp của trận hiện tại được tự động lưu trên thiết bị bằng `localStorage`, có thể khôi phục hoặc xóa. Bản nháp được xóa sau khi lưu thành công.
- Có thể sao chép danh sách cầu thủ từ trận gần nhất có rating; rating và các chỉ số cũ không được sao chép.
- Mỗi request lưu tối đa 49 rating. `POST /api/matches/{id}/ratings` upsert theo cặp match/cầu thủ nên chỉnh sửa không tạo rating trùng.
- Rating đã lưu có thể chỉnh sửa từ màn hình lịch sử trận; UI liên quan được tải lại mà không reload toàn trang.

### Logic đánh giá

Pipeline đánh giá nằm ở:

```text
lib/analytics/performance.ts
lib/evaluationEngine.ts
lib/recommendationService.ts
```

App chỉ đánh giá/khuyến nghị khi cầu thủ có ít nhất 3 trận. Người dùng có thể chọn thống nhất cửa sổ 5, 10 hoặc 20 trận ở trạng thái cầu thủ, form extremes và recommendation; WMA, trend, variance, momentum, risk và recommendation đều được tính lại theo số trận thực tế có trong cửa sổ. Mặc định vẫn là 5 trận. Mẫu dưới 5 trận có confidence thấp, hiển thị cảnh báo cỡ mẫu và chỉ đưa ra khuyến nghị theo dõi thay vì kết luận mạnh.

Kết quả trả kèm breakdown cho WMA, rating trung bình, trend, variance, momentum, discipline, risk và cỡ mẫu. Giao diện hiển thị giá trị, ý nghĩa, chiều tác động và contribution khi có trọng số. Tín hiệu nhạy cảm được trình bày trung lập là “Cảnh báo bất thường”/“Cần theo dõi thêm”; đây không phải kết luận về hành vi của cầu thủ.

Backtest dùng phương pháp walk-forward: mỗi rating thực tế chỉ được so với dự đoán tạo từ các trận xảy ra trước nó. Các metric gồm MAE, số mẫu, prediction trung bình và rating thực tế trung bình; cần tối thiểu 4 trận để có mẫu đầu tiên.

### Deploy Vercel

1. Thêm `DATABASE_URL` vào Vercel Project Settings -> Environment Variables.
2. Chọn đúng môi trường `Production`, `Preview`, `Development` nếu cần.
3. Redeploy project sau khi thêm biến môi trường.
4. Trước khi deploy nên chạy:

```bash
npm test
npm run build
```

### Lưu ý an toàn

- Không commit `.env`, `.env.local`, connection string Neon hoặc AWS credentials.
- Chỉ cấu hình `DATABASE_URL`; không thêm lại AWS/DynamoDB credentials vào backend.
- App hiện chưa có đăng nhập/phân quyền; nếu public rộng rãi cần bổ sung lớp bảo vệ.

---

## English

A personal web app for tracking football player performance: manage squads, create matches, enter ratings, review form history, and generate recommendations from match data.

### Tech Stack

- Next.js 15 App Router and Route Handlers
- React 19, strict TypeScript
- Neon Postgres via `@neondatabase/serverless`
- Vitest
- Plain CSS in `app/globals.css`

### Database

The runtime app currently uses Neon Postgres with 3 core tables:

- `players`: player metadata
- `matches`: match metadata
- `match_ratings`: per-player ratings and stats for each match

Supporting view:

- `v_player_match_history`: player form history used by status and recommendation APIs

All backend database activity uses Neon/PostgreSQL. The repository no longer contains a DynamoDB client, scripts, or dependencies.

### Local Setup

```bash
npm install
```

Create `.env.local` from `.env.example`:

```powershell
Copy-Item .env.example .env.local
```

Required runtime variable:

```env
DATABASE_URL=postgresql://...
```

Run locally:

```bash
npm run dev
```

Open `http://localhost:3000`.

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm test` | Run Vitest |
| `npm run build` | Build production and check TypeScript |
| `npm start` | Run production after build |
| `npm run db:migrate` | Apply pending versioned SQL migrations |
| `npm run db:status` | Show applied and pending migrations |
| `npm run db:seed` | Add anonymous samples with the dev/test safety latch |

### Database lifecycle

Versioned schema lives in `database/migrations`. For a new database, run `npm run db:migrate` and then `npm run db:status` before starting the app. See `database/README.md` for indexes, views, safe seed data, backup/restore, rollback, and the production procedure. Never edit an applied migration or run destructive changes without a tested backup.

### Main APIs

- Players: `/api/players`, `/api/players/{id}`, `/api/players/bulk-delete`, `/api/players/{id}/reset`
- Matches: `/api/matches`, `/api/matches/{id}`, `/api/matches/{id}/ratings`
- Analytics: `/api/player-status`, `/api/form-extremes`, `/api/recommendations`

`POST /api/rating` is deprecated and returns `410 Gone`.

### Rating entry and editing

Rating entry now uses a three-step player selection, stat entry, and review flow. Ratings start empty, drafts are autosaved per match in local storage, and the latest available lineup can be copied without copying old stats. A save accepts at most 49 unique players and upserts by match/player, so editing an existing rating does not create duplicates.

### Evaluation Logic

The evaluation pipeline lives in:

```text
lib/analytics/performance.ts
lib/evaluationEngine.ts
lib/recommendationService.ts
```

The app only evaluates/recommends players with at least 3 matches. Users can select a 5-, 10-, or 20-match analysis window (default: 5); WMA, trend, variance, momentum, risk, and recommendations are recalculated for the actual sample. Responses include an explainability breakdown and a leakage-safe walk-forward backtest with MAE and sample averages. Sensitive signals use neutral monitoring language and must not be interpreted as proof of misconduct.

Phase 2 adds selectable `WMA` and `Decay` profiles. Ratings from short appearances remain visible but receive lower weight and confidence; legacy records without minutes safely fall back to 90 minutes. Raw event totals are retained, while per-90 values require at least 270 minutes. Basic GK/DF/MF/FW profiles vary stability, discipline, rating, and momentum emphasis. Player status, form extremes, recommendations, dashboard analytics, and match history share optional `season`, `competition`, and `matchType` filters. Weak samples return `Chưa đủ cơ sở để khuyến nghị` instead of a strong lineup decision.

### Vercel Deployment

1. Add `DATABASE_URL` in Vercel Project Settings -> Environment Variables.
2. Select `Production`, `Preview`, and/or `Development` as needed.
3. Redeploy after adding the environment variable.
4. Before deploying, run:

```bash
npm test
npm run build
```

### Safety Notes

- Do not commit `.env`, `.env.local`, Neon connection strings, or AWS credentials.
- Configure only `DATABASE_URL`; do not reintroduce AWS/DynamoDB credentials into the backend.
- The app currently has no authentication/authorization; add protection before making it broadly public.

### Dashboard xu hướng (20/08/2026)

Dashboard cầu thủ có biểu đồ SVG responsive cho rating, WMA và dự đoán hiện tại; KPI kết quả, bàn thắng và kiến tạo cập nhật theo 5, 10, 20 trận hoặc khoảng ngày tùy chọn. Biểu đồ dùng analytics sẵn có nên không bổ sung chart dependency. Toàn bộ giao diện dùng Roboto qua `next/font/google`.

### Match history API update (20/08/2026)

`GET /api/matches` uses server-side pagination and supports `page`, `pageSize`, `search`, `opponent`, `result`, `playerId`, `dateFrom`, `dateTo`, `season`, `competition`, `matchType`, `sortBy=date|rating`, and `sortOrder=asc|desc`. The response includes `items`, `page`, `pageSize`, `total`, and `totalPages`; `matches` remains as a compatibility alias. `POST` and `PATCH` accept the three optional match tags with an 80-character limit. `PATCH` is partial: omitting `matchDate` and `matchDateTime` preserves the stored date, time, and datetime (including legacy rows); sending either date field validates it and rebuilds the related values when needed.

### Phase 3 backtest (20/08/2026)

Run `npm run analytics:backtest` to compare `current-heuristic`, `last-rating`, `rolling-average`, and `wma-only` on identical leakage-safe samples for windows 5/10/20. The command only reads the anonymous fixture; it does not connect to or mutate the production database. It writes grouped MAE, mean error, sample size, skipped-target details, and the tuning assessment to `reports/backtest-player-evaluation.md` and JSON.
