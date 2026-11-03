(() => {
'use strict';

/* =========================================================
   Yardımcılar
   ========================================================= */
const KEY = 'finansal.v1';
const IMG_KEY = 'finansal.carImage';

const $ = (s, r = document) => r.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sum = (arr, f = x => x) => arr.reduce((a, x) => a + f(x), 0);

const pad = n => String(n).padStart(2, '0');
const toStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const todayStr = () => toStr(new Date());
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return toStr(d); };
const utc = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const diffDays = (a, b) => Math.round((utc(b) - utc(a)) / 864e5);
const dowIdx = s => (parseD(s).getDay() + 6) % 7; // Pazartesi = 0
const monthEnd = s => { const d = parseD(s); return toStr(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const DOW = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const DOW_S = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const fmtDate = (s, year) => { const d = parseD(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}${year ? ' ' + d.getFullYear() : ''}`; };
const fmtShort = s => { const d = parseD(s); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; };
const fmtTime = ts => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
const nfc = new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 });
const sign = v => (v < 0 ? '−' : '');
const money = v => sign(Math.round(v)) + '₺' + nf0.format(Math.abs(v));      // yuvarlanmış
const nf2f = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyX = v => {                                                          // kuruş varsa 2 hane
  const a = Math.round(Math.abs(v) * 100) / 100;
  return sign(v) + '₺' + (Number.isInteger(a) ? nf0 : nf2f).format(a);
};
const compact = v => v >= 1000 ? nfc.format(v) : nf0.format(v);

// "1.250,50" / "1250.5" / "1.250" gibi girişleri sayıya çevirir
function parseAmount(s) {
  s = String(s ?? '').trim().replace(/[\s₺]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  return Number(s);
}
const amountStr = v => (v ? String(v).replace('.', ',') : '');

/* =========================================================
   Kategoriler
   ========================================================= */
const DEFAULT_CATS = [
  { id: 'yemek', name: 'Yemek', emoji: '🍔', color: '#f97316' },
  { id: 'market', name: 'Market', emoji: '🛒', color: '#22c55e' },
  { id: 'kahve', name: 'Kahve', emoji: '☕', color: '#b45309' },
  { id: 'ulasim', name: 'Ulaşım', emoji: '🚇', color: '#3b82f6' },
  { id: 'eglence', name: 'Eğlence', emoji: '🎉', color: '#ec4899' },
  { id: 'alisveris', name: 'Alışveriş', emoji: '🛍️', color: '#8b5cf6' },
  { id: 'fatura', name: 'Fatura', emoji: '🧾', color: '#eab308' },
  { id: 'saglik', name: 'Sağlık', emoji: '💊', color: '#14b8a6' },
  { id: 'diger', name: 'Diğer', emoji: '📦', color: '#64748b' },
];
const CUSTOM_COLORS = ['#06b6d4', '#f43f5e', '#84cc16', '#d946ef', '#0ea5e9', '#f59e0b', '#10b981', '#6366f1', '#ef4444', '#a3a3a3'];

const allCats = () => [...DEFAULT_CATS, ...S.customCats];
const catById = id => allCats().find(c => c.id === id) || { id, name: 'Diğer', emoji: '📦', color: '#64748b' };

function ensureCustomCat(name) {
  const clean = name.trim().replace(/\s+/g, ' ');
  const low = clean.toLocaleLowerCase('tr');
  const found = allCats().find(c => c.name.toLocaleLowerCase('tr') === low);
  if (found) return found.id;
  const cat = {
    id: 'c_' + uid(),
    name: clean.charAt(0).toLocaleUpperCase('tr') + clean.slice(1),
    emoji: '🏷️',
    color: CUSTOM_COLORS[S.customCats.length % CUSTOM_COLORS.length],
  };
  S.customCats.push(cat);
  return cat.id;
}

/* =========================================================
   Veri (localStorage)
   ========================================================= */
const defaultState = () => ({
  v: 1,
  periods: [],      // {id, start, end, total}
  expenses: [],     // {id, amount, cat, note, date, ts}
  customCats: [],   // {id, name, emoji, color}
  cards: [],        // {id, name, debt, limit, dueDay, color, log:[{ts, delta, note}]}
  car: { name: '', price: 0, deposits: [], mark: null }, // deposits:{id, amount, date, note, ts}  mark:{value, ts}
  habits: DEFAULT_HABITS(), // {id, name, desc, emoji, color, target, start, log:{'YYYY-MM-DD': 1 (yaptım) | 0 (yapmadım)}}
});

// Kişisel gelişim alışkanlıkları: haftalık hedef (target) tutturulursa haftalık streak devam eder
function DEFAULT_HABITS() {
  return [
    { id: 'english', name: 'İngilizce', desc: 'Okuma yap ya da yeni bir şey öğren', emoji: '📚', color: '#3b82f6', target: 5, start: todayStr(), log: {} },
    { id: 'gym', name: 'Gym', desc: 'Antrenman', emoji: '🏋️', color: '#f97316', target: 3, start: todayStr(), log: {} },
  ];
}

function normalize(raw) {
  const st = Object.assign(defaultState(), raw || {});
  st.car = Object.assign(defaultState().car, st.car || {});
  if (!Array.isArray(st.habits)) st.habits = [];
  for (const h of DEFAULT_HABITS()) if (!st.habits.some(x => x.id === h.id)) st.habits.push(h);
  return st;
}

function load() {
  try { return normalize(JSON.parse(localStorage.getItem(KEY))); }
  catch { return defaultState(); }
}

let S = load();

function save() {
  invalidate();
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch { toast('Kaydedilemedi — depolama dolu olabilir'); }
}

const getCarImage = () => { try { return localStorage.getItem(IMG_KEY) || ''; } catch { return ''; } };

/* =========================================================
   Bütçe hesabı
   Her günün limiti = (toplam para − o güne kadar harcanan) / (kalan gün sayısı, o gün dahil)
   → Limiti aşarsan fazlası kalan günlere eşit bölünür (limitler düşer),
     az harcarsan artan para kalan günlere eşit bölünür (limitler artar).
   ========================================================= */
let SC = new Map(), SMAP = null;
function invalidate() { SC = new Map(); SMAP = null; }

function spentMap() {
  if (!SMAP) {
    SMAP = {};
    for (const e of S.expenses) SMAP[e.date] = (SMAP[e.date] || 0) + e.amount;
  }
  return SMAP;
}

function buildSeries(p) {
  const map = spentMap();
  const n = diffDays(p.start, p.end) + 1;
  const arr = [], byDate = {};
  let before = 0;
  for (let i = 0; i < n; i++) {
    const d = addDays(p.start, i);
    const limit = (p.total - before) / (n - i);
    const spent = map[d] || 0;
    const o = { d, i, n, limit, spent };
    arr.push(o); byDate[d] = o;
    before += spent;
  }
  return { arr, byDate, totalSpent: before };
}

function getSeries(p) {
  if (!SC.has(p.id)) SC.set(p.id, buildSeries(p));
  return SC.get(p.id);
}

function periodFor(d) {
  for (let i = S.periods.length - 1; i >= 0; i--) {
    const p = S.periods[i];
    if (d >= p.start && d <= p.end) return p;
  }
  return null;
}

function currentPeriod() {
  const t = todayStr();
  const cur = periodFor(t);
  if (cur) return cur;
  const upcoming = S.periods.filter(p => p.start > t).sort((a, b) => a.start.localeCompare(b.start))[0];
  if (upcoming) return upcoming;
  return [...S.periods].sort((a, b) => a.end.localeCompare(b.end)).at(-1) || null;
}

const dayInfo = d => { const p = periodFor(d); return p ? getSeries(p).byDate[d] : null; };

function todayStatus() {
  const t = todayStr(), p = periodFor(t);
  if (!p) return null;
  const o = getSeries(p).byDate[t];
  return { remaining: o.limit - o.spent, limit: o.limit, spent: o.spent };
}

// Isı haritası rengi: limitin altında → yeşil (ne kadar az harcadıysan o kadar koyu),
// limitin üstünde → kırmızı (ne kadar aştıysan o kadar koyu; 2 katı = en koyu)
function heat(spent, limit) {
  let h, s, l;
  if (limit <= 0) {
    if (spent <= 0) { h = 145; s = 55; l = 45; }
    else { h = 358; s = 75; l = 32; }
  } else {
    const r = spent / limit;
    if (r <= 1) { const k = 1 - r; h = 145; s = 50 + k * 15; l = 82 - k * 50; }
    else { const k = Math.min(1, r - 1); h = 358; s = 78; l = 80 - k * 48; }
  }
  return { bg: `hsl(${h} ${s}% ${l}%)`, fg: l < 57 ? '#fff' : (h === 145 ? '#0b2e18' : '#4c0519') };
}

/* =========================================================
   UI durumu + render
   ========================================================= */
const now0 = new Date();
const ui = {
  page: 'home',
  hm: { y: now0.getFullYear(), m: now0.getMonth() },
  an: { mode: 'week', off: 0 },
  showAll: false,
};

const PAGES = {
  home: { title: () => 'Bütçe', sub: () => { const t = todayStr(); return `${fmtDate(t)} ${DOW[dowIdx(t)]}`; }, render: renderHome },
  stats: { title: () => 'Analiz', sub: () => 'Nereye ne kadar harcadın?', render: renderStats },
  cards: { title: () => 'Kartlar', sub: () => 'Kredi kartı borçların', render: renderCards },
  car: { title: () => 'Hayal', sub: () => S.car.name || 'Hayalindeki araba', render: renderCar },
  dev: { title: () => 'Gelişim', sub: () => 'Her gün biraz daha iyi', render: renderDev },
};

function render() {
  const pg = PAGES[ui.page];
  document.body.dataset.page = ui.page;
  $('#main').innerHTML = pg.render();
  $('#title').textContent = pg.title();
  $('#subtitle').textContent = pg.sub();
  document.querySelectorAll('.nav [data-page]').forEach(b => b.classList.toggle('on', b.dataset.page === ui.page));
}

/* ---------------- Ana sayfa ---------------- */
function renderHome() {
  const t = todayStr();
  const p = currentPeriod();
  let html = '';
  if (!p) {
    html += `<section class="card welcome">
      <div class="welcome-emoji">👋</div>
      <h2>Hoş geldin!</h2>
      <p class="muted">Elindeki parayı ve hangi tarihe kadar yetmesi gerektiğini gir; her gün ne kadar harcayabileceğini anlık olarak hesaplayayım.</p>
      <button class="btn primary block big" data-act="budget">Bütçeni ayarla</button>
    </section>`;
  } else {
    html += heroCard(p, t);
  }
  html += heatmapCard();

  const list = S.expenses.filter(e => e.date === t).sort((a, b) => b.ts - a.ts);
  html += `<div class="section-title">Bugünün harcamaları ${list.length ? `<span>${moneyX(sum(list, e => e.amount))}</span>` : ''}</div>`;
  html += `<section class="card" style="padding:8px 10px">${list.length
    ? `<div class="list">${list.map(e => expRow(e)).join('')}</div>`
    : `<div class="empty-state"><span class="big">🎯</span>Bugün henüz harcama yok.<br>Alttaki <b>+</b> ile ekleyebilirsin.</div>`}</section>`;
  return html;
}

function heroCard(p, t) {
  const ser = getSeries(p);
  const n = ser.arr.length;
  const periodLine = `<button class="period-line" data-act="budget">📅 ${fmtShort(p.start)} – ${fmtShort(p.end)} · ${money(p.total)} <span>Düzenle</span></button>`;

  if (t < p.start) {
    return `<section class="hero">${periodLine}
      <div class="hero-label">Dönem ${fmtDate(p.start)} tarihinde başlıyor</div>
      <div class="hero-amount">${money(p.total / n)}</div>
      <div class="hero-sub">başlangıç günlük limiti · ${n} gün</div>
    </section>`;
  }
  if (t > p.end) {
    const left = p.total - ser.totalSpent;
    return `<section class="hero ${left < 0 ? 'bad' : ''}">${periodLine}
      <div class="hero-label">Dönem bitti ${left >= 0 ? '🎉' : ''}</div>
      <div class="hero-amount">${money(left)}</div>
      <div class="hero-sub">${left >= 0 ? 'cebinde kaldı' : 'bütçeyi aştın'} · toplam harcama ${money(ser.totalSpent)}</div>
      <button class="btn light block" data-act="newPeriod">Yeni dönem başlat</button>
    </section>`;
  }

  const o = ser.byDate[t];
  const rem = o.limit - o.spent;
  const over = rem < -0.004;
  const exhausted = o.limit <= 0;
  const pct = o.limit > 0 ? Math.min(100, (o.spent / o.limit) * 100) : 100;
  const next = ser.arr[o.i + 1];
  const daysLeft = n - o.i;
  const totalLeft = p.total - ser.totalSpent;
  const after = daysLeft - 1; // bugünden sonra kalan gün

  let note = '';
  if (exhausted) note = 'Bu dönemin bütçesi tükendi. Bütçeye para eklemek için dönemi düzenleyebilirsin.';
  else if (over && after > 0) note = `Aştığın <b>${money(-rem)}</b> kalan ${after} güne eşit dağıtıldı → her gün <b>${money(-rem / after)}</b> daha az.`;
  else if (over) note = `Son gün limiti <b>${money(-rem)}</b> aştın.`;
  else if (rem > 0 && after > 0) note = `Bugün başka harcama yapmazsan kalan ${money(rem)} sonraki ${after} güne eklenir → günde <b>+${money(rem / after)}</b>.`;

  return `<section class="hero ${over || exhausted ? 'bad' : ''}">${periodLine}
      <div class="hero-label">${exhausted ? 'Bütçe tükendi' : over ? 'Bugün limiti aştın' : 'Bugün harcayabileceğin'}</div>
      <div class="hero-amount">${over ? '+' : ''}${money(Math.abs(rem))}</div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <div class="hero-row"><span>Günlük limit <b>${money(o.limit)}</b></span><span>Harcanan <b>${moneyX(o.spent)}</b></span></div>
      ${note ? `<div class="hero-note">${note}</div>` : ''}
    </section>
    <div class="tiles">
      <div class="tile"><span>Kalan bütçe</span><b class="${totalLeft < 0 ? 'bad' : ''}">${money(totalLeft)}</b></div>
      <div class="tile"><span>Kalan gün</span><b>${daysLeft}</b></div>
      <div class="tile"><span>Yarınki limit</span><b class="${next && next.limit < o.limit - 0.5 ? 'bad' : next && next.limit > o.limit + 0.5 ? 'good' : ''}">${next ? money(next.limit) : '—'}</b></div>
    </div>`;
}

function heatmapCard() {
  const { y, m } = ui.hm;
  const t = todayStr();
  const daysIn = new Date(y, m + 1, 0).getDate();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;
  const map = spentMap();
  let cells = '<div class="cell empty"></div>'.repeat(lead);
  let good = 0, bad = 0, monthSpent = 0;

  for (let d = 1; d <= daysIn; d++) {
    const ds = toStr(new Date(y, m, d));
    const spent = map[ds] || 0;
    monthSpent += spent;
    const info = dayInfo(ds);
    let cls = 'cell', style = '';
    if (ds > t) cls += ' future';
    else if (!info) cls += ' off';
    else {
      const c = heat(info.spent, info.limit);
      style = `background:${c.bg};color:${c.fg}`;
      if (ds < t) (info.spent > info.limit + 0.004 ? bad++ : good++);
    }
    if (ds === t) cls += ' today';
    cells += `<button class="${cls}" style="${style}" data-act="day" data-d="${ds}"><span>${d}</span>${spent > 0 ? `<small>${compact(spent)}</small>` : ''}</button>`;
  }

  return `<section class="card">
    <div class="card-head">
      <button class="icon-btn" data-act="hmPrev" aria-label="Önceki ay">‹</button>
      <h3>${MONTHS[m]} ${y}</h3>
      <button class="icon-btn" data-act="hmNext" aria-label="Sonraki ay">›</button>
    </div>
    <div class="dow">${DOW_S.map(x => `<span>${x}</span>`).join('')}</div>
    <div class="heat">${cells}</div>
    <div class="legend"><span>Az harcadım</span><i class="lg-green"></i><i class="lg-red"></i><span>Aştım</span></div>
    <div class="hm-sum"><span>🟢 <b>${good}</b> iyi gün</span><span>🔴 <b>${bad}</b> aşım</span><span>Ay: <b>${money(monthSpent)}</b></span></div>
  </section>`;
}

function expRow(e, showDate) {
  const c = catById(e.cat);
  const title = e.note || c.name;
  const meta = [e.note ? c.name : '', showDate ? fmtShort(e.date) : '', e.ts ? fmtTime(e.ts) : ''].filter(Boolean).join(' · ');
  return `<button class="row" data-act="editExp" data-id="${e.id}">
    <span class="ico" style="background:${c.color}22;color:${c.color}">${c.emoji}</span>
    <span class="row-main"><b>${esc(title)}</b><small>${esc(meta)}</small></span>
    <span class="row-amt">${moneyX(e.amount)}</span>
  </button>`;
}

/* ---------------- Analiz ---------------- */
function statRange() {
  const t = todayStr();
  const { mode, off } = ui.an;
  if (mode === 'week') {
    const start = addDays(addDays(t, -dowIdx(t)), off * 7);
    const end = addDays(start, 6);
    const label = parseD(start).getMonth() === parseD(end).getMonth()
      ? `${parseD(start).getDate()} – ${fmtShort(end)}` : `${fmtShort(start)} – ${fmtShort(end)}`;
    return { start, end, label: off === 0 ? `Bu hafta · ${label}` : label, prev: { start: addDays(start, -7), end: addDays(end, -7) }, prevLabel: 'geçen haftaya göre' };
  }
  if (mode === 'month') {
    const n = new Date();
    const first = new Date(n.getFullYear(), n.getMonth() + off, 1);
    const start = toStr(first), end = monthEnd(start);
    const pf = toStr(new Date(first.getFullYear(), first.getMonth() - 1, 1));
    return { start, end, label: `${MONTHS[first.getMonth()]} ${first.getFullYear()}`, prev: { start: pf, end: monthEnd(pf) }, prevLabel: 'geçen aya göre' };
  }
  const p = currentPeriod();
  if (!p) { ui.an.mode = 'month'; return statRange(); }
  return { start: p.start, end: p.end, label: `${fmtShort(p.start)} – ${fmtShort(p.end)}`, period: p };
}

function renderStats() {
  const r = statRange();
  const t = todayStr();
  const list = S.expenses.filter(e => e.date >= r.start && e.date <= r.end);
  const total = sum(list, e => e.amount);
  const lastDay = t < r.end ? t : r.end;
  const elapsed = Math.max(1, diffDays(r.start, lastDay) + 1);
  const avg = t < r.start ? 0 : total / elapsed;

  let delta = '';
  if (r.prev) {
    const pt = sum(S.expenses.filter(e => e.date >= r.prev.start && e.date <= r.prev.end), e => e.amount);
    if (pt > 0) {
      const ch = ((total - pt) / pt) * 100;
      delta = `<span class="delta ${ch > 0 ? 'up' : 'down'}">${ch > 0 ? '▲' : '▼'} %${nf0.format(Math.abs(ch))}</span> <span class="muted" style="font-size:12px">${r.prevLabel}</span>`;
    }
  }

  // kategori toplamları
  const agg = {};
  for (const e of list) agg[e.cat] = (agg[e.cat] || 0) + e.amount;
  const cats = Object.entries(agg).map(([id, v]) => ({ ...catById(id), id, v })).sort((a, b) => b.v - a.v);

  let html = `<div class="seg">
      ${[['week', 'Hafta'], ['month', 'Ay'], ['period', 'Dönem']].map(([k, l]) => `<button data-act="anMode" data-mode="${k}" class="${ui.an.mode === k ? 'on' : ''}">${l}</button>`).join('')}
    </div>
    <div class="range-nav">
      ${r.period ? '<span></span>' : '<button class="icon-btn" data-act="anPrev">‹</button>'}
      <b>${r.label}</b>
      ${r.period ? '<span></span>' : `<button class="icon-btn" data-act="anNext" ${ui.an.off >= 0 ? 'style="visibility:hidden"' : ''}>›</button>`}
    </div>
    <section class="card summary-grid">
      <div><div class="muted">Toplam harcama</div><div class="big-num">${moneyX(total)}</div></div>
      <div style="text-align:right"><div class="muted">Günlük ort.</div><b style="font-size:18px">${money(avg)}</b></div>
      <div style="grid-column:1/-1">${delta || `<span class="muted" style="font-size:12.5px">${list.length} harcama</span>`}</div>
    </section>`;

  if (!list.length) {
    html += `<section class="card"><div class="empty-state"><span class="big">📊</span>Bu aralıkta harcama yok.</div></section>`;
    return html;
  }

  html += `<section class="card">
      <div class="card-head"><h3>Kategori dağılımı</h3></div>
      <div class="donut-wrap">${donut(cats, total)}
        <div class="leg">${cats.slice(0, 6).map(c => `<div class="leg-row"><i style="background:${c.color}"></i><span>${esc(c.name)}</span><b>%${nf0.format((c.v / total) * 100)}</b></div>`).join('')}
        ${cats.length > 6 ? `<div class="muted" style="font-size:12px">+${cats.length - 6} kategori daha</div>` : ''}</div>
      </div>
    </section>`;

  html += `<section class="card chart">
      <div class="card-head"><h3>Günlük harcama</h3></div>
      ${barChart(r)}
      <div class="chart-legend"><span><i style="background:var(--good)"></i>Limit içinde</span><span><i style="background:var(--bad)"></i>Limit aşıldı</span><span><i style="background:none;border-top:2px solid var(--muted);height:0;border-radius:0"></i>O günün limiti</span></div>
    </section>`;

  html += `<section class="card">
      <div class="card-head"><h3>Kategoriler</h3></div>
      <div class="cat-list">${cats.map(c => `<div class="cat-item">
          <span class="ico" style="background:${c.color}22;color:${c.color}">${c.emoji}</span>
          <div><div class="cat-top"><span>${esc(c.name)}<small>%${nf0.format((c.v / total) * 100)}</small></span><span>${moneyX(c.v)}</span></div>
          <div class="cat-bar"><i style="width:${(c.v / cats[0].v) * 100}%;background:${c.color}"></i></div></div>
        </div>`).join('')}</div>
    </section>`;

  const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts);
  const shown = ui.showAll ? sorted : sorted.slice(0, 8);
  let lastD = '', rows = '';
  for (const e of shown) {
    if (e.date !== lastD) {
      lastD = e.date;
      const dt = sum(list.filter(x => x.date === e.date), x => x.amount);
      rows += `<div class="day-head"><span>${fmtDate(e.date)} ${DOW[dowIdx(e.date)]}</span><span>${moneyX(dt)}</span></div>`;
    }
    rows += expRow(e);
  }
  html += `<div class="section-title">Harcamalar</div>
    <section class="card" style="padding:6px 10px">${rows}
      ${sorted.length > 8 ? `<button class="btn ghost block" data-act="toggleAll" style="color:var(--accent)">${ui.showAll ? 'Daha az göster' : `Tümünü göster (${sorted.length})`}</button>` : ''}
    </section>`;
  return html;
}

function donut(cats, total) {
  const R = 58, C = 2 * Math.PI * R;
  let off = 0;
  const segs = cats.map(c => {
    const len = (c.v / total) * C;
    const gap = cats.length > 1 ? Math.min(2.5, len * 0.4) : 0;
    const s = `<circle r="${R}" cx="80" cy="80" fill="none" stroke="${c.color}" stroke-width="24" stroke-dasharray="${Math.max(0.01, len - gap)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 80 80)"/>`;
    off += len;
    return s;
  }).join('');
  return `<svg viewBox="0 0 160 160" class="donut">${segs}
    <text x="80" y="75" class="d-l">TOPLAM</text>
    <text x="80" y="95" class="d-v">${money(total)}</text></svg>`;
}

function barChart(r) {
  const t = todayStr();
  const map = spentMap();
  const days = [];
  for (let d = r.start; d <= r.end; d = addDays(d, 1)) days.push(d);
  const vals = days.map(d => ({ d, v: map[d] || 0, info: d <= t ? dayInfo(d) : null }));
  const W = 340, H = 170, pt = 8, pb = 20;
  const n = days.length, bw = W / n;
  const max = Math.max(1, ...vals.map(x => x.v), ...vals.map(x => (x.info ? Math.max(0, x.info.limit) : 0))) * 1.08;
  const y = v => pt + (H - pt - pb) * (1 - v / max);
  const step = n <= 7 ? 1 : n <= 31 ? 5 : Math.ceil(n / 7);
  let svg = `<line class="grid" x1="0" x2="${W}" y1="${H - pb}" y2="${H - pb}"/>`;
  vals.forEach((x, i) => {
    const bx = i * bw + bw * 0.16, w = bw * 0.68;
    if (x.v > 0) {
      const cls = x.info ? (x.v > x.info.limit + 0.004 ? 'b-bad' : 'b-good') : 'b-neutral';
      const top = y(x.v);
      svg += `<rect class="${cls}" x="${bx.toFixed(2)}" y="${top.toFixed(2)}" width="${w.toFixed(2)}" height="${(H - pb - top).toFixed(2)}" rx="${Math.min(4, w / 3).toFixed(2)}"/>`;
    }
    if (x.info && x.info.limit > 0) {
      const ly = y(x.info.limit).toFixed(2);
      svg += `<line class="lim" x1="${(i * bw + bw * 0.06).toFixed(2)}" x2="${(i * bw + bw * 0.94).toFixed(2)}" y1="${ly}" y2="${ly}"/>`;
    }
    const dn = parseD(x.d).getDate();
    const lbl = n <= 7 ? DOW_S[dowIdx(x.d)] : (i === 0 || (n <= 31 ? dn % step === 0 : i % step === 0)) ? String(dn) : '';
    if (lbl) svg += `<text class="axis" x="${(i * bw + bw / 2).toFixed(2)}" y="${H - 5}">${lbl}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}">${svg}</svg>`;
}

/* ---------------- Kartlar ---------------- */
function nextDue(day) {
  if (!day) return null;
  const n = new Date();
  const mk = (y, m) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
  let d = mk(n.getFullYear(), n.getMonth());
  if (toStr(d) < todayStr()) d = mk(n.getFullYear(), n.getMonth() + 1);
  return toStr(d);
}

function renderCards() {
  const cards = S.cards;
  const totalDebt = sum(cards, c => c.debt);
  const totalLimit = sum(cards.filter(c => c.limit), c => c.limit);
  const dues = cards.filter(c => c.dueDay && c.debt > 0).map(c => ({ c, d: nextDue(c.dueDay) })).sort((a, b) => a.d.localeCompare(b.d));

  let html = `<section class="card debt-sum">
    <span class="muted">Toplam kart borcu</span>
    <div class="big-num">${moneyX(totalDebt)}</div>
    ${totalLimit ? `<div class="progress" style="margin:8px 0 4px"><i style="width:${Math.min(100, (totalDebt / totalLimit) * 100)}%"></i></div>
      <div class="progress-txt"><span>Limit kullanımı %${nf0.format((totalDebt / totalLimit) * 100)}</span><span>Toplam limit ${money(totalLimit)}</span></div>` : ''}
    ${dues.length ? `<div class="eta">⏰ En yakın son ödeme: <b>${esc(dues[0].c.name)}</b> · ${fmtDate(dues[0].d)} (${dueText(dues[0].d)})</div>` : ''}
  </section>`;

  html += cards.map(c => {
    const due = nextDue(c.dueDay);
    const dl = due ? diffDays(todayStr(), due) : null;
    return `<button class="ccard g${c.color || 0}" data-act="card" data-id="${c.id}">
      <div class="cc-top"><b>${esc(c.name)}</b><span class="cc-chip"></span></div>
      <div class="cc-debt"><small>Güncel borç</small>${moneyX(c.debt)}</div>
      ${c.limit ? `<div><div class="cc-bar"><i style="width:${Math.min(100, (c.debt / c.limit) * 100)}%"></i></div>
        <div class="cc-row"><span>Limit ${money(c.limit)}</span><span>Kullanılabilir ${money(c.limit - c.debt)}</span></div></div>` : ''}
      ${due && c.debt > 0 ? `<span class="cc-due ${dl <= 3 ? 'soon' : ''}">Son ödeme ${fmtShort(due)} · ${dueText(due)}</span>` : ''}
    </button>`;
  }).join('');

  html += `<button class="btn block big" data-act="cardForm" style="border:1.5px dashed var(--border);background:transparent">＋ Kart ekle</button>`;
  return html;
}

const dueText = d => { const n = diffDays(todayStr(), d); return n === 0 ? 'bugün' : n === 1 ? 'yarın' : `${n} gün kaldı`; };

/* ---------------- Hayal araba ---------------- */
function carValue() {
  const c = S.car;
  const deposited = sum(c.deposits, d => d.amount);
  const value = c.mark ? c.mark.value + sum(c.deposits.filter(d => d.ts > c.mark.ts), d => d.amount) : deposited;
  return { deposited, value };
}

function renderCar() {
  const c = S.car;
  const img = getCarImage();
  const { deposited, value } = carValue();
  const hero = `<label class="car-hero" style="${img ? `background-image:url(${img})` : ''}">
      <input type="file" accept="image/*" id="carImg">
      ${img ? '<div class="shade"></div><span class="cam">📷 Değiştir</span>' : '<div class="placeholder"><span class="big">📸</span>Hayalindeki arabanın<br>fotoğrafını ekle</div>'}
      ${img ? `<div class="car-txt"><h2>${esc(c.name || 'Hayalimdeki araba')}</h2><p>${c.price ? money(c.price) : ''}</p></div>` : ''}
    </label>`;

  if (!c.price) {
    return hero + `<section class="card welcome">
      <div class="welcome-emoji">🏎️</div>
      <h2>Hedefini belirle</h2>
      <p class="muted">Arabanın adını ve fiyatını gir. Yaptığın yatırımları ekledikçe ne kadar kaldığını burada göreceksin.</p>
      <button class="btn primary block big" data-act="carForm">Arabayı ayarla</button>
    </section>`;
  }

  const left = c.price - value;
  const pct = Math.max(0, Math.min(100, (value / c.price) * 100));
  const profit = value - deposited;

  let eta = '';
  if (left > 0 && c.deposits.length) {
    const first = c.deposits.reduce((a, d) => (d.date < a ? d.date : a), c.deposits[0].date);
    const months = Math.max(1, diffDays(first, todayStr()) / 30.44);
    const rate = deposited / months;
    if (rate > 0) {
      const ml = Math.ceil(left / rate);
      const when = new Date(); when.setMonth(when.getMonth() + ml);
      eta = `<div class="eta">📈 Aylık ortalama <b>${money(rate)}</b> yatırımla yaklaşık <b>${ml} ay</b> sonra (${MONTHS[when.getMonth()]} ${when.getFullYear()}) hedefe ulaşırsın.</div>`;
    }
  }

  const deps = [...c.deposits].sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts);

  return hero + `
    <section class="card left-card">
      ${left > 0
        ? `<div class="big-left">${money(left)}</div><div class="lbl">kaldı 🚗</div>`
        : `<div class="big-left">Hedefe ulaştın!</div><div class="lbl">🎉 Arabayı alabilirsin</div>`}
      <div class="progress"><i style="width:${pct}%"></i></div>
      <div class="progress-txt"><span>%${nf0.format(pct)} tamamlandı</span><span>Hedef ${money(c.price)}</span></div>
      ${eta}
    </section>
    <div class="tiles">
      <div class="tile"><span>Güncel değer</span><b>${money(value)}</b></div>
      <div class="tile"><span>Yatırılan</span><b>${money(deposited)}</b></div>
      <div class="tile"><span>Kâr / zarar</span><b class="${profit > 0.5 ? 'good' : profit < -0.5 ? 'bad' : ''}">${profit > 0.5 ? '+' : ''}${money(profit)}</b></div>
    </div>
    <div class="btn-row">
      <button class="btn primary" data-act="deposit">＋ Yatırım ekle</button>
      <button class="btn" data-act="carValue">Değeri güncelle</button>
    </div>
    ${c.mark ? `<p class="foot">Son değer güncellemesi: ${fmtDate(toStr(new Date(c.mark.ts)), true)} · ${money(c.mark.value)}</p>` : ''}
    <div class="section-title">Yatırım geçmişi <button data-act="carForm">Arabayı düzenle</button></div>
    <section class="card" style="padding:8px 10px">
      ${deps.length ? `<div class="list">${deps.map(d => `<button class="row" data-act="depEdit" data-id="${d.id}">
          <span class="ico" style="background:var(--accent-soft);color:var(--accent)">💰</span>
          <span class="row-main"><b>${esc(d.note || 'Yatırım')}</b><small>${fmtDate(d.date, true)}</small></span>
          <span class="row-amt good">+${moneyX(d.amount)}</span></button>`).join('')}</div>`
        : '<div class="empty-state"><span class="big">💸</span>Henüz yatırım eklenmedi.</div>'}
    </section>`;
}

/* ---------------- Kişisel gelişim ----------------
   Hafta = Pazartesi–Pazar. Haftalık hedefi (İngilizce 5, Gym 3) tutturan her hafta
   streak'i 1 artırır; hedefin altında kalan bir hafta streak'i sıfırlar.
   Başlangıç haftası eksik günlerle başladıysa hedef o haftaya göre küçültülür. */
const weekStart = d => addDays(d, -dowIdx(d));

function weekCount(h, ws) {
  let c = 0;
  for (let i = 0; i < 7; i++) if (h.log[addDays(ws, i)] === 1) c++;
  return c;
}

function weekTarget(h, ws) {
  const we = addDays(ws, 6);
  if (h.start > we) return null;                       // takip başlamadan önceki hafta
  if (h.start > ws) return Math.min(h.target, diffDays(h.start, we) + 1);
  return h.target;
}

function habitStats(h) {
  const t = todayStr(), cw = weekStart(t);
  const cur = weekCount(h, cw);
  const curT = weekTarget(h, cw) ?? h.target;
  const curMet = cur >= curT;
  let possible = cur;                                   // bu hafta ulaşılabilecek en yüksek sayı
  for (let d = t; d <= addDays(cw, 6); d = addDays(d, 1)) if (h.log[d] !== 1) possible++;

  let done = 0;                                         // biten haftalardan üst üste tutturulanlar
  for (let ws = addDays(cw, -7); ; ws = addDays(ws, -7)) {
    const tg = weekTarget(h, ws);
    if (tg === null || weekCount(h, ws) < tg) break;
    done++;
  }

  let best = 0, run = 0;
  for (let ws = weekStart(h.start); ws <= cw; ws = addDays(ws, 7)) {
    if (weekCount(h, ws) >= weekTarget(h, ws)) best = Math.max(best, ++run);
    else if (ws < cw) run = 0;
  }

  let dayStreak = 0;
  for (let d = h.log[t] === 1 ? t : addDays(t, -1); h.log[d] === 1; d = addDays(d, -1)) dayStreak++;

  return {
    cur, curT, curMet, best, dayStreak,
    streak: done + (curMet ? 1 : 0),
    lost: !curMet && possible < curT,
    needed: Math.max(0, curT - cur),
    daysLeft: 7 - dowIdx(t),
    total: Object.values(h.log).filter(v => v === 1).length,
  };
}

function renderDev() {
  return S.habits.map(habitCard).join('') +
    `<p class="foot">Bir güne dokunarak işaretle: boş → ✓ yaptım → ✕ yapmadım → boş</p>`;
}

function habitCard(h) {
  const s = habitStats(h);
  const t = todayStr(), cw = weekStart(t);
  const v = h.log[t];

  let week = '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(cw, i), val = h.log[d], fut = d > t;
    week += `<button class="hd ${val === 1 ? 'done' : val === 0 ? 'miss' : ''} ${d === t ? 'today' : ''}" ${fut ? 'disabled' : ''} data-act="habitCycle" data-h="${h.id}" data-d="${d}">
      <small>${DOW_S[i]}</small><span>${val === 1 ? '✓' : val === 0 ? '✕' : parseD(d).getDate()}</span></button>`;
  }

  // son 12 hafta: üstte haftalık hedef çizgisi, altında 7 gün
  let grid = '';
  for (let w = 11; w >= 0; w--) {
    const ws = addDays(cw, -7 * w);
    const tg = weekTarget(h, ws), cnt = weekCount(h, ws);
    const mk = tg === null ? '' : cnt >= tg ? 'met' : ws < cw ? 'fail' : 'now';
    grid += `<i class="wk ${mk}"></i>`;
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i), val = h.log[d];
      grid += d > t ? '<i class="hc fut"></i>'
        : `<button class="hc ${val === 1 ? 'done' : val === 0 ? 'miss' : ''}" data-act="habitCycle" data-h="${h.id}" data-d="${d}" aria-label="${fmtDate(d)}"></button>`;
    }
  }

  const msg = s.curMet
    ? `Haftalık hedef tamam! Streak devam ediyor 🔥${s.cur > s.curT ? ` (+${s.cur - s.curT} fazladan)` : ''}`
    : s.lost
      ? 'Bu hafta hedefe artık yetişemezsin — hafta bitince streak sıfırlanacak.'
      : `Hedef için <b>${s.needed} gün</b> daha lazım · haftanın bitmesine ${s.daysLeft} gün var`;

  return `<section class="card habit" style="--hc:${h.color}">
    <div class="habit-head">
      <span class="ico" style="background:${h.color}22">${h.emoji}</span>
      <div class="row-main"><b>${esc(h.name)}</b><small>${esc(h.desc)} · haftada ${h.target} gün</small></div>
      <div class="streak ${s.streak ? 'on' : ''} ${s.lost ? 'risk' : ''}"><span>🔥</span><b>${s.streak}</b><small>hafta</small></div>
    </div>
    <div class="today-btns">
      <button class="btn ${v === 1 ? 'yes' : ''}" data-act="habitSet" data-h="${h.id}" data-v="1">✓ Bugün yaptım</button>
      <button class="btn ${v === 0 ? 'no' : ''}" data-act="habitSet" data-h="${h.id}" data-v="0">✕ Yapmadım</button>
    </div>
    <div class="hweek">${week}</div>
    <div class="hprog"><div class="progress"><i style="width:${Math.min(100, (s.cur / s.curT) * 100)}%"></i></div><b>${s.cur}/${s.curT}</b></div>
    <p class="hmsg ${s.curMet ? 'good' : s.lost ? 'bad' : ''}">${msg}</p>
    <div class="hgrid">${grid}</div>
    <div class="hstats">
      <div><span>Rekor</span><b>${s.best} hafta</b></div>
      <div><span>Üst üste</span><b>${s.dayStreak} gün</b></div>
      <div><span>Toplam</span><b>${s.total} gün</b></div>
    </div>
  </section>`;
}

