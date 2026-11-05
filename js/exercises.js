// Интерактивные упражнения. Каждый раннер получает контейнер, навык, уровень и колбэк onDone({ passed, stars, score, total }).

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = rnd(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sample = (arr, k) => shuffle(arr).slice(0, k);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Значки интерфейса: одна линейная семья. Эмодзи остаются только содержанием заданий.
const ICONS = {
  sound: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
  mute: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 5 6"/><path d="m21 9-5 6"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  download: '<path d="M12 4v11"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/>',
  up: '<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>',
  down: '<path d="M12 5v14"/><path d="m6 13 6 6 6-6"/>',
  left: '<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>',
  right: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
};
const icon = (name, size = 20) => `<svg class="i" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

// ---------- Звук и голос ----------
const Sound = {
  ctx: null,
  get() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === 'suspended') this.ctx.resume(); return this.ctx; },
  tone(freq, dur = 0.5, when = 0, type = 'triangle', vol = 0.35) {
    const c = this.get(), t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
  },
  drum(when = 0) {
    const c = this.get(), t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.15);
    g.gain.setValueAtTime(0.8, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.25);
  },
  good() { this.tone(660, 0.15); this.tone(880, 0.25, 0.12); },
  bad() { this.tone(220, 0.3, 0, 'sine', 0.25); },
};
const midiFreq = m => 440 * Math.pow(2, (m - 69) / 12);

const Voice = {
  on: true,
  say(text, lang = 'ru-RU') {
    if (!this.on || !window.speechSynthesis) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang; u.rate = lang === 'ru-RU' ? 0.95 : 0.85;
    const v = speechSynthesis.getVoices().find(v => v.lang.replace('_', '-').startsWith(lang.slice(0, 2)));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  },
};

// ---------- Генераторы вопросов ----------
const OBJ = ['🍎', '⭐', '🐟', '🚗', '🎈', '🐞', '🍓', '⚽', '🦆', '🧸'];
const groupHTML = (e, n) => `<div class="objs">${Array.from({ length: n }, (_, i) => `<span>${e}</span>${(i + 1) % 5 === 0 && i + 1 < n ? '<br>' : ''}`).join('')}</div>`;
function near(n, k, lo = 0) {
  const s = new Set([n]);
  let guard = 0;
  while (s.size < k && guard++ < 100) { const x = n + rnd(-3, 3); if (x >= lo) s.add(x); }
  return shuffle([...s]).map(x => ({ html: x, correct: x === n }));
}
const opt = (html, correct) => ({ html, correct });

const SHAPES = {
  circle: ['круг', 0], square: ['квадрат', 4], triangle: ['треугольник', 3], rect: ['прямоугольник', 4],
  oval: ['овал', 0], rhombus: ['ромб', 4], star: ['звезда', 10], pentagon: ['пятиугольник', 5], hexagon: ['шестиугольник', 6],
};
const SHAPE_COLORS = ['#e4572e', '#2e86de', '#20a464', '#f2b705', '#8e44ad', '#e67e22'];
function shapeSVG(type, color = pick(SHAPE_COLORS), size = 76) {
  const poly = pts => `<polygon points="${pts}" fill="${color}"/>`;
  const reg = (n, r = 40, rot = -90) => Array.from({ length: n }, (_, i) => {
    const a = (rot + i * 360 / n) * Math.PI / 180; return `${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`;
  }).join(' ');
  const body = {
    circle: `<circle cx="50" cy="50" r="40" fill="${color}"/>`,
    square: `<rect x="14" y="14" width="72" height="72" fill="${color}"/>`,
    rect: `<rect x="6" y="28" width="88" height="44" fill="${color}"/>`,
    oval: `<ellipse cx="50" cy="50" rx="44" ry="26" fill="${color}"/>`,
    triangle: poly('50,10 92,86 8,86'),
    rhombus: poly('50,6 88,50 50,94 12,50'),
    pentagon: poly(reg(5, 44)),
    hexagon: poly(reg(6, 44, 0)),
    star: poly(Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? 18 : 44, a = (-90 + i * 36) * Math.PI / 180; return `${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`; }).join(' ')),
  }[type];
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-label="${SHAPES[type][0]}">${body}</svg>`;
}
const coinHTML = v => `<span class="coin c${v}">${v}<small>₽</small></span>`;
const ITEMS = [['🍦', 'мороженое'], ['🍭', 'леденец'], ['🧃', 'сок'], ['🎈', 'шарик'], ['🧸', 'мишка'], ['🍪', 'печенье'], ['✏️', 'карандаш'], ['🚗', 'машинка']];
const VOWELS = 'АЕЁИОУЫЭЮЯ';

const GEN = {
  count(L) {
    const max = [10, 15, 20][L - 1], n = rnd(L === 1 ? 2 : 6, max), e = pick(OBJ);
    return { q: 'Сколько здесь предметов?', visual: groupHTML(e, n), options: near(n, 4, 1) };
  },
  compare(L) {
    if (L === 1) {
      let a = rnd(1, 8), b = rnd(1, 8); while (a === b) b = rnd(1, 8);
      const more = Math.random() < 0.6, e = pick(OBJ);
      return { q: more ? 'Где больше?' : 'Где меньше?', options: [opt(groupHTML(e, a), more ? a > b : a < b), opt(groupHTML(e, b), more ? b > a : b < a)], wide: true };
    }
    if (L === 2) {
      const nums = sample(Array.from({ length: 20 }, (_, i) => i + 1), 3), big = Math.random() < 0.5;
      const target = big ? Math.max(...nums) : Math.min(...nums);
      return { q: big ? 'Какое число самое большое?' : 'Какое число самое маленькое?', options: nums.map(n => opt(n, n === target)) };
    }
    const a = rnd(0, 20), b = Math.random() < 0.2 ? a : rnd(0, 20);
    const sign = a > b ? '>' : a < b ? '<' : '=';
    return { q: `Какой знак поставить между ${a} и ${b}?`, visual: `<div class="big">${a} <span class="slot">?</span> ${b}</div>`, options: ['>', '<', '='].map(s => opt(s, s === sign)) };
  },
  numcomp(L) {
    const max = [5, 7, 10][L - 1], n = rnd(3, max), a = rnd(1, n - 1), b = n - a;
    if (L === 1) return { q: `Число ${n} — это ${a} и сколько ещё?`, visual: `<div class="objs">${'🔵'.repeat(a)}${'⚪'.repeat(b)}</div><div class="big">${n} = ${a} + <span class="slot">?</span></div>`, options: near(b, 3, 0) };
    if (L === 2) return { q: `Число ${n} — это ${a} и сколько ещё?`, visual: `<div class="big">${n} = ${a} + <span class="slot">?</span></div>`, options: near(b, 4, 0) };
    const wrong = new Set();
    while (wrong.size < 2) { const x = rnd(1, n), y = rnd(1, n); if (x + y !== n) wrong.add(`${x} + ${y}`); }
    return { q: `Какая пара вместе даёт ${n}?`, visual: `<div class="big">${n}</div>`, options: shuffle([opt(`${a} + ${b}`, true), ...[...wrong].map(w => opt(w, false))]) };
  },
  arith(L) {
    if (L === 1) {
      const a = rnd(1, 3), b = rnd(1, 5 - a), e = pick(OBJ);
      return { q: `${a} плюс ${b}. Сколько всего?`, visual: `<div class="big">${e.repeat(a)} + ${e.repeat(b)} = <span class="slot">?</span></div>`, options: near(a + b, 3, 1) };
    }
    if (L === 2) {
      const plus = Math.random() < 0.5;
      const a = rnd(plus ? 1 : 3, plus ? 8 : 10), b = plus ? rnd(1, 10 - a) : rnd(1, a);
      const r = plus ? a + b : a - b;
      return { q: `${a} ${plus ? 'плюс' : 'минус'} ${b}. Сколько будет?`, visual: `<div class="big">${a} ${plus ? '+' : '−'} ${b} = <span class="slot">?</span></div>`, options: near(r, 4, 0) };
    }
    const t = pick([
      () => { const a = rnd(3, 12), b = rnd(2, 20 - a); return [`У Миши было ${a} машинок, ему подарили ещё ${b}. Сколько стало?`, a + b, '🚗']; },
      () => { const a = rnd(6, 15), b = rnd(2, a - 1); return [`На ветке сидели ${a} птиц, ${b} улетели. Сколько осталось?`, a - b, '🐦']; },
      () => { const a = rnd(5, 12), b = rnd(3, 20 - a); return [`В коробке ${a} кубиков, папа добавил ${b}. Сколько всего кубиков?`, a + b, '🧱']; },
      () => { const a = rnd(8, 18), b = rnd(2, 8); return [`Было ${a} конфет, ${b} съели. Сколько осталось?`, a - b, '🍬']; },
    ])();
    return { q: t[0], visual: `<div class="huge">${t[2]}</div>`, options: near(t[1], 4, 0) };
  },
  pattern(L) {
    const pools = [['🔴', '🔵', '🟢', '🟡', '🟣'], ['⭐', '🌙', '☀️', '☁️'], ['🐶', '🐱', '🐭', '🐰'], ['🍎', '🍌', '🍇', '🍓']];
    if (L === 3 && Math.random() < 0.5) {
      const s = rnd(1, 6), k = pick([1, 2, 3]), down = Math.random() < 0.3;
      const seq = Array.from({ length: 4 }, (_, i) => down ? s + 3 * k - i * k : s + i * k);
      const ans = down ? seq[3] - k : seq[3] + k;
      return { q: 'Какое число следующее?', visual: `<div class="big seq">${seq.join(' , ')} , <span class="slot">?</span></div>`, options: near(ans, 3, 0) };
    }
    const p = sample(pick(pools), 3);
    const units = { 1: [[0, 1]], 2: [[0, 0, 1], [0, 1, 2], [0, 1, 1]], 3: [[0, 1, 1, 2], [0, 0, 1, 1], [0, 1, 2, 1]] }[L];
    const unit = pick(units).map(i => p[i]);
    const len = unit.length * 2 + rnd(0, unit.length - 1);
    const seq = Array.from({ length: len }, (_, i) => unit[i % unit.length]);
    const ans = unit[len % unit.length];
    const opts = [...new Set([...unit, ...p])].slice(0, 3);
    if (!opts.includes(ans)) opts[0] = ans;
    return { q: 'Что будет дальше?', visual: `<div class="big seq">${seq.join('')}<span class="slot">?</span></div>`, options: shuffle(opts).map(o => opt(o, o === ans)) };
  },
  oddone(L) {
    const [a, b] = shuffle(pick(L === 1 ? ODD_FAR : ODD_NEAR));
    const k = L === 3 ? 4 : 3;
    const odd = pick(CATEGORIES[b]);
    const items = shuffle([...sample(CATEGORIES[a], k).map(e => opt(e, false)), opt(odd, true)]);
    return { q: 'Что здесь лишнее?', options: items, why: `Остальные — ${a}` };
  },
  shapes(L) {
    if (L < 3) {
      const pool = L === 1 ? ['circle', 'square', 'triangle', 'rect'] : ['circle', 'square', 'triangle', 'rect', 'oval', 'rhombus', 'star', 'pentagon'];
      const opts = sample(pool, 4), target = pick(opts);
      return { q: `Найди: ${SHAPES[target][0]}`, options: opts.map(s => opt(shapeSVG(s), s === target)) };
    }
    const pool = ['triangle', 'square', 'rect', 'rhombus', 'pentagon', 'hexagon'];
    if (Math.random() < 0.5) {
      const s = pick(pool), n = SHAPES[s][1];
      return { q: 'Сколько углов у этой фигуры?', visual: shapeSVG(s, undefined, 120), options: [3, 4, 5, 6].map(x => opt(x, x === n)) };
    }
    const n = pick([3, 5, 6]), target = pool.find(s => SHAPES[s][1] === n);
    const others = sample(pool.filter(s => SHAPES[s][1] !== n), 2).concat('circle');
    return { q: `Найди фигуру, у которой ${n} углов`, options: shuffle([target, ...others]).map(s => opt(shapeSVG(s), s === target)) };
  },
  pitch(L) {
    const three = L === 3 && Math.random() < 0.5;
    const gap = L === 1 ? rnd(7, 12) : L === 2 ? rnd(3, 5) : rnd(1, 2);
    const base = rnd(57, 69);
    let notes, hi;
    if (three) {
      notes = shuffle([base, base + gap, base - rnd(2, 4)]);
      hi = notes.indexOf(Math.max(...notes));
    } else {
      notes = Math.random() < 0.5 ? [base, base + gap] : [base + gap, base];
      hi = notes[0] > notes[1] ? 0 : 1;
    }
    const play = () => notes.forEach((m, i) => Sound.tone(midiFreq(m), 0.6, i * 0.8));
    return {
      q: three ? 'Какой звук самый высокий?' : 'Какой звук выше — первый или второй?',
      visual: `<button class="btn ghost replay" type="button">${icon('sound')} Послушать ещё раз</button>`,
      options: notes.map((_, i) => opt(`${['1️⃣', '2️⃣', '3️⃣'][i]}<small>${['первый', 'второй', 'третий'][i]}</small>`, i === hi)),
      play, sayAfter: 2000,
    };
  },
  money(L) {
    if (L === 1) {
      const coins = Array.from({ length: rnd(2, 4) }, () => pick([1, 1, 2, 2, 5]));
      const sum = coins.reduce((a, b) => a + b, 0);
      return { q: 'Сколько здесь рублей?', visual: `<div class="coins">${coins.map(coinHTML).join('')}</div>`, options: near(sum, 4, 1) };
    }
    if (L === 2) {
      const coins = Array.from({ length: rnd(2, 4) }, () => pick([1, 2, 5, 5, 10]));
      const sum = coins.reduce((a, b) => a + b, 0), item = pick(ITEMS);
      const price = Math.max(1, sum + pick([-3, -2, -1, 0, 1, 2, 3]));
      const ok = sum >= price;
      return { q: `Хватит денег на ${item[1]} за ${price} ₽?`, visual: `<div class="coins">${coins.map(coinHTML).join('')}</div><div class="big">${item[0]} <span class="tag">${price} ₽</span></div>`, options: [opt('✅<small>хватит</small>', ok), opt('❌<small>не хватит</small>', !ok)] };
    }
    const have = pick([10, 10, 20]), item = pick(ITEMS), price = rnd(2, have - 1);
    return { q: `Было ${have} ₽. Купили ${item[1]} за ${price} ₽. Сколько сдачи?`, visual: `<div class="big">${coinHTML(10)}${have === 20 ? coinHTML(10) : ''} → ${item[0]} <span class="tag">${price} ₽</span></div>`, options: near(have - price, 4, 0) };
  },
  profit(L) {
    if (L === 1) {
      const [x, y] = sample(ITEMS, 2); let a = rnd(1, 10), b = rnd(1, 10); while (a === b) b = rnd(1, 10);
      const more = Math.random() < 0.5;
      return { q: more ? 'Что дороже?' : 'Что дешевле?', options: [opt(`${x[0]}<span class="tag">${a} ₽</span>`, more ? a > b : a < b), opt(`${y[0]}<span class="tag">${b} ₽</span>`, more ? b > a : b < a)] };
    }
    if (L === 2) {
      if (Math.random() < 0.3) {
        const a = rnd(4, 10), b = rnd(1, a - 1), item = pick(ITEMS);
        return { q: `Купил ${item[1]} за ${a} ₽, продал за ${b} ₽. Заработал или потерял?`, visual: `<div class="big">${item[0]} ${a} ₽ → ${b} ₽</div>`, options: [opt('📈<small>заработал</small>', false), opt('📉<small>потерял</small>', true)] };
      }
      const a = rnd(1, 6), b = rnd(a + 1, 10), item = pick(ITEMS);
      return { q: `Купил ${item[1]} за ${a} ₽, продал за ${b} ₽. Сколько заработал?`, visual: `<div class="big">${item[0]} ${a} ₽ → ${b} ₽</div>`, options: near(b - a, 4, 0) };
    }
    if (Math.random() < 0.5) {
      const n = rnd(2, 4), p = rnd(2, 3);
      return { q: `Продал ${n} стакана лимонада по ${p} ₽. Сколько получил?`, visual: `<div class="big">${'🥤'.repeat(n)}</div><div>каждый по ${p} ₽</div>`, options: near(n * p, 4, 1) };
    }
    const c = rnd(3, 8), r = rnd(c + 2, 20);
    return { q: `На лимоны потратил ${c} ₽, лимонада продал на ${r} ₽. Какая прибыль?`, visual: `<div class="big">🍋 −${c} ₽ &nbsp; 🥤 +${r} ₽</div>`, options: near(r - c, 4, 0) };
  },
  sounds(L) {
    if (L === 1) {
      const pool = WORDS.filter(w => !'ЯЁЕЮ'.includes(w[0][0]));
      const w = pick(pool), first = w[0][0];
      const others = sample([...new Set(pool.map(x => x[0][0]))].filter(l => l !== first), 2);
      return { q: `Какой первый звук в слове «${w[0].toLowerCase()}»?`, visual: `<div class="huge">${w[1]}</div>`, options: shuffle([first, ...others]).map(l => opt(l, l === first)) };
    }
    if (L === 2) {
      const pool = WORDS.filter(w => LAST_SOUND_OK.has(w[0]));
      const w = pick(pool), last = w[0].slice(-1);
      const others = sample([...new Set(pool.map(x => x[0].slice(-1)))].filter(l => l !== last), 2);
      return { q: `Какой последний звук в слове «${w[0].toLowerCase()}»?`, visual: `<div class="huge">${w[1]}</div>`, options: shuffle([last, ...others]).map(l => opt(l, l === last)) };
    }
    const w = pick(WORDS), n = [...w[0]].filter(ch => VOWELS.includes(ch)).length;
    return { q: `Сколько слогов в слове «${w[0].toLowerCase()}»? Прохлопай его!`, visual: `<div class="huge">${w[1]}</div>`, options: [1, 2, 3, 4].map(x => opt(x, x === n)) };
  },
  read(L) {
    if (L === 1) {
      const pool = WORDS.filter(w => !'ЁЯ'.includes(w[0][0]));
      const ws = []; for (const w of shuffle(pool)) { if (!ws.some(x => x[0][0] === w[0][0])) ws.push(w); if (ws.length === 3) break; }
      const t = ws[0];
      return { q: 'Какая картинка начинается на эту букву?', visual: `<div class="letter">${t[0][0]}</div>`, options: shuffle(ws).map(w => opt(w[1], w === t)), silentVisual: true };
    }
    if (L === 2) {
      const cons = 'МНЛРСПТКБД', vows = 'АОУЫИ';
      const c = pick([...cons]), sameCons = Math.random() < 0.5;
      const syl = sameCons ? sample([...vows], 3).map(v => c + v) : sample([...cons], 3).map(x => x + pick([...vows]));
      const t = syl[0];
      return { q: 'Найди слог, который ты слышишь', say: t.toLowerCase(), visual: `<button class="btn ghost replay" type="button">${icon('sound')} Ещё раз</button>`, options: shuffle(syl).map(s => opt(s, s === t)), replaySay: t.toLowerCase() };
    }
    const pool = WORDS.filter(w => w[0].length <= 5);
    const ws = sample(pool, 3), t = ws[0];
    return { q: 'Прочитай слово и найди картинку', visual: `<div class="word">${t[0]}</div>`, options: shuffle(ws).map(w => opt(w[1], w === t)), noSay: true };
  },
  emotions(L) {
    if (L < 3) {
      const [s, e] = pick(EMOTIONS);
      const others = sample(Object.keys(EMOTION_NAMES).filter(x => x !== e), L === 1 ? 2 : 3);
      return { q: s, options: shuffle([e, ...others]).map(x => opt(`${x}<small>${EMOTION_NAMES[x]}</small>`, x === e)) };
    }
    const [s, opts] = pick(SITUATIONS);
    return { q: s, options: shuffle(opts).map(([e, t, ok]) => opt(`${e}<small>${t}</small>`, !!ok)), wide: true };
  },
  living(L) {
    const [yes, no, q] = [['living', 'nonliving', 'Найди живое'], ['water', 'land', 'Кто живёт в воде?'], ['fly', 'nofly', 'Кто умеет летать?']][L - 1];
    const t = pick(LIVING[yes]);
    return { q, options: shuffle([opt(t, true), ...sample(LIVING[no], 3).map(e => opt(e, false))]) };
  },
  eng(L) {
    const words = sample(ENG[L], L === 3 ? 4 : 3), t = words[0];
    return { q: `Послушай слово и найди картинку: «${t[0]}»`, say: t[0], sayLang: 'en-US', replaySay: t[0], replayLang: 'en-US', visual: `<button class="btn ghost replay" type="button">${icon('sound')} Ещё раз</button>`, options: shuffle(words).map(w => opt(`${w[1]}`, w === t)), noSay: true };
  },
};

// ---------- Общие куски интерфейса упражнений ----------
function dotsHTML(total, done, results) {
  return `<div class="dots">${Array.from({ length: total }, (_, i) => `<i class="${i < done ? (results[i] ? 'ok' : 'no') : i === done ? 'cur' : ''}"></i>`).join('')}</div>`;
}
const starsFor = (score, total, pass) => score < pass ? 0 : score === total ? 3 : score >= pass + Math.ceil((total - pass) / 2) ? 2 : 1;

function burst(el) {
  const b = document.createElement('div');
  b.className = 'burst';
  b.innerHTML = Array.from({ length: 10 }, () => `<span style="--x:${rnd(-120, 120)}px;--y:${rnd(-140, -40)}px">${pick(['⭐', '✨', '🎉', '💫'])}</span>`).join('');
  el.appendChild(b); setTimeout(() => b.remove(), 900);
}

// ---------- Викторина ----------
function runQuiz(root, skill, level, onDone) {
  const total = 8, pass = 6, gen = GEN[SKILLS[skill].gen];
  let i = 0, score = 0; const results = []; const seen = new Set();
  const next = () => {
    if (!root.isConnected) return;
    if (i >= total) return onDone({ passed: score >= pass, stars: starsFor(score, total, pass), score, total, pass });
    let item, guard = 0;
    do { item = gen(level); } while (seen.has(item.q + item.options.map(o => o.html).join()) && guard++ < 20);
    seen.add(item.q + item.options.map(o => o.html).join());
    root.innerHTML = `${dotsHTML(total, i, results)}
      <div class="q"><button class="say" type="button" aria-label="Прочитать вслух">${icon('sound', 24)}</button><span>${esc(item.q)}</span></div>
      ${item.visual ? `<div class="visual">${item.visual}</div>` : ''}
      <div class="opts ${item.wide ? 'wide' : ''} n${item.options.length}">${item.options.map((o, k) => `<button class="opt" data-k="${k}" type="button">${o.html}</button>`).join('')}</div>`;
    const speak = () => { if (!item.noSay) Voice.say(item.q); if (item.say) setTimeout(() => Voice.say(item.say, item.sayLang || 'ru-RU'), item.noSay ? 0 : 1600); };
    root.querySelector('.say').onclick = () => { speak(); if (item.play) item.play(); };
    const replay = root.querySelector('.replay');
    if (replay) replay.onclick = () => { if (item.play) item.play(); if (item.replaySay) Voice.say(item.replaySay, item.replayLang || 'ru-RU'); };
    if (item.play) { item.play(); setTimeout(speak, item.sayAfter || 0); } else speak();
    let locked = false;
    root.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      if (locked) return; locked = true;
      const o = item.options[+b.dataset.k];
      results.push(o.correct);
      if (o.correct) { score++; b.classList.add('right'); Sound.good(); burst(b); }
      else {
        b.classList.add('wrong'); Sound.bad();
        root.querySelectorAll('.opt').forEach((x, k) => { if (item.options[k].correct) x.classList.add('right'); });
      }
      i++; setTimeout(next, o.correct ? 900 : 1700);
    });
  };
  next();
}

