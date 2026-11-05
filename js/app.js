// Интерфейс «Тропы»: анкета → рекомендации → траектория → упражнения.

const STORE_KEY = 'tropa.v1';
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const app = $('#app');

let state = load();
function load() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; } }
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* приватный режим — живём без сохранения */ } }

const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const nextSeptember = () => { const d = new Date(); const y = d.getMonth() >= 8 ? d.getFullYear() + 1 : d.getFullYear(); return `${y}-09-01`; };

function derived() {
  if (!state.profile) return null;
  const compScores = scoreCompetencies(state.profile);
  const profScores = scoreProfessions(compScores);
  const plan = buildPlan(state.profile, state.selection, compScores);
  return { compScores, profScores, plan };
}

function setProfile(profile, keepProgress) {
  profile.createdAt = todayISO();
  const cs = scoreCompetencies(profile);
  state = { profile, selection: defaultSelection(cs, scoreProfessions(cs)), progress: keepProgress ? state.progress || {} : {}, voice: state.voice };
  save();
}

function loadTest(n) {
  setProfile(JSON.parse(JSON.stringify(TEST_PROFILES[n])), false);
  state.test = n; save();
}

// ---------- Шапка ----------
const STEPS = [['intake', 'Анкета'], ['recommend', 'Рекомендации'], ['plan', 'Траектория'], ['learn', 'Упражнения']];
function header(active) {
  const ok = !!state.profile;
  return `<header class="top">
    <a class="logo" href="#/">Тропа<span>3–7 лет</span></a>
    <nav class="steps">${STEPS.map(([id, t], i) => `<a href="#/${id}" class="${id === active ? 'on' : ''} ${!ok && i ? 'off' : ''}"><b>${i + 1}</b>${t}</a>`).join('')}</nav>
    <button class="voice" type="button" title="Озвучивать задания" aria-label="Озвучивать задания" aria-pressed="${Voice.on}">${icon(Voice.on ? 'sound' : 'mute')}</button>
  </header>`;
}
function bindHeader() {
  const v = $('.voice');
  v.onclick = () => { Voice.on = !Voice.on; state.voice = Voice.on; save(); v.innerHTML = icon(Voice.on ? 'sound' : 'mute'); v.setAttribute('aria-pressed', Voice.on); if (!Voice.on) speechSynthesis?.cancel(); };
}
function page(active, body) {
  app.innerHTML = header(active) + `<main class="wrap">${body}</main>`;
  bindHeader();
  window.scrollTo(0, 0);
}

// ---------- Главная ----------
function viewHome() {
  page('', `
  <section class="hero">
    <h1>Программа обучения, собранная под конкретного ребёнка</h1>
    <p class="lead">Родитель описывает ребёнка и себя. «Тропа» предлагает компетенции, профессии будущего и навыки, строит план по месяцам и даёт интерактивные упражнения с зачётами.</p>
    <div class="row">
      <a class="btn" href="#/intake">${state.profile ? 'Изменить анкету' : 'Заполнить анкету'}</a>
      <a class="btn ghost" href="?test=1#/plan">Открыть ТЕСТ 1</a>
      ${state.profile ? '<a class="btn ghost" href="#/learn">Продолжить упражнения</a>' : ''}
    </div>
  </section>
  <ol class="path">
    ${[['Анкета', 'Возраст, способности, физическое развитие, образование и профессии родителей, срок программы.'],
      ['Рекомендации', 'Оценка 13 компетенций, подбор профессий-ориентиров и навыков с объяснением «почему».'],
      ['Траектория', 'Этапы и календарь по месяцам, недельная нагрузка, роли родителей, кружки, итоговый проект. Выгрузка в PDF.'],
      ['Упражнения', '33 навыка × 3 уровня. Интерактив для ребёнка с озвучкой, зачёт открывает следующий уровень.']]
      .map(([t, d]) => `<li><b>${t}</b><p>${d}</p></li>`).join('')}
  </ol>`);
}

