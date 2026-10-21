// Prototype: rotating-partner doubles scheduler.
// Each round: split active players into foursomes (one per court) + sit-outs.
// Cost: repeat partner (heavy) > repeat opponent (light); sit-outs spread evenly.
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function schedule(players, { courts, rounds, seed = 1, restarts = 400 }) {
  const rand = rng(seed);
  const partner = new Map(), opp = new Map(), sat = Object.fromEntries(players.map((p) => [p, 0]));
  const out = [];
  const perRound = Math.min(courts * 4, Math.floor(players.length / 4) * 4);
  for (let r = 0; r < rounds; r++) {
    // Sit-outs: players who have sat most go on court first (ties random).
    const order = [...players].sort((a, b) => sat[b] - sat[a] || rand() - 0.5);
    const active = order.slice(0, perRound), sitting = order.slice(perRound);
    sitting.forEach((p) => sat[p]++);
    let best = null, bestCost = Infinity;
    for (let t = 0; t < restarts; t++) {
      const sh = [...active].sort(() => rand() - 0.5), games = [];
      let cost = 0;
      for (let i = 0; i < sh.length; i += 4) {
        const [a, b, c, d] = sh.slice(i, i + 4);
        // pick the best of the 3 ways to split a foursome into two sides
        const splits = [[[a, b], [c, d]], [[a, c], [b, d]], [[a, d], [b, c]]].map(([s1, s2]) => {
          const pc = (partner.get(key(...s1)) || 0) + (partner.get(key(...s2)) || 0);
          let oc = 0; for (const x of s1) for (const y of s2) oc += opp.get(key(x, y)) || 0;
          return { s1, s2, c: pc * 100 + oc };
        }).sort((x, y) => x.c - y.c);
        games.push(splits[0]); cost += splits[0].c;
      }
      if (cost < bestCost) { bestCost = cost; best = games; if (cost === 0) break; }
    }
    for (const g of best) {
      partner.set(key(...g.s1), (partner.get(key(...g.s1)) || 0) + 1);
      partner.set(key(...g.s2), (partner.get(key(...g.s2)) || 0) + 1);
      for (const x of g.s1) for (const y of g.s2) opp.set(key(x, y), (opp.get(key(x, y)) || 0) + 1);
    }
    out.push({ games: best.map((g) => `${g.s1.join('+')} v ${g.s2.join('+')}`), sitting });
  }
  // Report
  const pairsTotal = (players.length * (players.length - 1)) / 2;
  const partneredOnce = [...partner.values()].filter((v) => v >= 1).length;
  const repeatPartners = [...partner.values()].reduce((s, v) => s + Math.max(0, v - 1), 0);
  const sits = Object.values(sat);
  return { out, report: { distinctPartnerPairs: `${partneredOnce}/${pairsTotal}`, repeatPartners, maxOpposed: Math.max(...opp.values()), sitOuts: `${Math.min(...sits)}–${Math.max(...sits)}` } };
}

for (const [n, courts, rounds] of [[8, 2, 7], [9, 2, 9], [12, 3, 11], [10, 2, 8], [13, 3, 13]]) {
  const players = Array.from({ length: n }, (_, i) => `P${i + 1}`);
  const { out, report } = schedule(players, { courts, rounds });
  console.log(`${n} players, ${courts} courts, ${rounds} rounds →`, JSON.stringify(report));
  if (n === 8) out.slice(0, 3).forEach((r, i) => console.log(`   R${i + 1}: ${r.games.join(' | ')}${r.sitting.length ? '  sit: ' + r.sitting.join(',') : ''}`));
}