function setHabit(id, d, val) {
  const h = S.habits.find(x => x.id === id);
  if (!h || d > todayStr()) return;
  if (val === undefined) delete h.log[d]; else h.log[d] = val;
  if (val !== undefined && d < h.start) h.start = d;
  save(); render();
  if (val === 1) {
    vibrate();
    const s = habitStats(h);
    toast(s.curMet ? `${h.emoji} ${h.name}: bu hafta ${s.cur}/${s.curT} — streak ${s.streak} hafta 🔥` : `${h.emoji} ${h.name}: bu hafta ${s.cur}/${s.curT}`);
  }
}

/* =========================================================
   Alt sayfa (sheet)
   ========================================================= */
// iPhone'da klavye açılınca görünür alan küçülür; modalı görünür alana sığdır ki klavye üstünü örtmesin
const VV = window.visualViewport;
function fitSheet() {
  const root = $('#sheet');
  if (!VV || !root.classList.contains('open')) return;
  root.style.top = VV.offsetTop + 'px';
  root.style.height = VV.height + 'px';
  root.classList.toggle('kb', window.innerHeight - VV.height > 120);
}
if (VV) { VV.addEventListener('resize', fitSheet); VV.addEventListener('scroll', fitSheet); }

function openSheet(html, mount) {
  const root = $('#sheet');
  root.querySelector('.sheet-body').innerHTML = html;
  root.querySelector('.sheet-panel').scrollTop = 0;
  root.classList.add('open');
  root.setAttribute('aria-hidden', 'false');
  document.body.classList.add('noscroll');
  fitSheet();
  if (mount) mount(root.querySelector('.sheet-body'));
}
function closeSheet() {
  const root = $('#sheet');
  root.classList.remove('open', 'kb');
  root.style.top = root.style.height = '';
  root.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('noscroll');
  if (document.activeElement) document.activeElement.blur();
}
const head = title => `<div class="sheet-head"><h3>${title}</h3><button class="icon-btn" data-act="close" aria-label="Kapat">✕</button></div>`;
const shake = el => { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); };

