// Client helper (ES module, không cần build): nén ảnh · gọi /api/ai · đọc stream SSE · lỗi thân thiện · fallback mẫu.
// <script type="module"> import { compressImage, askJSON, streamChat } from '/js/ai.js' </script>

export class AIError extends Error {
  constructor(message, { status = 0, retryable = true } = {}) {
    super(message);
    this.status = status;
    this.retryable = retryable;
  }
}

/** Nén ảnh về cạnh dài ≤ maxSide, JPEG; hạ chất lượng tới khi ≤ maxBytes. Trả data URI. */
export async function compressImage(file, { maxSide = 1024, quality = 0.82, maxBytes = 1_200_000 } = {}) {
  if (!file || !file.type?.startsWith('image/')) throw new AIError('Hãy chọn một file ảnh.', { retryable: false });
  let bmp;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); // xoay đúng theo EXIF
  } catch {
    throw new AIError('Trình duyệt không đọc được ảnh này (HEIC?). Hãy chụp lại hoặc chọn JPEG/PNG.', { retryable: false });
  }
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // PNG trong suốt → nền trắng thay vì đen khi sang JPEG
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  let q = quality;
  let url = canvas.toDataURL('image/jpeg', q);
  while (url.length * 0.75 > maxBytes && q > 0.4) {
    q -= 0.1;
    url = canvas.toDataURL('image/jpeg', q);
  }
  return url;
}

async function post(body, { timeoutMs = 60_000, signal } = {}) {
  const sig = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
  let res;
  try {
    res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: sig,
    });
  } catch (e) {
    if (e.name === 'AbortError' && signal?.aborted) throw new AIError('Đã huỷ.', { retryable: false });
    if (e.name === 'TimeoutError') throw new AIError('AI phản hồi quá lâu, hãy thử lại.');
    throw new AIError('Mất kết nối mạng, kiểm tra Internet rồi thử lại.');
  }
  if (!res.ok) {
    let msg = `Lỗi ${res.status}`;
    try {
      msg = (await res.json()).error || msg;
    } catch {
      if (res.status === 413) msg = 'Ảnh quá lớn, hãy chọn ảnh khác.';
      if (res.status === 504) msg = 'Máy chủ hết thời gian chờ, thử lại.';
    }
    throw new AIError(msg, { status: res.status, retryable: res.status >= 500 || res.status === 429 });
  }
  return res;
}

/** Task trả JSON có schema (vd 'kcal'). Trả { data, mock?, model?, cost? }. */
export async function askJSON(task, { input, image, images, model } = {}, opts) {
  const res = await post({ task, input, image, images, model }, opts);
  return res.json();
}

/** Chat stream. onDelta(chunk, fullText). Trả { text, mock }. */
export async function streamChat(messages, onDelta, opts) {
  const res = await post({ task: 'chat', messages, stream: true }, opts);
  const mock = res.headers.get('x-mock') != null;
  if (!res.headers.get('content-type')?.includes('text/event-stream')) {
    const j = await res.json(); // server trả JSON (không stream) → vẫn xử lý được
    onDelta?.(j.text || '', j.text || '');
    return { text: j.text || '', mock: !!j.mock };
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '';
  let text = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, '');
      buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue; // bỏ dòng trống, ": ping", "event:"
      const data = line.slice(5).trim();
      if (data === '[DONE]') return { text, mock };
      try {
        const piece = JSON.parse(data).choices?.[0]?.delta?.content || '';
        if (piece) {
          text += piece;
          onDelta?.(piece, text);
        }
      } catch {
        /* chunk không phải JSON → bỏ qua */
      }
    }
  }
  return { text, mock };
}

/** Bọc lời gọi: lỗi → trả dữ liệu mẫu có cờ mock để demo không chết; UI phải hiện nhãn + nút thử lại. */
export async function withFallback(fn, sample) {
  try {
    return await fn();
  } catch (e) {
    console.warn('[ai] fallback:', e.message);
    return { data: sample, mock: true, error: e.message };
  }
}
