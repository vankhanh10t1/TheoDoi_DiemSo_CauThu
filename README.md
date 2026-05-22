# FCON Performance Tracker — Football Performance Intelligence System

Ứng dụng web Next.js để quản lý đội hình, nhập điểm trận, phân tích phong độ bằng WMA, phát hiện xu hướng, ước lượng rủi ro và đưa ra khuyến nghị chuyển nhượng dựa trên dữ liệu thực tế từ DynamoDB.

## Tính Năng

### 1. Rating / Nhập Điểm Trận (`📊 Rating`)
- **Match-First Flow:** Tạo trận mới trước, sau đó nhập điểm từng cầu thủ
- Chọn cầu thủ từ danh sách cầu thủ thực tế đang có trong app
- Nhập điểm trận từ 1.0 đến 10.0
- Chọn kết quả: Win / Draw / Loss
- Chọn vị trí đá (Position Group + Detailed Position)
- Chọn đá chính hoặc dự bị
- Tuỳ chọn: Nhập thẻ vàng, thẻ đỏ, phạm lỗi
- Tự động tính phong độ WMA, xu hướng, dự đoán, rủi ro dựa trên toàn bộ số trận

### 2. Squad Management (`👥 Đội Hình`)
- Xem danh sách cầu thủ lấy từ DynamoDB
- Thêm cầu thủ mới với tên, vị trí và cardSeason; `playerId` được tạo tự động
- **Duplicate Check:** Tên cầu thủ được kiểm tra trùng lặp (case-insensitive, trimmed)
- Cập nhật cầu thủ: sửa tên + vị trí + cardSeason
- Xóa cầu thủ và toàn bộ lịch sử trận đấu của cầu thủ đó
- Reset lịch sử điểm số của một cầu thủ mà không xóa cầu thủ
- Xem chi tiết cầu thủ (link tới Player Detail)

### 3. Transfer Recommendation (`🎯 Đề Xuất`)
Dựa trên WMA, trend, variance, prediction, risk score và fraud alert, hệ thống phân loại cầu thủ thành các hành động:

| Mã Đề Xuất | Ưu Tiên | Ý nghĩa |
| :-- | :-- | :-- |
| 🚨 **REPLACE** | 5 (Cao nhất) | Thay thế khẩn cấp do fraud alert hoặc kỷ luật/rủi ro cực cao |
| 🔴 **SELL** | 4 | Thanh lý: rủi ro cao + phong độ thấp |
| ⚠️ **BENCH** | 3 | Đưa dự bị: phong độ không ổn định (VOLATILE/DOWN/COLD) |
| 🟡 **MONITOR** | 2 | Theo dõi thêm: rủi ro trung bình, chưa ổn định hoàn toàn |
| ✅ **KEEP** | 1 (Thấp nhất) | Giữ trong đội hình: phong độ ổn định, xu hướng tốt |

**Ranking:** Khi có nhiều điều kiện khớp, hệ thống chọn recommendation với priority cao nhất

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

## Match-First Flow (Hiện Tại - May 18, 2026)

**Ứng dụng sử dụng kiến trúc match-first để đảm bảo tính nhất quán dữ liệu và tránh ghi đè:**

1. **Tạo Trận:** `POST /api/matches` với payload `{ matchDate: "YYYY-MM-DD" }`
   - Response chứa `match` object có `id` duy nhất (ISO8601 timestamp)
   - Match ID đảm bảo không có 2 trận cùng ngày ghi đè nhau

2. **Lưu Điểm Cho Trận:** `POST /api/matches/:matchId/ratings` với payload:
   ```json
   {
     "ratings": [
       {
         "playerId": "...",
         "score": 7.5,
         "isStarter": true,
         "result": "Win",
         "positionGroup": "DEF",
         "detailedPosition": "CB",
         "yellowCards": 0,
         "redCards": 0,
         "fouls": 2
       },
       ...
     ]
   }
   ```

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

### Các Thành Phần Analytics Mới

- **Feature Engineering** (`lib/featureEngineering`): tổng hợp `avg_score`, `weighted_average`, `variance`, `trend`, `discipline_score`, `aggression_index`, `loss_streak`, `momentum` và các feature khác để cung cấp input cho Prediction / Risk / Recommendation engines.
- **Discipline Engine** (`lib/analytics/discipline.ts`): tính `disciplineScore`, `aggressionIndex`, `disciplineTrend` và các chỉ số liên quan, có thể cấu hình penalty theo vị trí.


## API Routes (Current - May 18, 2026)

