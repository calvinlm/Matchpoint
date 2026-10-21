// Compare Matchpoint's current round-robin order with the circle method.
function current(teams) {
  const out = [];
  for (let i = 0; i < teams.length; i++)
    for (let j = i + 1; j < teams.length; j++) out.push([teams[i], teams[j]]);
  return out;
}

// Circle (Berger) method: every team plays once per round; odd count -> one bye per round.
function circle(teams) {
  const t = [...teams];
  if (t.length % 2) t.push(null);
  const n = t.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const round = [];
    for (let i = 0; i < n / 2; i++) {
      const a = t[i], b = t[n - 1 - i];
      if (a && b) round.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(round);
    t.splice(1, 0, t.pop()); // rotate all but first
  }
  return rounds;
}

// Queue metrics if matches are played in list order on `courts` courts.
// A match can't start while either team is still on court; we take the first eligible.
function metrics(order, teams, courts) {
  const queue = [...order], slots = [], firstPlay = {}, maxRun = {}, lastSlot = {}, run = {};
  let slot = 0;
  while (queue.length) {
    const busy = new Set(), picked = [];
    for (let k = 0; k < queue.length && picked.length < courts; k++) {
      const [a, b] = queue[k];
      if (!busy.has(a) && !busy.has(b)) { picked.push(k); busy.add(a); busy.add(b); }
    }
    for (const k of picked.reverse()) {
      const [a, b] = queue.splice(k, 1)[0];
      for (const x of [a, b]) {
        if (firstPlay[x] === undefined) firstPlay[x] = slot;
        run[x] = lastSlot[x] === slot - 1 ? (run[x] || 0) + 1 : 1;
        maxRun[x] = Math.max(maxRun[x] || 0, run[x]);
        lastSlot[x] = slot;
      }
    }
    slots.push(picked.length);
    slot++;
  }
  const idleCourtSlots = slots.reduce((s, used) => s + (courts - used), 0);
  return {
    slotsToFinish: slot,
    idleCourtSlots,
    longestBackToBack: Math.max(...teams.map((x) => maxRun[x])),
    latestFirstMatchSlot: Math.max(...teams.map((x) => firstPlay[x])),
  };
}

const teams = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];
const courts = 3;
const cur = current(teams);
console.log('CURRENT order (first 8):', cur.slice(0, 8).map((m) => m.join('v')).join(', '));
console.log('CURRENT metrics, 6 teams / 3 courts:', metrics(cur, teams, courts));
const rr = circle(teams);
rr.forEach((r, i) => console.log(`Circle round ${i + 1}:`, r.map((m) => m.join('v')).join(', ')));
console.log('CIRCLE metrics, 6 teams / 3 courts:', metrics(rr.flat(), teams, courts));

// Group split: sequential slicing (current) vs snake.
const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
console.log('Groups now (slice):', [seeds.slice(0, 4), seeds.slice(4)]);
const snake = [[], []];
seeds.forEach((s, i) => { const r = Math.floor(i / 2), p = i % 2; snake[r % 2 ? 1 - p : p].push(s); });
console.log('Groups snake:', snake);
// Uneven groups: 10 teams, groupSize 4, 3 groups
const ten = Array.from({ length: 10 }, (_, i) => i + 1);
console.log('10 teams, groupSize 4 x 3 now:', [0, 1, 2].map((g) => ten.slice(g * 4, g * 4 + 4).length));
