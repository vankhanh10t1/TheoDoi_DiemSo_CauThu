# FCON Performance Tracker — Hệ thống quản lý đội hình và phong độ (May 18, 2026)

Ứng dụng web Next.js để quản lý cầu thủ, nhập điểm trận (match-first flow), phân tích phong độ dựa trên WMA, phát hiện xu hướng, ước lượng rủi ro và đưa ra khuyến nghị giữ/bán cầu thủ dựa trên dữ liệu trong Neon/PostgreSQL.

## Tính Năng

### 1. Rating / Nhập Điểm Trận (`📊 Rating`)

**Match-First Flow (Current):**
1. **Tạo trận mới:** POST `/api/matches` → nhận `matchId`
2. **Nhập điểm cho cầu thủ:** POST `/api/matches/:matchId/ratings` với danh sách cầu thủ

**Tính năng:**
- Chọn cầu thủ từ danh sách cầu thủ thực tế trong app
- Nhập điểm trận từ 1.0 đến 10.0
- Chọn kết quả: Win / Draw / Loss
- Chọn vị trí đá (Position Group + Detailed Position)
- Chọn đá chính hoặc dự bị
- Tuỳ chọn: nhập thẻ vàng, thẻ đỏ, phạm lỗi
- Tự động tính WMA, trend, prediction, risk và cảnh báo phong độ bất thường

**Note:** Endpoint cũ `POST /api/rating` deprecated (trả về 410 Gone)

### 2. Squad Management (`👥 Đội Hình`)
- Xem danh sách cầu thủ lấy từ Neon/PostgreSQL
- Thêm cầu thủ mới với tên, vị trí và **cardSeason**; `playerId` được tạo tự động
- **Duplicate Check:** Tên cầu thủ được kiểm tra trùng lặp (case-insensitive, trimmed)
  - Không thể thêm 2 cầu thủ cùng tên (trả về 409 Conflict)
  - Thông báo lỗi tiếng Việt rõ ràng
- Cập nhật cầu thủ: sửa tên + vị trí + cardSeason
- Xóa cầu thủ và toàn bộ lịch sử trận đấu
- Reset lịch sử điểm số mà không xóa cầu thủ
- Xem chi tiết cầu thủ (link tới Player Detail)

### 3. Transfer Recommendation (`🎯 Đề Xuất`)

Dựa trên WMA, trend, variance, prediction, risk, discipline và cảnh báo bất thường, hệ thống phân loại cầu thủ:

| Mã | Ưu Tiên | Ý Nghĩa | Điều Kiện |
| :-- | :-- | :-- | :-- |
| 🚨 **REPLACE** | 5 | Cần theo dõi thêm | Cảnh báo bất thường bật OR (disciplineScore < 50 && aggressionIndex >= 8) |
| 🔴 **SELL** | 4 | Thanh lý | riskScore >= 70 OR predictedScore < 4.5 |
| ⚠️ **BENCH** | 3 | Dự bị | riskScore >= 35 OR VOLATILE OR DOWN trend OR COLD momentum |
| 🟡 **MONITOR** | 2 | Theo dõi | riskScore >= 30 OR confidence < 0.6 |
| ✅ **KEEP** | 1 | Giữ | riskScore < 30 AND UP trend AND confidence >= 0.6 |

**Cảnh báo phong độ bất thường (REPLACE):** Bật khi **đồng thời** có 5 điều kiện:
1. `predictedScore < 4.5`
2. `trendStatus = DOWN`
3. `stabilityLevel = VOLATILE`
4. `lossStreak >= 3`
5. `redRate > 0` (ít nhất 1 thẻ đỏ)

**Ranking:** Priority cao nhất được chọn

### 4. Player Detail (`🔍 Chi Tiết Cầu Thủ`)
- Xem thông tin cầu thủ (tên, vị trí, cardSeason)
- Nhập điểm trận mới
- Xem lịch sử trận đấu chi tiết (kể cả position, cards, fouls)
- Xem metrics phong độ: **WMA**, trend, variance, momentum, prediction, confidence, risk score
- Xem trạng thái hiện tại với badges: trend (📈/⬇️/→), risk level (🟢/🟠/🔴), momentum (HOT/NORMAL/COLD)
- Xem discipline score và aggression index
- Trạng thái cảnh báo phong độ bất thường (nếu có)
- Reset lịch sử điểm số

## Kiến Trúc Hệ Thống