// ---------- Анкета ----------
function viewIntake() {
  const p = state.profile || { sex: 'm', ageYears: 5, ageMonths: 0, endDate: nextSeptember(), hours: 6, abilities: {}, physiqueAhead: 0 };
  const opts = (arr, v) => arr.map(([val, t]) => `<option value="${val}" ${String(val) === String(v) ? 'selected' : ''}>${t}</option>`).join('');
  page('intake', `
  <h1>Анкета</h1>
  <p class="lead">Всё, что известно о ребёнке и семье. Чем точнее, тем точнее траектория.</p>
  <form class="form" id="f">
    <fieldset><legend>Ребёнок</legend>
      <div class="grid2">
        <label>Имя (необязательно)<input name="name" value="${esc(p.name || '')}" placeholder="Например, Миша"></label>
        <label>Пол<select name="sex">${opts([['m', 'мальчик'], ['f', 'девочка']], p.sex)}</select></label>
        <label>Возраст: лет<select name="ageYears">${opts([3, 4, 5, 6, 7].map(x => [x, x]), p.ageYears)}</select></label>
        <label>и месяцев<select name="ageMonths">${opts(Array.from({ length: 12 }, (_, i) => [i, i]), p.ageMonths)}</select></label>
        <label>Программа до<input type="date" name="endDate" value="${p.endDate}" required><span class="err" id="end-err" role="alert"></span></label>
        <label>Часов в неделю на развитие<select name="hours">${opts([3, 4, 5, 6, 7, 8, 10, 12].map(x => [x, `${x} ч`]), p.hours)}</select></label>
      </div>
    </fieldset>
    <fieldset><legend>Способности и интересы</legend>
      <div class="abil">${ABILITIES.map(a => `<div class="abil-row"><span>${a.icon} ${a.name}</span><div class="seg">${ABILITY_LEVELS.map((t, l) => `<label><input type="radio" name="ab_${a.id}" value="${l}" ${(+p.abilities[a.id] || 0) === l ? 'checked' : ''}><span>${l ? t : '—'}</span></label>`).join('')}</div></div>`).join('')}</div>
    </fieldset>
    <fieldset><legend>Физическое развитие и заметки</legend>
      <div class="grid2">
        <label>Крупнее и сильнее сверстников<select name="physiqueAhead">${opts([[0, 'как сверстники'], [1, 'примерно на 1 год'], [2, 'на 2 года'], [3, 'на 3 года'], [4, 'на 4 года и больше']], p.physiqueAhead)}</select></label>
        <label>Особенности, увлечения, ограничения<textarea name="notes" rows="2">${esc(p.notes || '')}</textarea></label>
      </div>
    </fieldset>
    <fieldset><legend>Родители: образование и профессия</legend>
      <p class="muted">Их навыки учитываются: родитель может вести часть занятий. Пишите свободно: «окончил МИРЭА, программист».</p>
      <div class="grid2">
        <label>Отец<input name="father" value="${esc(p.father || '')}" placeholder="вуз, специальность, работа"><span class="chips" data-for="father"></span></label>
        <label>Мать<input name="mother" value="${esc(p.mother || '')}" placeholder="вуз, специальность, работа"><span class="chips" data-for="mother"></span></label>
      </div>
    </fieldset>
    <div class="row">
      <button class="btn" type="submit">Получить рекомендации →</button>
      <button class="btn ghost" type="button" id="t1">Заполнить как ТЕСТ 1</button>
      ${state.profile ? '<button class="btn ghost danger" type="button" id="reset">Новый ребёнок (сбросить всё)</button>' : ''}
    </div>
  </form>`);
  const f = $('#f');
  const chips = () => $$('.chips', f).forEach(c => {
    const d = detectDomains(f.elements[c.dataset.for].value);
    c.innerHTML = d.length ? d.map(x => `<i>${PARENT_DOMAINS[x].name}</i>`).join('') : '';
  });
  f.addEventListener('input', () => { chips(); $('#end-err').textContent = ''; }); chips();
  f.onsubmit = e => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(f));
    const profile = {
      name: v.name.trim(), sex: v.sex, ageYears: +v.ageYears, ageMonths: +v.ageMonths, endDate: v.endDate, hours: +v.hours,
      physiqueAhead: +v.physiqueAhead, notes: v.notes.trim(), father: v.father.trim(), mother: v.mother.trim(),
      abilities: Object.fromEntries(ABILITIES.map(a => [a.id, +v[`ab_${a.id}`] || 0]).filter(([, l]) => l)),
    };
    const minEnd = new Date(); minEnd.setMonth(minEnd.getMonth() + 1);
    if (new Date(profile.endDate) < minEnd) {
      $('#end-err').textContent = 'Программа длится минимум месяц: выберите дату окончания позже.';
      f.elements.endDate.focus();
      return;
    }
    setProfile(profile, true);
    location.hash = '#/recommend';
  };
  $('#t1').onclick = () => { loadTest(1); viewIntake(); };
  const r = $('#reset');
  if (r) r.onclick = () => { if (confirm('Удалить анкету и весь прогресс?')) { state = { voice: state.voice }; save(); viewIntake(); } };
}

