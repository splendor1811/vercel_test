// Đĩa Việt — AI nhận món (task "meal"), code tính kcal từ /data/dishes.json, gợi ý (task "advice").
import { compressImage, askJSON } from '/js/ai.js';
import PRESETS from '/js/presets.js';

const $ = (s) => document.querySelector(s);
const fmt = new Intl.NumberFormat('vi-VN');
const COLORS = ['#D9432B', '#2F6B4F', '#F08A5D', '#7FA88A', '#11261B', '#B9D3BF'];
const SAMPLES = [
  { key: 'pho', name: 'Phở bò', src: '/img/samples/pho-beef-noodles-2008.jpg' },
  { key: 'buncha', name: 'Bún chả', src: '/img/samples/bun-cha-hanoi.jpg' },
  { key: 'comtam', name: 'Cơm tấm', src: '/img/samples/com-tam-2008.jpg' },
  { key: 'banhxeo', name: 'Bánh xèo', src: '/img/samples/banh-xeo.jpg' },
  { key: 'goicuon', name: 'Gỏi cuốn', src: '/img/samples/goi-cuon-phuongnhu.jpg' },
  { key: 'bunbo', name: 'Bún bò Huế', src: '/img/samples/bun-bo-hue-from-huong-giang-2011.jpg' },
];

let DB, RDA, items = [], busy = false, adviceTimer, lastSource = null;
const byId = (id) => DB.dishes.find((d) => d.id === id);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* chế độ riêng tư */ } },
};

// ---------- tính toán (không dùng AI) ----------
function itemKcal(it) {
  const f = DB.portion[it.portion] ?? 1;
  const n = it.count || 1;
  const d = it.id && byId(it.id);
  if (d) return { mid: d.kcal * f * n, lo: d.range[0] * f * n, hi: d.range[1] * f * n };
  const e = Number(it.unit_kcal) || 0; // ngoài danh sách: ước tính AI mỗi cái/phần, khoảng rộng ±35%
  return { mid: e * f * n, lo: e * 0.65 * f * n, hi: e * 1.35 * f * n };
}
function totals() {
  return items.reduce((t, it) => { const k = itemKcal(it); return { mid: t.mid + k.mid, lo: t.lo + k.lo, hi: t.hi + k.hi }; }, { mid: 0, lo: 0, hi: 0 });
}
function profile() {
  const p = store.get('dv-profile', { sex: 'nu', age: '20-29', act: 1 });
  return { ...p, need: RDA.rows[p.age][p.sex][p.act] };
}
const round10 = (x) => Math.round(x / 10) * 10;

// ---------- giao diện ----------
function setStatus(text, err = false) { const s = $('#status'); s.textContent = text; s.classList.toggle('error', err); }

function drawRing() {
  const g = $('#ring-segs');
  g.innerHTML = '';
  const t = totals().mid;
  const need = profile().need;
  const C = 2 * Math.PI * 94;
  let start = 0;
  items.forEach((it, i) => {
    const frac = Math.min(itemKcal(it).mid / need, 1 - start);
    if (frac <= 0) return;
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', 100); c.setAttribute('cy', 100); c.setAttribute('r', 94);
    c.setAttribute('class', 'ring-seg');
    c.style.stroke = COLORS[i % COLORS.length];
    c.style.strokeDasharray = `${frac * C - 2} ${C}`;
    c.style.strokeDashoffset = C; // vẽ dần
    c.setAttribute('transform', `rotate(${start * 360} 100 100)`);
    g.appendChild(c);
    requestAnimationFrame(() => requestAnimationFrame(() => { c.style.strokeDashoffset = 0; }));
    start += frac;
  });
  return t;
}

