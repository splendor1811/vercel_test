// Kết quả task "meal" đã chạy thật qua Gateway (gemini-3.5-flash, 06/10/2026) cho 6 ảnh mẫu.
// Chỉ dùng khi bản deploy chưa nối AI (mock) để demo vẫn đúng; UI gắn nhãn rõ.
export default {
 "pho": {
  "items": [
   {
    "id": "pho-bo",
    "label": "Phở bò",
    "confidence": 0.98,
    "portion": "M",
    "count": 1,
    "est_kcal": null,
    "alternatives": [
     "bun-bo-hue",
     "hu-tieu"
    ]
   }
  ],
  "note": "Tô phở bò tái chín thơm ngon."
 },
 "buncha": {
  "items": [
   {
    "id": "bun-cha",
    "label": "Bún chả",
    "confidence": 0.98,
    "portion": "M",
    "count": 1,
    "est_kcal": null,
    "alternatives": []
   },
   {
    "id": null,
    "label": "Nem rán",
    "confidence": 0.95,
    "portion": "M",
    "count": 2,
    "est_kcal": 300,
    "alternatives": []
   }
  ],
  "note": "Bún chả đầy đủ kèm đĩa nem rán ăn kèm."
 },
 "comtam": {
  "items": [
   {
    "id": "com-tam",
    "label": "Cơm tấm bì chả",
    "confidence": 0.95,
    "portion": "M",
    "count": 1,
    "est_kcal": null,
    "alternatives": []
   }
  ],
  "note": "Cơm tấm sườn bì chả trứng ốp la đầy đủ."
 },
 "banhxeo": {
  "items": [
   {
    "id": "banh-xeo",
    "label": "Bánh xèo",
    "confidence": 0.95,
    "portion": "M",
    "count": 1,
    "est_kcal": null,
    "alternatives": []
   }
  ],
  "note": "Bánh xèo vàng giòn ăn kèm với rau xà lách."
 },
 "goicuon": {
  "items": [
   {
    "id": "goi-cuon",
    "label": "Gỏi cuốn tôm thịt",
    "confidence": 0.98,
    "portion": "S",
    "count": 1,
    "est_kcal": null,
    "alternatives": []
   }
  ],
  "note": "Một cuốn gỏi cuốn tôm thịt kèm rau xà lách."
 },
 "bunbo": {
  "items": [
   {
    "id": "bun-bo-hue",
    "label": "Bún bò Huế",
    "confidence": 0.9,
    "portion": "M",
    "count": 1,
    "est_kcal": null,
    "alternatives": [
     "pho-bo"
    ]
   }
  ],
  "note": "Tô bún bò Huế nóng hổi với nước dùng màu đỏ đặc trưng và thịt bò."
 }
};
