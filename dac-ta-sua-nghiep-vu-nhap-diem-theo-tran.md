# Đặc tả sửa nghiệp vụ nhập điểm cầu thủ theo từng trận đấu

## 1. Bối cảnh hiện tại

Hiện tại app theo dõi phong độ cầu thủ đang có lỗi nghiệp vụ nghiêm trọng:

- Người dùng nhập điểm cho từng cầu thủ.
- Khi nhập điểm cho 11 cầu thủ, hệ thống lại hiểu đó là điểm của 11 trận đấu khác nhau.
- Trong thực tế, 11 điểm đó phải thuộc cùng một trận đấu.

Ví dụ sai hiện tại:

```txt
Neuer: 7.0   => hệ thống hiểu là trận 1
Kimmich: 7.5 => hệ thống hiểu là trận 2
Musiala: 8.0 => hệ thống hiểu là trận 3
Kane: 9.0    => hệ thống hiểu là trận 4
```

Cách hiểu đúng phải là:

```txt
Match #001: Bayern 4 - 1 Arsenal

Neuer: 7.0
Kimmich: 7.5
Musiala: 8.0
Kane: 9.0

=> Tất cả rating trên đều thuộc cùng Match #001
```

---

## 2. Mục tiêu cần sửa

Cần thay đổi nghiệp vụ nhập điểm theo mô hình:

1. Người dùng tạo một trận đấu trước.
2. Trận đấu có thông tin kết quả, tỉ số, ngày thi đấu, đối thủ và ghi chú.
3. Sau khi tạo trận đấu, người dùng mới nhập điểm cho các cầu thủ đã tham gia trận đó.
4. Tất cả điểm cầu thủ được nhập ở bước này phải dùng chung cùng một `matchId`.
5. Hệ thống không được hiểu 11 điểm cầu thủ là 11 trận đấu khác nhau nữa.

Nói ngắn gọn:

```txt
Match là cha.
PlayerMatchRating là con.
```

Quan hệ đúng:

```txt
1 Match có nhiều PlayerMatchRating
1 Player có nhiều PlayerMatchRating qua nhiều Match
```

---

## 3. Luồng nghiệp vụ mới

Luồng mới cần được triển khai như sau:

```txt
User bấm "Thêm trận đấu"
        ↓
Nhập ngày thi đấu, đối thủ, tỉ số
        ↓
Hệ thống tự tính kết quả Win/Draw/Lose
        ↓
Lưu Match
        ↓
Đi đến màn hình nhập điểm cầu thủ
        ↓
User chọn cầu thủ tham gia và nhập rating
        ↓
Lưu nhiều PlayerMatchRating cùng matchId
        ↓
Cập nhật thống kê phong độ
```

Ví dụ:

```txt
Trận đấu:
Bayern 4 - 1 Arsenal

Result: WIN
Match ID: match_abc123
```

Sau đó nhập điểm:

```txt
Neuer: 7.0
Davies: 7.5
Kimmich: 8.0
Musiala: 8.5
Kane: 9.0
```

Hệ thống phải lưu thành:

```txt
rating_1 -> match_abc123 -> Neuer -> 7.0
rating_2 -> match_abc123 -> Davies -> 7.5
rating_3 -> match_abc123 -> Kimmich -> 8.0
rating_4 -> match_abc123 -> Musiala -> 8.5
rating_5 -> match_abc123 -> Kane -> 9.0
```

---

## 4. Data model đề xuất

### 4.1. Model `Match`

Dùng để lưu thông tin của từng trận đấu.

```ts
type Match = {
  id: string;
  matchDate: string;
  opponentName?: string;
  myScore: number;
  opponentScore: number;
  result: "WIN" | "DRAW" | "LOSE";
  note?: string;
  createdAt: string;
  updatedAt: string;
};
```

Ví dụ dữ liệu:

```json
{
  "id": "match_001",
  "matchDate": "2026-05-18",
  "opponentName": "Arsenal",
  "myScore": 4,
  "opponentScore": 1,
  "result": "WIN",
  "note": "Trận thắng đậm, hàng công đá tốt",
  "createdAt": "2026-05-18T13:30:00Z",
  "updatedAt": "2026-05-18T13:30:00Z"
}
```

---

### 4.2. Model `PlayerMatchRating`

Dùng để lưu điểm của từng cầu thủ trong từng trận.

