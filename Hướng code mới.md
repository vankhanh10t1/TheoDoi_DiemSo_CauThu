# Squad UI: Group Players by Position Group

Cập nhật UI “Đội hình” để gom nhóm cầu thủ theo nhóm vị trí.

## Yêu cầu

Group cầu thủ thành 4 section:

* GK
* DF
* MF
* FW

## Position mapping

* GK:

  * GK

* DF:

  * CB
  * LB
  * RB
  * LWB
  * RWB

* MF:

  * CDM
  * CM
  * CAM
  * LM
  * RM

* FW:

  * LW
  * RW
  * CF
  * ST

## UI behavior

* Mỗi group có tiêu đề riêng:

  * GK
  * DF
  * MF
  * FW

* Hiển thị số lượng cầu thủ trong từng group

* Trong mỗi group, render danh sách `SquadPlayerCard`

* Giữ màu card theo nhóm vị trí hiện có:

  * GK → yellow
  * DF → blue
  * MF → green
  * FW → orange

## Data rules

* Không dùng mock data
* Chỉ group từ player list thật lấy từ state/API/DynamoDB
* Nếu group không có cầu thủ:

  * có thể ẩn group
  * hoặc hiển thị empty state gọn

## Technical requirements

* Tạo/reuse helper:

  * `getPositionGroup(position)`
  * `groupPlayersByPosition(players)`

* Không duplicate logic mapping vị trí

* TypeScript strict typing

* Responsive/mobile-friendly

* Không phá search/filter hiện có ở màn hình “Đội hình”

## Mục tiêu

UI “Đội hình” hiển thị cầu thủ được phân nhóm rõ ràng theo GK/DF/MF/FW.