function countUp(el, to) {
  const from = Number(el.dataset.v || 0);
  el.dataset.v = to;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = fmt.format(to); return; }
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / 700), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt.format(Math.round(from + (to - from) * e));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function renderTotals() {
  const t = totals();
  const p = profile();
  countUp($('#total'), round10(t.mid));
  $('#range').textContent = items.length ? `dao động ${fmt.format(round10(t.lo))}–${fmt.format(round10(t.hi))} kcal` : 'Chưa có món nào';
  countUp($('#pct'), Math.round((t.mid / p.need) * 100));
  $('#profile-btn').textContent = `${p.sex === 'nu' ? 'nữ' : 'nam'} ${p.age} tuổi, vận động ${['nhẹ', 'vừa', 'nặng'][p.act]} (${fmt.format(p.need)} kcal)`;
  drawRing();
}

function itemRow(it, i) {
  const d = it.id && byId(it.id);
  const k = itemKcal(it);
  const li = document.createElement('li');
  li.className = 'item';
  const name = d ? d.name : it.label;
  const tags = [
    !d ? '<span class="tag tag-ai">ước tính AI</span>' : '',
    d && it.confidence < 0.6 ? '<span class="tag tag-low">chưa chắc</span>' : '',
  ].join(' ');
  const unit = d ? d.unit : 'phần';
  li.innerHTML = `
    <span class="dot" style="background:${COLORS[i % COLORS.length]}"></span>
    <div><h3>${name} ${tags}</h3>
      <p class="meta">${d ? `${d.serving} ≈ ${fmt.format(d.kcal)} kcal · nguồn: ${d.source.name}` : 'Không có trong bảng 21 món — số do AI ước tính, sai số lớn'}</p></div>
    <p class="kcal">${fmt.format(round10(k.mid))} kcal</p>
    <div class="controls">
      <div class="seg" role="radiogroup" aria-label="Khẩu phần ${name}">
        ${['S', 'M', 'L'].map((p) => `<label><input type="radio" name="p${i}" value="${p}" ${it.portion === p ? 'checked' : ''}>${{ S: 'Nhỏ', M: 'Vừa', L: 'Lớn' }[p]}</label>`).join('')}
      </div>
      ${d?.countable || (it.count || 1) > 1 ? `<div class="stepper"><button type="button" data-d="-1" aria-label="Bớt một ${unit}">−</button><output aria-live="polite">${it.count || 1}</output><span>${unit}</span><button type="button" data-d="1" aria-label="Thêm một ${unit}">+</button></div>` : ''}
      <button type="button" class="icon-btn" data-remove aria-label="Xoá ${name}">✕</button>
    </div>
    ${it.alternatives?.length && (it.confidence < 0.6 || !d) ? `<div class="ask"><span>Có phải là</span>${it.alternatives.map(byId).filter(Boolean).slice(0, 3).map((a) => `<button type="button" data-alt="${a.id}">${a.name}?</button>`).join('')}</div>` : ''}`;
  li.querySelectorAll('.seg input').forEach((r) => r.addEventListener('change', () => { it.portion = r.value; update(); }));
  li.querySelectorAll('.stepper button').forEach((b) => b.addEventListener('click', () => { it.count = Math.max(1, (it.count || 1) + Number(b.dataset.d)); update(); }));
  li.querySelector('[data-remove]').addEventListener('click', () => { items.splice(i, 1); update(); });
  li.querySelectorAll('[data-alt]').forEach((b) => b.addEventListener('click', () => { it.id = b.dataset.alt; it.confidence = 1; it.alternatives = []; update(); }));
  return li;
}

function update({ advice = true } = {}) {
  const ol = $('#items');
  ol.innerHTML = '';
  items.forEach((it, i) => ol.appendChild(itemRow(it, i)));
  renderTotals();
  if (advice) { clearTimeout(adviceTimer); adviceTimer = setTimeout(loadAdvice, 700); }
}

