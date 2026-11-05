// Движок рекомендаций и траектории. Чистые функции: профиль → оценки → план.

const MONTHS_RU = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONTHS_RU_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

const compById = id => COMPETENCIES.find(c => c.id === id);
const abilityById = id => ABILITIES.find(a => a.id === id);

function monthsBetween(a, b) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function ageMonthsAt(profile, date) {
  const base = profile.ageYears * 12 + (profile.ageMonths || 0);
  return base + monthsBetween(new Date(profile.createdAt), date);
}

function formatAge(months) {
  const y = Math.floor(months / 12), m = months % 12;
  const yw = y % 10 === 1 && y % 100 !== 11 ? 'год' : (y % 10 >= 2 && y % 10 <= 4 && (y % 100 < 10 || y % 100 >= 20) ? 'года' : 'лет');
  return m ? `${y} ${yw} ${m} мес.` : `${y} ${yw}`;
}

function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_RU_GEN[d.getMonth()]} ${d.getFullYear()}`;
}

// Сферы родителя по свободному тексту об образовании и профессии.
function detectDomains(text) {
  const t = ' ' + (text || '').toLowerCase().replace(/ё/g, 'е') + ' ';
  const found = [];
  for (const [id, d] of Object.entries(PARENT_DOMAINS)) {
    const hit = d.keys.find(k => {
      const key = k.replace(/ё/g, 'е');
      // Короткие ключи (it, pr, маи) — только целым словом.
      return key.length <= 3 ? new RegExp(`[^a-zа-я]${key}[^a-zа-я]`).test(t) : t.includes(key);
    });
    if (hit) found.push(id);
  }
  return found;
}

function schoolStart(profile) {
  const end = new Date(profile.endDate);
  const ageEnd = ageMonthsAt(profile, end);
  const ageNow = ageMonthsAt(profile, new Date(profile.createdAt));
  return ageEnd >= 72 && ageNow < 90 ? ageEnd : 0;
}

const saturate = raw => Math.min(99, Math.round(100 * (1 - Math.exp(-raw / 60))));

function scoreCompetencies(profile) {
  const ab = profile.abilities || {};
  const parents = [
    { who: 'отец', text: profile.father, domains: detectDomains(profile.father) },
    { who: 'мать', text: profile.mother, domains: detectDomains(profile.mother) },
  ];
  const ahead = +profile.physiqueAhead || 0;
  const schoolAge = schoolStart(profile);

  return COMPETENCIES.map(c => {
    let raw = c.base;
    const reasons = [];
    for (const [a, w] of Object.entries(c.w)) {
      const lvl = +ab[a] || 0;
      if (!lvl) continue;
      raw += lvl * w;
      if (lvl * w >= 12) reasons.push(`${abilityById(a).name.toLowerCase()} — ${ABILITY_LEVELS[lvl]}`);
    }
    if (c.physique && ahead > 0) {
      raw += c.physique;
      reasons.push(c.id === 'eq'
        ? `крупнее сверстников на ${ahead} г. — важно научиться бережно управлять силой`
        : `крупнее сверстников на ${ahead} г. — физическое преимущество`);
    }
    for (const p of parents) {
      for (const d of p.domains) {
        const w = (c.parent || {})[d];
        if (!w) continue;
        raw += w;
        if (w >= 6) reasons.push(`${p.who}: ${PARENT_DOMAINS[d].name} («${p.text.trim()}») — может вести занятия`);
      }
    }
    if (c.schoolBonus && schoolAge) {
      raw += c.schoolBonus;
      reasons.push(`к ${formatDate(profile.endDate)} будет ${formatAge(schoolAge)} — поступление в 1 класс`);
    }
    if (!reasons.length) reasons.push('базовая компетенция возраста');
    return { id: c.id, score: saturate(raw), reasons };
  }).sort((a, b) => b.score - a.score);
}

function scoreProfessions(compScores) {
  const s = Object.fromEntries(compScores.map(c => [c.id, c.score]));
  return PROFESSIONS.map(p => ({
    id: p.id,
    score: Math.round(Object.entries(p.w).reduce((sum, [c, w]) => sum + w * (s[c] || 0), 0)),
  })).sort((a, b) => b.score - a.score);
}

// Выбранные профессии по убыванию совпадения: один порядок для экрана и PDF.
function selectedProfessions(selection, profScores) {
  return profScores.filter(x => selection.profs.includes(x.id)).map(x => PROFESSIONS.find(p => p.id === x.id));
}

// Предвыбор: сильные компетенции, топ-5 профессий, все навыки выбранных компетенций.
function defaultSelection(compScores, profScores) {
  const comps = compScores.filter(c => c.score >= 40).map(c => c.id);
  const profs = profScores.slice(0, 5).map(p => p.id);
  const skills = comps.flatMap(c => compById(c).skills);
  return { comps, profs, skills };
}

function programMonths(profile) {
  const start = new Date(profile.createdAt);
  if (start.getDate() > 20) start.setMonth(start.getMonth() + 1);
  start.setDate(1);
  const end = new Date(profile.endDate);
  end.setDate(end.getDate() - 1);
  const months = [];
  for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
    months.push({ y: d.getFullYear(), m: d.getMonth() });
  }
  return months;
}

const monthLabel = ({ y, m }) => `${MONTHS_RU[m][0].toUpperCase()}${MONTHS_RU[m].slice(1)} ${y}`;

function buildPlan(profile, selection, compScores) {
  const scoreOf = Object.fromEntries(compScores.map(c => [c.id, c.score]));
  const comps = selection.comps.map(compById).sort((a, b) => scoreOf[b.id] - scoreOf[a.id]);
  const has = id => selection.comps.includes(id);
  const skills = selection.skills.filter(s => has(SKILLS[s].comp));
  const months = programMonths(profile);
  const school = has('school') && schoolStart(profile);

  // Этапы: три уровня навыков + финальный месяц на проект, если программа длиннее 3 месяцев.
  const n = months.length;
  const finalLen = n >= 4 ? 1 : 0;
  const body = n - finalLen;
  const cuts = [0, Math.ceil(body / 3), Math.ceil(body * 2 / 3), body];
  const phaseDefs = [
    { title: 'Старт: база и интерес', level: 1, focus: 'Диагностика и первые зачёты по всем навыкам. Ребёнок пробует всё, взрослые наблюдают, что увлекает сильнее.' },
    { title: 'Развитие: устойчивые навыки', level: 2, focus: 'Регулярные занятия, кружки, второй уровень упражнений. Проверка в конце этапа и корректировка нагрузки.' },
    { title: 'Мастерство: сложные задачи и проекты', level: 3, focus: 'Третий уровень, самостоятельные проекты, выступления и соревнования.' },
  ];
  const phases = phaseDefs.map((p, i) => ({ ...p, months: months.slice(cuts[i], cuts[i + 1]) })).filter(p => p.months.length);
  if (finalLen) phases.push({
    title: school ? 'Финиш: итоговый проект и готовность к школе' : 'Финиш: итоговый проект',
    level: 0, months: months.slice(body),
    focus: 'Повторение, итоговая диагностика по всем навыкам и защита итогового проекта перед семьёй.',
  });
  phases.forEach((p, i) => { p.n = i + 1; p.skills = p.level ? skills : []; });

  const monthPlan = months.map((mo, i) => {
    const phase = phases.find(p => p.months.includes(mo));
    return { label: monthLabel(mo), phase: phase.n, events: monthEvents(mo, i, n, has, profile, school) };
  });

  // Недельная нагрузка: часы делятся пропорционально оценке, онлайн-упражнения — не больше 15 минут в день.
  const totalMin = (+profile.hours || 6) * 60;
  const sum = comps.reduce((s, c) => s + scoreOf[c.id], 0) || 1;
  const weekly = comps.map(c => {
    const min = Math.max(30, Math.round(totalMin * scoreOf[c.id] / sum / 15) * 15);
    return { comp: c.id, minutes: min, format: weeklyFormat(c.id, profile) };
  });

  return {
    months: monthPlan, phases, weekly,
    onlineNote: 'Экранные упражнения — не больше 15 минут в день, 5 дней в неделю. Остальное время — офлайн: кружки, игры, занятия с родителями.',
    parents: parentRoles(profile, selection),
    offline: comps.map(c => ({ comp: c.id, text: c.offline })),
    milestones: comps.map(c => ({ comp: c.id, text: c.result })),
    project: finalProject(has),
    schoolAge: school,
  };
}

function weeklyFormat(comp, profile) {
  const f = detectDomains(profile.father), m = detectDomains(profile.mother);
  const who = d => PARENT_ROLES[d] && PARENT_ROLES[d].comps.includes(comp);
  const parts = [];
  if (f.some(who)) parts.push('с папой');
  if (m.some(who)) parts.push('с мамой');
  const offlineOnly = compById(comp).skills.every(s => SKILLS[s].kind === 'activity');
  if (!offlineOnly) parts.push('упражнения в «Тропе»');
  parts.push('кружок/секция');
  return parts.join(' · ');
}

function monthEvents(mo, i, n, has, profile, school) {
  const ev = [];
  if (i === 0) {
    ev.push('Диагностика: пройти уровень «Старт» во всех упражнениях');
    ev.push('Записаться в кружки и секции (см. «Офлайн»)');
  }
  if (mo.m === 11 && has('music')) ev.push('Новогодний домашний концерт: ритм и песня для семьи');
  if (mo.m === 0 && has('sport')) ev.push('Зимние активности: коньки, лыжи, санки');
  if (mo.m === 1 && school) ev.push('Старт подготовки к школе в группе, 2 раза в неделю');
  if (mo.m === 3 && school) ev.push('С 1 апреля — заявление в 1 класс через Госуслуги');
  if (mo.m === 3 && has('music') && school) ev.push('Прослушивание в детскую музыкальную школу');
  if (mo.m === 4 && has('sport')) ev.push('Весенние детские соревнования или турнир секции');
  if (mo.m === 5 || mo.m === 6) {
    if (has('sport')) ev.push('Лето: плавание, велосипед, спортивный лагерь');
    if (has('nature')) ev.push('Летние опыты и наблюдения на природе');
  }
  if (mo.m === 6 && has('business')) ev.push('Пробная ярмарка или лимонадная лавка');
  if (i > 0 && i < n - 1 && (i % 3 === 0)) ev.push('Контрольная точка: пересмотреть траекторию по результатам');
  if (i === n - 1) {
    ev.push('Итоговая диагностика по всем навыкам');
    ev.push('Защита итогового проекта перед семьёй');
    if (school) ev.push('Режим дня школьника, сборы в 1 класс');
  }
  return ev;
}

function parentRoles(profile, selection) {
  const out = [];
  for (const [who, text] of [['Папа', profile.father], ['Мама', profile.mother]]) {
    if (!text || !text.trim()) continue;
    const domains = detectDomains(text);
    const roles = domains.map(d => PARENT_ROLES[d]).filter(r => r && r.comps.some(c => selection.comps.includes(c)));
    if (roles.length) {
      out.push({ who, about: text.trim(), domains: domains.map(d => PARENT_DOMAINS[d].name), text: roles.map(r => r.text).join(' Также ') });
    } else {
      out.push({ who, about: text.trim(), domains: [], text: 'читает вместе с ребёнком 15 минут в день, участвует в проектах и отмечает зачёты офлайн-заданий.' });
    }
  }
  return out;
}

function finalProject(has) {
  if (has('eng') && has('business')) {
    return {
      title: 'Ярмарка изобретений',
      text: 'Собрать и запрограммировать своего робота или изобретение' + ', придумать название и цену, подготовить рекламу и выступление' +
        (has('music') ? ', сочинить музыкальную заставку' : '') +
        ', провести мини-ярмарку для семьи и друзей и посчитать прибыль.',
    };
  }
  if (has('eng')) return { title: 'Мой робот', text: 'Собрать и запрограммировать робота, нарисовать схему и показать его работу семье.' };
  if (has('business')) return { title: 'Лимонадная лавка', text: 'Спланировать, подготовить и провести свою лавку, посчитать затраты, выручку и прибыль.' };
  if (has('music')) return { title: 'Мой концерт', text: 'Подготовить и провести домашний концерт: программа, билеты, выступление.' };
  return { title: 'Моя выставка', text: 'Собрать лучшие работы за год и рассказать о них семье.' };
}

// Прогресс: уровень доступен, если предыдущий сдан.
const progKey = (skill, level) => `${skill}:${level}`;

function skillLevelState(progress, skill, level) {
  const p = progress[progKey(skill, level)];
  if (p && p.passed) return 'passed';
  if (level === 1) return 'open';
  const prev = progress[progKey(skill, level - 1)];
  return prev && prev.passed ? 'open' : 'locked';
}

function currentLevel(progress, skill) {
  for (let l = 1; l <= 3; l++) if (skillLevelState(progress, skill, l) !== 'passed') return l;
  return 0;
}

// Следующие упражнения: сначала самые низкие уровни, компетенции чередуются.
function nextExercises(selection, progress, limit = 4) {
  const items = selection.skills
    .filter(s => selection.comps.includes(SKILLS[s].comp))
    .map(s => ({ skill: s, level: currentLevel(progress, s) }))
    .filter(x => x.level);
  items.sort((a, b) => a.level - b.level || (SKILLS[a.skill].kind === 'activity') - (SKILLS[b.skill].kind === 'activity'));
  const out = [], usedComp = new Set();
  for (const x of items) {
    if (out.length >= limit) break;
    if (usedComp.has(SKILLS[x.skill].comp)) continue;
    usedComp.add(SKILLS[x.skill].comp);
    out.push(x);
  }
  for (const x of items) if (out.length < limit && !out.includes(x)) out.push(x);
  return out;
}

function progressStats(selection, progress) {
  const skills = selection.skills.filter(s => selection.comps.includes(SKILLS[s].comp));
  const total = skills.length * 3;
  const passed = skills.reduce((n, s) => n + [1, 2, 3].filter(l => progress[progKey(s, l)]?.passed).length, 0);
  const stars = skills.reduce((n, s) => n + [1, 2, 3].reduce((k, l) => k + (progress[progKey(s, l)]?.stars || 0), 0), 0);
  return { total, passed, stars, pct: total ? Math.round(passed / total * 100) : 0 };
}

if (typeof module !== 'undefined') {
  module.exports = { detectDomains, scoreCompetencies, scoreProfessions, defaultSelection, buildPlan, nextExercises, progressStats, ageMonthsAt, formatAge };
}