// ---------- Расставь по порядку ----------
function runOrder(root, skill, level, onDone) {
  const sets = sample(ORDER_SETS[SKILLS[skill].sets], 4), total = sets.length, pass = 2;
  const k = [3, 4, 5][level - 1];
  let r = 0, firstTry = 0; const results = [];
  const round = () => {
    if (!root.isConnected) return;
    if (r >= total) return onDone({ passed: firstTry >= pass, stars: starsFor(firstTry, total, pass), score: firstTry, total, pass });
    const set = sets[r], steps = set.steps.slice(0, Math.min(k, set.steps.length));
    let placed = [], attempts = 0;
    const cards = shuffle(steps.map((s, idx) => ({ s, idx })));
    const q = skill === 's_plan' ? `Составь план: «${set.title}». Что сначала, что потом?` : skill === 's_story' ? `Разложи картинки по порядку: «${set.title}»` : `Расставь шаги по порядку: «${set.title}»`;
    const draw = () => {
      root.innerHTML = `${dotsHTML(total, r, results)}
        <div class="q"><button class="say" type="button" aria-label="Прочитать вслух">${icon('sound', 24)}</button><span>${esc(q)}</span></div>
        <div class="slots">${steps.map((_, n) => { const c = placed[n]; return `<button class="slotc ${c ? 'filled' : ''}" data-n="${n}" type="button"><b>${n + 1}</b>${c ? `<span class="e">${c.s[0]}</span><small>${esc(c.s[1])}</small>` : ''}</button>`; }).join('')}</div>
        <div class="cards">${cards.map((c, n) => placed.includes(c) ? '' : `<button class="card" data-n="${n}" type="button"><span class="e">${c.s[0]}</span><small>${esc(c.s[1])}</small></button>`).join('')}</div>`;
      root.querySelector('.say').onclick = () => Voice.say(q);
      root.querySelectorAll('.card').forEach(b => b.onclick = () => { placed.push(cards[+b.dataset.n]); Sound.tone(520, 0.08); draw(); check(); });
      root.querySelectorAll('.slotc.filled').forEach(b => b.onclick = () => { placed.splice(+b.dataset.n); draw(); });
    };
    const check = () => {
      if (placed.length < steps.length) return;
      const ok = placed.every((c, n) => c.idx === n);
      if (ok) {
        if (!attempts) firstTry++;
        results.push(!attempts); Sound.good(); burst(root);
        const tell = skill === 's_story' ? '<p class="hint">🗣️ Теперь расскажи эту историю взрослому!</p>' : '';
        root.querySelector('.cards').innerHTML = `<div class="done-round">✅ Верно! ${tell}<button class="btn" type="button">Дальше</button></div>`;
        root.querySelector('.done-round .btn').onclick = () => { r++; round(); };
      } else {
        attempts++; Sound.bad();
        root.querySelectorAll('.slotc').forEach((b, n) => { if (placed[n].idx !== n) b.classList.add('wrong'); });
        setTimeout(() => { placed = placed.filter((c, n) => c.idx === n && placed.slice(0, n).every((p, m) => p.idx === m)); draw(); }, 1100);
      }
    };
    draw(); Voice.say(q);
  };
  round();
}

