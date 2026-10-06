// Task AI của "Đĩa Việt". AI chỉ NHẬN DIỆN món trong danh sách đóng + ước lượng khẩu phần/số lượng;
// kcal tính bằng code từ public/data/dishes.json (có nguồn). Món ngoài danh sách: AI ước tính, UI gắn nhãn "ước tính AI".
const FAST = process.env.MODEL_FAST || 'gemini-3.5-flash';

export const TASKS = {
  meal: {
    model: FAST,
    vision: true,
    maxTokens: 2000,
    reasoning: 'low',
    system:
      'Bạn nhận diện món ăn Việt Nam trong ảnh. Input có danh sách "id: tên món". Với mỗi món THẤY RÕ trong ảnh: ' +
      'chọn id khớp nhất và để est_kcal = null; nếu không có trong danh sách thì id = null, label = tên tiếng Việt, est_kcal = ước tính kcal cho phần thấy được. ' +
      'portion: S (nhỏ hơn suất thường), M (suất thường), L (lớn hơn). count: số cái/cuốn/ổ nếu món đếm được, còn lại 1. ' +
      'confidence 0–1 trung thực; alternatives = tối đa 3 id khác dễ nhầm. Thành phần vốn thuộc một món thì gộp (bún + chả + nước chấm + rau = Bún chả), ' +
      'nhưng món ăn kèm gọi riêng (nem rán, quẩy, trứng ốp thêm, chả giò, đồ uống rõ ràng) là mục riêng. ' +
      'Bỏ qua đồ uống không rõ, gia vị, bát nước chấm riêng. Ảnh không có món ăn: items rỗng, note giải thích ngắn. note ≤ 20 chữ, tiếng Việt.',
    schema: {
      name: 'meal',
      schema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: ['string', 'null'] },
                label: { type: 'string' },
                confidence: { type: 'number' },
                portion: { type: 'string', enum: ['S', 'M', 'L'] },
                count: { type: 'number' },
                est_kcal: { type: ['number', 'null'] },
                alternatives: { type: 'array', items: { type: 'string' } },
              },
              required: ['id', 'label', 'confidence', 'portion', 'count', 'est_kcal', 'alternatives'],
              additionalProperties: false,
            },
          },
          note: { type: 'string' },
        },
        required: ['items', 'note'],
        additionalProperties: false,
      },
    },
  },

  advice: {
    model: FAST,
    maxTokens: 1200,
    reasoning: 'low',
    system:
      'Bạn là chuyên gia dinh dưỡng nói tiếng Việt, giọng thân thiện, thực tế. Input là bữa ăn (món, kcal tính sẵn) và nhu cầu ngày. ' +
      'Đưa tối đa 3 gợi ý ngắn (≤ 22 chữ mỗi gợi ý), cụ thể bằng món/thói quen Việt (thêm rau, bớt nước béo, đổi đồ uống…). ' +
      'Không chẩn đoán bệnh, không khuyên ăn dưới 1.200 kcal/ngày, không chê ngoại hình. Không lặp lại số kcal đã có. ' +
      'swap: một gợi ý đổi món tương đương nhẹ hơn chỉ dùng tên món có trong input "Danh sách món", hoặc null.',
    schema: {
      name: 'advice',
      schema: {
        type: 'object',
        properties: { tips: { type: 'array', items: { type: 'string' } }, swap: { type: ['string', 'null'] } },
        required: ['tips', 'swap'],
        additionalProperties: false,
      },
    },
  },
};

export const ALLOWED_MODELS = (process.env.ALLOWED_MODELS || FAST).split(',').map((s) => s.trim()).filter(Boolean);