const skillCount = sel => {
  const n = sel.skills.filter(s => sel.comps.includes(SKILLS[s].comp)).length;
  return `${n} ${plural(n, 'навык', 'навыка', 'навыков')}`;
};

// ---------- Рекомендации ----------
function viewRecommend() {
  const { compScores, profScores, plan } = derived();
  const sel = state.selection, p = state.profile;
  const bar = s => `<span class="bar"><i style="width:${s}%"></i></span><b class="score">${s}</b>`;
  page('recommend', `
  <h1>Рекомендации</h1>
  <p class="lead">${esc(p.name || 'Ребёнок')}, ${formatAge(p.ageYears * 12 + (p.ageMonths || 0))} · программа на ${plan.months.length} мес., до ${formatDate(p.endDate)}${plan.schoolAge ? ` — к этому моменту ${formatAge(plan.schoolAge)}, старт школы` : ''}. Отметьте то, что берём в работу.</p>
  <h2>Компетенции</h2>
  <div class="cards3">${compScores.map(cs => { const c = compById(cs.id), on = sel.comps.includes(c.id); return `
    <label class="pick ${on ? 'on' : ''}" style="--c:${c.color}">
      <input type="checkbox" data-comp="${c.id}" ${on ? 'checked' : ''}>
      <div class="pick-h"><span class="ic">${c.icon}</span><b>${c.name}</b></div>
      <div class="pick-s">${bar(cs.score)}</div>
      <p>${c.about}</p>
      <ul class="why">${cs.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
    </label>`; }).join('')}</div>
  <h2>Профессии-ориентиры</h2>
  <p class="muted">Это не выбор судьбы, а ориентир: к чему ведут сильные стороны. Отмеченная профессия добавляет нужные ей компетенции.</p>
  <div class="cards3">${profScores.map(ps => { const pr = PROFESSIONS.find(x => x.id === ps.id), on = sel.profs.includes(pr.id); return `
    <label class="pick small ${on ? 'on' : ''}">
      <input type="checkbox" data-prof="${pr.id}" ${on ? 'checked' : ''}>
      <div class="pick-h"><span class="ic">${pr.icon}</span><b>${pr.name}</b></div>
      <div class="pick-s">${bar(ps.score)}</div>
      <p>${pr.about}</p>
    </label>`; }).join('')}</div>
  <h2>Навыки</h2>
  <div class="skills">${sel.comps.map(compById).map(c => `
    <div class="skill-group" style="--c:${c.color}"><b>${c.icon} ${c.name}</b>
      ${c.skills.map(s => `<label class="sk"><input type="checkbox" data-skill="${s}" ${sel.skills.includes(s) ? 'checked' : ''}> ${SKILLS[s].name} <em>${SKILLS[s].kind === 'activity' ? 'офлайн' : 'интерактив'}</em></label>`).join('')}
    </div>`).join('') || '<p class="muted">Отметьте хотя бы одну компетенцию.</p>'}</div>
  <div class="row sticky-cta"><span class="muted">Выбрано: ${sel.comps.length} ${plural(sel.comps.length, 'компетенция', 'компетенции', 'компетенций')}, ${skillCount(sel)}</span><a class="btn" href="#/plan">Построить траекторию →</a></div>`);

  $$('[data-comp]').forEach(i => i.onchange = () => {
    const id = i.dataset.comp, c = compById(id);
    if (i.checked) { sel.comps.push(id); c.skills.forEach(s => sel.skills.includes(s) || sel.skills.push(s)); }
    else sel.comps = sel.comps.filter(x => x !== id);
    save(); viewRecommend();
  });
  $$('[data-prof]').forEach(i => i.onchange = () => {
    const id = i.dataset.prof;
    if (i.checked) {
      sel.profs.push(id);
      Object.entries(PROFESSIONS.find(p => p.id === id).w).filter(([, w]) => w >= .3).forEach(([c]) => {
        if (!sel.comps.includes(c)) { sel.comps.push(c); compById(c).skills.forEach(s => sel.skills.includes(s) || sel.skills.push(s)); }
      });
    } else sel.profs = sel.profs.filter(x => x !== id);
    save(); viewRecommend();
  });
  $$('[data-skill]').forEach(i => i.onchange = () => {
    const s = i.dataset.skill;
    sel.skills = i.checked ? [...sel.skills, s] : sel.skills.filter(x => x !== s);
    save();
  });
}

// ---------- Траектория ----------
function viewPlan() {
  const d = derived(), { plan, compScores, profScores } = d, p = state.profile, sel = state.selection;
  const scoreOf = Object.fromEntries(compScores.map(c => [c.id, c.score]));
  const stats = progressStats(sel, state.progress);
  const maxMin = Math.max(...plan.weekly.map(w => w.minutes), 1);
  const comps = sel.comps.map(compById).sort((a, b) => scoreOf[b.id] - scoreOf[a.id]);
  page('plan', `
  <div class="plan-head">
    <div>
      <h1>${esc(p.name || 'Траектория ребёнка')}: ${plan.months[0]?.label.toLowerCase()} — ${formatDate(p.endDate)}</h1>
      <p class="lead">${state.test ? `ТЕСТ ${state.test} · ` : ''}${p.sex === 'f' ? 'Девочка' : 'Мальчик'}, ${formatAge(p.ageYears * 12 + (p.ageMonths || 0))} · ${plan.months.length} мес. · ${p.hours} ч в неделю · пройдено ${stats.passed} из ${stats.total} уровней</p>
    </div>
    <div class="row"><button class="btn" id="pdf" type="button">${icon('download')} Скачать PDF</button><a class="btn ghost" href="#/learn">К упражнениям →</a><p class="err" id="pdf-err" role="alert"></p></div>
  </div>

  <section class="key">
    <div><span>Сильные стороны</span><b>${comps.slice(0, 3).map(c => c.icon + ' ' + c.name).join('<br>') || 'Не выбраны'}</b></div>
    <div><span>Профессии-ориентиры</span><b>${selectedProfessions(sel, profScores).map(x => x.icon + ' ' + x.name).join('<br>') || 'Не выбраны'}</b></div>
    <div><span>Итоговый проект</span><b>${plan.project.title}</b><p>${plan.project.text}</p></div>
  </section>

  <h2>Этапы</h2>
  <div class="phases">${plan.phases.map(ph => `
    <div class="phase">
      <b>Этап ${ph.n}. ${ph.title}</b>
      <div class="muted">${ph.months.length > 1 ? `${monthLabel(ph.months[0])} — ${monthLabel(ph.months.at(-1))}` : monthLabel(ph.months[0])}</div>
      <p>${ph.focus}</p>
      <div class="muted">${ph.level ? `${skillCount(sel)} · уровень ${ph.level} «${LEVEL_NAMES[ph.level]}»` : `Итоговый проект: ${plan.project.title}`}</div>
    </div>`).join('')}</div>

  <h2>Календарь</h2>
  <div class="timeline">${plan.months.map(m => `
    <div class="tl"><div class="tl-m"><b>${m.label}</b><span>этап ${m.phase}</span></div>
      <div class="tl-e">${m.events.length ? m.events.map(e => `<div class="ev">${e}</div>`).join('') : '<div class="muted">Регулярные занятия по плану этапа</div>'}</div></div>`).join('')}</div>

  <div class="two">
    <section><h2>Неделя</h2>
      <p class="muted">${plan.onlineNote}</p>
      <div class="week">${plan.weekly.map(w => { const c = compById(w.comp); return `
        <div class="wk"><span>${c.icon} ${c.name}</span><span class="bar" style="--c:${c.color}"><i style="width:${w.minutes / maxMin * 100}%"></i></span><b>${w.minutes} мин</b><small>${w.format}</small></div>`; }).join('')}</div>
    </section>
    <section><h2>Роли родителей</h2>
      ${plan.parents.map(r => `<div class="parent"><b>${r.who}</b> <span class="muted">${esc(r.about)}${r.domains.length ? ' · ' + r.domains.join(', ') : ''}</span><p>${r.text}</p></div>`).join('') || '<p class="muted">Заполните образование родителей в анкете.</p>'}
      <h2>Кружки и секции</h2>
      <ul class="plain">${plan.offline.map(o => `<li>${compById(o.comp).icon} ${o.text}</li>`).join('')}</ul>
    </section>
  </div>

  <h2>Результаты к ${formatDate(p.endDate)}</h2>
  <div class="timeline">${plan.milestones.map(m => { const c = compById(m.comp); return `<div class="tl wide"><b>${c.icon} ${c.name}</b><div>${m.text}</div></div>`; }).join('')}</div>`);
  $('#pdf').onclick = downloadPdf;
}

// ---------- PDF ----------
function loadScript(src) {
  return new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = fail; document.head.appendChild(s); });
}
async function downloadPdf() {
  const btn = $('#pdf'), err = $('#pdf-err'); err.textContent = ''; btn.disabled = true; btn.textContent = 'Готовлю PDF…';
  try {
    if (!window.pdfMake) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/pdfmake.min.js');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/vfs_fonts.min.js');
    }
    const { compScores, profScores, plan } = derived();
    const name = (state.profile.name || 'rebenok').replace(/\s+/g, '_');
    pdfMake.createPdf(buildPdfDoc(state, compScores, profScores, plan)).download(`Тропа_программа_${name}.pdf`);
  } catch (e) {
    err.textContent = 'PDF не собрался. Проверьте интернет и нажмите «Скачать PDF» ещё раз.';
  } finally { btn.disabled = false; btn.innerHTML = `${icon('download')} Скачать PDF`; }
}