async function loadAdvice() {
  const tips = $('#tips');
  if (!items.length) { tips.innerHTML = '<li>Thêm món để nhận gợi ý.</li>'; $('#swap').hidden = true; return; }
  tips.innerHTML = '<li class="skeleton"></li><li class="skeleton"></li>';
  const t = totals(), p = profile();
  const meal = items.map((it) => `${it.id ? byId(it.id).name : it.label} (${it.portion}, x${it.count || 1}) ≈ ${round10(itemKcal(it).mid)} kcal`).join('; ');
  const input = `Bữa ăn: ${meal}. Tổng ≈ ${round10(t.mid)} kcal. Nhu cầu ngày: ${p.need} kcal (${p.sex}, ${p.age} tuổi). ` +
    `Danh sách món: ${DB.dishes.map((d) => `${d.name} ${d.kcal}`).join(', ')}`;
  try {
    const r = await askJSON('advice', { input });
    tips.innerHTML = '';
    (r.data?.tips || []).slice(0, 3).forEach((s) => { const li = document.createElement('li'); li.textContent = s; tips.appendChild(li); });
    const sw = $('#swap');
    sw.hidden = !r.data?.swap;
    sw.textContent = r.data?.swap ? `Đổi món: ${r.data.swap}` : '';
  } catch (e) {
    tips.innerHTML = `<li>Chưa lấy được gợi ý (${e.message}).</li>`;
  }
}

function showMock(text) { const m = $('#mock-note'); m.hidden = !text; m.textContent = text || ''; }

async function analyze(source) {
  if (busy) return;
  busy = true;
  lastSource = source;
  const stage = $('#stage');
  stage.dataset.state = 'busy';
  $('#ring-segs').innerHTML = '';
  $('#plate-hint').hidden = true;
  const img = $('#photo');
  img.hidden = false;
  img.alt = source.name ? `Ảnh mẫu: ${source.name}` : 'Ảnh bữa ăn bạn vừa chọn';
  img.src = source.preview;
  showMock('');
  try {
    setStatus('Đang thu nhỏ ảnh…');
    const dataUrl = source.file ? await compressImage(source.file) : await urlToDataUrl(source.preview);
    setStatus('Đang nhận diện món…');
    const list = DB.dishes.map((d) => `${d.id}: ${d.name}`).join('\n');
    const r = await askJSON('meal', { input: `Danh sách món:\n${list}`, image: dataUrl }, { timeoutMs: 45_000 });
    setStatus('Đang tra bảng dinh dưỡng…');
    let data = r.data;
    if (r.mock) {
      if (source.key && PRESETS[source.key]) {
        data = PRESETS[source.key];
        showMock('Bản demo chưa nối AI: đang hiện kết quả AI đã chạy trước cho ảnh mẫu này.');
      } else {
        data = { items: [], note: '' };
        showMock('Bản demo chưa nối AI — hãy thêm món thủ công ở ô bên dưới.');
      }
    }
    // est_kcal của AI là cho cả phần thấy được → đổi sang kcal mỗi cái/phần để stepper và khẩu phần tính đúng
    items = (data?.items || []).map((x) => ({ ...x, id: x.id && byId(x.id) ? x.id : null,
      unit_kcal: (Number(x.est_kcal) || 0) / Math.max(1, x.count || 1) / (DB.portion[x.portion] ?? 1) }));
    $('#result').hidden = false;
    if (!items.length && !r.mock) setStatus(data?.note || 'Không thấy món ăn trong ảnh. Thử chụp từ trên xuống, đủ sáng, thấy cả tô/đĩa.', true);
    else setStatus(items.length ? `Nhận ra ${items.length} món${data?.note ? ' · ' + data.note : ''}` : '');
    update();
    if (items.length) $('#result').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  } catch (e) {
    setStatus(e.message, true);
  } finally {
    stage.dataset.state = 'done';
    busy = false;
  }
}

async function urlToDataUrl(url) {
  const blob = await (await fetch(url)).blob();
  return compressImage(new File([blob], 'mau.jpg', { type: blob.type || 'image/jpeg' }));
}