```ts
type PlayerMatchRating = {
  id: string;
  matchId: string;
  playerId: string;
  rating: number;
  position?: "GK" | "DF" | "MF" | "FW";
  goals?: number;
  assists?: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
};
```

Ví dụ dữ liệu:

```json
[
  {
    "id": "rating_001",
    "matchId": "match_001",
    "playerId": "neuer",
    "rating": 7.0,
    "goals": 0,
    "assists": 0
  },
  {
    "id": "rating_002",
    "matchId": "match_001",
    "playerId": "kimmich",
    "rating": 7.5,
    "goals": 0,
    "assists": 1
  },
  {
    "id": "rating_003",
    "matchId": "match_001",
    "playerId": "kane",
    "rating": 9.0,
    "goals": 2,
    "assists": 0
  }
]
```

---

## 5. Quan hệ dữ liệu

Mô hình quan hệ cần đạt được:

```txt
Player 1 --- n PlayerMatchRating n --- 1 Match
```

Giải thích:

- Một trận đấu có nhiều điểm đánh giá cầu thủ.
- Một cầu thủ có thể được đánh giá ở nhiều trận khác nhau.
- Một cầu thủ chỉ được có một rating trong cùng một trận.
- Cần đảm bảo unique theo cặp `matchId + playerId`.

---

## 6. UI cần sửa

Cần tách luồng nhập điểm thành 2 bước.

---

### 6.1. Bước 1: Tạo trận đấu

Tạo màn hình hoặc form tên là:

```txt
Thêm trận đấu
```

Các field cần có:

```txt
Ngày thi đấu
Tên đối thủ
Tỉ số đội mình
Tỉ số đối thủ
Ghi chú trận đấu
```

Không nên bắt người dùng tự chọn kết quả nếu đã có tỉ số.

Kết quả phải được hệ thống tự động suy ra:

```ts
if (myScore > opponentScore) result = "WIN";
else if (myScore === opponentScore) result = "DRAW";
else result = "LOSE";
```

Ví dụ:

```txt
Tỉ số: 3 - 1
=> Result: WIN
```

```txt
Tỉ số: 2 - 2
=> Result: DRAW
```

```txt
Tỉ số: 0 - 3
=> Result: LOSE
```

Sau khi lưu trận thành công, chuyển sang bước nhập điểm cầu thủ cho trận đó.

---

### 6.2. Bước 2: Nhập điểm cầu thủ trong trận

Tạo màn hình hoặc form tên là:

```txt
Nhập điểm cầu thủ cho trận đấu
```

Phần đầu trang cần hiển thị thông tin trận:

```txt
Trận đấu: Bayern 4 - 1 Arsenal
Kết quả: WIN
Ngày: 18/05/2026
```

Bên dưới là bảng nhập điểm cầu thủ:

```txt
| Cầu thủ  | Vị trí | Tham gia | Điểm | Bàn thắng | Kiến tạo | Ghi chú |
|----------|-------|----------|------|-----------|----------|---------|
| Neuer    | GK    | Có       | 7.0  | 0         | 0        |         |
| Kimmich  | MF    | Có       | 7.5  | 0         | 1        |         |
| Musiala  | MF    | Có       | 8.0  | 1         | 1        |         |
| Kane     | FW    | Có       | 9.0  | 2         | 0        |         |
```

Yêu cầu:

- Có checkbox hoặc trạng thái `Tham gia trận`.
- Chỉ lưu rating cho cầu thủ được đánh dấu là có tham gia.
- Không bắt buộc đúng 11 cầu thủ.
- Cho phép nhập cả cầu thủ dự bị nếu có.
- Nút lưu nên là `Lưu điểm trận đấu`.

Không nên đặt nút là `Lưu cầu thủ`, vì nghiệp vụ đang lưu điểm của cả trận.

---

## 7. Các màn hình cần có

### 7.1. Màn hình danh sách trận đấu

Hiển thị danh sách các trận đã nhập.

Ví dụ:

```txt
| Ngày       | Đối thủ  | Tỉ số | Kết quả | Số cầu thủ đã chấm |
|------------|----------|-------|---------|--------------------|
| 18/05/2026 | Arsenal  | 4-1   | WIN     | 11                 |
| 15/05/2026 | Chelsea  | 2-2   | DRAW    | 13                 |
| 12/05/2026 | Man Utd  | 0-3   | LOSE    | 11                 |
```

---