/* ---------- Harcama ekle / düzenle ---------- */
function openExpense(opts = {}) {
  const e = opts.id ? S.expenses.find(x => x.id === opts.id) : null;
  let sel = e ? e.cat : null;
  const date = e ? e.date : (opts.date || todayStr());

  openSheet(`${head(e ? 'Harcamayı düzenle' : 'Harcama ekle')}
    <form id="expForm" autocomplete="off" novalidate>
      <label class="amount"><span>₺</span><input id="amt" inputmode="decimal" placeholder="0" value="${amountStr(e?.amount)}"></label>
      <div class="chips scroll" id="chips">${allCats().map(c => `<button type="button" class="chip ${sel === c.id ? 'on' : ''}" data-cat="${c.id}"><span>${c.emoji}</span>${esc(c.name)}</button>`).join('')}</div>
      <input class="field" id="note" placeholder="Not ya da yeni kategori (ör. Netflix)" value="${esc(e?.note || '')}" enterkeyhint="done">
      <p class="hint" id="hint"></p>
      <div class="form-row">
        <label class="date-pill">📅 <input type="date" id="date" value="${date}"></label>
        ${e ? '<button type="button" class="btn danger" id="del">Sil</button>' : ''}
      </div>
      <button class="btn primary block big" type="submit">Kaydet</button>
    </form>`, body => {
    const amt = $('#amt', body), note = $('#note', body), hint = $('#hint', body);
    const updHint = () => {
      const v = note.value.trim();
      if (sel && v) hint.textContent = 'Yazdığın not olarak kaydedilecek.';
      else if (sel) hint.textContent = '';
      else if (v) {
        const ex = allCats().find(c => c.name.toLocaleLowerCase('tr') === v.toLocaleLowerCase('tr'));
        hint.textContent = ex ? `"${ex.name}" kategorisine eklenecek.` : `"${v}" yeni kategori olarak kaydedilecek.`;
      } else hint.textContent = 'Bir kategori seç ya da kendin yaz.';
    };
    updHint();
    $('#chips', body).addEventListener('click', ev => {
      const b = ev.target.closest('[data-cat]'); if (!b) return;
      sel = sel === b.dataset.cat ? null : b.dataset.cat;
      body.querySelectorAll('[data-cat]').forEach(x => x.classList.toggle('on', x.dataset.cat === sel));
      updHint();
    });
    note.addEventListener('input', updHint);
    if (e) $('#del', body).addEventListener('click', () => deleteExpense(e.id));

    $('#expForm', body).addEventListener('submit', ev => {
      ev.preventDefault();
      const amount = Math.round(parseAmount(amt.value) * 100) / 100;
      if (!(amount > 0)) { shake(amt.parentElement); amt.focus(); return; }
      let cat = sel, txt = note.value.trim();
      if (!cat) { if (txt) { cat = ensureCustomCat(txt); txt = ''; } else cat = 'diger'; }
      const d = $('#date', body).value || todayStr();
      if (e) Object.assign(e, { amount, cat, note: txt, date: d });
      else S.expenses.push({ id: uid(), amount, cat, note: txt, date: d, ts: Date.now() });
      save(); closeSheet(); render();
      const st = d === todayStr() ? todayStatus() : null;
      let msg = `${moneyX(amount)} · ${catById(cat).name} kaydedildi`;
      if (st) msg += st.remaining >= 0 ? ` — bugün kalan ${money(st.remaining)}` : ` — limit ${money(-st.remaining)} aşıldı`;
      vibrate();
      toast(msg);
    });
    if (!e) amt.focus();
  });
}