`React UI → Next.js App Router/Route Handlers → @neondatabase/serverless → Neon PostgreSQL`.
Runtime sử dụng ba bảng `players`, `matches`, `match_ratings` và view `v_player_match_history`. Toàn bộ backend chỉ dùng Neon/PostgreSQL; repository không còn AWS SDK hoặc đường thực thi DynamoDB.

## API Routes (Match-First Flow, May 18, 2026)

### Match Management (New)
- `POST /api/matches` - Tạo trận mới
- `POST /api/matches/:matchId/ratings` - Lưu điểm cho cầu thủ trong trận
- `GET /api/matches` - Danh sách trận
- `GET /api/matches/:matchId` - Chi tiết trận (bao gồm ratings)

### Player Management
- `GET /api/players` - Danh sách cầu thủ
- `POST /api/players` - Thêm cầu thủ (với duplicate check)
- `PATCH /api/players/{id}` - Cập nhật tên + vị trí + cardSeason
- `DELETE /api/players/{id}` - Xóa cầu thủ và toàn bộ dữ liệu
- `PATCH /api/players/{id}/reset` - Xóa lịch sử điểm, giữ cầu thủ

### Analytics
- `GET /api/player-status?id={id}` - Tính WMA/trend/prediction/risk
- `GET /api/recommendations` - Khuyến nghị (KEEP/MONITOR/BENCH/SELL/REPLACE)
- `GET /api/form-extremes` - Top/bottom performers

### Debug
- `GET /api/debug-env` - Kiểm tra cấu hình runtime (không trả secret)
- `GET /api/debug-ratings?matchId={matchId}` - Verify ratings

**Legacy:**
- `POST /api/rating` - Deprecated (410 Gone)

## Lịch sử schema trước khi chuyển đổi (không còn hỗ trợ)

Phần bên dưới chỉ là ghi chép định dạng dữ liệu cũ để truy vết lịch sử. Không còn code, command, client hay dependency nào có thể đọc/ghi nguồn này. **Không dùng cho vận hành hiện tại.**

| Loại Item | PK | SK | Nội dung |
| :-- | :-- | :-- | :-- |
| **PLAYER METADATA** | `PLAYER#{playerId}` | `METADATA` | Thông tin cầu thủ: Name, CardSeason, Position |
| **RATING** (Match-First) | `PLAYER#{playerId}` | `MATCH#{matchId}` | Điểm trận: Score, IsStarter, Result, PositionGroup, DetailedPosition, YellowCards, RedCards, Fouls, MatchDate |
| **MATCH METADATA** | `MATCH#{matchId}` | `METADATA` | Thông tin trận: MatchDate, CreatedAt |

**Ví dụ:**

```json
{
  "PK": "PLAYER#CR7",
  "SK": "METADATA",
  "Name": "C. Ronaldo",
  "CardSeason": "21CU",
  "Position": "ST"
}
```

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
- `matchId` trong SK đảm bảo tính duy nhất (không bị ghi đè nếu cùng ngày)
- `CardSeason` thay thế legacy `Season` field
- Theo dõi vị trí per match: `PositionGroup` (DEF, MID, FWD) + `DetailedPosition` (CB, RB, ST, ...)
- Các field Card/Fouls tùy chọn; missing = 0

## Cấu Hình & Chạy

### 1. Cài đặt dependency

```bash
npm install
```

### 2. Cấu hình database runtime

Cập nhật `.env.local`:

```env
DATABASE_URL=postgresql://user:password@host.neon.tech/neondb?sslmode=require
```

### 3. Dựng schema PostgreSQL

```bash
npm run db:migrate
npm run db:status
```

Schema, index, view, backup/restore và rollback được mô tả tại `database/README.md`.

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

## Phân Loại Phong Độ (Hybrid Analytics, May 14, 2026)

Dựa trên **WMA** (Weighted Moving Average) + trend + variance + prediction + risk + discipline:

| Metric | Formula / Tính Toán | Ngưỡng |
| :-- | :-- | :-- |
| **WMA** | `(x1×0.5 + x2×0.3 + x3×0.2)` (newest first) | Current form score chính |
| **Trend** | `x3 - x1` | UP (>1), STABLE (-1...1), DOWN (<-1) |
| **Variance** | Độ phân tán điểm | STABLE (<1), UNSTABLE (1-4), VOLATILE (>4) |
| **Momentum** | `(x3-x2) + (x2-x1)` | HOT (>1), NORMAL (-1...1), COLD (<-1) |
| **Predicted Score** | `0.48×wma + 0.22×avg + 0.12×trend + 0.08×momentum - 0.14×variance - 0.25×lossStreak` | Confidence |
| **Risk Score** | `trend×0.3 + variance×0.25 + streak×0.25 + prediction×0.2` | LOW (<35), MEDIUM (35-70), HIGH (>70) |
| **Discipline** | `100 - (redRate + yellowRate + foulRate)` | Discipline score |

**Tích Hợp vào Recommendation:**
- Cảnh báo phong độ bất thường (5 điều kiện) → **REPLACE** (priority 5)
- Risk HIGH + predicted low → **SELL** (priority 4)
- Risk MED OR VOLATILE OR DOWN → **BENCH** (priority 3)
- Risk >= 30 → **MONITOR** (priority 2)
- Risk < 30 + UP trend → **KEEP** (priority 1)

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
- Classification logic
- Transfer recommendation ranking
- Average score calculation

### Manual testing

1. Thêm cầu thủ ở Squad Management
2. Cập nhật tên/vị trí cầu thủ
3. Nhập điểm trận ở Rating (hệ thống đánh giá ngay khi có từ 1 trận)
4. Xem khuyến nghị ở Transfer Recommendation
5. Reset lịch sử điểm số trong Player Detail

## Ghi Chú Hiện Tại (May 18, 2026)

- ✅ **Match-First Flow:** Matches created via `POST /api/matches`, then rated via `POST /api/matches/:matchId/ratings`
- ✅ **Player Duplicate Check:** Tên cầu thủ không thể trùng lặp (case-insensitive)
- ✅ **CardSeason Field:** Replaces legacy "Season" field
- ✅ **Position Tracking:** Per-match position group + detailed position
- ✅ **Discipline & Aggression:** Tracked per match (yellowCards, redCards, fouls)
- ✅ **Unusual-form alert:** neutral 5-condition monitoring signal with REPLACE priority
- ✅ **Trend Analysis:** Integrated into recommendations (UP/DOWN/STABLE)
- ✅ **Bug Fixed:** Match 2 no longer overwrites Match 1 (uses matchId in SK)
- ⚠️ **Legacy Rating Flow:** `POST /api/rating` deprecated (410 Gone)
- 📝 **Safe dev seed:** `ALLOW_DATABASE_SEED=true npm run db:seed` chỉ dành cho database dev/test cô lập
- ✅ **Build & Test:** `npm test` passes, `npm run build` passes

## Các Tính Năng Mở Rộng

- Export danh sách khuyến nghị (CSV/PDF)
- Lịch sử chuyển nhượng + lợi nhuận/lỗ
- Đăng nhập & phân quyền
- Tích hợp dữ liệu bóng đá từ API ngoài
- Machine learning để dự đoán phong độ
- Gemini AI chatbot để tư vấn chuyển nhượng

**Version:** 2.1 | **Status:** Runtime on Neon/PostgreSQL; production restore settings cần xác minh thêm | **Tech:** Next.js 15 + Neon PostgreSQL

## Nhật ký cập nhật - 20/08/2026

- **Ngày thực hiện:** 20/08/2026
- **Công việc đã làm:** Chuyển lịch sử trận sang phân trang server-side; thêm tìm đối thủ, lọc ngày/kết quả/cầu thủ, sắp xếp ngày/rating; thêm modal sửa/xóa trận và form sửa rating.
- **Bug gặp phải:** Client cũ tải tối đa 100 trận rồi tự cắt trang; API danh sách chưa có metadata và thao tác rating chỉ có giao diện xem.
- **Cách xử lý:** Đưa điều kiện lọc, đếm tổng, `limit/offset` và thứ tự ổn định vào truy vấn Postgres; tái sử dụng `PATCH`, `DELETE` và API upsert rating hiện có; tự lùi trang khi xóa phần tử cuối.
- **File/khu vực liên quan:** `components/match-history.tsx`, `app/api/matches/**`, `lib/matchService.ts`, `lib/types.ts`, `lib/client-api.ts`, `app/globals.css`, `README.md`.
- **Ghi chú:** Khoảng ngày lọc trực tiếp trên cột `match_date` dạng ngày để không dịch ngày theo timezone. Build production đã vượt qua kiểm tra TypeScript.