### 7.2. Màn hình chi tiết trận đấu

Hiển thị thông tin trận và bảng điểm cầu thủ.

Ví dụ:

```txt
Bayern 4 - 1 Arsenal
Kết quả: WIN
Ngày: 18/05/2026
Ghi chú: Trận thắng đậm, hàng công đá tốt
```

Bảng điểm:

```txt
| Cầu thủ  | Vị trí | Điểm | Bàn | Kiến tạo | Ghi chú |
|----------|-------|------|-----|----------|---------|
| Kane     | FW    | 9.0  | 2   | 0        | Gánh hàng công |
| Musiala  | MF    | 8.5  | 1   | 1        | Rê bóng tốt |
| Neuer    | GK    | 7.0  | 0   | 0        | Ổn định |
```

---

### 7.3. Màn hình thêm trận đấu

Form tạo trận gồm:

```txt
Ngày thi đấu
Tên đối thủ
Tỉ số đội mình
Tỉ số đối thủ
Ghi chú
```

Sau khi bấm lưu:

```txt
Tạo trận thành công -> chuyển sang màn hình nhập điểm cầu thủ.
```

---

### 7.4. Màn hình nhập/sửa điểm cầu thủ trong trận

Form hoặc bảng nhập điểm hàng loạt gồm:

```txt
Chọn cầu thủ tham gia
Nhập điểm từng cầu thủ
Nhập bàn thắng
Nhập kiến tạo
Nhập ghi chú nếu có
Lưu tất cả
```

Cần hỗ trợ sửa lại điểm sau khi đã lưu.

---

## 8. API / Function cần có

### 8.1. Tạo trận đấu

Nếu dùng API REST:

```http
POST /api/matches
```

Body:

```json
{
  "matchDate": "2026-05-18",
  "opponentName": "Arsenal",
  "myScore": 4,
  "opponentScore": 1,
  "note": "Trận thắng đậm, hàng công đá tốt"
}
```

Backend tự tính result:

```ts
function calculateResult(myScore: number, opponentScore: number) {
  if (myScore > opponentScore) return "WIN";
  if (myScore === opponentScore) return "DRAW";
  return "LOSE";
}
```

Response:

```json
{
  "id": "match_abc123",
  "matchDate": "2026-05-18",
  "opponentName": "Arsenal",
  "myScore": 4,
  "opponentScore": 1,
  "result": "WIN"
}
```

Nếu dùng function nội bộ:

```ts
createMatch(data)
```

---

### 8.2. Lưu nhiều rating cho một trận

Nếu dùng API REST:

```http
POST /api/matches/:matchId/ratings
```

Body:

```json
{
  "ratings": [
    {
      "playerId": "neuer",
      "rating": 7.0,
      "goals": 0,
      "assists": 0,
      "note": ""
    },
    {
      "playerId": "kane",
      "rating": 9.0,
      "goals": 2,
      "assists": 1,
      "note": "Gánh hàng công"
    }
  ]
}
```

Nếu dùng function nội bộ:

```ts
saveMatchRatings(matchId, ratings)
```

Ví dụ:

```ts
saveMatchRatings("match_001", [
  { playerId: "neuer", rating: 7.0 },
  { playerId: "kimmich", rating: 7.5 },
  { playerId: "musiala", rating: 8.0 },
  { playerId: "kane", rating: 9.0 }
]);
```

Yêu cầu:

- Tất cả rating phải gắn cùng `matchId`.
- Không được tạo một match mới cho mỗi rating.
- Không được lưu trùng một cầu thủ trong cùng một trận.

---

## 9. Nếu dùng DynamoDB

Nếu app đang dùng DynamoDB, có thể thiết kế theo 2 table cho dễ triển khai.

---

### 9.1. Table `Matches`

```txt
PK: matchId

Các field:
- matchDate
- opponentName
- myScore
- opponentScore
- result
- note
- createdAt
- updatedAt
```

Ví dụ:

```json
{
  "matchId": "match_001",
  "matchDate": "2026-05-18",
  "opponentName": "Arsenal",
  "myScore": 4,
  "opponentScore": 1,
  "result": "WIN",
  "note": "Trận thắng đậm"
}
```

---

### 9.2. Table `PlayerMatchRatings`

```txt
PK: matchId
SK: playerId

Các field:
- rating
- goals
- assists
- note
- createdAt
- updatedAt
```

Ví dụ:

```json
{
  "matchId": "match_001",
  "playerId": "kane",
  "rating": 9.0,
  "goals": 2,
  "assists": 0,
  "note": "Gánh hàng công"
}
```

Cách query toàn bộ rating của một trận:

```txt
Query PlayerMatchRatings where PK = match_001
```

Kết quả:

```txt
match_001 | neuer
match_001 | kimmich
match_001 | musiala
match_001 | kane
```

---

### 9.3. GSI để xem lịch sử phong độ cầu thủ

Để lấy lịch sử phong độ của một cầu thủ, nên thêm GSI:

```txt
GSI1PK: playerId
GSI1SK: matchDate
```

Dùng để query:

```txt
Lấy toàn bộ rating của Kane qua các trận
```

---

## 10. Validate bắt buộc

Cần xử lý các rule sau:

```txt
1. Không cho tạo trận nếu thiếu ngày thi đấu.
2. Không cho nhập tỉ số âm.
3. Result phải tự suy ra từ tỉ số.
4. Không cho nhập rating ngoài khoảng 0 - 10.
5. Không cho một playerId bị nhập trùng trong cùng một matchId.
6. Một trận có thể có từ 1 đến nhiều cầu thủ được chấm điểm.
7. Không bắt buộc đúng 11 cầu thủ.
8. Có thể cho phép sửa điểm sau khi đã lưu.
9. Nếu xóa trận đấu thì phải xóa hoặc vô hiệu hóa toàn bộ rating thuộc trận đó.
10. Khi thống kê phong độ, chỉ tính các rating có matchId hợp lệ.
11. Không được tạo một trận mới cho mỗi rating cầu thủ.
```

Rule quan trọng nhất:

```txt
Unique: matchId + playerId
```

---

## 11. Cách tính phong độ sau khi sửa nghiệp vụ

Sau khi có model mới, việc tính phong độ sẽ chuẩn hơn.

Ví dụ muốn tính phong độ cầu thủ trong 5 trận gần nhất:

```txt
Lấy 5 PlayerMatchRating gần nhất của playerId đó
Tính average rating
Kết hợp với kết quả trận đấu tương ứng
```

Công thức đơn giản:

```ts
formScore = averageRating;
```

Công thức tốt hơn:

```ts
formScore =
  averageRating * 0.7
  + winRateScore * 0.2
  + contributionScore * 0.1;
```

Trong đó:

```txt
averageRating: điểm trung bình cầu thủ
winRateScore: tỉ lệ thắng ở các trận cầu thủ tham gia
contributionScore: điểm đóng góp từ bàn thắng và kiến tạo
```

Ví dụ:

```txt
Kane 5 trận gần nhất:
9.0, 8.5, 7.5, 8.0, 9.5

Điểm trung bình = 8.5
Đội thắng 4/5 trận = winRate 80%
Có 6 bàn + 2 kiến tạo

=> Phong độ: Rất cao
```

---

## 12. Yêu cầu kết quả cuối cùng

Sau khi sửa, hệ thống phải hoạt động đúng như sau:

```txt
Người dùng tạo 1 trận đấu:
Bayern 4 - 1 Arsenal

Sau đó nhập điểm cho 11 cầu thủ:
Neuer 7.0
Davies 7.5
Kimmich 8.0
Musiala 8.5
Kane 9.0
...

Hệ thống phải hiểu:
Tất cả 11 điểm trên thuộc cùng một trận đấu.
```

Không được hiểu sai thành:

```txt
11 cầu thủ = 11 trận đấu
```

Mà phải hiểu đúng là:

```txt
1 trận đấu = nhiều điểm cầu thủ
```

---

## 13. Tóm tắt ngắn gọn cho developer

Cần refactor nghiệp vụ nhập điểm từ kiểu cũ:

```txt
PlayerRating tự đại diện cho một trận
```

Sang kiểu mới:

```txt
Match đại diện cho một trận
PlayerMatchRating đại diện cho điểm của một cầu thủ trong trận đó
```

Cấu trúc đúng:

```txt
Match
  -> thông tin trận
  -> danh sách cầu thủ tham gia
  -> điểm từng cầu thủ trong trận
```

Khi nhập điểm cho nhiều cầu thủ trong cùng một trận, tất cả rating phải dùng chung một `matchId`.

Đây là thay đổi nghiệp vụ bắt buộc để app theo dõi phong độ cầu thủ hoạt động đúng.