// ---------- Память: пары ----------
function runMemory(root, skill, level, onDone) {
  const pairs = [4, 6, 8][level - 1], limit = [12, 15, 18][level - 1];
  const pool = sample(Object.values(CATEGORIES).flat(), pairs);
  const deck = shuffle([...pool, ...pool].map((e, id) => ({ e, id, open: false, done: false })));
  let moves = 0, first = null, busy = false, found = 0;
  const q = 'Открывай по две карточки и найди все пары';
  const draw = () => {
    root.innerHTML = `<div class="q"><button class="say" type="button" aria-label="Прочитать вслух">${icon('sound', 24)}</button><span>${q}</span></div>
      <div class="meta">Ходов: <b>${moves}</b> из ${limit} · Пар: <b>${found}</b> из ${pairs}</div>
      <div class="mem">${deck.map((c, n) => `<button class="mcard ${c.open || c.done ? 'open' : ''} ${c.done ? 'done' : ''}" data-n="${n}" type="button">${c.open || c.done ? c.e : '❓'}</button>`).join('')}</div>`;
    root.querySelector('.say').onclick = () => Voice.say(q);
    root.querySelectorAll('.mcard').forEach(b => b.onclick = () => flip(+b.dataset.n));
  };
  const flip = n => {
    const c = deck[n]; if (busy || c.open || c.done) return;
    c.open = true; Sound.tone(600, 0.06);
    if (!first) { first = c; draw(); return; }
    moves++;
    if (first.e === c.e) {
      first.done = c.done = true; first.open = c.open = false; first = null; found++; Sound.good(); draw();
      if (found === pairs) setTimeout(() => {
        const passed = moves <= limit;
        const stars = !passed ? 0 : moves <= limit * 0.7 ? 3 : moves <= limit * 0.85 ? 2 : 1;
        onDone({ passed, stars, score: moves, total: limit, pass: limit, unit: 'moves' });
      }, 600);
    } else {
      busy = true; draw();
      setTimeout(() => { first.open = c.open = false; first = null; busy = false; draw(); }, 900);
    }
  };
  draw(); Voice.say(q);
}