function deleteExpense(id) {
  const idx = S.expenses.findIndex(x => x.id === id);
  if (idx < 0) return;
  const [removed] = S.expenses.splice(idx, 1);
  save(); closeSheet(); render();
  toast(`${moneyX(removed.amount)} silindi`, () => { S.expenses.push(removed); save(); render(); });
}

/* ---------- Gün detayı ---------- */
function openDay(d) {
  const info = dayInfo(d);
  const list = S.expenses.filter(e => e.date === d).sort((a, b) => b.ts - a.ts);
  const spent = sum(list, e => e.amount);
  const t = todayStr();
  let stats = '';
  if (info && d <= t) {
    const diff = info.limit - spent;
    stats = `<div class="stat-trio">
      <div><span>Limit</span><b>${money(info.limit)}</b></div>
      <div><span>Harcanan</span><b>${moneyX(spent)}</b></div>
      <div><span>${diff >= 0 ? 'Artan' : 'Aşım'}</span><b class="${diff >= 0 ? 'good' : 'bad'}">${money(Math.abs(diff))}</b></div>
    </div>`;
  } else if (info) {
    stats = `<div class="info-box">Bugünkü duruma göre bu günün tahmini limiti: <b>${money(info.limit)}</b></div>`;
  } else {
    stats = `<div class="info-box">Bu gün herhangi bir bütçe dönemine dahil değil. Harcanan: <b>${moneyX(spent)}</b></div>`;
  }
  openSheet(`${head(`${fmtDate(d, true)} · ${DOW[dowIdx(d)]}`)}
    <div class="stack">
      ${stats}
      ${list.length ? `<div class="list">${list.map(e => expRow(e)).join('')}</div>` : '<div class="empty-state">Bu gün harcama yok.</div>'}
      <button class="btn primary block" data-act="addOnDay" data-d="${d}">＋ Bu güne harcama ekle</button>
    </div>`);
}

