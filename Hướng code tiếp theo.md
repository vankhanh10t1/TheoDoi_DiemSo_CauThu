# Create SquadPlayerCard + PerformanceTable

Dựa trên file markdown spec hiện tại, tạo/cập nhật các component sau:

## 1. `components/SquadPlayerCard.tsx`

Yêu cầu:

* Tạo component card cầu thủ dùng cho UI “Đội hình”
* Áp dụng màu theo nhóm vị trí:

Mapping:

* GK → yellow
* DF: CB, LB, RB, LWB, RWB → blue
* MF: CDM, CM, CAM, LM, RM → green
* FW: LW, RW, CF, ST → orange

Card cần hiển thị tối thiểu:

* tên cầu thủ
* mùa thẻ
* vị trí
* số trận nếu có
* risk nếu có

Không hiển thị player ID.

## 2. `components/PerformanceTable.tsx`

Yêu cầu:

* Tạo component hiển thị danh sách phong độ cầu thủ
* Dùng cùng position color mapping như `SquadPlayerCard`
* Hiển thị các field chính:

  * tên cầu thủ
  * mùa thẻ
  * vị trí
  * số trận
  * WMA nếu có
  * Trend nếu có
  * Risk nếu có

## 3. Yêu cầu chung

* TypeScript strict typing
* Không dùng mock/hardcoded player data
* Nhận data qua props
* Reuse helper `getPositionGroup/getPositionColor` nếu có
* Nếu chưa có helper thì tạo helper nhỏ để tránh duplicate logic
* UI responsive/mobile-friendly
* Không phá layout hiện tại

Mục tiêu:

* UI “Đội hình” và “Phong độ” đổi màu cầu thủ đúng theo nhóm vị trí trong spec.
