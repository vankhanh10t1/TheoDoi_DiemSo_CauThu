# FCON Performance Tracker — Hệ Thống Quản Lý Đội Hình + Hỗ Trợ Quyết Định Chuyển Nhượng

Ứng dụng web quản lý phong độ cầu thủ theo dữ liệu thực tế, cung cấp khuyến nghị chuyên biệt cho việc giữ/bán cầu thủ.

## Tính Năng

### 1. **Rating / Nhập Điểm Trận** (`📊 Rating` tab)
- Chọn cầu thủ từ dropdown
- Nhập điểm trận (1.0 – 10.0)
- Chọn kết quả (Thắng/Hòa/Thua)
- Chọn đá chính/dự bị
- Tự động tính phong độ dựa trên 5 trận gần nhất

### 2. **Squad Management** (`👥 Đội Hình` tab)
- **Xem danh sách cầu thủ** từ DynamoDB (hoặc fallback từ danh sách hard-coded)
- **Thêm cầu thủ mới**: nhập mã, tên, mùa giải, vị trí
- **Xóa cầu thủ**: xóa cấu thủ & toàn bộ dữ liệu trận đấu của họ
- **Xem chi tiết**: chuyển sang Player Detail screen

### 3. **Transfer Recommendation** (`🎯 Đề Xuất` tab)
Dựa trên 5 trận gần nhất, phân loại cầu thủ thành 3 nhóm:

| Mã Đề Xuất | Tiêu Chí                    | Hành Động Đề Nghị       | Ưu Tiên |
| :--------- | :------------------------- | :------------------ | :------ |
| 🚨 **SELL**   | Điểm < 4.5 (Fraud)        | Thanh lý ngay          | 🔴 Cao |
| ⚠️ **MONITOR**  | Điểm 4.5-5.9 (Under Review) | Theo dõi kỹ           | 🟠 Trung |
| ✅ **HOLD**     | Điểm ≥ 6.0 (Stable/Star)   | Giữ chặt đội hình      | 🟢 Thấp |

### 4. **Player Detail** (`🔍 Chi Tiết Cầu Thủ`)
- Xem tất cả thông tin cầu thủ
- Nhập điểm trận mới
- Xem 5 trận gần nhất + điểm trung bình
- Xem trạng thái phong độ hiện tại

---

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
    │Functions │◄────────►│ FCON_Table    │
    │ API      │           │ (Single-table │
    │ Routes   │           │  design)      │
    └──────────┘           └───────────────┘

API Routes:
- POST   /api/rating                    # Lưu điểm trận
- GET    /api/player-status?id={id}     # Tính phong độ
- GET    /api/players                   # Danh sách cầu thủ
- POST   /api/players                   # Thêm cầu thủ
- DELETE /api/players/{id}              # Xóa cầu thủ
- GET    /api/recommendations           # Khuyến nghị chuyển nhượng
```

---

## DynamoDB Schema

**Bảng:** `FCON_Table`

| Loại Item | PK | SK | Nội Dung |
| :-------- | :- | :- | :------- |
| **METADATA** | `PLAYER#{id}` | `METADATA` | Thông tin cầu thủ (Name, Season, Position) |
| **MATCH** | `PLAYER#{id}` | `MATCH#{ISO8601_timestamp}` | Điểm trận (Score, IsStarter, Result) |

**Ví dụ:**
```json
{
  "PK": "PLAYER#CR7",
  "SK": "METADATA",
  "Name": "C. Ronaldo",
  "Season": "21CU",
  "Position": "ST"
}

{
  "PK": "PLAYER#CR7",
  "SK": "MATCH#20260511T140000Z",
  "Score": 7.5,
  "IsStarter": true,
  "Result": "Win"
}
```

---

## Cấu Hình & Chạy

### 1. Cài Đặt Dependency

```bash
npm install
```

### 2. Cấu Hình AWS Credentials

Cập nhật `.env.local`:

```env
AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_ACCESS_KEY
AWS_REGION=ap-southeast-1
DYNAMODB_TABLE_NAME=FCON_Table
# Nếu dùng local DynamoDB:
# DYNAMODB_ENDPOINT=http://localhost:8000
```

### 3. Tạo Bảng DynamoDB (AWS Console)

- **Table name:** `FCON_Table`
- **Partition Key:** `PK` (String)
- **Sort Key:** `SK` (String)
- **Capacity:** Provisioned 1/1 (Free Tier)

### 4. Seed Dữ Liệu METADATA

```bash
npm run seed
```

### 5. Chạy Dev Server

```bash
npm run dev
```

Mở http://localhost:3000

### 6. Chạy Tests

```bash
npm test
```

### 7. Build Production

```bash
npm run build
npm start
```

---

## Phân Loại Phong Độ

Dựa trên **trung bình 5 trận gần nhất (X̄)**:

| X̄ | Status | Action | Màu |
| :- | :------- | :--- | :--- |
| > 8.0 | ⭐ **Star Player** | Giữ chặt đội hình chính | 🟢 Xanh |
| 6.0 – 8.0 | ✅ **Stable** | Tiếp tục tin dùng | ⚪ Trắng |
| 4.5 – 5.9 | ⚠️ **Under Review** | Đẩy lên ghế dự bị | 🟠 Vàng |
| < 4.5 | 🚨 **Fraud** | Thanh lý ngay | 🔴 Đỏ |

---

## State Management

App sử dụng **React Context** (`AppContext`) để quản lý:
- Current active tab/screen
- Selected player for detail view
- Refresh trigger (để reload data)

---

## Testing

### Unit Tests

```bash
npm test
```

Kiểm tra:
- Classification logic (phân loại phong độ)
- Transfer recommendation ranking
- Average score calculation

### Manual Testing

1. **Thêm cầu thủ** → Squad Management → "Thêm Cầu Thủ"
2. **Nhập điểm 5 trận** → Rating → chọn cầu thủ → nhập điểm
3. **Xem khuyến nghị** → Transfer Recommendation → check trạng thái
4. **Xem chi tiết** → Click "Chi Tiết" từ bất kỳ card nào

---

## Các Tính Năng Mở Rộng (Future)

- [ ] Export danh sách khuyến nghị (CSV/PDF)
- [ ] Lịch sử chuyển nhượng + lợi nhuận/lỗ
- [ ] Đăng nhập & quyền (multiple scouts)
- [ ] API tích hợp từ external sports data
- [ ] Machine learning để dự đoán phong độ
- [ ] Gemini AI chatbot để tư vấn chuyển nhượng
- [ ] Real-time updates (WebSocket)

---

## Support

Nếu gặp lỗi:
1. Kiểm tra `.env.local` credentials
2. Xác minh DynamoDB table tồn tại
3. Xem console browser (F12) để debug errors
4. Chạy `npm run build` để kiểm tra lỗi TypeScript

---

**Version:** 2.0 | **Status:** Production Ready | **Tech:** Next.js 15 + AWS DynamoDB