/* ---------- Bütçe dönemi ---------- */
function openBudget(mode) {
  const p = mode === 'edit' ? currentPeriod() : null;
  const t = todayStr();
  const start = p ? p.start : t;
  const end = p ? p.end : monthEnd(t) === t ? monthEnd(addDays(t, 1)) : monthEnd(t);
  const spentSoFar = p ? getSeries(p).totalSpent : 0;

  openSheet(`${head(p ? 'Bütçe dönemini düzenle' : 'Yeni bütçe dönemi')}
    <form id="budForm" novalidate>
      <label class="label">Elimdeki para
        <input class="field" id="bTotal" inputmode="decimal" placeholder="ör. 15.000" value="${amountStr(p?.total)}" style="font-size:20px;font-weight:700">
      </label>
      <div class="grid-2">
        <label class="label">Başlangıç<input class="field" type="date" id="bStart" value="${start}"></label>
        <label class="label">Bitiş<input class="field" type="date" id="bEnd" value="${end}"></label>
      </div>
      <div class="quick">
        <button type="button" class="chip" data-q="month">Ay sonuna kadar</button>
        <button type="button" class="chip" data-q="7">1 hafta</button>
        <button type="button" class="chip" data-q="15">15 gün</button>
        <button type="button" class="chip" data-q="30">30 gün</button>
      </div>
      <div class="info-box" id="bInfo"></div>
      <button class="btn primary block big" type="submit">Kaydet</button>
      ${p ? '<button type="button" class="btn block" data-act="newPeriod">Bunun yerine yeni dönem başlat</button>' : ''}
    </form>`, body => {
    const tot = $('#bTotal', body), s = $('#bStart', body), en = $('#bEnd', body), info = $('#bInfo', body);
    const upd = () => {
      const total = parseAmount(tot.value);
      const n = s.value && en.value ? diffDays(s.value, en.value) + 1 : 0;
      if (!(total > 0) || n <= 0) { info.innerHTML = 'Tutarı ve tarihleri gir.'; return; }
      info.innerHTML = `<b>${n} gün</b> · başlangıç günlük limiti <b>${money(total / n)}</b>` +
        (p ? `<br>Bu dönemde şu ana kadar harcanan: <b>${moneyX(spentSoFar)}</b> · kalan <b>${money(total - spentSoFar)}</b>` : '');
    };
    upd();
    [tot, s, en].forEach(x => x.addEventListener('input', upd));
    body.querySelector('.quick').addEventListener('click', ev => {
      const b = ev.target.closest('[data-q]'); if (!b) return;
      const base = s.value || t;
      en.value = b.dataset.q === 'month' ? monthEnd(base) : addDays(base, Number(b.dataset.q) - 1);
      upd();
    });
    $('#budForm', body).addEventListener('submit', ev => {
      ev.preventDefault();
      const total = parseAmount(tot.value);
      if (!(total > 0)) { shake(tot); return; }
      if (!s.value || !en.value || en.value < s.value) { shake(en); toast('Bitiş tarihi başlangıçtan önce olamaz'); return; }
      const np = p || { id: uid() };
      Object.assign(np, { start: s.value, end: en.value, total });
      if (!p) S.periods.push(np);
      resolveOverlaps(np);
      save(); closeSheet(); ui.page = 'home'; render();
      toast('Bütçe kaydedildi');
    });
  });
}

