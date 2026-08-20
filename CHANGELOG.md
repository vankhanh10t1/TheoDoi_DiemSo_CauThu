# Nhật ký thay đổi

## 20/08/2026 - Nhập sơ đồ tùy chỉnh

- Công việc đã làm: khi chọn `Tùy chỉnh`, form hiển thị ô nhập các sơ đồ như `4-5-1`, `4-1-4-1`, `4-3-3-0` hoặc `3-2-4-1`.
- Cách xử lý: chuẩn hóa khoảng trắng, kiểm tra 3–5 tuyến phân cách bằng dấu `-` và tổng số cầu thủ bằng 10 ở cả client lẫn API.
- File liên quan: `lib/formation.ts`, hai form tạo trận, API tạo/sửa trận và `tests/formation.test.ts`.

## 20/08/2026 - Đội hình xuất phát và hiệu quả vị trí

- Công việc đã làm: thêm sơ đồ trận, vị trí theo trận, đá chính/dự bị, phút thi đấu/phút thay người; mở rộng form, API upsert, lịch sử cầu thủ và analytics 5/10/20 trận theo vị trí/sơ đồ.
- Bug gặp phải: dữ liệu cũ không có lineup và khóa rating hiện tại phải tiếp tục chống trùng.
- Cách xử lý: migration dùng cột nullable/default an toàn, fallback đá chính cho bản ghi cũ, giữ khóa chính `(match_id, player_id)`, validate 0–120 phút ở API và cảnh báo mẫu dưới 3.
- File/khu vực liên quan: `database/migrations/003_starting_lineup.sql`, `lib/types.ts`, `lib/matchService.ts`, `lib/playerService.ts`, `lib/analytics/lineup.ts`, `app/api/matches/**`, `app/api/analytics/lineup`, `components/**`.
- Ghi chú: chưa triển khai kéo-thả sân bóng; dành cho phase sau.

## 20/08/2026 - So sánh cầu thủ

- Công việc đã làm: thêm tab so sánh 2–4 cầu thủ cùng nhóm vị trí, bộ lọc 5/10/20 trận hoặc khoảng ngày, radar SVG, bảng metric có highlight, mở chi tiết và endpoint batch `POST /api/analytics/players/compare`.
- Bug gặp phải: analytics chỉ khai báo cửa sổ 5/10 trận; gọi từng cầu thủ có nguy cơ N+1 query; metric tổng gây bất lợi khi số trận lệch nhau.
- Cách xử lý: mở rộng cửa sổ lên 20; đọc metadata và lịch sử theo mảng ID bằng batch query; dùng metric theo trận và cảnh báo cỡ mẫu yếu/chênh lệch.
- File/khu vực liên quan: `components/player-comparison.tsx`, `components/app-shell.tsx`, `components/app-context.tsx`, `app/api/analytics/players/compare/route.ts`, `lib/analytics/**`, `lib/playerService.ts`, `lib/types.ts`, `app/globals.css`, `README.md`.
- Ghi chú: radar dùng SVG thuần React, không thêm dependency; kết quả mẫu nhỏ không phải kết luận tuyệt đối.

## 20/08/2026 - Chuẩn hóa tài liệu và vòng đời Neon/PostgreSQL

- Công việc đã làm: đồng bộ `README.md`/`FEATURES.md` theo runtime Neon; thêm baseline SQL có version, migration status, hướng dẫn bootstrap/deploy/backup/restore/rollback, index/view/constraint và seed dev ẩn danh có chốt an toàn.
- Bug gặp phải: schema trước đây chỉ có thể suy ra từ query và script import; seed là no-op; `FEATURES.md` vẫn mô tả DynamoDB là runtime; chưa có lịch sử migration trong database.
- Cách xử lý: tạo `database/migrations/001_baseline.sql`, bảng `schema_migrations`, runner transaction qua Neon, `db:migrate`/`db:status`/`db:seed`; xóa AWS SDK cùng toàn bộ helper/script DynamoDB để backend chỉ còn Neon/PostgreSQL.
- File/khu vực liên quan: `database/**`, `scripts/db-migrate.ts`, `scripts/seed.ts`, `README.md`, `FEATURES.md`, `.env.example`, `package.json` và `package-lock.json`.
- Ghi chú: không kết nối hoặc thay đổi production; cấu hình retention/point-in-time restore theo Neon plan và độ khớp baseline với database đang tồn tại **cần xác minh thêm** trước lần apply production đầu tiên. `npm test` pass 39/39 và `npm run build` thành công.

### Sửa lỗi migration runner

