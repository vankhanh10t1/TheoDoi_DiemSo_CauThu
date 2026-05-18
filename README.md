# FCON Performance Tracker — Football Performance Intelligence System

Ứng dụng web Next.js để quản lý đội hình, nhập điểm trận, phân tích phong độ bằng WMA, phát hiện xu hướng, ước lượng rủi ro và đưa ra khuyến nghị chuyển nhượng dựa trên dữ liệu thực tế từ DynamoDB.

## Tính Năng

### 1. Rating / Nhập Điểm Trận (`📊 Rating`)
- Chọn cầu thủ từ danh sách cầu thủ thực tế đang có trong app
- Nhập điểm trận từ 1.0 đến 10.0
- Chọn kết quả: Win / Draw / Loss
- Chọn đá chính hoặc dự bị
- Tự động tính phong độ dựa trên bộ analytics hybrid mới

### 2. Squad Management (`👥 Đội Hình`)
- Xem danh sách cầu thủ lấy từ DynamoDB
- Thêm cầu thủ mới với tên và vị trí, `playerId` được tạo tự động
- Cập nhật cầu thủ: sửa tên + vị trí
- Xóa cầu thủ và toàn bộ lịch sử trận đấu của cầu thủ đó
- Reset lịch sử điểm số của một cầu thủ mà không xóa cầu thủ
- Xem chi tiết cầu thủ

### 3. Transfer Recommendation (`🎯 Đề Xuất`)
Dựa trên WMA, trend, variance, prediction, risk score và fraud alert, hệ thống phân loại cầu thủ thành các hành động:

| Mã Đề Xuất | Ý nghĩa |
| :-- | :-- |
| **KEEP** | Giữ trong đội hình |
| **MONITOR** | Theo dõi thêm |
| **BENCH** | Đưa dự bị |
| **SELL** | Nên thanh lý |
| **REPLACE** | Thay thế khẩn cấp do fraud/risk cao |

Màn hình “Phong độ” hiện tại được nhóm theo `LOW RISK`, `MEDIUM RISK`, `HIGH RISK`, mỗi group có số lượng riêng và card chỉ hiển thị mùa thẻ, vị trí, số trận và badge Risk để tập trung vào risk monitoring trên mobile.

### 4. Player Detail (`🔍 Chi Tiết Cầu Thủ`)
- Xem thông tin cầu thủ
- Nhập điểm trận mới
- Xem WMA, trend, variance, momentum, prediction, confidence và risk
- Xem trạng thái phong độ hiện tại
- Reset lịch sử điểm số của cầu thủ

## Analytics Engine

### WMA
Hệ thống dùng Weighted Moving Average làm current form score chính:

```txt
WMA = 0.5*x3 + 0.3*x2 + 0.2*x1
```

Trong đó `x3` là trận gần nhất và `x1` là trận xa nhất trong 3 trận gần nhất. Nếu ít hơn 3 trận, weights được normalize tự động.

### Trend Detection

```txt
trend = x3 - x1
```

- `> 1` => `UP`
- `-1` đến `1` => `STABLE`
- `< -1` => `DOWN`

### Variance / Stability

- `< 1` => `STABLE`
- `1 - 4` => `UNSTABLE`
- `> 4` => `VOLATILE`

### Momentum

```txt
momentum = (x3 - x2) + (x2 - x1)
```

- `> 1` => `HOT`
- `-1` đến `1` => `NORMAL`
- `< -1` => `COLD`

### Predicted Score

Hệ thống sử dụng heuristic model để dự đoán phong độ tiếp theo:

```txt
predictedScore = 0.48×wmaScore + 0.22×averageScore + 0.12×trendValue 
                 + 0.08×momentum - 0.14×variance - 0.25×lossStreak

confidence = 0.48 + adjustments_theo(lossStreak, variance, trend, momentum, wma_vs_avg)
```

**Ngưỡng Confidence:**
- `> 0.8` => `HIGH`
- `0.5 - 0.8` => `MEDIUM`
- `< 0.5` => `LOW`

### Risk Score

Risk được tính dựa trên 4 yếu tố với trọng số:

```txt
riskScore = trendRisk×0.3 + varianceRisk×0.25 + streakRisk×0.25 + predictionRisk×0.2
```

Trong đó:
- `trendRisk` = 1 nếu DOWN, 0 nếu UP/STABLE
- `varianceRisk` = 1 nếu VOLATILE, 0.6 nếu UNSTABLE, 0 nếu STABLE
- `streakRisk` = min(1, max(0, lossStreak / 3))
- `predictionRisk` = 1 nếu predicted < 4.5, 0.5 nếu 4.5-6, 0 nếu >= 6