// Yeni/düzenlenen dönemle çakışan eski dönemleri kırp
function resolveOverlaps(np) {
  S.periods = S.periods.filter(q => {
    if (q === np) return true;
    if (q.end < np.start || q.start > np.end) return true;
    if (q.start >= np.start && q.end <= np.end) return false;
    if (q.start < np.start) q.end = addDays(np.start, -1);
    else q.start = addDays(np.end, 1);
    return true;
  });
}

/* ---------- Kart ---------- */
function openCardForm(id) {
  const c = id ? S.cards.find(x => x.id === id) : null;
  let color = c ? c.color || 0 : S.cards.length % 6;
  openSheet(`${head(c ? 'Kartı düzenle' : 'Kart ekle')}
    <form id="cardForm" novalidate>
      <label class="label">Kart adı<input class="field" id="cName" placeholder="ör. Bonus, Axess" value="${esc(c?.name || '')}"></label>
      <label class="label">Güncel borç<input class="field" id="cDebt" inputmode="decimal" placeholder="0" value="${amountStr(c?.debt)}"></label>
      <div class="grid-2">
        <label class="label">Limit (ops.)<input class="field" id="cLimit" inputmode="decimal" placeholder="—" value="${amountStr(c?.limit)}"></label>
        <label class="label">Son ödeme günü<input class="field" id="cDue" inputmode="numeric" placeholder="1–31" value="${c?.dueDay || ''}"></label>
      </div>
      <div class="swatches">${[0, 1, 2, 3, 4, 5].map(i => `<button type="button" class="swatch g${i} ${i === color ? 'on' : ''}" data-c="${i}"></button>`).join('')}</div>
      <button class="btn primary block big" type="submit">Kaydet</button>
      ${c ? '<button type="button" class="btn danger block" id="cDel">Kartı sil</button>' : ''}
    </form>`, body => {
    body.querySelector('.swatches').addEventListener('click', ev => {
      const b = ev.target.closest('[data-c]'); if (!b) return;
      color = Number(b.dataset.c);
      body.querySelectorAll('.swatch').forEach(x => x.classList.toggle('on', x === b));
    });
    if (c) $('#cDel', body).addEventListener('click', () => {
      if (!confirm(`${c.name} silinsin mi?`)) return;
      S.cards = S.cards.filter(x => x.id !== c.id); save(); closeSheet(); render();
    });
    $('#cardForm', body).addEventListener('submit', ev => {
      ev.preventDefault();
      const name = $('#cName', body).value.trim();
      if (!name) { shake($('#cName', body)); return; }
      const debt = parseAmount($('#cDebt', body).value) || 0;
      const limit = parseAmount($('#cLimit', body).value) || 0;
      const due = Math.min(31, Math.max(0, parseInt($('#cDue', body).value, 10) || 0));
      if (c) {
        if (Math.abs(debt - c.debt) > 0.004) c.log.push({ ts: Date.now(), delta: debt - c.debt, note: 'Elle düzeltme' });
        Object.assign(c, { name, debt, limit, dueDay: due, color });
      } else {
        S.cards.push({ id: uid(), name, debt, limit, dueDay: due, color, log: debt ? [{ ts: Date.now(), delta: debt, note: 'Başlangıç borcu' }] : [] });
      }
      save(); closeSheet(); render();
    });
  });
}