- Bug gặp phải: runner tách SQL tại mọi dấu chấm phẩy, bao gồm dấu chấm phẩy trong comment, khiến Neon nhận fragment `also supports...` và trả lỗi cú pháp `42601`.
- Cách xử lý: chuyển sang delimiter tường minh `-- statement-breakpoint`; toàn bộ DDL và bản ghi migration tiếp tục chạy trong cùng một transaction.
- Ghi chú: lần chạy lỗi rollback transaction của `001_baseline.sql`; chỉ bảng theo dõi rỗng `schema_migrations` có thể đã được tạo trước transaction.
- Bug tiếp theo trên branch thử nghiệm: view hiện hữu có 24 cột trong khi baseline khai báo tập cột ngắn hơn, nên PostgreSQL từ chối `CREATE OR REPLACE VIEW` với lỗi `42P16`.
- Cách xử lý: đối chiếu metadata chỉ đọc và giữ nguyên đầy đủ contract 24 cột của view hiện hữu trong baseline; xác nhận trước khi sửa có 34 players, 77 matches và 279 ratings.
- Đối soát dữ liệu: không có rating ngoài `1–10`, tên chuẩn hóa trùng hoặc khóa ngoại mồ côi; bổ sung migration `002_rating_constraint.sql` để đồng bộ constraint database với validation của app.

## 20/08/2026 - Minh bạch hóa và hiệu chỉnh đánh giá phong độ

- Công việc đã làm: bổ sung cửa sổ phân tích 5/10 trận; truyền lựa chọn từ UI qua API vào toàn bộ pipeline WMA, trend, variance, momentum, risk và recommendation; thêm breakdown theo từng yếu tố, bảng dữ liệu đầu vào có thể thu gọn và backtest walk-forward với MAE, số mẫu, prediction/rating trung bình.
- Bug gặp phải: API cắt cứng 5 trận trước analytics trong khi WMA chỉ dùng 3 điểm; test cũ phụ thuộc cách tính này và nhãn `Fraud`; dữ liệu lịch sử không lưu prediction theo từng trận.
- Cách xử lý: gom cấu hình cửa sổ vào `lib/analytics/config.ts`, mở rộng WMA theo toàn bộ cửa sổ với trọng số giảm dần, giữ các key `fraudRisk`/`fraudReasons` nội bộ để không phá dữ liệu cũ nhưng thay toàn bộ nhãn hiển thị bằng ngôn ngữ trung lập; dựng prediction lịch sử theo walk-forward từ dữ liệu có trước mỗi trận.
- File/khu vực liên quan: `lib/analytics/**`, `lib/prediction/**`, `lib/risk/**`, `lib/recommendation/**`, `lib/types.ts`, `lib/evaluationEngine.ts`, `app/api/player-status/route.ts`, `components/player-detail.tsx`, `components/tracker-app.tsx`, `app/globals.css`, `tests/**`, `README.md`, `CHANGELOG.md`.
- Ghi chú: backtest cần ít nhất 4 trận để tạo mẫu đầu tiên; UI luôn ghi rõ số trận thực tế được phân tích khi cầu thủ có ít dữ liệu hơn cửa sổ đã chọn; `npm test` pass 39/39 và `npm run build` thành công.

## 20/08/2026 - Nâng cấp luồng rating

- Công việc đã làm: chia form rating thành 3 bước; bỏ rating mặc định 5; thêm tìm kiếm/chọn tất cả, cảnh báo giới hạn 49, bảng xác nhận, trạng thái loading/error/success, autosave/khôi phục/xóa draft và copy đội hình từ trận gần nhất mà không copy chỉ số.
- Công việc backend: bổ sung kiểm tra player trùng trong payload, giữ giới hạn 49 và chuẩn hóa thông báo validation tiếng Việt; cơ chế upsert hiện có tiếp tục hỗ trợ chỉnh sửa rating không tạo duplicate.
- Bug gặp phải: dữ liệu draft có thể không hợp lệ hoặc `localStorage` không khả dụng; copy đội hình có nguy cơ ghi đè dữ liệu đang nhập.
- Cách xử lý: bọc toàn bộ thao tác local storage bằng cơ chế an toàn, kiểm tra version/match của draft và dùng hộp thoại xác nhận nội bộ trước khi thay đội hình.
- File/khu vực liên quan: `components/bulk-rating-input-form.tsx`, `app/api/matches/[id]/ratings/route.ts`, `app/globals.css`, `README.md`, `CHANGELOG.md`.
- Ghi chú: `npm test` pass 38/38 test và `npm run build` thành công.

## 20/08/2026

- Công việc đã làm: thêm dashboard xu hướng rating/WMA/prediction, KPI thắng-hòa-thua, bàn thắng, kiến tạo và bộ lọc 5/10/20 trận hoặc khoảng ngày; đổi font toàn app sang Roboto.
- Bug gặp phải: lịch sử API trả dữ liệu mới nhất trước, trong khi biểu đồ cần hiển thị từ cũ đến mới; một số cầu thủ không có đủ dữ liệu prediction.
- Cách xử lý: sắp xếp bằng helper thời gian hiện tại trước khi dựng chuỗi, tính WMA cuộn theo đúng thứ tự đầu vào của analytics, và chỉ vẽ prediction khi giá trị hợp lệ.
- File/khu vực liên quan: `components/trend-dashboard.tsx`, `components/tracker-app.tsx`, `app/layout.tsx`, `app/globals.css`, `README.md`.
- Ghi chú: chart dùng SVG thuần React, không thêm dependency; có empty state và tooltip native.