**Ngưỡng Risk Level:**
- `>= 70` => `HIGH`
- `35 - 70` => `MEDIUM`
- `< 35` => `LOW`

### Discipline & Aggression

Hệ thống tính các chỉ số kỷ luật từ dữ liệu trận đấu:

```txt
disciplineScore = 100 - (redCards_rate + yellowCards_rate + fouls_rate)
aggressionIndex = (fouls + yellowCards×0.5 + redCards×2) / totalMatches
```

**Ảnh hưởng đến Recommendation:**
- Nếu `disciplineScore < 50 && aggressionIndex >= 8` => **REPLACE** (hành vi hung hãn)
- Nếu `disciplineScore < 65 && aggressionIndex >= 5` => **BENCH** (theo dõi kỷ luật)

### Fraud Alert

Fraud risk được bật khi **đồng thời** có 5 điều kiện:

1. `predictedScore < 4.5`
2. `trendStatus = DOWN`
3. `stabilityLevel = VOLATILE`
4. `lossStreak >= 3`
5. `redRate > 0` (ít nhất 1 thẻ đỏ trong lịch sử)

Khi fraud alert bật => Recommendation = **REPLACE** (ưu tiên cao nhất)

## Kiến Trúc Hệ Thống

```
┌─────────────────────────────────┐
│   React/Next.js App             │
│   ├─ AppShell (Navigation)      │
│   ├─ TrackerApp (Rating)        │
│   ├─ SquadManagement            │
│   ├─ TransferRecommendation     │
│   └─ PlayerDetail               │
└────────────────────┬────────────┘
                     │
         ┌───────────┴──────────────┐
         │                          │
    ┌────▼─────┐           ┌────────▼──────┐
    │ Vercel   │           │ AWS DynamoDB  │
    │ Functions│◄────────►│ FCON_Table     │
    │ API      │           │ (Single-table  │
    │ Routes   │           │ design)        │
    └──────────┘           └───────────────┘
```

### New analytic components

- **Feature Engineering** (`lib/featureEngineering`): tổng hợp `avg_score`, `weighted_average`, `variance`, `trend`, `discipline_score`, `aggression_index`, `loss_streak`, `momentum` và các feature khác để cung cấp input cho Prediction / Risk / Recommendation engines.
- **Discipline Engine** (`lib/analytics/discipline.ts`): tính `disciplineScore`, `aggressionIndex`, `disciplineTrend` và các chỉ số liên quan, có thể cấu hình penalty theo vị trí.


## API Routes

- `POST /api/rating` - Lưu điểm trận
- `GET /api/player-status?id={id}` - Tính phong độ
- `GET /api/players` - Danh sách cầu thủ
- `POST /api/players` - Thêm cầu thủ
- `PATCH /api/players/{id}` - Cập nhật tên + vị trí
- `DELETE /api/players/{id}` - Xóa cầu thủ và toàn bộ dữ liệu trận đấu
- `PATCH /api/players/{id}/reset` - Xóa lịch sử điểm số, giữ lại cầu thủ
- `GET /api/recommendations` - Khuyến nghị chuyển nhượng

## UI Screenshots

Nếu muốn đính kèm ảnh chụp màn hình cho tài liệu hoặc demo, có thể đặt chúng vào một thư mục như `public/screenshots/` và chèn liên kết trực tiếp trong README. Hiện tại dự án chưa bắt buộc có ảnh chụp để chạy.

## DynamoDB Schema

**Bảng:** `FCON_Table`

| Loại Item | PK | SK | Nội dung |
| :-- | :-- | :-- | :-- |
| **METADATA** | `PLAYER#{id}` | `METADATA` | Thông tin cầu thủ (`Name`, `Season`, `Position`) |
| **MATCH** | `PLAYER#{id}` | `MATCH#{ISO8601_timestamp}` | Điểm trận (`Score`, `IsStarter`, `Result`) |

**Ví dụ:**

```json
{
  "PK": "PLAYER#CR7",
  "SK": "METADATA",
  "Name": "C. Ronaldo",
  "Season": "21CU",
  "Position": "ST"
}
```

```json
{
  "PK": "PLAYER#CR7",
  "SK": "MATCH#20260511T140000Z",
  "Score": 7.5,
  "IsStarter": true,
  "Result": "Win",
  "YellowCards": 1,
  "RedCards": 0,
  "Fouls": 2
}
```

Note: Match items now optionally include `YellowCards`, `RedCards`, and `Fouls` (integers >= 0). Existing items without these fields remain compatible; the analytics and UI treat missing fields as zero.

## Cấu Hình & Chạy

### 1. Cài đặt dependency

```bash
npm install
```

### 2. Cấu hình AWS Credentials

Cập nhật `.env.local`:

```env
AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_ACCESS_KEY
AWS_REGION=ap-southeast-1
DYNAMODB_TABLE_NAME=FCON_Table
# Hoặc nếu Vercel đang dùng biến cũ:
# DYNAMODB_TABLE=FCON_Table
# Nếu dùng local DynamoDB:
# DYNAMODB_ENDPOINT=http://localhost:8000
```

### 2.1. Cấu hình trên Vercel

- Thêm các biến `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `DYNAMODB_TABLE_NAME` hoặc `DYNAMODB_TABLE` trong **Environment Variables** của project.
- Chọn đúng scope **Production** cho deployment thật. Nếu chỉ set ở Preview/Development thì production sẽ không đọc được.
- Sau khi thêm hoặc sửa biến môi trường, cần **redeploy** lại production deployment để runtime nhận cấu hình mới.

### 3. Tạo bảng DynamoDB

- Table name: `FCON_Table`
- Partition Key: `PK` (String)
- Sort Key: `SK` (String)

### 4. Chạy ứng dụng

```bash
npm run dev
```

Mở `http://localhost:3000`

### 5. Chạy tests

```bash
npm test
```

### 6. Build production

```bash
npm run build
npm start
```

## Recommendation Logic (Phân Loại Phong Độ)

Dữ liệu đánh giá hiện không còn phụ thuộc vào average đơn giản. UI và API ưu tiên WMA, trend, variance, prediction, risk, discipline và fraud alert để quyết định hành động:

| Điều kiện | Recommendation | Priority | Ý nghĩa |
| :-- | :-- | :-- | :-- |
| Fraud risk bật | **REPLACE** | 5 | Thay thế khẩn cấp, cảnh báo gian lận/rủi ro cao |
| riskLevel = HIGH hoặc predictedScore < 4 | **SELL** | 4 | Thanh lý, rủi ro cao + phong độ thấp |
| riskScore >= 55 hoặc VOLATILE hoặc DOWN hoặc COLD | **BENCH** | 3 | Đưa dự bị, phong độ không ổn định |
| disciplineScore < 50 && aggressionIndex >= 8 | **REPLACE** | 5 | Vấn đề kỷ luật nghiêm trọng, thay thế |
| disciplineScore < 65 && aggressionIndex >= 5 | **BENCH** | 3 | Kỷ luật kém, theo dõi dự bị |
| riskScore >= 30 hoặc trendStatus != UP hoặc confidence < 0.6 | **MONITOR** | 2 | Theo dõi thêm, chưa ổn định hoàn toàn |
| riskScore < 30 && trendStatus = UP && wmaScore >= 6 | **KEEP** | 1 | Giữ, phong độ ổn định |

**Ưu tiên:** Khi có nhiều điều kiện khớp, hệ thống chọn recommendation với priority cao nhất.

## State Management

App sử dụng React Context (`AppContext`) để quản lý:
- Tab/screen hiện tại
- Cầu thủ đang chọn ở màn chi tiết
- Refresh trigger để làm mới dữ liệu
- Danh sách cầu thủ thực tế đang dùng cho Rating và Squad Management

## Testing

### Unit tests

```bash
npm test
```

Kiểm tra:
- WMA / trend / variance / momentum
- Prediction / risk / fraud logic
- Recommendation ranking

### Manual testing

1. Thêm cầu thủ ở Squad Management
2. Cập nhật tên/vị trí cầu thủ
3. Nhập điểm trận ở Rating (hệ thống đánh giá ngay khi có từ 1 trận)
4. Xem khuyến nghị ở Transfer Recommendation
5. Reset lịch sử điểm số trong Player Detail

## Ghi chú hiện tại

- Không còn dữ liệu mock/default cho danh sách cầu thủ
- `playerId` được tạo tự động khi thêm cầu thủ
- `npm run seed` hiện không còn là luồng bắt buộc cho app
- UI “Phong độ” được tối giản cho mobile và tập trung vào Risk badge
- Build production và test suite phải pass trước khi push lên GitHub / redeploy Vercel

## Deploy

Quy trình chuẩn:

1. Chạy `npm test`
2. Chạy `npm run build`
3. Commit thay đổi
4. Push branch hiện tại lên GitHub
5. Chờ Vercel auto redeploy production deployment

## Các Tính Năng Mở Rộng

- Export danh sách khuyến nghị (CSV/PDF)
- Lịch sử chuyển nhượng + lợi nhuận/lỗ
- Đăng nhập & phân quyền
- Tích hợp dữ liệu bóng đá từ API ngoài
- Machine learning để dự đoán phong độ thực thụ, ví dụ Bayesian Ridge Regression
- Gemini AI chatbot để tư vấn chuyển nhượng

**Version:** 2.0 | **Status:** Production Ready | **Tech:** Next.js 15 + AWS DynamoDB
