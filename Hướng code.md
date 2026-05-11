# FCON Performance Tracker — Đặc Tả Nghiệp Vụ (Anti-Bán Độ)

> **Phiên bản:** 1.1 | **Tech Lead reviewed** | Sẵn sàng cho GitHub Copilot

---

## 1. Mục Tiêu Ứng Dụng

Xây dựng hệ thống quản trị phong độ cầu thủ dựa trên dữ liệu thực tế nhằm:

- Loại bỏ cảm tính trong việc sắp xếp đội hình
- Phát hiện sớm các nhân tố "bán độ" (phong độ giả tạo, thi đấu kém ổn định)
- Tối ưu hóa quyết định liên quan đến quỹ chuyển nhượng

---

## 2. Kiến Trúc Dữ Liệu — DynamoDB Single-Table Design

### 2.1. Tên bảng

```
FCON_Table
```

### 2.2. Khóa chính

| Thuộc tính            | Kiểu   | Giá trị mẫu                         |
| :-------------------- | :----- | :---------------------------------- |
| `PK` (Partition Key)  | String | `PLAYER#CR7`                        |
| `SK` (Sort Key)       | String | `METADATA` hoặc `MATCH#<timestamp>` |

### 2.3. Hai loại Item trong bảng

**Item loại 1 — Thông tin cầu thủ (METADATA)**

```json
{
  "PK": "PLAYER#CR7",
  "SK": "METADATA",
  "Name": "C. Ronaldo",
  "Season": "21CU",
  "Position": "ST"
}
```

**Item loại 2 — Kết quả từng trận (MATCH)**

```json
{
  "PK": "PLAYER#CR7",
  "SK": "MATCH#20260511T140000Z",
  "Score": 4.5,
  "IsStarter": true,
  "Result": "Loss"
}
```

> **Lưu ý thiết kế:** Sort Key dạng `MATCH#<ISO8601_timestamp>` cho phép sắp xếp theo thời gian tự nhiên và truy vấn bằng `begins_with`.

---

## 3. Kiến Trúc Hệ Thống

```
[React/Next.js Frontend]
        │
        ▼
[Vercel Serverless Functions]
        │
        ▼
[AWS DynamoDB — FCON_Table]
```

- **Frontend:** React / Next.js — Mobile-first UI
- **Backend:** Vercel Functions (Node.js runtime)
- **Database:** AWS DynamoDB (Free Tier — Provisioned Mode, kết nối trực tiếp từ ngày đầu)

---

## 4. Quy Trình Nghiệp Vụ

### 4.1. Luồng Nhập Điểm (Entry Flow)

```
Người dùng mở app
      │
      ▼
Chọn cầu thủ từ Dropdown
(Load từ các item có SK = "METADATA")
      │
      ▼
Nhập điểm trận đấu (1.0 – 10.0)
      │
      ▼
Nhấn "Lưu"
      │
      ▼
[POST /api/rating]
Tạo item mới:
  PK = "PLAYER#{PlayerID}"
  SK = "MATCH#{Current_ISO_Timestamp}"
  Score, IsStarter, Result
      │
      ▼
Xác nhận lưu thành công
```

### 4.2. Luồng Đánh Giá Phong Độ (Evaluation Flow)

```
Chọn cầu thủ
      │
      ▼
[GET /api/player-status?id={playerId}]
      │
      ▼
DynamoDB Query:
  KeyConditionExpression: PK = "PLAYER#{id}"
                          AND SK begins_with "MATCH#"
  ScanIndexForward: false   ← Trận mới nhất lên đầu
      │
      ▼
Backend tính toán
      │
  ├─ Số trận = 0 → Trả về "Đang theo dõi"
      │
  └─ Số trận > 0 → Tính trung bình (X̄)
                             │
                             ▼
                       Phân loại phong độ
                       (xem Bảng §5)
```

---

## 5. Hệ Thống Phân Loại Phong Độ

Dựa trên **điểm trung bình toàn bộ số trận hiện có (X̄)**:

| Điểm X̄      | Trạng thái           | Hành động                   | Màu UI      |
| :----------- | :------------------- | :-------------------------- | :---------- |
| `> 8.0`      | ⭐ **Star Player**    | Giữ chặt đội hình chính     | 🟢 Xanh lá  |
| `6.0 – 8.0`  | ✅ **Stable**         | Tiếp tục tin dùng           | ⚪ Trắng     |
| `4.5 – 5.9`  | ⚠️ **Under Review**  | Đẩy lên ghế dự bị          | 🟠 Vàng cam |
| `< 4.5`      | 🚨 **Fraud**          | Thanh lý ngay lập tức       | 🔴 Đỏ chói  |

---

## 6. API Specification

### `POST /api/rating`

Lưu điểm số cho một cầu thủ sau trận đấu.

**Request Body:**

```json
{
  "playerId": "CR7",
  "score": 7.5,
  "isStarter": true,
  "result": "Win"
}
```

**Validation rules:**

- `score`: Bắt buộc, kiểu `number`, trong khoảng `[1.0, 10.0]`
- `playerId`: Bắt buộc, phải tồn tại trong bảng (SK = `METADATA`)
- `result`: Enum — `"Win"` | `"Draw"` | `"Loss"`

**Response (201 Created):**