function openCard(id) {
  const c = S.cards.find(x => x.id === id);
  if (!c) return;
  const log = [...c.log].sort((a, b) => b.ts - a.ts).slice(0, 12);
  openSheet(`${head(esc(c.name))}
    <div class="stack">
      <div class="info-box" style="text-align:center">Güncel borç<div class="big-num" style="color:var(--text)">${moneyX(c.debt)}</div></div>
      <label class="amount"><span>₺</span><input id="cAmt" inputmode="decimal" placeholder="0"></label>
      <div class="btn-row">
        <button class="btn danger" id="cAdd">＋ Borç ekle</button>
        <button class="btn good" id="cPay">✓ Ödeme yaptım</button>
      </div>
      ${log.length ? `<div><div class="section-title" style="margin:6px 4px 4px">Geçmiş</div><div class="list">${log.map(l => `<div class="row">
          <span class="ico" style="background:${l.delta > 0 ? 'var(--bad-soft)' : 'var(--good-soft)'};color:${l.delta > 0 ? 'var(--bad)' : 'var(--good)'}">${l.delta > 0 ? '↑' : '↓'}</span>
          <span class="row-main"><b>${esc(l.note)}</b><small>${fmtDate(toStr(new Date(l.ts)), true)}</small></span>
          <span class="row-amt" style="color:${l.delta > 0 ? 'var(--bad)' : 'var(--good)'}">${l.delta > 0 ? '+' : '−'}${moneyX(Math.abs(l.delta))}</span></div>`).join('')}</div></div>` : ''}
      <button class="btn block" data-act="cardForm" data-id="${c.id}">Kartı düzenle</button>
    </div>`, body => {
    const amt = $('#cAmt', body);
    const apply = sgn => {
      const v = Math.round(parseAmount(amt.value) * 100) / 100;
      if (!(v > 0)) { shake(amt.parentElement); amt.focus(); return; }
      c.debt = Math.round((c.debt + sgn * v) * 100) / 100;
      c.log.push({ ts: Date.now(), delta: sgn * v, note: sgn > 0 ? 'Borç eklendi' : 'Ödeme' });
      save(); closeSheet(); render(); vibrate();
      toast(sgn > 0 ? `${moneyX(v)} borç eklendi` : `${moneyX(v)} ödeme kaydedildi`);
    };
    $('#cAdd', body).addEventListener('click', () => apply(1));
    $('#cPay', body).addEventListener('click', () => apply(-1));
  });
}

/* ---------- Araba ---------- */
function openCarForm() {
  const c = S.car;
  openSheet(`${head('Hayalindeki araba')}
    <form id="carForm" novalidate>
      <label class="label">Araba<input class="field" id="carName" placeholder="ör. Porsche 911 Carrera" value="${esc(c.name)}"></label>
      <label class="label">Güncel fiyatı<input class="field" id="carPrice" inputmode="decimal" placeholder="ör. 8.500.000" value="${amountStr(c.price)}" style="font-size:20px;font-weight:700"></label>
      <p class="hint" style="margin-top:-4px">Fiyat değiştikçe buradan güncelleyebilirsin.</p>
      <button class="btn primary block big" type="submit">Kaydet</button>
      ${getCarImage() ? '<button type="button" class="btn block" id="imgDel">Fotoğrafı kaldır</button>' : ''}
    </form>`, body => {
    const del = $('#imgDel', body);
    if (del) del.addEventListener('click', () => { localStorage.removeItem(IMG_KEY); closeSheet(); render(); });
    $('#carForm', body).addEventListener('submit', ev => {
      ev.preventDefault();
      const price = parseAmount($('#carPrice', body).value);
      if (!(price > 0)) { shake($('#carPrice', body)); return; }
      c.name = $('#carName', body).value.trim();
      c.price = price;
      save(); closeSheet(); render();
    });
  });
}

function openDeposit(id) {
  const d = id ? S.car.deposits.find(x => x.id === id) : null;
  openSheet(`${head(d ? 'Yatırımı düzenle' : 'Yatırım ekle')}
    <form id="depForm" novalidate>
      <label class="amount"><span>₺</span><input id="dAmt" inputmode="decimal" placeholder="0" value="${amountStr(d?.amount)}"></label>
      <input class="field" id="dNote" placeholder="Not (ör. Altın, fon, döviz)" value="${esc(d?.note || '')}">
      <div class="form-row">
        <label class="date-pill">📅 <input type="date" id="dDate" value="${d ? d.date : todayStr()}"></label>
        ${d ? '<button type="button" class="btn danger" id="dDel">Sil</button>' : ''}
      </div>
      <button class="btn primary block big" type="submit">Kaydet</button>
    </form>`, body => {
    const amt = $('#dAmt', body);
    if (d) $('#dDel', body).addEventListener('click', () => {
      if (!confirm('Bu yatırım kaydı silinsin mi?')) return;
      S.car.deposits = S.car.deposits.filter(x => x.id !== d.id); save(); closeSheet(); render();
    });
    $('#depForm', body).addEventListener('submit', ev => {
      ev.preventDefault();
      const amount = Math.round(parseAmount(amt.value) * 100) / 100;
      if (!(amount > 0)) { shake(amt.parentElement); return; }
      const note = $('#dNote', body).value.trim();
      const date = $('#dDate', body).value || todayStr();
      if (d) Object.assign(d, { amount, note, date });
      else S.car.deposits.push({ id: uid(), amount, note, date, ts: Date.now() });
      save(); closeSheet(); render(); vibrate();
      const left = S.car.price - carValue().value;
      toast(left > 0 ? `Harika! ${money(left)} kaldı 🚗` : 'Hedefe ulaştın! 🎉');
    });
    if (!d) amt.focus();
  });
}

