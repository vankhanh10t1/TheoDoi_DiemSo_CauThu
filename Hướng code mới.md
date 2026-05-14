Update màn hình “Phong độ” để phân loại cầu thủ theo Risk Level.

Yêu cầu:

* Group cầu thủ theo:

  * LOW RISK
  * MEDIUM RISK
  * HIGH RISK

Risk mapping:

* LOW → xanh
* MEDIUM → vàng
* HIGH → đỏ

UI:

* mỗi group có section riêng
* hiển thị số lượng cầu thủ trong từng group
* card cầu thủ phải dùng màu/border/badge theo risk level
* ưu tiên mobile-friendly

Logic:

* dùng riskScore/riskLevel hiện có từ analytics engine
* không hardcode dữ liệu
* tất cả cầu thủ đã có ít nhất 1 trận đều phải được phân loại

Ngoài ra:

* sort:

  * HIGH risk lên đầu
  * trong cùng group sort theo riskScore giảm dần

Sau khi hoàn thành:

* test local
* commit rõ ràng
* push lên GitHub branch hiện tại
* verify Vercel redeploy thành công