// ---------- Робот ----------
function makeMaze(level) {
  const N = level === 3 ? 6 : 5, rocks = [0, 5, 8][level - 1], minDist = [3, 4, 6][level - 1];
  const cells = Array.from({ length: N * N }, (_, i) => [i % N, Math.floor(i / N)]);
  const key = ([x, y]) => `${x},${y}`;
  const bfs = (from, to, block) => {
    const q = [from], seen = new Set([key(from)]);
    while (q.length) {
      const [x, y] = q.shift(); if (x === to[0] && y === to[1]) return true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N || seen.has(k) || block.has(k)) continue;
        seen.add(k); q.push([nx, ny]);
      }
    }
    return false;
  };
  for (let t = 0; t < 500; t++) {
    const [start, goal, bat, ...rest] = shuffle(cells);
    if (Math.abs(start[0] - goal[0]) + Math.abs(start[1] - goal[1]) < minDist) continue;
    const block = new Set(rest.slice(0, rocks).map(key));
    const battery = level === 3 ? bat : null;
    if (battery ? bfs(start, battery, block) && bfs(battery, goal, block) : bfs(start, goal, block)) return { N, start, goal, battery, block };
  }
  return { N, start: [0, 0], goal: [N - 1, N - 1], battery: null, block: new Set() };
}

