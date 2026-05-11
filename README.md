# FCON Performance Tracker — Hệ thống quản lý đội hình và phong độ

Ứng dụng web Next.js để quản lý cầu thủ, nhập điểm trận, đánh giá phong độ 5 trận gần nhất và đưa ra khuyến nghị giữ/bán cầu thủ dựa trên dữ liệu thực tế từ DynamoDB.

## Tính Năng

### 1. Rating / Nhập Điểm Trận (`📊 Rating`)
- Chọn cầu thủ từ danh sách cầu thủ thực tế đang có trong app
- Nhập điểm trận từ 1.0 đến 10.0
- Chọn kết quả: Win / Draw / Loss
- Chọn đá chính hoặc dự bị
- Tự động tính phong độ dựa trên 5 trận gần nhất

### 2. Squad Management (`👥 Đội Hình`)
- Xem danh sách cầu thủ lấy từ DynamoDB
- Thêm cầu thủ mới với tên và vị trí, `playerId` được tạo tự động
- Cập nhật cầu thủ: sửa tên + vị trí
- Xóa cầu thủ và toàn bộ lịch sử trận đấu của cầu thủ đó
- Reset lịch sử điểm số của một cầu thủ mà không xóa cầu thủ
- Xem chi tiết cầu thủ

### 3. Transfer Recommendation (`🎯 Đề Xuất`)
Dựa trên 5 trận gần nhất, hệ thống phân loại cầu thủ thành 3 nhóm:

| Mã Đề Xuất | Tiêu Chí | Hành Động Đề Nghị | Ưu Tiên |
| :-- | :-- | :-- | :-- |
| 🚨 **SELL** | Điểm < 4.5 | Thanh lý ngay | 🔴 Cao |
| ⚠️ **MONITOR** | Điểm 4.5 - 5.9 | Theo dõi kỹ | 🟠 Trung |
| ✅ **HOLD** | Điểm ≥ 6.0 | Giữ chặt đội hình | 🟢 Thấp |

### 4. Player Detail (`🔍 Chi Tiết Cầu Thủ`)
- Xem thông tin cầu thủ
- Nhập điểm trận mới
- Xem 5 trận gần nhất và điểm trung bình
- Xem trạng thái phong độ hiện tại
- Reset lịch sử điểm số của cầu thủ

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

## API Routes

- `POST /api/rating` - Lưu điểm trận
- `GET /api/player-status?id={id}` - Tính phong độ
- `GET /api/players` - Danh sách cầu thủ
- `POST /api/players` - Thêm cầu thủ
- `PATCH /api/players/{id}` - Cập nhật tên + vị trí
- `DELETE /api/players/{id}` - Xóa cầu thủ và toàn bộ dữ liệu trận đấu
- `PATCH /api/players/{id}/reset` - Xóa lịch sử điểm số, giữ lại cầu thủ
- `GET /api/recommendations` - Khuyến nghị chuyển nhượng

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
  "Result": "Win"
}
```

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

## Phân Loại Phong Độ

Dựa trên trung bình 5 trận gần nhất (`X̄`):

| X̄ | Status | Action |
| :-- | :-- | :-- |
| > 8.0 | ⭐ Star Player | Giữ chặt đội hình chính |
| 6.0 - 8.0 | ✅ Stable | Tiếp tục tin dùng |
| 4.5 - 5.9 | ⚠️ Under Review | Đẩy lên ghế dự bị |
| < 4.5 | 🚨 Fraud | Thanh lý ngay |

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
3. Nhập điểm 5 trận ở Rating
4. Xem khuyến nghị ở Transfer Recommendation
5. Reset lịch sử điểm số trong Player Detail

## Ghi chú hiện tại

- Không còn dữ liệu mock/default cho danh sách cầu thủ
- `playerId` được tạo tự động khi thêm cầu thủ
- `npm run seed` hiện không còn là luồng bắt buộc cho app

## Các Tính Năng Mở Rộng

- Export danh sách khuyến nghị (CSV/PDF)
- Lịch sử chuyển nhượng + lợi nhuận/lỗ
- Đăng nhập & phân quyền
- Tích hợp dữ liệu bóng đá từ API ngoài
- Machine learning để dự đoán phong độ
- Gemini AI chatbot để tư vấn chuyển nhượng

**Version:** 2.0 | **Status:** Production Ready | **Tech:** Next.js 15 + AWS DynamoDB
