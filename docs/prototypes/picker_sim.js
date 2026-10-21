// Compare the QA plan's pickNext (weighted score) with a refined, tiered picker.
// Minute-tick simulation of courts; deterministic match lengths.
const MIN = 60000;
const T0 = Date.parse('2026-10-18T08:00:00Z');

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

// Circle-method round robin -> matches with roundIndex
function circle(teams, div) {
  const t = [...teams]; if (t.length % 2) t.push(null);
  const n = t.length, out = [];
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = t[i], b = t[n - 1 - i];
      if (a && b) out.push({ id: `${div}-${a}-${b}`, teams: [a, b], roundIndex: r, div });
    }
    t.splice(1, 0, t.pop());
  }
  return out;
}

// ---- Picker A: QA plan, verbatim logic ----
function pickNextQA(queue, now, live, held, lastPlayedAt, settings) {
  const eligible = queue.filter((m) => !m.teams.some((t) => live.has(t)) && !m.teams.some((t) => held.has(t)));
  return eligible
    .map((m) => {
      const rest = Math.min(...m.teams.map((t) => now - (lastPlayedAt[t] ?? 0)));
      const restOk = rest >= settings.minRestMs;
      return { m, score: (restOk ? 1000 : 0) + rest / 60000 + (m.pinned ? 5000 : 0) - m.roundIndex * 10 };
    })
    .sort((a, b) => b.score - a.score)[0]?.m ?? null;
}

// ---- Picker B: refined, tiered (lexicographic) ----
// pinned > rested > placed by TD (by manualOrder) > lowest round > fewest played
// > division waiting longest > longest rest (capped) > generation order
function pickNextTiered(queue, now, live, held, lastPlayedAt, settings, ctx) {
  const eligible = queue.filter((m) => !m.teams.some((t) => live.has(t)) && !m.teams.some((t) => held.has(t)));
  const cap = settings.minRestMs * 3;
  const restOf = (m) => Math.min(...m.teams.map((t) => Math.min(cap, now - (lastPlayedAt[t] ?? ctx.eventStart))));
  const playedOf = (m) => Math.min(...m.teams.map((t) => ctx.played[t] || 0));
  const divWait = (m) => now - (ctx.divLastStart[m.div] ?? ctx.eventStart);
  const key = (m) => [
    m.pinned ? 0 : 1,
    restOf(m) >= settings.minRestMs ? 0 : 1,
    m.manualOrder != null ? m.manualOrder : Infinity,
    m.roundIndex,
    playedOf(m),
    -divWait(m),
    -restOf(m),
    m.genOrder,
  ];
  const cmp = (a, b) => { const ka = key(a), kb = key(b); for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1; return 0; };
  return eligible.sort(cmp)[0] ?? null;
}