function openCarValue() {
  const { value, deposited } = carValue();
  openSheet(`${head('Yatırımların güncel değeri')}
    <form id="valForm" novalidate>
      <p class="muted" style="font-size:14px">Altın, döviz, fon vb. yatırımlarının <b>bugünkü toplam değerini</b> gir. Sonraki yatırımlar bu değerin üstüne eklenir.</p>
      <label class="amount"><span>₺</span><input id="vAmt" inputmode="decimal" placeholder="0" value="${amountStr(Math.round(value * 100) / 100)}"></label>
      <div class="info-box">Yatırılan toplam: <b>${moneyX(deposited)}</b></div>
      <button class="btn primary block big" type="submit">Güncelle</button>
      ${S.car.mark ? '<button type="button" class="btn block" id="vReset">Değeri sıfırla (yatırılan tutarı kullan)</button>' : ''}
    </form>`, body => {
    const r = $('#vReset', body);
    if (r) r.addEventListener('click', () => { S.car.mark = null; save(); closeSheet(); render(); });
    $('#valForm', body).addEventListener('submit', ev => {
      ev.preventDefault();
      const v = parseAmount($('#vAmt', body).value);
      if (!(v >= 0)) { shake($('#vAmt', body).parentElement); return; }
      S.car.mark = { value: v, ts: Date.now() };
      save(); closeSheet(); render();
      toast('Değer güncellendi');
    });
  });
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 1400;
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      resolve(cv.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img')); };
    img.src = url;
  });
}

/* ---------- Ayarlar ---------- */
function openSettings() {
  const p = currentPeriod();
  const periods = [...S.periods].sort((a, b) => b.start.localeCompare(a.start));
  openSheet(`${head('Ayarlar')}
    <div class="stack">
      <div class="settings-group">
        <h4>Bütçe dönemi</h4>
        ${p ? `<div class="info-box"><b>${fmtDate(p.start)} – ${fmtDate(p.end, true)}</b><br>Elimdeki para: <b>${money(p.total)}</b></div>
          <div class="btn-row"><button class="btn" data-act="budget">Düzenle</button><button class="btn" data-act="newPeriod">Yeni dönem</button></div>`
        : '<button class="btn primary block" data-act="newPeriod">Bütçe dönemi oluştur</button>'}
        ${periods.length > 1 ? `<div class="list">${periods.map(q => `<div class="row"><span class="row-main"><b>${fmtShort(q.start)} – ${fmtShort(q.end)} ${q.end.slice(0, 4)}</b><small>${money(q.total)} · harcanan ${money(getSeries(q).totalSpent)}</small></span>
            ${q !== p ? `<button class="btn danger" style="height:34px;padding:0 12px;font-size:13px" data-act="delPeriod" data-id="${q.id}">Sil</button>` : ''}</div>`).join('')}</div>` : ''}
      </div>
      <div class="settings-group">
        <h4>Yedekleme</h4>
        <p class="muted" style="font-size:13px">Veriler sadece bu telefonda saklanır. Ara sıra yedek almanı öneririm.</p>
        <div class="btn-row">
          <button class="btn" data-act="export">⬇︎ Yedek al</button>
          <label class="btn">⬆︎ Yedek yükle<input type="file" id="importFile" accept="application/json,.json" hidden></label>
        </div>
      </div>
      <div class="settings-group">
        <h4>Tehlikeli bölge</h4>
        <button class="btn danger block" data-act="reset">Tüm verileri sil</button>
      </div>
      <p class="foot">Finansal · ${S.expenses.length} harcama kaydı</p>
    </div>`, body => {
    $('#importFile', body).addEventListener('change', ev => importData(ev.target.files[0]));
  });
}

async function exportData() {
  const data = JSON.stringify({ ...S, carImage: getCarImage() });
  const name = `finansal-yedek-${todayStr()}.json`;
  const file = new File([data], name, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function importData(file) {
  if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const data = JSON.parse(fr.result);
      if (!Array.isArray(data.expenses) || !Array.isArray(data.periods)) throw new Error('format');
      if (!confirm('Mevcut veriler yedektekilerle değiştirilecek. Devam edilsin mi?')) return;
      const { carImage, ...rest } = data;
      S = normalize(rest);
      if (carImage) localStorage.setItem(IMG_KEY, carImage); else localStorage.removeItem(IMG_KEY);
      save(); closeSheet(); render();
      toast('Yedek yüklendi');
    } catch { toast('Bu dosya geçerli bir yedek değil'); }
  };
  fr.readAsText(file);
}

/* =========================================================
   Toast / titreşim
   ========================================================= */
let toastTimer;
function toast(msg, undo) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button>Geri al</button>' : ''}`;
  if (undo) el.querySelector('button').onclick = () => { undo(); el.classList.remove('show'); };
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), undo ? 5000 : 2800);
}
const vibrate = () => { try { navigator.vibrate && navigator.vibrate(12); } catch { /* yok */ } };

/* =========================================================
   Olaylar
   ========================================================= */
const ACT = {
  nav: el => { ui.page = el.dataset.page; ui.showAll = false; render(); window.scrollTo(0, 0); },
  add: () => openExpense(),
  close: () => closeSheet(),
  settings: () => openSettings(),
  budget: () => openBudget(currentPeriod() ? 'edit' : 'new'),
  newPeriod: () => openBudget('new'),
  delPeriod: el => {
    if (!confirm('Bu dönem silinsin mi? (Harcamalar silinmez)')) return;
    S.periods = S.periods.filter(p => p.id !== el.dataset.id); save(); render(); openSettings();
  },
  hmPrev: () => { const d = new Date(ui.hm.y, ui.hm.m - 1, 1); ui.hm = { y: d.getFullYear(), m: d.getMonth() }; render(); },
  hmNext: () => { const d = new Date(ui.hm.y, ui.hm.m + 1, 1); ui.hm = { y: d.getFullYear(), m: d.getMonth() }; render(); },
  day: el => openDay(el.dataset.d),
  addOnDay: el => openExpense({ date: el.dataset.d }),
  editExp: el => openExpense({ id: el.dataset.id }),
  anMode: el => { ui.an = { mode: el.dataset.mode, off: 0 }; ui.showAll = false; render(); },
  anPrev: () => { ui.an.off--; ui.showAll = false; render(); },
  anNext: () => { if (ui.an.off < 0) { ui.an.off++; ui.showAll = false; render(); } },
  toggleAll: () => { ui.showAll = !ui.showAll; render(); },
  card: el => openCard(el.dataset.id),
  cardForm: el => openCardForm(el.dataset.id),
  carForm: () => openCarForm(),
  deposit: () => openDeposit(),
  depEdit: el => openDeposit(el.dataset.id),
  carValue: () => openCarValue(),
  habitSet: el => {
    const h = S.habits.find(x => x.id === el.dataset.h), t = todayStr(), v = Number(el.dataset.v);
    if (h) setHabit(h.id, t, h.log[t] === v ? undefined : v);
  },
  habitCycle: el => {
    const h = S.habits.find(x => x.id === el.dataset.h), d = el.dataset.d;
    if (h) setHabit(h.id, d, h.log[d] === undefined ? 1 : h.log[d] === 1 ? 0 : undefined);
  },
  export: () => exportData(),
  reset: () => {
    if (!confirm('Tüm veriler kalıcı olarak silinecek. Emin misin?')) return;
    if (!confirm('Son kez soruyorum: her şey silinsin mi?')) return;
    localStorage.removeItem(KEY); localStorage.removeItem(IMG_KEY);
    S = defaultState(); save(); closeSheet(); ui.page = 'home'; render();
  },
};

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (fn) fn(el, ev);
});

document.addEventListener('change', async ev => {
  if (ev.target.id !== 'carImg') return;
  const f = ev.target.files[0];
  if (!f) return;
  try {
    const data = await readImage(f);
    localStorage.setItem(IMG_KEY, data);
    render();
    toast('Fotoğraf kaydedildi');
  } catch { toast('Fotoğraf kaydedilemedi'); }
});

document.addEventListener('keydown', ev => { if (ev.key === 'Escape') closeSheet(); });

// Gün değişirse (uygulama arka planda açık kaldıysa) yeniden hesapla
let lastDay = todayStr();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && todayStr() !== lastDay) {
    lastDay = todayStr();
    const n = new Date(); ui.hm = { y: n.getFullYear(), m: n.getMonth() };
    invalidate(); render();
  }
});

/* =========================================================
   Başlat
   ========================================================= */
render();
if (new URLSearchParams(location.search).get('add') === '1') openExpense();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  // Yeni sürüm yüklendiğinde sayfayı bir kez yenile → güncellemeler hemen görünür
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloaded && !$('#sheet').classList.contains('open')) { reloaded = true; location.reload(); }
  });
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
})();
