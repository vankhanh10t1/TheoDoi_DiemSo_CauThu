# FCON Performance Tracker

Ứng dụng web theo dõi phong độ cầu thủ bóng đá, quản lý đội hình, nhập điểm theo trận và đưa ra phân tích/rủi ro/khuyến nghị dựa trên dữ liệu lưu trong AWS DynamoDB.

## Công nghệ sử dụng

- Next.js 15 (App Router, Route Handlers)
- React 19 và React Context
- TypeScript strict mode
- AWS SDK for JavaScript v3
- AWS DynamoDB theo mô hình single-table
- Vitest
- CSS thuần trong `app/globals.css`

## Tính năng chính

- Quản lý cầu thủ: xem, tìm kiếm, thêm, sửa, xóa đơn lẻ và xóa nhiều cầu thủ.
- Kiểm tra trùng tên cầu thủ khi thêm hoặc cập nhật.
- Tạo trận đấu và nhập rating hàng loạt cho các cầu thủ tham gia.
- Lưu rating theo cả hướng trận đấu và hướng cầu thủ.
- Xem chi tiết, trạng thái và lịch sử phong độ của cầu thủ.
- Bảng phong độ toàn đội có tìm kiếm và sắp xếp dữ liệu.
- Phân tích WMA/current form, average, trend, variance, momentum, prediction và confidence.
- Phân tích discipline, aggression, risk và fraud alert.
- Sinh khuyến nghị `KEEP`, `MONITOR`, `BENCH`, `SELL`, `REPLACE`.
- Sắp xếp lịch sử phong độ theo `MatchDate`, fallback sang `CreatedAt` hoặc sort key.
- Reset lịch sử phong độ theo cầu thủ mà vẫn giữ metadata cầu thủ.

## Cấu trúc thư mục

```text
app/
  api/                  Route Handlers cho players, matches, ratings và analytics
  globals.css           Style toàn ứng dụng
  layout.tsx
  page.tsx
components/             UI quản lý đội hình, nhập điểm, phong độ và chi tiết cầu thủ
lib/
  analytics/            WMA, trend, variance, momentum và discipline
  prediction/           Dự đoán điểm và confidence
  recommendation/       Logic khuyến nghị
  risk/                 Tính risk score
  dynamodb.ts           Khởi tạo DynamoDB client
  matchService.ts       Đọc/ghi dữ liệu trận và rating
  playerService.ts      Đọc/xóa dữ liệu cầu thủ
  match-history.ts      Sắp xếp lịch sử trận
tests/                  Unit tests Vitest
scripts/seed.ts         Script no-op, hiện không tạo dữ liệu mẫu
```

## API chính

### Cầu thủ

- `GET /api/players`
- `POST /api/players`
- `GET /api/players/{id}`
- `PATCH /api/players/{id}`
- `DELETE /api/players/{id}`
- `POST /api/players/bulk-delete`
- `PATCH /api/players/{id}/reset`

### Trận đấu và rating

- `GET /api/matches`
- `POST /api/matches`
- `GET /api/matches/{id}`
- `PATCH /api/matches/{id}`
- `DELETE /api/matches/{id}`
- `GET /api/matches/{id}/ratings`
- `POST /api/matches/{id}/ratings`
- `DELETE /api/matches/{id}/ratings?playerId={playerId}`

### Phân tích

- `GET /api/player-status?id={playerId}`
- `GET /api/form-extremes`
- `GET /api/recommendations`

`POST /api/rating` là endpoint cũ và hiện trả về `410 Gone`.

## Yêu cầu môi trường

- Node.js tương thích Next.js 15; khuyến nghị Node.js 20 LTS.
- npm.
- Một bảng AWS DynamoDB có:
  - Partition key: `PK` kiểu String.
  - Sort key: `SK` kiểu String.
- AWS credentials có quyền đọc/ghi cần thiết trên bảng DynamoDB.

## Cài đặt

```bash
npm install
```

## Cấu hình `.env`

