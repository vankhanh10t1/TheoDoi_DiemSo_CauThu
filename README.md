# FCON Performance Tracker

Ứng dụng web theo dõi phong độ cầu thủ bóng đá, quản lý đội hình, tạo trận, nhập điểm đánh giá và đưa ra khuyến nghị dựa trên dữ liệu lưu trong AWS DynamoDB.

## Công nghệ

- Next.js 15 App Router và Route Handlers
- React 19, React Context và TypeScript strict
- AWS SDK for JavaScript v3, DynamoDB single-table
- Vitest
- CSS thuần trong `app/globals.css`

## Tính năng chính

- Quản lý cầu thủ và đội hình.
- Tạo trận, nhập rating hàng loạt và lưu rating theo hai chiều match/player.
- Xem lịch sử trận và lịch sử điểm cầu thủ, sắp xếp theo thời gian trận đấu.
- Evaluation Flow với WMA, xu hướng, biến động, momentum, dự đoán, rủi ro và kỷ luật.
- Xem chi tiết cầu thủ từ Đội hình và Phong độ.
- Khuyến nghị `KEEP`, `MONITOR`, `BENCH`, `SELL`, `REPLACE`.
- Reset hoặc xóa dữ liệu cầu thủ và đồng bộ rating liên quan.
- Audit/reconciliation dữ liệu DynamoDB theo chế độ dry-run mặc định.
- Chỉ đánh giá và tạo khuyến nghị khi cầu thủ có ít nhất 3 trận.

## Cài đặt

Yêu cầu Node.js 20 LTS hoặc phiên bản tương thích Next.js 15.

```bash
npm install
```

Tạo `.env.local` từ `.env.example`:

```powershell
Copy-Item .env.example .env.local
```

## Biến môi trường

| Biến | Bắt buộc | Mô tả |
| --- | --- | --- |
| `AWS_ACCESS_KEY_ID` | Có | AWS access key, không commit giá trị thật |
| `AWS_SECRET_ACCESS_KEY` | Có | AWS secret key, không commit giá trị thật |
| `AWS_REGION` | Có | Region chứa bảng DynamoDB |
| `DYNAMODB_TABLE_NAME` | Có* | Tên bảng DynamoDB |
| `DYNAMODB_TABLE` | Có* | Alias tương thích cho tên bảng |
| `DYNAMODB_LIST_INDEX_NAME` | Không | GSI tùy chọn để đọc danh sách cầu thủ |

\* Chỉ cần cấu hình một trong `DYNAMODB_TABLE_NAME` hoặc `DYNAMODB_TABLE`.

IAM dùng cho app cần các quyền DynamoDB phù hợp như `GetItem`, `PutItem`, `UpdateItem`, `DeleteItem`, `Query`, `Scan` và `BatchWriteItem` trên bảng mục tiêu.

## Chạy local

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm test
npm run build
npm start
npm run audit:data
```

| Script | Công dụng |
| --- | --- |
| `npm run dev` | Chạy development server |
| `npm test` | Chạy unit tests Vitest |
| `npm run build` | Build production và kiểm tra TypeScript |
| `npm start` | Chạy production server sau khi build |
| `npm run audit:data` | Audit DynamoDB ở chế độ dry-run, không ghi/xóa |
| `npm run audit:data -- --verbose` | Hiển thị toàn bộ chi tiết audit |
| `npm run audit:data -- --fix` | Áp dụng các sửa chữa an toàn, không tự xóa orphan |
| `npm run seed` | Script seed no-op, không tạo mock data |

Luôn chạy audit dry-run và xem summary trước khi dùng `--fix`. Fix mode chỉ:

- backfill `MatchDateTime` khi có `MatchDate` hợp lệ;
- bổ sung rating/history đối ứng khi match và player đều tồn tại;
- đồng bộ player history từ match-rating canonical;
- sửa `RatingCount`.

Các rating tham chiếu player/match đã bị xóa chỉ được báo cáo, không tự động xóa hoặc phục hồi.

## DynamoDB single-table

| Loại item | PK | SK |
| --- | --- | --- |
| Metadata cầu thủ | `PLAYER#{playerId}` | `METADATA` |
| Khóa giữ tên cầu thủ | `PLAYER_NAME#{normalizedName}` | `RESERVATION` |
| Lịch sử rating theo cầu thủ | `PLAYER#{playerId}` | `MATCH#{matchId}` |
| Metadata trận | `MATCH#{matchId}` | `METADATA` |
| Rating theo trận | `MATCH#{matchId}` | `RATING#{playerId}` |

Match-rating là nguồn canonical khi reconciliation. Khi lưu/xóa rating riêng lẻ, app dùng DynamoDB transaction cho cả hai chiều, `RatingCount` và optimistic `RatingVersion`. Dữ liệu cũ thiếu `MatchDateTime` vẫn fallback sang `MatchDate`, `CreatedAt`, `UpdatedAt` hoặc sort key legacy.

Tên cầu thủ được chuẩn hóa bằng `trim().toLowerCase()` và giữ bằng reservation key trong cùng transaction create/update. Audit `--fix` có thể backfill reservation cho tên legacy duy nhất; tên legacy bị trùng chỉ được báo cáo.

Thời gian hiển thị dùng múi giờ `Asia/Ho_Chi_Minh`. Timestamp UTC được giữ nguyên khi lưu và convert khi hiển thị.

## Recommendation

Nguồn recommendation canonical là:

```text
lib/analytics/performance.ts
  -> lib/recommendation/index.ts
```

Evaluation Flow, chi tiết cầu thủ và API transfer recommendation đều sử dụng kết quả từ cùng pipeline `analyzeRecentMatches`. `lib/recommendationService.ts` chỉ làm nhiệm vụ map dữ liệu DynamoDB và xếp hạng kết quả.

## API chính

- Players: `/api/players`, `/api/players/{id}`, `/api/players/bulk-delete`, `/api/players/{id}/reset`
- Matches: `/api/matches`, `/api/matches/{id}`, `/api/matches/{id}/ratings`
- Analytics: `/api/player-status`, `/api/form-extremes`, `/api/recommendations`

`POST /api/rating` là endpoint cũ và trả `410 Gone`.

Các API debug `/api/debug-env` và `/api/debug-ratings` chỉ hoạt động ngoài production.

`listMatches` và recommendations hiện vẫn cần filtered scan để tương thích dữ liệu cũ. Source đã giới hạn projection/pagination và có TODO chuyển sang GSI hoặc materialized view khi migration schema được chuẩn bị.

## Deploy Vercel

1. Cấu hình các biến môi trường cho đúng môi trường Preview/Production.
2. Đảm bảo AWS Region, tên bảng và IAM permissions khớp DynamoDB.
3. Chạy:

```bash
npm test
npm run build
npm run audit:data
```

4. Deploy hoặc redeploy project trên Vercel.

Production và local dùng cùng helper parse/sort thời gian; không parse trực tiếp ngày `DD/MM/YYYY` bằng `new Date(...)`.

## Lưu ý an toàn

- Không commit `.env`, `.env.local` hoặc AWS credentials.
- Audit mặc định chỉ đọc dữ liệu.
- `--fix` không xóa orphan vì không thể chắc chắn record đó còn cần hay không.
- App hiện chưa có đăng nhập/phân quyền; cần bổ sung lớp bảo vệ trước khi public cho nhiều người dùng.