function runRobot(root, skill, level, onDone) {
  const total = 3; let r = 0, fails = 0;
  const DIRS = { up: [0, -1, 'вверх'], down: [0, 1, 'вниз'], left: [-1, 0, 'влево'], right: [1, 0, 'вправо'] };
  const round = () => {
    if (!root.isConnected) return;
    if (r >= total) {
      const stars = fails <= 1 ? 3 : fails <= 3 ? 2 : 1;
      return onDone({ passed: true, stars, score: total, total, pass: total, fails });
    }
    const m = makeMaze(level);
    let prog = [], running = false;
    const q = level === 3 ? 'Составь программу: робот берёт батарейку и едет к флажку' : 'Составь программу, чтобы робот доехал до флажка';
    const draw = (pos = m.start, got = false, boom = false) => {
      root.innerHTML = `<div class="dots">${Array.from({ length: total }, (_, i) => `<i class="${i < r ? 'ok' : i === r ? 'cur' : ''}"></i>`).join('')}</div>
        <div class="q"><button class="say" type="button" aria-label="Прочитать вслух">${icon('sound', 24)}</button><span>${q}</span></div>
        <div class="grid" style="--n:${m.N}">${Array.from({ length: m.N * m.N }, (_, i) => {
          const x = i % m.N, y = Math.floor(i / m.N), here = (p) => p && p[0] === x && p[1] === y;
          let c = '';
          if (m.block.has(`${x},${y}`)) c = '🪨';
          else if (here(m.goal)) c = '🏁';
          else if (here(m.battery) && !got) c = '🔋';
          if (here(pos)) c = boom ? '💥' : '🤖';
          return `<div class="cell">${c}</div>`;
        }).join('')}</div>
        <div class="tape">${prog.length ? prog.map((d, n) => `<button class="tok" data-n="${n}" type="button" aria-label="Убрать команду ${DIRS[d][2]}">${icon(d, 22)}</button>`).join('') : '<span class="muted">Нажимай стрелки — получится программа</span>'}</div>
        <div class="pad">${Object.entries(DIRS).map(([d, v]) => `<button class="arrow" data-d="${d}" type="button" aria-label="Команда ${v[2]}">${icon(d, 30)}</button>`).join('')}
          <button class="btn run" type="button">${icon('play', 18)} Пуск</button><button class="btn ghost clear" type="button">Стереть</button></div>`;
      root.querySelector('.say').onclick = () => Voice.say(q);
      root.querySelectorAll('.arrow').forEach(b => b.onclick = () => { if (running) return; prog.push(b.dataset.d); Sound.tone(500, 0.06); draw(); });
      root.querySelectorAll('.tok').forEach(b => b.onclick = () => { if (running) return; prog.splice(+b.dataset.n, 1); draw(); });
      root.querySelector('.clear').onclick = () => { if (!running) { prog = []; draw(); } };
      root.querySelector('.run').onclick = run;
    };
    const run = async () => {
      if (running || !prog.length) return; running = true;
      let pos = [...m.start], got = false;
      for (const d of prog) {
        const nx = pos[0] + DIRS[d][0], ny = pos[1] + DIRS[d][1];
        const crash = nx < 0 || ny < 0 || nx >= m.N || ny >= m.N || m.block.has(`${nx},${ny}`);
        if (crash) { draw(pos, got, true); Sound.bad(); fails++; Voice.say('Ой! Робот врезался. Исправь программу.'); await sleep(1200); running = false; draw(); return; }
        pos = [nx, ny];
        if (m.battery && pos[0] === m.battery[0] && pos[1] === m.battery[1]) got = true;
        draw(pos, got); Sound.tone(440, 0.05); await sleep(380);
      }
      const atGoal = pos[0] === m.goal[0] && pos[1] === m.goal[1];
      if (atGoal && (!m.battery || got)) {
        Sound.good(); burst(root); Voice.say('Ура! Робот на месте!');
        await sleep(1100); running = false; r++; round();
      } else {
        fails++; Sound.bad();
        Voice.say(atGoal ? 'Сначала нужно взять батарейку!' : 'Робот не доехал до флажка. Попробуй ещё.');
        await sleep(1300); running = false; draw();
      }
    };
    draw(); Voice.say(q);
  };
  round();
}

