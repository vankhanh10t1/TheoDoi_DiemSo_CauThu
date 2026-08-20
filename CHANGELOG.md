# Nhật ký thay đổi

## 20/08/2026

- Công việc đã làm: thêm dashboard xu hướng rating/WMA/prediction, KPI thắng-hòa-thua, bàn thắng, kiến tạo và bộ lọc 5/10/20 trận hoặc khoảng ngày; đổi font toàn app sang Roboto.
- Bug gặp phải: lịch sử API trả dữ liệu mới nhất trước, trong khi biểu đồ cần hiển thị từ cũ đến mới; một số cầu thủ không có đủ dữ liệu prediction.
- Cách xử lý: sắp xếp bằng helper thời gian hiện tại trước khi dựng chuỗi, tính WMA cuộn theo đúng thứ tự đầu vào của analytics, và chỉ vẽ prediction khi giá trị hợp lệ.
- File/khu vực liên quan: `components/trend-dashboard.tsx`, `components/tracker-app.tsx`, `app/layout.tsx`, `app/globals.css`, `README.md`.
- Ghi chú: chart dùng SVG thuần React, không thêm dependency; có empty state và tooltip native.
