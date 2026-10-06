// Proxy AI chung: chat (stream SSE) · vision · JSON có schema. Node runtime, Web-standard handler.
// Env (Vercel → Settings → Environment Variables):
//   PRODUCT_GATEWAY_KEY  key "tích hợp trong sản phẩm" của BTC (bí mật; thiếu thì dùng GATEWAY_KEY khi chạy local)
//   GATEWAY_BASE_URL     mặc định https://api.thucchien.ai (luyện local: http://localhost:4000 — Vercel KHÔNG gọi được localhost)
//   MOCK=1               không gọi Gateway · FALLBACK_MOCK=1  Gateway lỗi → trả dữ liệu mẫu có cờ mock
//   RATE_MAX (15/phút/IP) · MAX_COST_USD (trần chi phí mỗi instance, mặc định 3) · ALLOWED_MODELS
import { TASKS, ALLOWED_MODELS } from './_lib/tasks.js';
import { MOCK, mockStream } from './_lib/mock.js';

export const config = { maxDuration: 60 }; // Hobby: mặc định = tối đa = 300 s; đặt 60 cho đỡ treo

const KEY = process.env.PRODUCT_GATEWAY_KEY || process.env.GATEWAY_KEY || '';
const BASE = (process.env.GATEWAY_BASE_URL || 'https://api.thucchien.ai').replace(/\/+$/, '');
// LiteLLM/Gateway: <base>/v1/chat/completions. URL đã có phiên bản (…/v1, …/v1beta/openai của Google) thì giữ nguyên.
const CHAT_URL = /\/v\d[\w]*(\/openai)?$/.test(BASE) ? `${BASE}/chat/completions` : `${BASE}/v1/chat/completions`;
const IS_MOCK = process.env.MOCK === '1' || !KEY;
const FALLBACK = process.env.FALLBACK_MOCK === '1';
const MAX_BODY = 4_000_000; // Vercel chặn ở 4.5 MB (413 FUNCTION_PAYLOAD_TOO_LARGE) → tự chặn sớm với lỗi dễ hiểu
const UPSTREAM_TIMEOUT_MS = 50_000;
const RATE = { windowMs: 60_000, max: Number(process.env.RATE_MAX || 15) }; // mỗi IP / mỗi instance — chống bấm liên tục, không phải bảo mật tuyệt đối
const hits = new Map();
const MAX_COST = Number(process.env.MAX_COST_USD || 3); // trần mềm theo instance: URL public ai cũng gọi được
let spent = 0;

const json = (status, data, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RATE.windowMs);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > RATE.max;
}

const isDataImage = (u) => typeof u === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(u);

// Dựng messages từ input người dùng + system prompt của task. Client KHÔNG gửi được system prompt.
function buildMessages(task, body) {
  const msgs = [{ role: 'system', content: task.system }];
  if (Array.isArray(body.messages)) {
    // chat nhiều lượt: chỉ nhận role user/assistant, nội dung chuỗi, cắt bớt lượt cũ
    for (const m of body.messages.slice(-(task.maxTurns || 12))) {
      if (!['user', 'assistant'].includes(m?.role) || typeof m.content !== 'string') throw new Error('messages không hợp lệ');
      msgs.push({ role: m.role, content: m.content.slice(0, 4000) });
    }
  } else {
    const content = [{ type: 'text', text: String(body.input || 'Phân tích ảnh này.').slice(0, 4000) }];
    const images = body.images || (body.image ? [body.image] : []);
    if (images.length && !task.vision) throw new Error('Task này không nhận ảnh');
    for (const url of images.slice(0, 4)) {
      if (!isDataImage(url)) throw new Error('Ảnh phải là data URI jpeg/png/webp');
      content.push({ type: 'image_url', image_url: { url } }); // định dạng vision kiểu OpenAI, LiteLLM chuyển cho Gemini
    }
    msgs.push({ role: 'user', content });
  }
  if (msgs.length < 2) throw new Error('Thiếu nội dung');
  return msgs;
}

function parseJsonLoose(text) {
  const t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(t);
}

// reason phải là ASCII: nó đi vào header x-mock (header tiếng Việt có dấu → Response ném lỗi → 500)
function mockResponse(taskName, wantStream, reason) {
  if (wantStream) {
    return new Response(mockStream(MOCK.chat), {
      headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', 'x-mock': reason },
    });
  }
  const data = MOCK[taskName] ?? null;
  return json(200, { mock: true, reason, data, text: typeof data === 'string' ? data : JSON.stringify(data) });
}