// ---------- Ритм ----------
function runRhythm(root, skill, level, onDone) {
  const total = 5, pass = 3, S = 350, Lg = 700;
  let r = 0, score = 0; const results = [];
  const makePattern = () => {
    if (level === 1) return Array(rnd(2, 3)).fill(500);
    const n = level === 2 ? 3 : rnd(4, 5);
    let p; do { p = Array.from({ length: n }, () => pick([S, Lg])); } while (!p.includes(S) || !p.includes(Lg));
    return p;
  };
  const round = () => {
    if (!root.isConnected) return;
    if (r >= total) return onDone({ passed: score >= pass, stars: starsFor(score, total, pass), score, total, pass });
    const pat = makePattern();
    let taps = [], listening = false, timer;
    const q = 'Послушай ритм и повтори его на барабане';
    root.innerHTML = `${dotsHTML(total, r, results)}
      <div class="q"><button class="say" type="button" aria-label="Прочитать вслух">${icon('sound', 24)}</button><span>${q}</span></div>
      <div class="rhythm-line"></div>
      <button class="drum" type="button">🥁</button>
      <div class="pad"><button class="btn ghost again" type="button">${icon('sound')} Послушать ещё раз</button></div>
      <p class="status muted" aria-live="polite">Слушай…</p>`;
    const drum = root.querySelector('.drum'), status = root.querySelector('.status'), line = root.querySelector('.rhythm-line');
    const play = async () => {
      if (!root.isConnected) return;
      listening = false; taps = []; status.textContent = 'Слушай…';
      line.innerHTML = '';
      await sleep(400);
      const beats = [0, ...pat.map((_, i) => pat.slice(0, i + 1).reduce((a, b) => a + b, 0))];
      for (let i = 0; i < beats.length; i++) {
        await sleep(i ? beats[i] - beats[i - 1] : 0);
        Sound.drum(); drum.classList.add('hit'); setTimeout(() => drum.classList.remove('hit'), 120);
        line.insertAdjacentHTML('beforeend', `<i style="margin-left:${i ? (pat[i - 1] === Lg ? 28 : 8) : 0}px"></i>`);
      }
      await sleep(300);
      listening = true; status.textContent = 'Твоя очередь! Стучи по барабану.';
    };
    const evaluate = () => {
      listening = false;
      const iv = taps.slice(1).map((t, i) => t - taps[i]);
      let ok = iv.length === pat.length;
      if (ok && level > 1) {
        const scale = iv.reduce((a, b) => a + b, 0) / pat.reduce((a, b) => a + b, 0), thr = scale * Math.sqrt(S * Lg);
        ok = iv.every((t, i) => (t > thr) === (pat[i] === Lg));
      }
      if (ok) { score++; Sound.good(); burst(root); status.textContent = '✅ Точно в ритм!'; }
      else { Sound.bad(); status.textContent = `Почти! Было ударов: ${pat.length + 1}, у тебя: ${taps.length}.`; }
      results.push(ok); r++;
      setTimeout(round, 1500);
    };
    drum.onclick = () => {
      Sound.drum(); drum.classList.add('hit'); setTimeout(() => drum.classList.remove('hit'), 120);
      if (!listening) return;
      taps.push(performance.now());
      clearTimeout(timer);
      if (taps.length >= pat.length + 1) timer = setTimeout(evaluate, 500);
      else timer = setTimeout(evaluate, 2000);
    };
    root.querySelector('.again').onclick = play;
    root.querySelector('.say').onclick = () => Voice.say(q);
    Voice.say(q); setTimeout(play, 1800);
  };
  round();
}

