// Описание PDF-документа для pdfmake: образовательная программа и траектория.
// Чистая функция без DOM — её же использует скрипт генерации образца в Node.

const noEmoji = s => String(s ?? '').replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}️‍⃣]/gu, '').replace(/\s{2,}/g, ' ').trim();

function buildPdfDoc({ profile, selection, progress }, compScores, profScores, plan) {
  const C = { ink: '#1f2a37', muted: '#6b7280', accent: '#0f8a7e', line: '#d9dee5', soft: '#f3f6f8' };
  const scoreOf = Object.fromEntries(compScores.map(c => [c.id, c]));
  const name = profile.name?.trim() || 'Ребёнок';
  const ageNow = profile.ageYears * 12 + (profile.ageMonths || 0);
  const selComps = selection.comps.map(compById).sort((a, b) => scoreOf[b.id].score - scoreOf[a.id].score);
  const stats = progressStats(selection, progress);

  const h1 = t => ({ text: t, style: 'h1' });
  const h2 = t => ({ text: t, style: 'h2' });
  const p = (t, extra = {}) => ({ text: noEmoji(t), style: 'p', ...extra });
  const ul = items => ({ ul: items.map(noEmoji), style: 'p', margin: [0, 0, 0, 8] });
  const table = (widths, head, rows) => ({
    table: { headerRows: 1, widths, body: [head.map(t => ({ text: t, style: 'th' })), ...rows.map(r => r.map(c => typeof c === 'object' ? c : { text: noEmoji(c), style: 'td' }))] },
    layout: {
      hLineColor: () => C.line, vLineColor: () => C.line, hLineWidth: () => 0.6, vLineWidth: () => 0.6,
      fillColor: i => i === 0 ? C.soft : null, paddingTop: () => 4, paddingBottom: () => 4, paddingLeft: () => 5, paddingRight: () => 5,
    },
    margin: [0, 2, 0, 10],
  });
  const lvlState = (s, l) => {
    const st = skillLevelState(progress, s, l);
    const pr = progress[`${s}:${l}`];
    return st === 'passed' ? `зачёт ${'*'.repeat(pr.stars || 1)}` : st === 'open' ? 'доступно' : 'закрыто';
  };

  const abil = ABILITIES.filter(a => +profile.abilities?.[a.id]).map(a => `${a.name}: ${ABILITY_LEVELS[profile.abilities[a.id]]}`);
  const phaseMonths = ph => `${ph.months.length > 1 ? `${monthLabel(ph.months[0])} — ${monthLabel(ph.months.at(-1))}` : monthLabel(ph.months[0])}`;

  const content = [
    { text: 'ТРОПА · индивидуальная траектория развития', style: 'kicker' },
    { text: 'Образовательная программа и траектория обучения', style: 'title' },
    { text: `${name}, ${profile.sex === 'f' ? 'девочка' : 'мальчик'}, ${formatAge(ageNow)} · программа до ${formatDate(profile.endDate)} · ${profile.hours} ч в неделю`, style: 'sub' },
    { text: `Сформировано ${formatDate(new Date().toISOString())}. Прогресс: ${stats.passed} из ${stats.total} уровней (${stats.pct}%).`, style: 'meta' },

    h1('1. Главное'),
    ul([
      `Сильные стороны: ${selComps.slice(0, 4).map(c => `${c.name.toLowerCase()} (${scoreOf[c.id].score})`).join(', ')}.`,
      `Профессии-ориентиры: ${selectedProfessions(selection, profScores).map(p => p.name).join('; ') || 'не выбраны'}.`,
      plan.schoolAge ? `К ${formatDate(profile.endDate)} ребёнку будет ${formatAge(plan.schoolAge)}: программа завершается готовностью к 1 классу.` : `Программа рассчитана на ${plan.months.length} мес.`,
      `Итоговый проект — «${plan.project.title}»: ${plan.project.text}`,
      ...plan.parents.map(r => `${r.who} (${r.about}) ${r.text}`),
    ]),

    h1('2. Вводные'),
    table(['32%', '*'], ['Параметр', 'Значение'], [
      ['Возраст сейчас', formatAge(ageNow)],
      ['Срок программы', `${plan.months[0]?.label || ''} —${formatDate(profile.endDate)} (${plan.months.length} мес.)`],
      ['Способности', abil.join('; ') || 'не указаны'],
      ['Физическое развитие', +profile.physiqueAhead ? `крупнее сверстников примерно на ${profile.physiqueAhead} г.` : 'как у сверстников'],
      ['Отец', `${profile.father || '—'}${detectDomains(profile.father).length ? ` → ${detectDomains(profile.father).map(d => PARENT_DOMAINS[d].name).join(', ')}` : ''}`],
      ['Мать', `${profile.mother || '—'}${detectDomains(profile.mother).length ? ` → ${detectDomains(profile.mother).map(d => PARENT_DOMAINS[d].name).join(', ')}` : ''}`],
      ['Заметки', profile.notes || '—'],
    ]),

    h1('3. Компетенции'),
    p('Оценка 0–100 показывает, насколько компетенция подходит ребёнку с учётом способностей, физического развития, возраста и сфер родителей.'),
    table([150, 34, '*'], ['Компетенция', 'Оценка', 'Почему'], selComps.map(c => [
      { text: c.name, style: 'td', bold: true }, { text: String(scoreOf[c.id].score), style: 'td', alignment: 'center' }, scoreOf[c.id].reasons.join('; '),
    ])),
    p(`Не вошли в программу: ${COMPETENCIES.filter(c => !selection.comps.includes(c.id)).map(c => `${c.name.toLowerCase()} (${scoreOf[c.id].score})`).join(', ') || 'нет'}.`, { color: C.muted }),

    h1('4. Профессии-ориентиры'),
    table([170, 34, '*'], ['Профессия', 'Совпад.', 'Что делает'], profScores.filter(x => selection.profs.includes(x.id)).map(x => {
      const pr = PROFESSIONS.find(p => p.id === x.id);
      return [{ text: pr.name, style: 'td', bold: true }, { text: String(x.score), style: 'td', alignment: 'center' }, pr.about];
    })),

    h1('5. Траектория по этапам'),
    ...plan.phases.flatMap(ph => [
      h2(`Этап ${ph.n}. ${ph.title} · ${phaseMonths(ph)}`),
      p(ph.focus),
      ph.level ? p(`Уровень упражнений: ${ph.level} «${LEVEL_NAMES[ph.level]}». Навыки: ${ph.skills.map(s => SKILLS[s].name.toLowerCase()).join(', ')}.`, { color: C.muted }) : p(`Итоговый проект: «${plan.project.title}».`, { color: C.muted }),
    ]),
    h2('Календарь'),
    table([90, 34, '*'], ['Месяц', 'Этап', 'События и вехи'], plan.months.map(m => [m.label, { text: String(m.phase), style: 'td', alignment: 'center' }, m.events.join('; ') || 'регулярные занятия по плану этапа'])),

    h1('6. Навыки и упражнения'),
    p('Упражнения открываются по порядку: следующий уровень доступен после зачёта предыдущего.'),
    ...selComps.flatMap(c => {
      const skills = selection.skills.filter(s => SKILLS[s].comp === c.id);
      if (!skills.length) return [];
      return [h2(c.name), table(['*', 92, 92, 92], ['Навык и правило зачёта', '1 · Старт', '2 · Развитие', '3 · Мастер'], skills.map(s => [
        { stack: [{ text: SKILLS[s].name, bold: true, style: 'td' }, { text: (SKILLS[s].kind === 'activity' ? 'офлайн-задание; ' : 'интерактив; ') + passRule(s, 1), style: 'small' }] },
        ...[1, 2, 3].map(l => ({ text: lvlState(s, l), style: 'td', color: skillLevelState(progress, s, l) === 'passed' ? C.accent : C.ink })),
      ]))];
    }),

    h1('7. Недельная нагрузка'),
    p(plan.onlineNote),
    table([170, 50, '*'], ['Компетенция', 'Мин/нед', 'Формат'], plan.weekly.map(w => [compById(w.comp).name, { text: String(w.minutes), style: 'td', alignment: 'center' }, w.format])),

    h1('8. Роли родителей'),
    ...plan.parents.map(r => p(`${r.who} — ${r.about}${r.domains.length ? ` (${r.domains.join(', ')})` : ''}: ${r.text}`)),

    h1('9. Кружки и секции'),
    table([170, '*'], ['Компетенция', 'Рекомендация'], plan.offline.map(o => [compById(o.comp).name, o.text])),

    h1('10. Результаты к концу программы'),
    table([170, '*'], ['Компетенция', 'Ожидаемый результат'], plan.milestones.map(m => [compById(m.comp).name, m.text])),

    h1('11. Итоговый проект'),
    p(`«${plan.project.title}». ${plan.project.text}`),
  ];

  return {
    pageSize: 'A4', pageMargins: [40, 44, 40, 48],
    info: { title: `Тропа — программа: ${name}`, author: 'Тропа' },
    defaultStyle: { font: 'Roboto', fontSize: 9.5, color: C.ink, lineHeight: 1.2 },
    footer: (page, pages) => ({ columns: [{ text: 'Тропа · образовательная программа', color: C.muted }, { text: `${page} / ${pages}`, alignment: 'right', color: C.muted }], margin: [40, 16, 40, 0], fontSize: 8 }),
    styles: {
      kicker: { fontSize: 8, color: C.accent, bold: true, characterSpacing: 1, margin: [0, 0, 0, 4] },
      title: { fontSize: 20, bold: true, margin: [0, 0, 0, 6] },
      sub: { fontSize: 11, margin: [0, 0, 0, 2] },
      meta: { fontSize: 8.5, color: C.muted, margin: [0, 0, 0, 12] },
      h1: { fontSize: 13, bold: true, color: C.accent, margin: [0, 12, 0, 6] },
      h2: { fontSize: 10.5, bold: true, margin: [0, 6, 0, 3] },
      p: { margin: [0, 0, 0, 5] },
      th: { bold: true, fontSize: 8.5, color: C.muted },
      td: { fontSize: 9 },
      small: { fontSize: 7.5, color: C.muted },
    },
    content,
  };
}