function simulate({ matches, courts, picker, minRest = 10, heldUntil = {}, seed = 7 }) {
  const rand = rng(seed);
  const len = Object.fromEntries(matches.map((m) => [m.id, 12 + Math.floor(rand() * 9)])); // 12–20 min, same per match across pickers
  let queue = matches.map((m, i) => ({ ...m, genOrder: i }));
  const courtFreeAt = Array(courts).fill(0), courtMatch = Array(courts).fill(null);
  const lastPlayedAt = {}, played = {}, history = {}, divLastStart = {}, startOf = {};
  const settings = { minRestMs: minRest * MIN };
  let t = 0, idleWithEligible = 0, unrestedStarts = 0, maxSpread = 0;
  const allTeams = [...new Set(matches.flatMap((m) => m.teams))];
  while (queue.length || courtMatch.some(Boolean)) {
    const now = T0 + t * MIN;
    // finish matches
    for (let c = 0; c < courts; c++) if (courtMatch[c] && courtFreeAt[c] <= t) {
      for (const tm of courtMatch[c].teams) { lastPlayedAt[tm] = now; played[tm] = (played[tm] || 0) + 1; }
      courtMatch[c] = null;
    }
    const live = new Set(courtMatch.filter(Boolean).flatMap((m) => m.teams));
    const held = new Set(Object.entries(heldUntil).filter(([, until]) => t < until).map(([tm]) => tm));
    for (let c = 0; c < courts; c++) {
      if (courtMatch[c]) continue;
      const m = picker(queue, now, live, held, lastPlayedAt, settings, { eventStart: T0, played, divLastStart });
      if (!m) {
        const anyEligible = queue.some((q) => !q.teams.some((x) => live.has(x) || held.has(x)));
        if (anyEligible) idleWithEligible++;
        continue;
      }
      const rest = Math.min(...m.teams.map((x) => (lastPlayedAt[x] == null ? Infinity : (now - lastPlayedAt[x]) / MIN)));
      if (rest < minRest) unrestedStarts++;
      for (const x of m.teams) { (history[x] ||= []).push(t); live.add(x); }
      divLastStart[m.div] = now; startOf[m.id] = t;
      courtMatch[c] = m; courtFreeAt[c] = t + len[m.id];
      queue = queue.filter((q) => q.id !== m.id);
    }
    const counts = allTeams.map((x) => (history[x] || []).length);
    // spread only among teams not held
    const active = allTeams.filter((x) => !(heldUntil[x] > t)).map((x) => (history[x] || []).length);
    if (active.length) maxSpread = Math.max(maxSpread, Math.max(...active) - Math.min(...active));
    t++;
    if (t > 2000) throw new Error('stuck');
  }
  const gaps = allTeams.map((x) => { const h = history[x]; let g = 0; for (let i = 1; i < h.length; i++) g = Math.max(g, h[i] - h[i - 1]); return g; });
  const divEnd = {}; for (const m of matches) divEnd[m.div] = Math.max(divEnd[m.div] || 0, startOf[m.id] + len[m.id]);
  return { finishMin: t - 1, unrestedStarts, maxSpreadMatchesPlayed: maxSpread, longestGapBetweenStartsMin: Math.max(...gaps), divisionFinishMin: divEnd, startOf };
}

const fmt = (r) => { const { startOf, ...rest } = r; return JSON.stringify(rest); };
const six = ['A', 'B', 'C', 'D', 'E', 'F'];

console.log('S1  6 teams, 2 courts, rest 10');
for (const [name, p] of [['QA ', pickNextQA], ['New', pickNextTiered]]) console.log('  ', name, fmt(simulate({ matches: circle(six, 'D1'), courts: 2, picker: p })));

console.log('S2  same, team F arrives 45 min late');
for (const [name, p] of [['QA ', pickNextQA], ['New', pickNextTiered]]) console.log('  ', name, fmt(simulate({ matches: circle(six, 'D1'), courts: 2, picker: p, heldUntil: { F: 45 } })));

console.log('S3  two divisions share 3 courts: D1 6 teams, D2 5 teams (listed after D1)');
const two = [...circle(six, 'D1'), ...circle(['P', 'Q', 'R', 'S', 'T'], 'D2')];
for (const [name, p] of [['QA ', pickNextQA], ['New', pickNextTiered]]) console.log('  ', name, fmt(simulate({ matches: two, courts: 3, picker: p })));

console.log('S4  director moves a round-4 match (C v E, team leaving early) to the top');
for (const [name, p] of [['QA ', pickNextQA], ['New', pickNextTiered]]) {
  const ms = circle(six, 'D1');
  const target = ms.find((m) => m.roundIndex === 3 && m.teams.includes('C') && m.teams.includes('E')) || ms.find((m) => m.roundIndex === 3);
  const reordered = [target, ...ms.filter((m) => m !== target)].map((m) => (m === target ? { ...m, manualOrder: 1 } : m));
  const r = simulate({ matches: reordered, courts: 2, picker: p });
  console.log('  ', name, `moved match ${target.id} started at minute ${r.startOf[target.id]} of ${r.finishMin}`);
}
