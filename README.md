# Đĩa Việt: chụp món Việt, biết ngay bao nhiêu calo

Webapp mẫu dựng bằng skill `aitc-web` để thử quy trình deploy Vercel. Dạng đề: dinh dưỡng, chụp ảnh tính calo.

- **AI (qua Gateway, key ở server):**
  - task `meal` (vision): chọn món trong danh sách đóng 21 món, ước lượng khẩu phần và số lượng; món ngoài danh sách gắn nhãn "ước tính AI";
  - task `advice` (JSON): 3 gợi ý ngắn kèm một món đổi tương đương.
- **Số liệu:** kcal không do AI nghĩ ra, mà tính bằng code từ `public/data/dishes.json` (Bệnh viện Hoàn Mỹ; Viện Dinh dưỡng Quốc gia qua VnExpress; nguồn hạng C ghi rõ). Nhu cầu ngày lấy từ RDA 2016 (QĐ 2615/QĐ-BYT). Kết quả luôn hiện kèm khoảng sai số.
- **Dự phòng:** chưa có key thì API trả `mock:true`. Ảnh mẫu khi đó hiện kết quả AI đã chạy trước (`public/js/presets.js`) và có nhãn rõ.
- **Chi phí đo được** (gemini-3.5-flash): mỗi lượt nhận diện khoảng $0.004–0.008, mất 2–5 giây; mỗi lượt gợi ý khoảng $0.008, mất ~7 giây.

## Chạy
```bash
node scripts/dev.mjs                     # http://localhost:3000 — đọc .env gần nhất (PRODUCT_GATEWAY_KEY / GATEWAY_KEY, GATEWAY_BASE_URL)
```
Trên Vercel, vào Settings → Environment Variables, đặt `PRODUCT_GATEWAY_KEY`, `GATEWAY_BASE_URL` (Gateway truy cập được từ
internet) và `FALLBACK_MOCK=1`, rồi redeploy.

Ảnh mẫu lấy từ Wikimedia Commons (credit ở chân trang và trong `public/data/credits.json`).