export default {
  async fetch(req) {
    if (req.method === 'GET') return json(200, { ok: true, mock: IS_MOCK, tasks: Object.keys(TASKS) }); // health check
    if (req.method !== 'POST') return json(405, { error: 'Chỉ nhận POST' });

    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
    if (rateLimited(ip)) return json(429, { error: 'Bạn thao tác hơi nhanh, đợi 1 phút rồi thử lại.' }, { 'retry-after': '60' });
    if (Number(req.headers.get('content-length') || 0) > MAX_BODY)
      return json(413, { error: 'Ảnh quá lớn — hãy nén ảnh (≤1024px JPEG) trước khi gửi.' });

    let body;
    try {
      const raw = await req.text();
      if (raw.length > MAX_BODY) return json(413, { error: 'Dữ liệu quá lớn.' });
      body = JSON.parse(raw);
    } catch {
      return json(400, { error: 'Body phải là JSON' });
    }

    const taskName = String(body.task || 'chat');
    const task = TASKS[taskName];
    if (!task) return json(400, { error: `Task không hỗ trợ: ${taskName}` });
    const wantStream = !!task.stream && body.stream !== false;

    let messages;
    try {
      messages = buildMessages(task, body);
    } catch (e) {
      return json(400, { error: e.message });
    }
    if (IS_MOCK) return mockResponse(taskName, wantStream, KEY ? 'mock-env' : 'no-key');
    if (spent >= MAX_COST) {
      if (FALLBACK) return mockResponse(taskName, wantStream, 'cost-cap');
      return json(429, { error: 'Bản demo đã dùng hết hạn mức AI hôm nay.' });
    }

    const payload = {
      model: ALLOWED_MODELS.includes(body.model) ? body.model : task.model,
      messages,
      max_tokens: task.maxTokens || 1024,
      temperature: task.schema ? 0.2 : 0.6,
      stream: wantStream,
    };
    // Gemini 3.x "suy nghĩ" ăn vào max_tokens → JSON bị cắt cụt. Task cần nhanh đặt reasoning: 'low' (hoặc 'none').
    if (task.reasoning) payload.reasoning_effort = task.reasoning;
    if (task.schema) payload.response_format = { type: 'json_schema', json_schema: { ...task.schema, strict: true } };

    let up;
    try {
      up = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
    } catch (e) {
      console.error('[ai] upstream fetch failed', e?.name, e?.message);
      if (FALLBACK) return mockResponse(taskName, wantStream, 'gateway-down');
      return json(e?.name === 'TimeoutError' ? 504 : 502, { error: 'Không kết nối được dịch vụ AI, thử lại sau.' });
    }

    if (!up.ok) {
      const detail = (await up.text()).slice(0, 300);
      console.error('[ai] upstream', up.status, detail); // log server, KHÔNG trả nguyên văn lỗi Gateway cho client
      if (FALLBACK) return mockResponse(taskName, wantStream, `gateway-${up.status}`);
      const msg = up.status === 429 ? 'Dịch vụ AI đang quá tải hoặc hết hạn mức, thử lại sau.' : 'Dịch vụ AI lỗi, thử lại sau.';
      return json(up.status === 429 ? 429 : 502, { error: msg });
    }

    if (wantStream) {
      // Chuyển nguyên luồng SSE của Gateway (data: {...choices[0].delta.content}\n\n … data: [DONE]) về client.
      return new Response(up.body, {
        headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform' },
      });
    }

    const res = await up.json();
    const text = res?.choices?.[0]?.message?.content ?? '';
    const cost = up.headers.get('x-litellm-response-cost');
    spent += Number(cost) || 0;
    if (!task.schema) return json(200, { text, model: payload.model, cost });
    try {
      return json(200, { data: parseJsonLoose(text), model: payload.model, cost });
    } catch {
      console.error('[ai] JSON hỏng', text.slice(0, 200));
      if (FALLBACK) return mockResponse(taskName, false, 'bad-json');
      return json(502, { error: 'AI trả kết quả không đúng định dạng, bấm thử lại.' });
    }
  },
};
