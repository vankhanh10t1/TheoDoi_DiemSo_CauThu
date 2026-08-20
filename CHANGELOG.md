# Nhật ký thay đổi

## 20/08/2026 - Nâng cấp luồng rating

- Công việc đã làm: chia form rating thành 3 bước; bỏ rating mặc định 5; thêm tìm kiếm/chọn tất cả, cảnh báo giới hạn 49, bảng xác nhận, trạng thái loading/error/success, autosave/khôi phục/xóa draft và copy đội hình từ trận gần nhất mà không copy chỉ số.
- Công việc backend: bổ sung kiểm tra player trùng trong payload, giữ giới hạn 49 và chuẩn hóa thông báo validation tiếng Việt; cơ chế upsert hiện có tiếp tục hỗ trợ chỉnh sửa rating không tạo duplicate.
- Bug gặp phải: dữ liệu draft có thể không hợp lệ hoặc `localStorage` không khả dụng; copy đội hình có nguy cơ ghi đè dữ liệu đang nhập.
- Cách xử lý: bọc toàn bộ thao tác local storage bằng cơ chế an toàn, kiểm tra version/match của draft và dùng hộp thoại xác nhận nội bộ trước khi thay đội hình.
- File/khu vực liên quan: `components/bulk-rating-input-form.tsx`, `app/api/matches/[id]/ratings/route.ts`, `app/globals.css`, `README.md`, `CHANGELOG.md`.
- Ghi chú: `npm test` pass 38/38 test và `npm run build` thành công.

## 20/08/2026

- Công việc đã làm: thêm dashboard xu hướng rating/WMA/prediction, KPI thắng-hòa-thua, bàn thắng, kiến tạo và bộ lọc 5/10/20 trận hoặc khoảng ngày; đổi font toàn app sang Roboto.
- Bug gặp phải: lịch sử API trả dữ liệu mới nhất trước, trong khi biểu đồ cần hiển thị từ cũ đến mới; một số cầu thủ không có đủ dữ liệu prediction.
- Cách xử lý: sắp xếp bằng helper thời gian hiện tại trước khi dựng chuỗi, tính WMA cuộn theo đúng thứ tự đầu vào của analytics, và chỉ vẽ prediction khi giá trị hợp lệ.
- File/khu vực liên quan: `components/trend-dashboard.tsx`, `components/tracker-app.tsx`, `app/layout.tsx`, `app/globals.css`, `README.md`.
- Ghi chú: chart dùng SVG thuần React, không thêm dependency; có empty state và tooltip native.