// ---------- Карта упражнений ----------
function viewLearn() {
  const sel = state.selection, prog = state.progress;
  const stats = progressStats(sel, prog);
  const next = nextExercises(sel, prog);
  const comps = sel.comps.map(compById);
  page('learn', `
  <div class="plan-head">
    <div><h1>Упражнения</h1><p class="lead">Уровни открываются по порядку: зачёт → следующий уровень. Задания озвучиваются — ребёнку не нужно уметь читать.</p></div>
    <div class="prog"><span class="bar"><i style="width:${stats.pct}%"></i></span><div><b>${stats.passed}</b> из ${stats.total} уровней · ${stats.stars} ${plural(stats.stars, 'звезда', 'звезды', 'звёзд')}</div></div>
  </div>
  ${next.length ? `<h2>Сегодня</h2><div class="today">${next.map(x => { const s = SKILLS[x.skill], c = compById(s.comp); return `
    <a class="go" href="#/ex/${x.skill}/${x.level}" style="--c:${c.color}"><span class="ic">${c.icon}</span><b>${s.name}</b><small>Уровень ${x.level} «${LEVEL_NAMES[x.level]}»${s.kind === 'activity' ? ' · офлайн' : ''}</small><span class="play">${icon('play')}</span></a>`; }).join('')}</div>` : `<div class="done-all">${stats.total ? '🏆 Все уровни пройдены! Пора защищать итоговый проект.' : 'Навыки не выбраны. <a href="#/recommend">Отметьте компетенции в рекомендациях</a>, и здесь появятся упражнения.'}</div>`}
  <h2>Карта навыков</h2>
  <div class="map">${comps.map(c => `
    <div class="map-c" style="--c:${c.color}"><b>${c.icon} ${c.name}</b>
    ${c.skills.filter(s => sel.skills.includes(s)).map(s => `<div class="map-s"><span>${SKILLS[s].name}</span><span class="lv">${[1, 2, 3].map(l => {
      const st = skillLevelState(prog, s, l), pr = prog[progKey(s, l)];
      return st === 'locked' ? `<i class="locked" title="Откроется после зачёта уровня ${l - 1}" aria-label="Откроется после зачёта уровня ${l - 1}">${icon('lock', 16)}</i>`
        : `<a class="${st}" href="#/ex/${s}/${l}" title="${LEVEL_NAMES[l]}: ${passRule(s, l)}">${st === 'passed' ? '⭐'.repeat(pr.stars || 1) : l}</a>`;
    }).join('')}</span></div>`).join('')}</div>`).join('')}</div>`);
}