Tạo `.env.local` từ `.env.example`:

```bash
cp .env.example .env.local
```

Trên Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Các biến được source code sử dụng:

| Biến | Bắt buộc | Mô tả |
| --- | --- | --- |
| `AWS_ACCESS_KEY_ID` | Có | AWS access key, không commit giá trị thật |
| `AWS_SECRET_ACCESS_KEY` | Có | AWS secret key, không commit giá trị thật |
| `AWS_REGION` | Có | Region chứa bảng DynamoDB |
| `DYNAMODB_TABLE_NAME` | Có* | Tên bảng DynamoDB |
| `DYNAMODB_TABLE` | Có* | Alias thay thế cho `DYNAMODB_TABLE_NAME` |
| `DYNAMODB_LIST_INDEX_NAME` | Không | GSI dùng để tối ưu danh sách cầu thủ; nếu thiếu app fallback sang Scan |

\* Chỉ cần cấu hình một trong `DYNAMODB_TABLE_NAME` hoặc `DYNAMODB_TABLE`. Nên ưu tiên `DYNAMODB_TABLE_NAME`.

## Chạy local

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

## Kiểm thử và build

```bash
npm test
npm run build
npm start
```

Các scripts hiện có:

| Script | Công dụng |
| --- | --- |
| `npm run dev` | Chạy Next.js development server |
| `npm run build` | Build production |
| `npm start` | Chạy production server sau khi build |
| `npm test` | Chạy toàn bộ unit tests bằng Vitest |
| `npm run seed` | Chạy script seed no-op; hiện không tạo dữ liệu |

## DynamoDB single-table

Các item chính:

| Loại item | PK | SK |
| --- | --- | --- |
| Metadata cầu thủ | `PLAYER#{playerId}` | `METADATA` |
| Lịch sử/rating theo cầu thủ | `PLAYER#{playerId}` | `MATCH#{matchId}` |
| Metadata trận | `MATCH#{matchId}` | `METADATA` |
| Rating theo trận | `MATCH#{matchId}` | `RATING#{playerId}` |

Các rating mới lưu thêm `MatchDate` để analytics sắp xếp theo ngày thi đấu. Dữ liệu cũ thiếu `MatchDate` sẽ fallback sang `CreatedAt` hoặc sort key.

## Deploy

Project có thể deploy lên Vercel hoặc chạy bằng Node.js server:

1. Cấu hình đầy đủ environment variables trên môi trường deploy.
2. Đảm bảo DynamoDB và IAM permissions đã sẵn sàng.
3. Chạy `npm test` và `npm run build`.
4. Deploy source hoặc chạy `npm start` sau build.

Với Vercel, thêm env trong **Project Settings > Environment Variables**, sau đó redeploy.

## Ghi chú quan trọng

- Project không có dữ liệu mock/default; danh sách cầu thủ lấy từ DynamoDB.
- Project hiện chưa có đăng nhập hoặc phân quyền.
- `GET /api/debug-env` và `GET /api/debug-ratings` phục vụ chẩn đoán. Cần kiểm tra thêm việc giới hạn hoặc tắt các endpoint này trước khi public production.
- `/api/debug-env` chỉ báo trạng thái env và tên bảng, không trả secret AWS.
- Xóa cầu thủ sẽ xóa metadata, lịch sử theo cầu thủ và rating liên quan.
- Bulk delete dùng DynamoDB batch write và retry/backoff cho item chưa được xử lý.
- Reset cầu thủ hiện chỉ xóa các item `PLAYER#{playerId}` / `MATCH#{matchId}`; rating phía `MATCH#{matchId}` / `RATING#{playerId}` cần kiểm tra thêm nếu yêu cầu xóa đồng bộ hai chiều.
- `DYNAMODB_LIST_INDEX_NAME` cần trỏ tới GSI phù hợp; cấu hình GSI cụ thể cần kiểm tra thêm trên AWS hiện tại.
- Không commit `.env` hoặc `.env.local`.