// ---------- Музыкальная память ----------
function runMelody(root, skill, level, onDone) {
  const target = [3, 5, 6][level - 1];
  const PADS = [['#e4572e', 72, 'до'], ['#f2b705', 76, 'ми'], ['#20a464', 79, 'соль'], ['#2e86de', 84, 'до']];
  let seq = [rnd(0, 3), rnd(0, 3)], lives = 3, input = [], listening = false;
  const q = 'Послушай мелодию и повтори её на цветных клавишах';
  root.innerHTML = `<div class="q"><button class="say" type="button" aria-label="Прочитать вслух">${icon('sound', 24)}</button><span>${q}</span></div>
    <div class="meta">Длина мелодии: <b class="len">2</b> из ${target} · Жизни: <b class="lives">❤️❤️❤️</b></div>
    <div class="pads">${PADS.map((p, i) => `<button class="padk" data-i="${i}" style="--c:${p[0]}" type="button">${p[2]}</button>`).join('')}</div>
    <p class="status muted" aria-live="polite">Слушай…</p>`;
  const pads = root.querySelectorAll('.padk'), status = root.querySelector('.status');
  const flash = i => { Sound.tone(midiFreq(PADS[i][1]), 0.4); pads[i].classList.add('lit'); setTimeout(() => pads[i].classList.remove('lit'), 300); };
  const play = async () => {
    if (!root.isConnected) return;
    listening = false; input = []; status.textContent = 'Слушай…';
    root.querySelector('.len').textContent = seq.length;
    await sleep(700);
    for (const i of seq) { flash(i); await sleep(600); }
    listening = true; status.textContent = 'Повтори!';
  };
  pads.forEach(b => b.onclick = async () => {
    const i = +b.dataset.i; flash(i);
    if (!listening) return;
    input.push(i);
    const n = input.length - 1;
    if (input[n] !== seq[n]) {
      listening = false; lives--; Sound.bad();
      root.querySelector('.lives').textContent = '❤️'.repeat(lives) + '🤍'.repeat(3 - lives);
      if (!lives) { await sleep(800); return onDone({ passed: false, stars: 0, score: seq.length - 1, total: target, pass: target, unit: 'notes' }); }
      status.textContent = 'Ошибка — послушай ещё раз'; await sleep(900); play(); return;
    }
    if (input.length === seq.length) {
      listening = false; Sound.good(); burst(root);
      if (seq.length >= target) { await sleep(900); return onDone({ passed: true, stars: lives, score: seq.length, total: target, pass: target, unit: 'notes' }); }
      seq.push(rnd(0, 3)); status.textContent = '✅ Молодец! Мелодия становится длиннее…';
      await sleep(1000); play();
    }
  });
  root.querySelector('.say').onclick = () => Voice.say(q);
  Voice.say(q); setTimeout(play, 2200);
}