// ---------- Экран упражнения ----------
function viewExercise(skill, level) {
  level = +level;
  const s = SKILLS[skill];
  if (!s || ![1, 2, 3].includes(level)) { location.hash = '#/learn'; return; }
  if (skillLevelState(state.progress, skill, level) === 'locked') { location.hash = '#/learn'; return; }
  const c = compById(s.comp);
  app.innerHTML = `<div class="ex" style="--c:${c.color}">
    <div class="ex-top"><a href="#/learn" class="back">← Карта</a><div><b>${c.icon} ${s.name}</b><small>Уровень ${level} «${LEVEL_NAMES[level]}» · зачёт: ${passRule(skill, level)}</small></div>
    <button class="voice" type="button" title="Озвучивать задания" aria-label="Озвучивать задания" aria-pressed="${Voice.on}">${icon(Voice.on ? 'sound' : 'mute')}</button></div>
    <div class="stage"></div></div>`;
  bindHeader();
  window.scrollTo(0, 0);
  const stage = $('.stage');
  RUNNERS[s.kind](stage, skill, level, res => finish(stage, skill, level, res));
}

function finish(stage, skill, level, res) {
  const key = progKey(skill, level), prev = state.progress[key] || { attempts: 0 };
  state.progress[key] = {
    passed: prev.passed || res.passed, stars: Math.max(prev.stars || 0, res.stars || 0),
    attempts: prev.attempts + 1, date: todayISO(),
  };
  save();
  if (!stage.isConnected) return;
  const nx = nextExercises(state.selection, state.progress, 1)[0];
  const scoreLine = res.unit === 'moves' ? `Ходов: ${res.score} (нужно не больше ${res.total})`
    : res.unit === 'notes' ? `Мелодия: ${res.score} из ${res.total} нот`
    : res.offline ? 'Взрослый поставил зачёт' : res.fails !== undefined ? `Ошибок робота: ${res.fails}` : `Результат: ${res.score} из ${res.total}`;
  if (res.passed) { Sound.good(); setTimeout(() => Sound.tone(1046, 0.4), 250); Voice.say('Зачёт! Молодец!'); }
  else Voice.say('Почти получилось! Попробуем ещё раз?');
  stage.innerHTML = `<div class="result ${res.passed ? 'pass' : ''}">
    <div class="huge">${res.passed ? '🏆' : '💪'}</div>
    <h2>${res.passed ? 'Зачёт!' : 'Почти получилось!'}</h2>
    <div class="stars">${res.passed ? '⭐'.repeat(res.stars) + '☆'.repeat(3 - res.stars) : ''}</div>
    <p>${scoreLine}</p>
    ${res.passed ? `<p class="muted">${level < 3 ? `Открыт уровень ${level + 1} «${LEVEL_NAMES[level + 1]}».` : 'Навык освоен на всех уровнях!'}</p>` : `<p class="muted">Для зачёта: ${passRule(skill, level)}.</p>`}
    <div class="row center">
      ${res.passed && nx ? `<a class="btn" href="#/ex/${nx.skill}/${nx.level}">Дальше: ${SKILLS[nx.skill].name} →</a>` : ''}
      <button class="btn ${res.passed ? 'ghost' : ''}" id="again" type="button">Ещё раз</button>
      <a class="btn ghost" href="#/learn">К карте</a>
    </div></div>`;
  if (res.passed) burst(stage);
  $('#again').onclick = () => viewExercise(skill, level);
}

// ---------- Роутер ----------
function route() {
  if (window.speechSynthesis) speechSynthesis.cancel();
  const [, view = '', a, b] = location.hash.split('/');
  if (['recommend', 'plan', 'learn', 'ex'].includes(view) && !state.profile) { location.hash = '#/intake'; return; }
  ({ '': viewHome, intake: viewIntake, recommend: viewRecommend, plan: viewPlan, learn: viewLearn, ex: () => viewExercise(a, b) }[view] || viewHome)();
}

(function init() {
  Voice.on = state.voice !== false;
  const t = new URLSearchParams(location.search).get('test');
  if (t && TEST_PROFILES[t]) {
    if (state.test !== +t) loadTest(+t);
    history.replaceState(null, '', location.pathname + (location.hash || '#/plan'));
  }
  window.addEventListener('hashchange', route);
  route();
})();