### Match Management (New)
- `POST /api/matches` - Tạo trận mới (payload: `{ matchDate: "YYYY-MM-DD" }`)
- `POST /api/matches/:matchId/ratings` - Lưu điểm trận cho cầu thủ (payload: `{ ratings: [...] }`)
- `GET /api/matches` - Lấy danh sách trận đấu
- `GET /api/matches/:matchId` - Chi tiết trận (bao gồm tất cả ratings)

### Player Management
- `GET /api/players` - Danh sách cầu thủ
- `POST /api/players` - Thêm cầu thủ (với duplicate name checking)
- `PATCH /api/players/{id}` - Cập nhật tên + vị trí + cardSeason
- `DELETE /api/players/{id}` - Xóa cầu thủ và toàn bộ dữ liệu trận đấu
- `PATCH /api/players/{id}/reset` - Xóa lịch sử điểm số, giữ lại cầu thủ

### Analytics & Recommendations
- `GET /api/player-status?id={id}` - Tính phong độ WMA/trend/prediction/risk
- `GET /api/recommendations` - Khuyến nghị chuyển nhượng (KEEP/MONITOR/BENCH/SELL/REPLACE)
- `GET /api/form-extremes` - Top performers & bottom performers

### Debug Endpoints
- `GET /api/debug-env` - Kiểm tra cấu hình AWS
- `GET /api/debug-ratings?matchId={matchId}` - Xác minh ratings của trận

**Legacy:**
- `POST /api/rating` - **Deprecated** (returns 410 Gone)

## Ảnh Chụp Màn Hình UI

Nếu muốn đính kèm ảnh chụp màn hình cho tài liệu hoặc demo, có thể đặt chúng vào một thư mục như `public/screenshots/` và chèn liên kết trực tiếp trong README. Hiện tại dự án chưa bắt buộc có ảnh chụp để chạy.

## DynamoDB Schema (Match-First, May 18, 2026)

**Bảng:** `FCON_Table`

| Loại Item | PK | SK | Nội dung |
| :-- | :-- | :-- | :-- |
| **PLAYER METADATA** | `PLAYER#{playerId}` | `METADATA` | Thông tin cầu thủ: `Name`, `CardSeason`, `Position` |
| **RATING** (Match-First) | `PLAYER#{playerId}` | `MATCH#{matchId}` | Điểm trận: `Score`, `IsStarter`, `Result`, `PositionGroup`, `DetailedPosition`, `YellowCards`, `RedCards`, `Fouls`, `MatchDate` |
| **MATCH METADATA** | `MATCH#{matchId}` | `METADATA` | Thông tin trận: `MatchDate`, `CreatedAt` |

**Ví dụ:**

Player Metadata:
```json
{
  "PK": "PLAYER#CR7",
  "SK": "METADATA",
  "Name": "C. Ronaldo",
  "CardSeason": "21CU",
  "Position": "ST"
}
```

Rating (Match-First):
```json
{
  "PK": "PLAYER#CR7",
  "SK": "MATCH#20260518T140000Z",
  "Score": 7.5,
  "IsStarter": true,
  "Result": "Win",
  "PositionGroup": "FWD",
  "DetailedPosition": "ST",
  "YellowCards": 0,
  "RedCards": 0,
  "Fouls": 1,
  "MatchDate": "2026-05-18"
}
```

**Ghi Chú:**
- `matchId` trong SK đảm bảo tính duy nhất (không ghi đè nếu cùng ngày)
- `CardSeason` thay thế legacy `Season` field
- `PositionGroup` (DEF, MID, FWD) + `DetailedPosition` (CB, RB, ST, ...) theo dõi vị trí tại mỗi trận
- `YellowCards`, `RedCards`, `Fouls` tùy chọn; field thiếu được coi là 0

## Cấu Hình & Chạy

### 1. Cài đặt dependency

```bash
npm install
```

### 2. Cấu hình AWS Credentials

Cập nhật `.env.local` (local development):

```env
AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_ACCESS_KEY
AWS_REGION=ap-southeast-1
DYNAMODB_TABLE_NAME=FCON_Table
# Tùy chọn cho local DynamoDB:
# DYNAMODB_ENDPOINT=http://localhost:8000
```

### 2.1. Triển Khai Vercel

**Cấu Hình Environment Variables:**
- Thêm vào **Settings > Environment Variables**:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_REGION` (ví dụ: `ap-southeast-1`)
  - `DYNAMODB_TABLE_NAME` (ví dụ: `FCON_Table`)

**Scope Triển Khai:**
- Đặt scope là **Production** cho môi trường live
- Scope Preview/Development là riêng biệt; cấu hình nếu cần
- Sau khi sửa biến, **redeploy** production deployment để runtime lấy cấu hình mới

**Xác Minh:**
- Dùng endpoint `/api/debug-env` để kiểm tra xem credentials có được load đúng không

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

## Logic Khuyến Nghị (Phân Loại Phong Độ)

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