// ---------- Офлайн-задание с подтверждением взрослого ----------
function runActivity(root, skill, level, onDone) {
  const task = ACTIVITIES[skill][level - 1];
  root.innerHTML = `<div class="activity">
      <div class="huge">${compById(SKILLS[skill].comp).icon}</div>
      <div class="q"><button class="say" type="button" aria-label="Прочитать вслух">${icon('sound', 24)}</button><span>${esc(task)}</span></div>
      <p class="muted">Это задание выполняется в реальной жизни. Когда ребёнок справится, взрослый ставит зачёт.</p>
      <div class="pad"><button class="btn confirm" type="button">✅ Ребёнок выполнил — поставить зачёт</button></div>
    </div>`;
  root.querySelector('.say').onclick = () => Voice.say(task);
  root.querySelector('.confirm').onclick = () => {
    const a = rnd(6, 9), b = rnd(6, 9);
    const box = root.querySelector('.pad');
    box.innerHTML = `<div class="gate">
      <label>Проверка, что это взрослый: сколько будет ${a} × ${b}?
        <input inputmode="numeric" class="gate-in" autocomplete="off"></label>
      <p>Как получилось?</p>
      <div class="rate">${[1, 2, 3].map(s => `<button class="btn ghost" data-s="${s}" type="button">${'⭐'.repeat(s)}</button>`).join('')}</div>
      <p class="gate-err"></p></div>`;
    box.querySelectorAll('.rate .btn').forEach(btn => btn.onclick = () => {
      if (+box.querySelector('.gate-in').value !== a * b) { box.querySelector('.gate-err').textContent = 'Ответ неверный — зачёт ставит взрослый.'; return; }
      onDone({ passed: true, stars: +btn.dataset.s, score: 1, total: 1, pass: 1, offline: true });
    });
    box.querySelector('.gate-in').focus();
  };
  Voice.say(task);
}

const RUNNERS = { quiz: runQuiz, order: runOrder, memory: runMemory, robot: runRobot, rhythm: runRhythm, melody: runMelody, activity: runActivity };

// Как сдаётся уровень — для карточек, плана и PDF.
function passRule(skill, level) {
  const k = SKILLS[skill].kind;
  return {
    quiz: 'не меньше 6 верных ответов из 8',
    order: 'не меньше 2 из 4 заданий с первой попытки',
    memory: `найти все пары не больше чем за ${[12, 15, 18][level - 1]} ходов`,
    robot: 'довести робота до цели в 3 лабиринтах',
    rhythm: 'повторить 3 ритма из 5',
    melody: `повторить мелодию из ${[3, 5, 6][level - 1]} нот (3 жизни)`,
    activity: 'выполнить задание, зачёт ставит взрослый',
  }[k];
}
