# DESIGN — Đĩa Việt

## Brief
- Người dùng: người trẻ 18–35 ăn ngoài hằng ngày, muốn biết bữa vừa ăn "nặng" cỡ nào mà không phải tra bảng. Dùng trên điện thoại, ngay tại bàn ăn.
- Câu giá trị: "Đĩa Việt giúp bạn biết bữa món Việt vừa ăn khoảng bao nhiêu calo trong 5 giây, với số liệu có nguồn."
- Hành trình: chụp/tải ảnh (hoặc ảnh mẫu) → AI nhận món → sửa món, khẩu phần → so với nhu cầu ngày → gợi ý → lưu nhật ký hôm nay.
- AI: task `meal` (vision, danh sách đóng 21 món) + `advice` (JSON). Số kcal: code × `public/data/dishes.json` (Hoàn Mỹ, Viện DDQG qua VnExpress…), nhu cầu ngày: RDA 2016.
- Đầu ra (bài thử deploy): một webapp public trên Vercel, chạy MOCK khi chưa có key.

## Design Read
"Đây là webapp công cụ cho người trẻ ăn ngoài, ngôn ngữ tươi, ngon miệng, thẳng thắn, nghiêng về food-editorial hiện đại." Mode: Operate (+ màn đầu Persuade).

## Hướng đã chọn: "Đĩa và vòng"
- Chất liệu: đĩa sứ trắng, rau thơm, ớt. Nền xanh lá rất nhạt (rau), chữ xanh đậm, accent đỏ ớt.
- Điểm táo bạo duy nhất: ảnh món ăn thành một chiếc **đĩa tròn**, quanh đĩa là **vòng kcal** chia đoạn theo từng món, vẽ dần khi có kết quả.
- Không làm: nền kem + serif, gradient tím, card đều tăm tắp, emoji thay icon.

## Token
| Tên | Giá trị | Vai trò |
|---|---|---|
| --bg | #F4F7F1 | nền rau nhạt |
| --surface | #FFFFFF | đĩa, thẻ |
| --ink | #11261B | chữ |
| --muted | #4A5D51 | chữ phụ |
| --line | #D8E2D5 | đường kẻ |
| --accent | #D9432B | ớt: CTA, vòng, focus |
| Display / body | Bricolage Grotesque 800 / Be Vietnam Pro 400–600 | đều có subset vietnamese |