// ---------- nhật ký hôm nay (localStorage, không gửi đi đâu) ----------
const today = () => new Date().toISOString().slice(0, 10);
function renderLog() {
  const log = store.get('dv-log', {});
  const meals = log[today()] || [];
  const sum = meals.reduce((s, m) => s + m.kcal, 0);
  const need = profile().need;
  $('#log-fill').style.width = `${Math.min(100, (sum / need) * 100)}%`;
  $('#log-sum').textContent = meals.length ? `${fmt.format(sum)} / ${fmt.format(need)} kcal hôm nay (${Math.round((sum / need) * 100)}%)` : 'Chưa có bữa nào. Chụp bữa đầu tiên ở trên.';
  $('#log-list').innerHTML = meals.map((m) => `<li><span>${m.time} · ${m.names}</span><strong>${fmt.format(m.kcal)} kcal</strong></li>`).join('');
}

// ---------- khởi động ----------
async function init() {
  [DB, RDA] = await Promise.all([fetch('/data/dishes.json').then((r) => r.json()), fetch('/data/rda.json').then((r) => r.json())]);

  const ul = $('#samples');
  SAMPLES.forEach((s) => {
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" aria-pressed="false"><img src="${s.src}" alt="" width="64" height="64" loading="lazy">${s.name}</button>`;
    const b = li.firstElementChild;
    b.addEventListener('click', () => {
      ul.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      analyze({ key: s.key, name: s.name, preview: s.src });
    });
    ul.appendChild(li);
  });

  $('#file').addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    ul.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
    analyze({ file: f, preview: URL.createObjectURL(f) });
    e.target.value = '';
  });

  const sel = $('#add-dish');
  sel.innerHTML = '<option value="">Chọn món…</option>' + DB.dishes.map((d) => `<option value="${d.id}">${d.name} — ${d.serving}</option>`).join('');
  $('#add-btn').addEventListener('click', () => {
    if (!sel.value) return sel.focus();
    items.push({ id: sel.value, label: byId(sel.value).name, confidence: 1, portion: 'M', count: 1, alternatives: [] });
    sel.value = '';
    $('#result').hidden = false;
    update();
  });

  // hồ sơ nhu cầu
  const p = profile();
  const form = $('#profile');
  form.sex.value = p.sex; form.age.value = p.age; form.act.value = String(p.act);
  form.addEventListener('change', () => {
    store.set('dv-profile', { sex: form.sex.value, age: form.age.value, act: Number(form.act.value) });
    update({ advice: false });
    renderLog();
  });
  $('#profile-btn').addEventListener('click', (e) => {
    const open = form.hidden;
    form.hidden = !open;
    e.currentTarget.setAttribute('aria-expanded', String(open));
  });

  $('#save').addEventListener('click', () => {
    if (!items.length) return;
    const log = store.get('dv-log', {});
    const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    (log[today()] ||= []).push({ time, kcal: round10(totals().mid), names: items.map((it) => (it.id ? byId(it.id).name : it.label)).join(', ') });
    store.set('dv-log', log);
    renderLog();
    $('#save').textContent = 'Đã lưu ✓';
    setTimeout(() => { $('#save').textContent = 'Lưu vào nhật ký hôm nay'; }, 1600);
  });

  // bảng nguồn + credit ảnh
  $('#dish-table').innerHTML = DB.dishes.map((d) => `<tr><td>${d.name}</td><td>${d.serving}</td><td class="num">${fmt.format(d.kcal)}</td><td><a href="${d.source.url}" target="_blank" rel="noopener">${d.source.name}</a></td></tr>`).join('');
  $('#rda-src').innerHTML = `Nhu cầu năng lượng: <a href="${RDA.source.url}" target="_blank" rel="noopener">${RDA.source.name}</a>. Số liệu cập nhật ${DB.updated}.`;
  fetch('/data/credits.json').then((r) => r.json()).then((cs) => {
    $('#credits').innerHTML = 'Ảnh mẫu từ Wikimedia Commons: ' + cs.map((c) => `<a href="${c.source}" target="_blank" rel="noopener">${c.title.replace(/^File:/, '')}</a> — ${c.author}, ${c.license}`).join(' · ');
  }).catch(() => {});

  renderLog();
}

init().catch((e) => setStatus('Không tải được dữ liệu món ăn: ' + e.message, true));