```json
{
  "message": "Rating saved successfully",
  "sk": "MATCH#20260511T140000Z"
}
```

---

### `GET /api/player-status?id={playerId}`

Tính toán và trả về phong độ hiện tại của cầu thủ.

**Response — Đủ dữ liệu (200 OK):**

```json
{
  "playerId": "CR7",
  "name": "C. Ronaldo",
  "averageScore": 7.2,
  "matchCount": 3,
  "status": "Stable",
  "action": "Tiếp tục tin dùng",
  "color": "white",
  "recentMatches": [
    { "sk": "MATCH#20260511T140000Z", "score": 7.5, "result": "Win" }
  ]
}
```

**Response — Chưa có dữ liệu trận (200 OK):**

```json
{
  "playerId": "CR7",
  "name": "C. Ronaldo",
  "matchCount": 0,
  "status": "Đang theo dõi",
  "message": "Chưa có dữ liệu trận để đánh giá"
}
```

---

## 7. Kế Hoạch Triển Khai (Roadmap)

### Phase 1 — Setup & Seed

- [ ] Khởi tạo project Next.js + TypeScript
- [ ] Cài đặt AWS SDK v3:
  ```bash
  npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
  ```
- [ ] Tạo bảng `FCON_Table` trên **AWS Console**:
  - Partition Key: `PK` (String)
  - Sort Key: `SK` (String)
  - Capacity mode: Provisioned — Read/Write 1/1 (đủ Free Tier)
- [ ] Tạo **IAM User** với policy `AmazonDynamoDBFullAccess`, tải Access Key về
- [ ] Cấu hình `.env.local`:
  ```env
  AWS_ACCESS_KEY_ID=your_key
  AWS_SECRET_ACCESS_KEY=your_secret
  AWS_REGION=ap-southeast-1
  DYNAMODB_TABLE_NAME=FCON_Table
  ```
- [ ] Viết script `scripts/seed.ts` nhập danh sách cầu thủ ban đầu (METADATA items)
- [ ] Chạy seed một lần duy nhất:
  ```bash
  npx ts-node scripts/seed.ts
  ```

### Phase 2 — Business Logic

- [ ] Xây dựng `lib/dynamodb.ts` — khởi tạo DynamoDB client từ biến môi trường
- [ ] Xây dựng `lib/evaluationEngine.ts` — hàm tính X̄ và phân loại phong độ
- [ ] Xây dựng `POST /api/rating` với đầy đủ validation
- [ ] Xây dựng `GET /api/player-status` với thuật toán truy vấn toàn bộ trận hiện có
- [ ] Unit test cho logic phân loại phong độ
- [ ] Xử lý edge case: điểm không hợp lệ, cầu thủ không tồn tại, chưa có trận đấu

### Phase 3 — Deploy lên Vercel

- [ ] Push code lên GitHub (đảm bảo `.env.local` đã có trong `.gitignore`)
- [ ] Kết nối repo với Vercel
- [ ] Cấu hình biến môi trường trên **Vercel Dashboard** (giống `.env.local`)
- [ ] Deploy và smoke test toàn bộ luồng trên production

---

## 8. Cấu Trúc Thư Mục Đề Xuất

```
fcon-tracker/
├── app/
│   ├── api/
│   │   ├── rating/
│   │   │   └── route.ts          # POST /api/rating
│   │   └── player-status/
│   │       └── route.ts          # GET /api/player-status
│   └── page.tsx                  # Main UI
├── lib/
│   ├── dynamodb.ts               # AWS SDK client config
│   ├── playerService.ts          # Query logic
│   └── evaluationEngine.ts       # Thuật toán phân loại phong độ
├── scripts/
│   └── seed.ts                   # Nhập dữ liệu cầu thủ ban đầu lên AWS
└── .env.local                    # Biến môi trường (KHÔNG commit lên Git)
```

---

## 9. Ghi Chú Kỹ Thuật (Tech Lead Notes)

> *"Chúng ta dùng DynamoDB không phải chỉ để lưu trữ, mà để tận dụng tốc độ của nó trên Vercel."*

**Những điểm cần đặc biệt chú ý khi code:**

1. **Tốc độ là ưu tiên số 1** — Giao diện phải phản hồi trong vòng 30 giây nghỉ giữa 2 hiệp đấu.
2. **Validation nghiêm ngặt** — Điểm số phải là số thực trong `[1.0, 10.0]`, reject mọi input không hợp lệ trước khi gọi DynamoDB.
3. **Sort Key timestamp** — Dùng ISO 8601 UTC (`YYYYMMDDTHHMMSSZ`) để đảm bảo sắp xếp đúng thứ tự thời gian.
4. **Query thay vì Scan** — Luôn dùng `Query` với `KeyConditionExpression`, tuyệt đối không dùng `Scan` trong production.
5. **Bảo mật credentials** — Thêm `.env.local` vào `.gitignore` ngay từ commit đầu tiên. Không bao giờ hardcode Access Key trong code.
6. **Free Tier an toàn** — Provisioned capacity 1/1 RCU/WCU đủ dùng cho dev/test; theo dõi CloudWatch Metrics nếu có kế hoạch mở rộng.
7. **Mobile-first** — Toàn bộ UI thiết kế cho màn hình điện thoại trước, responsive desktop sau.