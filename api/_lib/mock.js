// Dữ liệu mẫu khi MOCK=1, thiếu key, hoặc Gateway lỗi (nếu FALLBACK_MOCK=1).
// Luôn trả kèm mock:true để UI hiện nhãn "Dữ liệu minh hoạ" — không giả làm kết quả AI thật.
export const MOCK = {
  meal: null, // client dùng kết quả dựng sẵn của ảnh mẫu; ảnh riêng → chọn món thủ công
  advice: {
    tips: ['Thêm một đĩa rau luộc hoặc rau sống để no lâu hơn.', 'Chan ít nước dùng/nước chấm để giảm muối và chất béo.', 'Uống nước lọc hoặc trà không đường thay nước ngọt.'],
    swap: null,
  },
  chat: 'Chế độ dự phòng.',
};

// Giả lập SSE giống OpenAI/LiteLLM để client dùng chung một bộ parse.
export function mockStream(text) {
  const enc = new TextEncoder();
  const parts = text.match(/.{1,12}/gsu) || [text];
  return new ReadableStream({
    async start(c) {
      for (const p of parts) {
        c.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: p } }] })}\n\n`));
        await new Promise((r) => setTimeout(r, 40));
      }
      c.enqueue(enc.encode('data: [DONE]\n\n'));
      c.close();
    },
  });
}
