// Claude · 2026-11-22, updated 2026-11-23 · Session 8e680ddd · flights portal trip page (fare-class cost rows, point values, steady layout, query filter)
const T = TRIP, R = T.rows;
const C = {id: 0, d: 1, to: 2, dep: 3, arr: 4, dur: 5, st: 6, via: 7, lays: 8, al: 9, fl: 10, cash: 11, fare: 12, dl: 13, sw: 14, swc: 15, aa: 16, ua: 17, swcb: 18, swcc: 19, notes: 20, dup: 21, uaSold: 22, legs: 23, org: 24, fares: 25};
const PROG = {dl: {cols: [C.dl], code: "DL", name: "Delta miles", bal: T.balances.dl}, sw: {cols: [C.sw, C.swc], code: "WN", name: "Southwest points", bal: T.balances.sw}, aa: {cols: [C.aa], code: "AA", name: "American miles", bal: T.balances.aa}, ua: {cols: [C.ua], code: "UA", name: "United miles", bal: T.balances.ua}};
const VAL = (T.values || {}).cents || {}, VSRC = (T.values || {}).source || "published averages";
const PNAME = Object.assign({dl: "Delta miles", sw: "Southwest points", aa: "American miles", ua: "United miles", as: "Alaska points"}, (T.values || {}).names || {});
const AL_PROG = {Southwest: "sw", Delta: "dl", American: "aa", United: "ua", Alaska: "as"};
const unitOf = p => p == "sw" || p == "as" ? "pts" : "mi";
const eqv = (p, pts, cash, tax) => VAL[p] ? pts * VAL[p] / 100 + (cash || 0) + (tax || 0) : null;
const SORTS = [["best", "Best value (cheapest way to pay)"], ["cash", "Cash price"], ["ptsv", "Points, by dollar value"], ["mc", "Points + cash"], ["new", "Cash after your credits"], ["dur", "Total time"], ["dep", "Departure"], ["arr", "Arrival"], ["lay", "Longest layover"]];
const DAYS = Object.keys(T.days), DESTS = Object.keys(T.destNames), ORGS = Object.keys(T.origins || {});
const MULTI = ORGS.length > 1;
const VIAS = [...new Set(R.flatMap(r => r[C.via]))];
const ALS = [...new Set(R.map(r => r[C.al]))];
const span = (vals, step) => { const a = vals.filter(v => v != null); return [Math.floor(Math.min(...a) / step) * step, Math.ceil(Math.max(...a) / step) * step]; };
const RG = {cash: span(R.map(r => r[C.cash]), 10), miles: span(R.flatMap(r => [r[C.dl], r[C.sw], r[C.swc], r[C.aa], r[C.ua]]), 500), dep: span(R.map(r => r[C.dep]), 15), arr: span(R.map(r => r[C.arr]), 15), lay: span(R.flatMap(r => r[C.lays]), 5), dur: span(R.map(r => r[C.dur]), 15)};
const DEF = () => ({from: T.fromDefault && T.fromDefault.length ? [...T.fromDefault] : [...ORGS], days: [...DAYS], to: [...T.destDefault], stops: "any", xconn: [], unl: true, lay: [RG.lay[0], RG.lay[1]], pay: "any", cash: RG.cash[1], miles: RG.miles[1], dep: [RG.dep[0], RG.dep[1]], arr: [RG.arr[0], RG.arr[1]], dur: Math.min(T.durDefault || 660, RG.dur[1]), xal: [], sort: "dur", liked: false, hid: false, similar: false, allFares: false, q: null});
let F = DEF();
const lowP = (r, p) => { for (const i of PROG[p].cols) if (r[i] != null) return r[i]; return null; };
function milesOf(r, pay) { if (PROG[pay]) { const v = lowP(r, pay); return v == null ? null : {v, p: pay}; } let b = null; for (const p in PROG) { const v = lowP(r, p); if (v != null && (!b || v < b.v)) b = {v, p}; } return b; }
const CASHCAP = (() => { const c = R.map(r => r[C.cash]).filter(v => v != null).sort((a, b) => a - b); return c.length ? c[Math.floor(c.length / 2)] * 2.5 : 1e9; })();  // ignore sold-out-style cash fares when judging point value
const cpm = r => { if (r[C.cash] == null || r[C.cash] > CASHCAP) return null; const m = milesOf(r, F.pay); return m ? r[C.cash] / m.v * 100 : null; };
const viaUnl = r => r[C.via].length < r[C.st];
const nextDay = r => r[C.arr] >= 1440;
const dayMark = r => { const n = Math.floor(r[C.arr] / 1440); return n > 0 ? "+" + n : n < 0 ? "\u2212" + (-n) : ""; };   // +1, +2, or -1 (westbound over the date line)
function credit(r) { const c = T.credits[r[C.al]]; if (!c || r[C.cash] == null || !c.sure) return null; const used = Math.min(c.sure, r[C.cash]); return {after: r[C.cash] - used, used, c}; }
const newMoney = r => { const c = credit(r); return c ? c.after : r[C.cash]; };
function passes(r, skip) {
  const id = r[C.id], liked = Store.has("like", id), hid = Store.has("hide", id), kept = KEEP.has(id);
  if (!kept && hid && !F.hid) return false; if (!kept && F.liked && !liked) return false;
  if ((r[C.dup] || worseFold(r)) && !F.similar && !liked && !kept) return false;
  if (F.q && F.q.ids && !F.q.ids.includes(id)) return false;
  if (skip != "from" && skip != "grid" && MULTI && !F.from.includes(r[C.org])) return false;
  if (skip != "day" && skip != "grid" && !F.days.includes(String(r[C.d]))) return false;
  if (skip != "to" && skip != "grid" && !F.to.includes(r[C.to])) return false;
  if (F.stops != "any" && r[C.st] > +F.stops) return false;
  if (F.pay == "cash" && r[C.cash] == null) return false; if (PROG[F.pay] && lowP(r, F.pay) == null) return false;
  if (F.cash < RG.cash[1] && (r[C.cash] == null || r[C.cash] > F.cash)) return false;
  if (F.miles < RG.miles[1]) { const m = milesOf(r, F.pay); if (!m || m.v > F.miles) return false; }
  if (r[C.dep] < F.dep[0] || r[C.dep] > F.dep[1] || r[C.arr] < F.arr[0] || r[C.arr] > F.arr[1]) return false;
  if (F.dur < RG.dur[1] && r[C.dur] > F.dur) return false;
  const layFull = F.lay[0] <= RG.lay[0] && F.lay[1] >= RG.lay[1];
  if (!layFull) { if (!r[C.lays].length) return false; if (r[C.lays].some(x => x < F.lay[0] || x > F.lay[1])) return false; }
  if (skip != "conn") { if (r[C.via].some(a => F.xconn.includes(a))) return false; if (viaUnl(r) && !F.unl) return false; }
  if (skip != "al" && F.xal.includes(r[C.al])) return false;
  return true;
}
const KEEP = new Set();
let WORSE = null;
function worseFold(r) {
  if (!WORSE) { WORSE = new Set(); const by = {}; for (const x of R) (by[x[C.d] + x[C.org] + x[C.to]] = by[x[C.d] + x[C.org] + x[C.to]] || []).push(x);
    for (const g of Object.values(by)) for (const x of g) { const bx = bestCost(x); if (bx == null) continue; for (const o of g) { if (o === x) continue; const bo = bestCost(o); if (bo == null || o[C.dur] > x[C.dur] || o[C.st] > x[C.st] || bo > bx) continue; if (x[C.cash] != null && (o[C.cash] == null || o[C.cash] > x[C.cash])) continue; if (o[C.dur] < x[C.dur] || bo < bx || o[C.st] < x[C.st]) { WORSE.add(x[C.id]); break; } } } }
  return WORSE.has(r[C.id]);
}
const sortKey = {best: r => bestCost(r) ?? 1e9, cash: r => r[C.cash] ?? 1e9, ptsv: r => ptsCost(r) ?? 1e9, mc: r => mcCost(r) ?? 1e9, new: r => newMoney(r) ?? 1e9, dur: r => r[C.dur], dep: r => r[C.d] * 1e4 + r[C.dep], arr: r => r[C.d] * 1e4 + r[C.arr], lay: r => -(r[C.lays].length ? Math.max(...r[C.lays]) : -1)};
// URL hash keeps the view so it can be reopened
function saveHash() { const d = DEF(), o = {}; for (const k in F) if (JSON.stringify(F[k]) != JSON.stringify(d[k])) o[k] = F[k]; const s = Object.keys(o).length ? "#v=" + encodeURIComponent(JSON.stringify(o)) : " "; history.replaceState(null, "", s == " " ? location.pathname : s); }
function loadHash() { const m = location.hash.match(/v=([^&]+)/); if (!m) return; try { Object.assign(F, JSON.parse(decodeURIComponent(m[1]))); } catch (e) {} if (!sortKey[F.sort]) F.sort = "dur"; }
// ---------- header blocks ----------
function renderTop() {
  const ago = (Date.now() - new Date(T.searched).getTime()) / 36e5;
  const agoTxt = ago < 1 ? "under an hour ago" : ago < 48 ? Math.round(ago) + " hours ago" : Math.round(ago / 24) + " days ago";
  $("scope").innerHTML = esc(T.scope) + " Searched " + esc(T.searchedLabel) + " (" + agoTxt + ")." + (ago > 24 ? ' <span class="pill warn">Prices may have moved</span> <button class="lnk" id="rerun"></button>' : "");
  const rb = $("rerun"); if (rb) { const it = "rerun:" + T.slug, p = Requests.pendingFor(it); rb.textContent = p ? "Re-run requested" : (Requests.has(it) ? "Re-run queued (undo)" : "Request a re-run"); rb.onclick = () => { if (!p) { Requests.toggle(it, "re-run " + T.short); renderTop(); } }; }
  const h = T.held;
  $("held").innerHTML = h ? '<div class="heldl">' + logoTile(h.airline, 1) + '<span>You hold <b>' + esc(h.flight) + "</b> from " + esc(h.fromName) + ", " + esc(T.daysShort[h.d] || "") + " " + tm(h.dep) + " → " + tm(h.arr) + " " + T.tzDest + ", " + money(h.price) + '. <span class="mu">Prices below compare to it.</span></span></div>' : "";
  $("pills").innerHTML = airlinePills(T.balances, T.credits, T.values, null, T.pillProgs);
  renderSeg();
}
function renderSeg() {
  const seg = (k, opts) => '<div class="seg" role="group">' + opts.map(([v, lab, on]) => '<button class="sg' + (on ? " on" : "") + '" data-seg="' + k + '" data-v="' + v + '" aria-pressed="' + on + '">' + lab + "</button>").join("") + "</div>";
  const fo = F.from.length == 1 ? F.from[0] : "*", dd = F.days.length == 1 ? F.days[0] : "*";
  $("seg").innerHTML = (MULTI ? '<div class="segw"><span class="segl">Leave from</span>' + seg("from", ORGS.map(o => [o, esc(T.origins[o]), fo == o]).concat([["*", "Any", fo == "*"]])) + "</div>" : "") +
    (DAYS.length > 1 ? '<div class="segw"><span class="segl">Day</span>' + seg("day", DAYS.map(d => [d, esc(T.daysShort[d]), dd == d]).concat([["*", "Both", dd == "*"]])) + "</div>" : "");
}
function pickCards(rows) {
  const picks = [], add = (label, r, val) => { if (!r) return; const p = picks.find(x => x.r === r); if (p) { p.labels.push(label); } else picks.push({labels: [label], r, val}); };
  const by = (f, cmp) => rows.filter(r => f(r) != null).sort((a, b) => cmp(f(a), f(b)) || a[C.dur] - b[C.dur] || a[C.dep] - b[C.dep])[0];
  const ch = by(r => r[C.cash], (a, b) => a - b); add("Cheapest cash", ch, () => money(ch[C.cash]) + (credit(ch) ? ' <span class="good">(' + money(credit(ch).after) + " after credits)</span>" : ""));
  const fm = by(r => (milesOf(r, F.pay) || {}).v, (a, b) => a - b); add("Fewest miles", fm, () => { const m = milesOf(fm, F.pay); return kfmt(m.v) + " " + PROG[m.p].code; });
  const fa = by(r => r[C.dur], (a, b) => a - b); add("Fastest", fa, () => du(fa[C.dur]));
  const bv = by(r => cpm(r), (a, b) => b - a); add("Best cents per mile", bv, () => cpm(bv).toFixed(1) + "¢");
  return picks;
}
function renderPicks(rows) {
  const by = (f, cmp) => rows.filter(r => f(r) != null).sort((a, b) => cmp(f(a), f(b)) || a[C.dur] - b[C.dur] || a[C.dep] - b[C.dep])[0];
  const asc = (a, b) => a - b;
  const slots = [
    ["Cheapest cash", by(r => r[C.cash], asc), r => money(r[C.cash]) + (credit(r) && credit(r).used ? ' <small class="good">' + money(credit(r).after) + " after credits</small>" : "")],
    ["Cheapest with points", by(r => ptsCost(r), asc), r => { const f = bestPtsFare(r); return kfmt(f[FA.pts]) + " <small>" + (AL_SHORT[f[FA.al]] || f[FA.al]) + ' <span class="eqc">~' + money(ptsCost(r)) + "</span></small>"; }],
    ["Fastest", by(r => r[C.dur], asc), r => du(r[C.dur])],
    ["Best value", by(r => bestCost(r), asc), r => bestWay(r).h]];
  $("picks").innerHTML = slots.map(([label, r, val]) => r ? '<button class="pick box" data-go="' + esc(r[C.id]) + '"><div class="mu">' + label + '</div><div class="pv">' + val(r) + '</div><div class="pr">' + logoTile(r[C.al], 1) + '<span>' + tm(r[C.dep]) + " " + T.tzOrigin + " · " + esc(T.daysShort[r[C.d]]) + "<br>" + stopsTxt(r) + " · " + du(r[C.dur]) + "</span></div></button>" : '<div class="pick box none"><div class="mu">' + label + '</div><div class="pv mu">none</div><div class="pr">No flight with this price matches.</div></div>').join("");
}
function joinLabels(a) { const l = a.map((x, i) => i ? x.toLowerCase() : x); return l.length < 2 ? l[0] : l.slice(0, -1).join(", ") + " and " + l[l.length - 1]; }
function pickVal(p) { const r = p.r, out = []; for (const l of p.labels) { if (l == "Cheapest cash") out.push(money(r[C.cash]) + (credit(r) ? ' <small class="good">' + money(credit(r).after) + " after credits</small>" : "")); if (l == "Fewest miles") { const m = milesOf(r, F.pay); out.push(kfmt(m.v) + " <small>" + PROG[m.p].code + "</small>"); } if (l == "Fastest") out.push(du(r[C.dur])); if (l == "Best cents per mile") out.push(cpm(r).toFixed(1) + "¢"); } return out.join(" · "); }
function stopsTxt(r) { return r[C.st] == 0 ? "Nonstop" : r[C.st] + (r[C.st] > 1 ? " stops " : " stop ") + (r[C.via].join(", ") || "") + (viaUnl(r) ? " +1" : ""); }
function renderGrid() {
  if (DAYS.length * DESTS.length * Math.max(1, ORGS.length) < 2) { $("gridbox").style.display = "none"; return; }
  const base = R.filter(r => passes(r, "grid")); let low = null;
  const RW = []; for (const d of DAYS) for (const o of (MULTI ? ORGS.filter(x => F.from.includes(x)) : [null])) RW.push({d, o});
  const cell = (w, to) => { const rs = base.filter(r => String(r[C.d]) == w.d && (!w.o || r[C.org] == w.o) && r[C.to] == to); const c = rs.filter(r => r[C.cash] != null).sort((a, b) => a[C.cash] - b[C.cash])[0]; const m = rs.map(r => milesOf(r, F.pay)).filter(Boolean).sort((a, b) => a.v - b.v)[0]; const f = rs.slice().sort((a, b) => a[C.dur] - b[C.dur])[0]; if (c && (low == null || c[C.cash] < low)) low = c[C.cash]; return {n: rs.length, c: c && c[C.cash], m, f: f && f[C.dur]}; };
  const cells = {}; for (const w of RW) for (const to of DESTS) cells[w.d + (w.o || "") + to] = cell(w, to);
  const box = (w, to) => { const x = cells[w.d + (w.o || "") + to], sel = F.days.includes(w.d) && F.to.includes(to) && (!w.o || F.from.includes(w.o)); return '<button class="gc' + (sel ? " sel" : "") + (x.c != null && x.c == low ? " lowc" : "") + (x.c != null && low != null && x.c > low * 1.5 ? " dimc" : "") + '" data-gd="' + w.d + '" data-gt="' + to + '" data-go2="' + (w.o || "") + '">' + (x.n ? "<b>" + (x.c != null ? money(x.c) : "no cash") + "</b><span>" + (x.m ? kfmt(x.m.v) + " " + PROG[x.m.p].code : "no award") + "</span><span>" + du(x.f) + "</span><small>" + x.n + " flights</small>" : "<small>none</small>") + "</button>"; };
  if (!wide.matches) { $("grid").innerHTML = '<div class="gm"><div class="gr gtop">' + DESTS.map(to => '<button class="gh" data-gto="' + to + '">' + esc(T.destNames[to]) + "</button>").join("") + "</div>" + RW.map(w => '<button class="gh gl" data-gday="' + w.d + '" data-gorg="' + (w.o || "") + '">' + esc(T.days[w.d]) + (w.o ? " <small>from " + esc(T.origins[w.o]) + "</small>" : "") + '</button><div class="gr">' + DESTS.map(to => box(w, to)).join("") + "</div>").join("") + "</div>"; return; }
  let h = '<table class="grid"><thead><tr><th></th>' + DESTS.map(to => '<th><button class="gh" data-gto="' + to + '">' + esc(T.destNames[to]) + "</button></th>").join("") + "</tr></thead><tbody>";
  for (const w of RW) { h += '<tr><th><button class="gh" data-gday="' + w.d + '" data-gorg="' + (w.o || "") + '">' + esc(T.days[w.d]) + (w.o ? "<br><small>from " + esc(T.origins[w.o]) + "</small>" : "") + "</button></th>"; for (const to of DESTS) { const x = cells[w.d + (w.o || "") + to], sel = F.days.includes(w.d) && F.to.includes(to) && (!w.o || F.from.includes(w.o)); h += '<td><button class="gc' + (sel ? " sel" : "") + (x.c != null && x.c == low ? " lowc" : "") + (x.c != null && low != null && x.c > low * 1.5 ? " dimc" : "") + '" data-gd="' + w.d + '" data-gt="' + to + '" data-go2="' + (w.o || "") + '">' + (x.n ? "<b>" + (x.c != null ? money(x.c) : "no cash") + "</b><span>" + (x.m ? kfmt(x.m.v) + " " + PROG[x.m.p].code : "no award") + "</span><span>" + du(x.f) + "</span><small>" + x.n + " flights</small>" : "<small>none</small>") + "</button></td>"; } h += "</tr>"; }
  $("grid").innerHTML = h + "</tbody></table>";
}
// ---------- chips and sheets ----------
const ALLD = () => F.days.length == DAYS.length, ALLT = () => F.to.length == DESTS.length;
function chipDefs() {
  const d = DEF(), lay = !(F.lay[0] <= RG.lay[0] && F.lay[1] >= RG.lay[1]);
  const nConn = VIAS.length - F.xconn.length, onlyOne = F.xconn.length == VIAS.length - 1 ? VIAS.find(a => !F.xconn.includes(a)) : null;
  const timesOn = F.dep[0] > RG.dep[0] || F.dep[1] < RG.dep[1] || F.arr[0] > RG.arr[0] || F.arr[1] < RG.arr[1];
  const ALLF = !MULTI || F.from.length == ORGS.length;
  return [
    ["to", "To", ALLT() ? null : F.to.map(x => T.destNames[x]).join(", ") || "none"],
    ["stops", "Stops", F.stops == "any" ? null : F.stops + " or fewer"],
    ["conn", "Connections", (F.xconn.length || !F.unl ? (onlyOne ? (T.city[onlyOne] || onlyOne) + " only" : nConn + " of " + VIAS.length + (F.unl ? "" : ", second stop listed")) : "") + (lay ? (F.xconn.length || !F.unl ? ", " : "") + "layover " + du(F.lay[0]) + " to " + du(F.lay[1]) : "") || null],
    ["pay", "Pay with", F.pay == "any" ? null : F.pay == "cash" ? "Cash" : PROG[F.pay].name],
    ["price", "Price", [F.cash < RG.cash[1] ? "up to " + money(F.cash) : "", F.miles < RG.miles[1] ? "up to " + kfmt(F.miles) : ""].filter(Boolean).join(", ") || null],
    ["times", "Times", timesOn ? [F.dep[0] > RG.dep[0] || F.dep[1] < RG.dep[1] ? "leave " + tm(F.dep[0]) + " to " + tm(F.dep[1]) : "", F.arr[0] > RG.arr[0] || F.arr[1] < RG.arr[1] ? (F.arr[0] > RG.arr[0] ? "land " + tm(F.arr[0]) + " to " : "land by ") + tm(F.arr[1]) + (F.arr[1] >= 1440 ? " next day" : "") : ""].filter(Boolean).join(", ") : null],
    ["dur", "Duration", F.dur < RG.dur[1] ? "up to " + du(F.dur) : null],
    ["al", "Airlines", F.xal.length ? (ALS.length - F.xal.length) + " of " + ALS.length : null],
    ["sort", "Sort", SORTS.find(s => s[0] == F.sort)[1]],
    ...(F.q ? [["q", "Asked", F.q.label || "your question"]] : [])
  ];
}
function renderChips() {
  const nL = Object.keys(Store.v.like).length, nH = Object.keys(Store.v.hide).length, any = JSON.stringify(F) != JSON.stringify(DEF());
  $("chips").innerHTML = chipDefs().map(([k, name, val]) => '<button class="chip' + (val && k != "sort" ? " on" : "") + '" data-chip="' + k + '" title="' + esc(val ? name + ": " + val : name) + '"><span class="cl">' + esc(val ? (k == "sort" ? "Sort: " + val : name + ": " + val) : name) + "</span>" + (val && k != "sort" ? '<span class="x" data-clear="' + k + '" aria-label="Clear ' + name + '">' + ICON.x + "</span>" : "") + "</button>").join("") +
    '<button class="chip' + (F.allFares ? " on" : "") + '" data-chip="allf" aria-pressed="' + F.allFares + '">All fares</button><button class="chip' + (F.liked ? " on" : "") + '" data-chip="liked"' + (nL || F.liked ? "" : ' disabled title="Tap the star on a flight to like it"') + '>★ Liked (' + nL + ')</button><button class="chip' + (F.hid ? " on" : "") + '" data-chip="hid">Hidden (' + nH + ")</button>" + (any ? '<button class="chip reset" data-chip="reset">Reset all</button>' : "");
}
function clearChip(k) { const d = DEF(), all = {days: [...DAYS], to: [...DESTS]}; if (k == "from") F.from = [...ORGS]; if (k == "day") F.days = all.days; if (k == "to") F.to = all.to; if (k == "stops") F.stops = "any"; if (k == "conn") { F.xconn = []; F.unl = true; F.lay = [RG.lay[0], RG.lay[1]]; } if (k == "pay") F.pay = "any"; if (k == "price") { F.cash = RG.cash[1]; F.miles = RG.miles[1]; } if (k == "times") { F.dep = [RG.dep[0], RG.dep[1]]; F.arr = [RG.arr[0], RG.arr[1]]; } if (k == "dur") F.dur = RG.dur[1]; if (k == "al") F.xal = []; if (k == "q") F.q = null; }
let curSheet = null, ranges = {};
function openSheet(k, anchor) {
  curSheet = k; ranges = {}; const t = {from: "Leave from", day: "Day", to: "Arrive at", stops: "Stops", conn: "Connect through", pay: "Pay with", price: "Price", times: "Times", dur: "Duration", al: "Airlines", sort: "Sort"}[k];
  $("shTitle").textContent = t; $("shTools").innerHTML = ["from", "day", "to", "conn", "al"].includes(k) ? '<button class="lnk" data-all="' + k + '">Select all</button><button class="lnk" data-none="' + k + '">Clear</button>' : "";
  const b = $("shBody"); b.innerHTML = "";
  if (k == "conn") {
    b.innerHTML = '<div class="rule">A flight shows when all its connections are ticked.</div>' + (VIAS.length > 15 ? '<input class="search" id="connQ" placeholder="Find an airport" autocomplete="off">' : "") + '<div id="shList"></div><div id="layR"></div><div class="quick"><button class="btn sm" data-lq="60,max">1h or more</button><button class="btn sm" data-lq="min,120">Under 2h</button><button class="btn sm" data-lq="min,max">Any</button></div><div class="rule" id="layNote"></div>';
    ranges.lay = makeRange($("layR"), {label: "Each layover", min: RG.lay[0], max: RG.lay[1], step: 5, dual: true, fmt: du, any: "Any length", value: F.lay}, () => { const v = ranges.lay.get(); F.lay = [v.lo, v.hi]; changed(); });
    const q = $("connQ"); if (q) q.oninput = () => fillList();
  } else if (k == "price") {
    b.innerHTML = '<div id="pC"></div><div id="pM"></div><div class="rule">All the way right means any price. A set limit hides flights with no price of that kind. Miles use the program in Pay with, or the cheapest award on the flight.</div>';
    if (F.pay != "cash" && !PROG[F.pay] || F.pay == "cash") ranges.cash = makeRange($("pC"), {label: "Cash", min: RG.cash[0], max: RG.cash[1], step: 10, fmt: v => money(v), any: "Any price", value: [null, F.cash]}, () => { F.cash = ranges.cash.get().hi; changed(); });
    if (F.pay != "cash") ranges.miles = makeRange($("pM"), {label: PROG[F.pay] ? PROG[F.pay].name : "Miles or points", min: RG.miles[0], max: RG.miles[1], step: 500, fmt: kfmt, any: "Any amount", value: [null, F.miles]}, () => { F.miles = ranges.miles.get().hi; changed(); });
  } else if (k == "times") {
    b.innerHTML = '<div id="tD"></div><div class="quick" data-tq="dep"></div><div id="tA"></div><div class="quick" data-tq="arr"></div>';
    ranges.dep = makeRange($("tD"), {label: "Leave " + (MULTI ? "the Bay Area" : T.originName) + " (" + T.tzOrigin + ")", min: RG.dep[0], max: RG.dep[1], step: 15, dual: true, fmt: tm, any: "Any time", value: F.dep}, () => { const v = ranges.dep.get(); F.dep = [v.lo, v.hi]; changed(); });
    ranges.arr = makeRange($("tA"), {label: "Land in " + T.destRegion + " (" + T.tzDest + ")", min: RG.arr[0], max: RG.arr[1], step: 15, dual: true, fmt: m => tm(m) + (m >= 2880 ? " (+" + Math.floor(m / 1440) + " days)" : m >= 1440 ? " next day" : ""), any: "Any time", value: F.arr}, () => { const v = ranges.arr.get(); F.arr = [v.lo, v.hi]; changed(); });
    const q = (w, lab, lo, hi) => '<button class="btn sm" data-tw="' + w + '" data-lo="' + lo + '" data-hi="' + hi + '">' + lab + "</button>";
    b.querySelector('[data-tq="dep"]').innerHTML = q("dep", "Morning", RG.dep[0], 720) + q("dep", "Midday", 600, 900) + q("dep", "Any", RG.dep[0], RG.dep[1]);
    b.querySelector('[data-tq="arr"]').innerHTML = q("arr", "By 6pm", RG.arr[0], 1080) + q("arr", "By 9pm", RG.arr[0], 1260) + q("arr", "By midnight", RG.arr[0], 1440) + q("arr", "Any", RG.arr[0], RG.arr[1]);
  } else if (k == "dur") {
    b.innerHTML = '<div id="dR"></div>'; ranges.dur = makeRange($("dR"), {label: "Total trip time", min: RG.dur[0], max: RG.dur[1], step: 15, fmt: du, any: "Any length", value: [null, F.dur]}, () => { F.dur = ranges.dur.get().hi; changed(); });
  } else b.innerHTML = '<div id="shList"></div>';
  fillList(); Sheet.show("sheet", anchor);
}
function optRow(type, val, on, name, small, ct, only, dim) { return '<label class="opt' + (dim ? " dim" : "") + '"><input type="' + type + '" ' + (type == "radio" ? 'name="r' + curSheet + '" ' : "") + 'data-opt="' + esc(val) + '"' + (on ? " checked" : "") + '><span class="nm">' + name + (small ? "<small>" + small + "</small>" : "") + '</span><span class="ct">' + (ct || "") + "</span>" + (only ? '<button class="only" data-only="' + esc(val) + '">only</button>' : "") + "</label>"; }
function facet(skip, keyf) { const m = {}; for (const r of R) { if (!passes(r, skip)) continue; for (const k of [].concat(keyf(r))) { const x = m[k] || (m[k] = {n: 0, c: null, mi: null}); x.n++; if (r[C.cash] != null && (x.c == null || r[C.cash] < x.c)) x.c = r[C.cash]; const mm = milesOf(r, F.pay); if (mm && (x.mi == null || mm.v < x.mi)) x.mi = mm.v; } } return m; }
const ctTxt = x => x ? x.n + " · from " + (PROG[F.pay] ? kfmt(x.mi) : x.c != null ? money(x.c) : kfmt(x.mi)) : "0";
function fillList() {
  const L = $("shList"), k = curSheet; if (!k || k == "links" || k == "filters") return;
  let h = "";
  if (k == "from") { const m = facet("from", r => r[C.org]); h = ORGS.map(o => optRow("checkbox", o, F.from.includes(o), esc(T.origins[o]), o, ctTxt(m[o]), true)).join(""); }
  if (k == "day") { const m = facet("day", r => String(r[C.d])); h = DAYS.map(d => optRow("checkbox", d, F.days.includes(d), esc(T.days[d]), "", ctTxt(m[d]), true)).join(""); }
  if (k == "to") { const m = facet("to", r => r[C.to]); h = DESTS.map(t => optRow("checkbox", t, F.to.includes(t), esc(T.destNames[t]), t, ctTxt(m[t]), true)).join(""); }
  if (k == "stops") { h = [["any", "Any number of stops"], ["1", "1 stop or fewer"], ["2", "2 stops or fewer"]].map(([v, n]) => optRow("radio", v, F.stops == v, n, "", "")).join("") + (R.some(r => r[C.st] == 0) ? "" : '<div class="rule">Nonstop: none on this route.</div>'); }
  if (k == "pay") { h = [["any", "Anything", ""], ["cash", "Cash", ""]].concat(Object.keys(PROG).map(p => [p, PROG[p].name, "you have " + (PROG[p].bal || 0).toLocaleString()])).map(([v, n, s]) => optRow("radio", v, F.pay == v, n, s, "")).join(""); }
  if (k == "sort") { h = SORTS.map(([v, n]) => optRow("radio", v, F.sort == v, n, "", "")).join(""); }
  if (k == "al") { const m = facet("al", r => r[C.al]); h = ALS.slice().sort((a, b) => (m[b] ? m[b].n : 0) - (m[a] ? m[a].n : 0)).map(a => optRow("checkbox", a, !F.xal.includes(a), logoTile(a, 1).replace('class="tile', 'style="display:inline-block;vertical-align:middle;margin-right:8px" class="tile') + esc(a), "", ctTxt(m[a]), true, !m[a])).join(""); }
  if (k == "conn") {
    const m = facet("conn", r => r[C.via]), q = ($("connQ") || {}).value || "", ql = q.toLowerCase();
    const list = VIAS.filter(a => !ql || a.toLowerCase().includes(ql) || (T.city[a] || "").toLowerCase().includes(ql)).sort((a, b) => (m[b] ? m[b].n : 0) - (m[a] ? m[a].n : 0) || a.localeCompare(b));
    const live = list.filter(a => m[a]), dead = list.filter(a => !m[a]);
    const row = a => optRow("checkbox", a, !F.xconn.includes(a), esc(T.city[a] || a) + " <small>" + a + "</small>" + (T.wx[a] ? '<span class="wx">' + esc(T.wx[a]) + "</span>" : ""), "", ctTxt(m[a]), true, !m[a]);
    let unl = 0; for (const r of R) if (passes(r, "conn") && viaUnl(r)) unl++;
    h = live.map(row).join("") + (dead.length ? '<details class="fold"' + (foldOpen ? " open" : "") + '><summary class="lnk">' + dead.length + " more with no flights right now</summary>" + dead.map(row).join("") + "</details>" : "") +
      optRow("checkbox", "__unl", F.unl, "Second stop not listed", "", unl + " flights") + '<div class="rule">Two-stop flights where the airline showed only the first connection.</div>' +
      (!F.xconn.length || VIAS.some(a => !F.xconn.includes(a)) ? "" : '<div class="rule" style="color:var(--bad)">No connections ticked. Tick at least one airport.</div>');
    const ln = $("layNote"); if (ln) { const n = R.filter(r => !r[C.lays].length).length; ln.textContent = (F.lay[0] > RG.lay[0] || F.lay[1] < RG.lay[1]) && n ? n + " flights with no layover length listed are hidden while this is set." : ""; }
  }
  if (L) L.innerHTML = h;
  $("shGo").textContent = "Show " + R.filter(r => passes(r)).length + " flights";
}
let foldOpen = false;
document.addEventListener("toggle", e => { if (e.target.classList && e.target.classList.contains("fold")) foldOpen = e.target.open; }, true);
function changed() { KEEP.clear(); saveHash(); render(); if (curSheet) fillList(); }
// ---------- booking links ----------
const AL_CODE = {Southwest: "WN", Delta: "DL", American: "AA", United: "UA", Alaska: "AS", Frontier: "F9", Spirit: "NK", JetBlue: "B6"};
const iso = d => T.dayDates[String(d)];
function pbv(n) { const o = []; while (true) { const b = n & 127; n >>>= 7; o.push(b | (n ? 128 : 0)); if (!n) return o; } }
const pkey = (f, w) => pbv(f << 3 | w), pvi = (f, n) => pkey(f, 0).concat(pbv(n));
const pld = (f, d) => { if (typeof d == "string") d = [...new TextEncoder().encode(d)]; return pkey(f, 2).concat(pbv(d.length), d); };
function tfs(date, from, to, legs) { let fd = pld(2, date); for (const l of legs || []) fd = fd.concat(pld(4, pld(1, l[0]).concat(pld(2, date), pld(3, l[1]), pld(5, l[2]), pld(6, String(l[3]))))); fd = fd.concat(pld(13, pvi(1, 1).concat(pld(2, from))), pld(14, pvi(1, 1).concat(pld(2, to)))); const info = pvi(1, 28).concat(pvi(2, 2), pld(3, fd), pvi(8, 1), pvi(9, 1), pvi(14, 1), pvi(19, 2)); return btoa(String.fromCharCode(...info)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function bookLinks(r) {
  const o = r[C.org] || ORGS[0], to = r[C.to], d = iso(r[C.d]), al = String(r[C.al]).split("/"), out = [];
  const legs = r[C.legs] && r[C.legs].length ? r[C.legs] : null;
  const gf = legs ? {label: "Google Flights: these exact flights", url: "https://www.google.com/travel/flights/booking?tfs=" + tfs(d, o, to, legs) + "&hl=en&gl=us&curr=USD"} : {label: "Google Flights: this route and day", url: "https://www.google.com/travel/flights/search?tfs=" + tfs(d, o, to) + "&hl=en&gl=us&curr=USD"};
  const sw = ft => "https://www.southwest.com/air/booking/select-depart.html?adultPassengersCount=1&departureDate=" + d + "&destinationAirportCode=" + (to == "PBI" ? "DJT" : to) + "&fareType=" + ft + "&originationAirportCode=" + o + "&passengerType=ADULT&returnDate=&tripType=oneway";
  const dl = aw => "https://www.delta.com/flight-search/search?action=findFlights&tripType=ONE_WAY&priceSchedule=" + (aw ? "AWARD" : "REVENUE") + "&originCity=" + o + "&destinationCity=" + to + "&departureDate=" + d + "&returnDate=&paxCount=1&searchByCabin=true&cabinFareClass=BE&deltaOnlySearch=false&awardTravel=" + aw;
  const ua = aw => "https://www.united.com/en/us/fsr/choose-flights?f=" + o + "&t=" + to + "&d=" + d + "&tt=1" + (aw ? "&at=1" : "") + "&sc=7&px=1&taxng=1&newHP=True&clm=7&st=bestmatches&tqp=" + (aw ? "A" : "R");
  const aa = aw => "https://www.aa.com/booking/search?locale=en_US&pax=1&adult=1&type=OneWay&searchType=" + (aw ? "Award" : "Revenue") + "&cabin=&carriers=ALL&slices=" + encodeURIComponent(JSON.stringify([{orig: o, origNearby: false, dest: to, destNearby: false, date: d}])) + (aw ? "&maxAwardSegmentAllowed=3" : "");
  if (al.includes("Southwest")) { out.push({label: "Southwest: cash", url: sw("USD"), p: "cash"}, {label: "Southwest: points", url: sw("POINTS"), p: "sw"}); }
  if (al.includes("Delta")) { out.push({label: "Delta: cash", url: dl(false), p: "cash"}, {label: "Delta: miles", url: dl(true), p: "dl"}); }
  if (al.includes("United")) { out.push({label: "United: cash", url: ua(false), p: "cash"}, {label: "United: miles", url: ua(true), p: "ua"}); }
  if (al.includes("American") || al.includes("Alaska")) { out.push({label: "American: cash", url: aa(false), p: "cash"}, {label: "American: miles", url: aa(true), p: "aa"}); }
  out.push(gf, {label: "Kayak: this route and day", url: "https://www.kayak.com/flights/" + o + "-" + to + "/" + d + "?sort=price_a"});
  return out;
}
function primaryBook(r) { const L = bookLinks(r); if (PROG[F.pay]) { const x = L.find(l => l.p == F.pay); if (x) return x; } if (r[C.legs] && r[C.legs].length) return L.find(l => l.label.startsWith("Google Flights")); return L.find(l => l.p == "cash") || L[0]; }
const bookBtn = r => { const b = primaryBook(r); return '<a class="btn sm book" href="' + esc(b.url) + '" target="_blank" rel="noopener" title="' + esc(b.label) + '">Book</a>'; };
// ---------- results ----------
const wide = window.matchMedia("(min-width: 700px)");
function layTxt(r) { const L = r[C.lays]; if (!L.length) return '<span class="mu">layover length not listed</span>'; return L.map(x => du(x) + (x < 45 ? '<span class="tag bad">tight</span>' : x < 60 ? '<span class="tag tight">short</span>' : x >= 180 ? '<span class="tag long">long</span>' : "")).join(", ") + (L.length < r[C.st] ? ' <span class="mu">2nd not listed</span>' : ""); }
// Cost: one row per fare class; across it each way to pay (cash, points, points + cash) in fixed columns so prices line up.
// Points carry a dollar value (purple) at NerdWallet's typical value; in each row the cheapest way to pay is green.
const FA = {al: 0, cls: 1, tier: 2, cash: 3, pts: 4, prog: 5, tax: 6, mc: 7, note: 8};
const AL_SHORT = {WN: "SW"}, AL_FULL = {WN: "Southwest", DL: "Delta", AA: "American", UA: "United", AS: "Alaska"};
const fareRows = r => (r[C.fares] || []).filter(f => f[FA.cash] != null || f[FA.pts] != null || (f[FA.mc] && f[FA.mc].length));
const ptsEq = f => f[FA.pts] != null ? eqv(f[FA.prog], f[FA.pts], 0, f[FA.tax]) : null;
const mcEq = f => f[FA.mc] && f[FA.mc].length ? eqv(f[FA.prog], f[FA.mc][0][0], f[FA.mc][0][1], 0) : null;
const minOf = a => { a = a.filter(v => v != null); return a.length ? Math.min(...a) : null; };
const fareCost = f => minOf([f[FA.cash], ptsEq(f), mcEq(f)]) ?? 1e9;
const bestCost = r => { const fs = fareRows(r); return fs.length ? minOf(fs.map(f => f[FA.cash]).concat(fs.map(ptsEq), fs.map(mcEq))) : r[C.cash]; };
const ptsCost = r => minOf(fareRows(r).map(ptsEq)), mcCost = r => minOf(fareRows(r).map(mcEq));
const bestPtsFare = r => fareRows(r).filter(f => ptsEq(f) != null).sort((a, b) => ptsEq(a) - ptsEq(b))[0];
const cheapestFare = fs => fs.slice().sort((a, b) => a[FA.tier] - b[FA.tier] || fareCost(a) - fareCost(b))[0];
const fareLab = f => (AL_SHORT[f[FA.al]] || f[FA.al]) + " " + (f[FA.cls] == "Lowest fare" ? "lowest" : f[FA.cls].replace(/ \(part [^)]*\)/, "+").replace("Economy (fully refundable)", "Econ. refundable").replace("Economy Plus (fully refundable)", "Econ. Plus refundable"));
function bestWay(r) {
  let b = null; const put = (v, h) => { if (v != null && (!b || v < b.v)) b = {v, h}; };
  for (const f of fareRows(r)) { put(f[FA.cash], money(f[FA.cash]) + " <small>cash · " + esc(fareLab(f)) + "</small>"); put(ptsEq(f), kfmt(f[FA.pts]) + " <small>" + esc(fareLab(f)) + ' <span class="eqc">~' + money(ptsEq(f)) + "</span></small>"); if (mcEq(f) != null) put(mcEq(f), kfmt(f[FA.mc][0][0]) + " + " + money(f[FA.mc][0][1]) + ' <small><span class="eqc">~' + money(mcEq(f)) + "</span></small>"); }
  return b || {v: r[C.cash], h: money(r[C.cash])};
}
let HASMC = null; const hasMc = () => HASMC ?? (HASMC = R.some(r => fareRows(r).some(f => mcEq(f) != null)));
function rateTip(p, pts, cash, tax) { const v = VAL[p]; if (!v) return ""; return PNAME[p] + " at a typical " + v + "¢ each (" + VSRC + "): " + pts.toLocaleString() + " × " + v + "¢ = " + money(pts * v / 100) + (cash ? ", plus " + money(cash) + " cash" : "") + (tax ? ", plus " + money(tax, true) + " tax" : "") + ". A typical value, not a cash-out rate."; }
const eqSpan = (p, pts, cash, tax) => { const e = eqv(p, pts, cash, tax); return e == null ? "" : ' <span class="eq" tabindex="0" data-tip="' + esc(rateTip(p, pts, cash, tax)) + '">(~' + money(e) + ")</span>"; };
// Is this a good use of points? This fare's cash price (or the flight's lowest) per point, against the typical value
function meter(f, r) {
  const p = f[FA.prog], v = VAL[p], pts = f[FA.pts]; if (!v || !pts) return "";
  const cash = f[FA.cash] != null ? f[FA.cash] : r[C.cash]; if (cash == null || cash > CASHCAP) return "";
  const c = (cash - (f[FA.tax] || 0)) / pts * 100, ratio = c / v, lvl = ratio >= 1.2 ? 3 : ratio < 0.8 ? 1 : 2, word = ["", "poor", "typical", "good"][lvl];
  const tip = "Points value on this fare: " + c.toFixed(2) + "¢ each (" + money(cash) + (f[FA.cash] != null ? " cash" : " lowest cash for this flight") + (f[FA.tax] ? " minus " + money(f[FA.tax], true) + " tax" : "") + ", divided by " + pts.toLocaleString() + "). Typical for " + PNAME[p] + ": " + v + "¢. " + (lvl == 3 ? "Good use of points." : lvl == 1 ? "Poor use of points: cash is the better deal." : "About typical.");
  return '<span class="vm l' + lvl + '" tabindex="0" data-tip="' + esc(tip) + '" aria-label="Points value ' + word + '"><i></i><i></i><i></i>' + (lvl != 2 ? "<em>" + word + "</em>" : "") + "</span>";
}
// ---------- the fare line: one component everywhere (list rows, phone cards, the panel): fare | cash | points (~$ value, meter) | points + cash | +N fares ----------
// The cheapest way to pay is green. Lines in one group are compared together: a flight's own line on its own; a flight on both days, its days,
// so the green lands on the cheaper day, and that day's label also gets a small "cheaper" tag.
const payCells = f => f ? [f[FA.cash], ptsEq(f), mcEq(f)] : [];
function markBest(lines, key) {
  const g = new Map(); lines.forEach((L, i) => { const k = key ? key(L) : i; if (!g.has(k)) g.set(k, []); g.get(k).push(L); });
  const own = L => { const v = payCells(L.f).filter(x => x != null); L.best = v.length > 1 ? Math.min(...v) : null; };
  for (const ls of g.values()) {
    const mins = ls.map(L => minOf(payCells(L.f))).filter(v => v != null);
    if (ls.length == 1 || (mins.length > 1 && Math.round(Math.max(...mins)) == Math.round(Math.min(...mins)))) { ls.forEach(own); continue; }  // same price on each day: each line reads like a single row
    const v = ls.flatMap(L => payCells(L.f)).filter(x => x != null), b = v.length > 1 ? Math.min(...v) : null; for (const L of ls) L.best = b;
  }
  return lines;
}
// the day (flight id) whose lines hold the lowest price, when the days differ
function cheaperDay(lines) {
  const by = new Map(); for (const L of lines) { const v = minOf(payCells(L.f)), k = L.r[C.id]; if (!by.has(k)) by.set(k, null); if (v != null && (by.get(k) == null || v < by.get(k))) by.set(k, v); }
  const ds = [...by].filter(([, v]) => v != null); if (new Set(ds.map(([, v]) => Math.round(v))).size < 2) return null;
  const lo = Math.round(Math.min(...ds.map(([, v]) => v))); return ds.find(([, v]) => Math.round(v) == lo)[0];
}
const cheaperTag = '<span class="tag good fch">cheaper</span>';
const dash = '<span class="dash">–</span>';
function fareTr(L, more, moreCol) {
  const f = L.f, r = L.r, day = L.day ? '<span class="fd">' + esc(L.day) + '</span><span class="fsep" aria-hidden="true">·</span>' : "", tag = L.cheaper ? cheaperTag : "";
  const lab = name => '<div class="fl">' + day + '<span class="fn">' + name + "</span>" + tag + "</div>";
  const g = v => v != null && L.best != null && Math.round(v) == Math.round(L.best) ? ' class="best"' : "", last = moreCol ? '<td class="mfc">' + more + "</td>" : "";
  if (!f) return '<tr class="t0"><th>' + lab('<span class="mu">' + (r[C.uaSold] ? "award sold out" : "no price") + "</span>") + "</th><td>" + dash + "</td><td>" + dash + "</td>" + (hasMc() ? "<td>" + dash + "</td>" : "") + last + "</tr>";
  const [al, cls, tier, cash, pts, p, tax, mc, note] = f, pe = ptsEq(f), me = mcEq(f);
  const bal = p ? T.balances[p] : null, need = bal != null && pts != null && pts > bal ? '<span class="need">need ' + kfmt(pts - bal) + " more</span>" : "";
  let h = '<tr class="t' + Math.min(3, tier) + '"><th title="' + esc((L.day ? L.day + ": " : "") + (AL_FULL[al] || al) + " " + cls + (note ? ". " + note : "") + (L.cheaper ? ". The cheaper day" : "")) + '">' + lab(esc(fareLab(f)) + (note ? '<span class="nt">*</span>' : "")) + "</th>";
  h += "<td" + g(cash) + ">" + (cash != null ? money(cash) : dash) + "</td>";
  h += "<td" + g(pe) + ">" + (pts != null ? '<span class="pn">' + kfmt(pts) + "</span>" + eqSpan(p, pts, 0, tax) + meter(f, r) + need : dash) + "</td>";
  if (hasMc()) h += "<td" + g(me) + ">" + (me != null ? '<span class="pn">' + kfmt(mc[0][0]) + " + " + money(mc[0][1]) + "</span>" + eqSpan(p, mc[0][0], mc[0][1], 0) : dash) + "</td>";
  return h + last + "</tr>";
}
// full = the panel's table: every fare, a header row, no "+N fares" column
function faresHTML(lines, more, full) {
  const mc = hasMc(), head = full ? '<thead><tr><th>Fare</th><td>Cash</td><td>Points</td>' + (mc ? "<td>Points + cash</td>" : "") + "</tr></thead>" : "";
  return '<table class="fares' + (mc ? " mc" : "") + (full ? " full" : "") + '"><colgroup><col class="fc1"><col class="fc2"><col class="fc3">' + (mc ? '<col class="fc4">' : "") + (full ? "" : '<col class="fc5">') + "</colgroup>" + head + "<tbody>" + lines.map((L, i) => fareTr(L, i == 0 ? more : "", !full)).join("") + "</tbody></table>";
}
const moreBtn = (id, total, shown) => { const n = total - shown; return n > 0 ? '<button class="lnk mf" data-fpfares="' + esc(id) + '" aria-label="See all ' + total + ' fares">+' + n + " fare" + (n > 1 ? "s" : "") + "</button>" : ""; };
const classKey = L => L.f ? L.f[FA.al] + "|" + L.f[FA.cls] : "none|" + L.r[C.id];
// fare classes for the fare line; a flight with only a lowest cash price (no classes listed) gets one "lowest" line
function lineFares(r) { const fs = fareRows(r); if (fs.length || r[C.cash] == null) return fs; const a = String(r[C.al]).split("/")[0], fc = /^([A-Z0-9]{2})\d/.exec(String(r[C.fl] || "").trim()); return [[fc ? fc[1] : AL_CODE[a] || a, "Lowest fare", 0, r[C.cash], null, null, null, [], ""]]; }  // the code of the first flight number (a codeshare's operating airline), else the airline's
// The list: each flight's cheapest fare (every fare with the All fares chip). A flight on both days (Day on Both) gets one line per day, labeled by day.
// "+N fares" ends the first line and opens the flight panel at its fares.
function rowFares(u) {
  const every = F.allFares;
  if (u.length == 1) { const r = u[0], fs = lineFares(r), show = fs.length ? (every ? fs : [cheapestFare(fs)]) : [null]; return faresHTML(markBest(show.map(f => ({f, r}))), moreBtn(r[C.id], fs.length, show.filter(Boolean).length), false); }
  const lines = []; let total = 0;
  for (const r of u) { const fs = lineFares(r); total += fs.length; const show = fs.length ? (every ? fs : [cheapestFare(fs)]) : [null]; for (const f of show) lines.push({f, r, day: dayShort(r)}); }
  markBest(lines, every ? classKey : () => 0);
  const ch = cheaperDay(lines); if (ch) lines.find(L => L.r[C.id] == ch).cheaper = true;
  return faresHTML(lines, moreBtn(u[0][C.id], total, lines.filter(L => L.f).length), false);
}
// The panel: every fare class; for a flight on both days, a table per day, each fare class compared across the days
function panelFares(u) {
  const per = u.map(r => lineFares(r).map(f => ({f, r}))), flat = per.flat();
  if (u.length == 1) return flat.length ? faresHTML(markBest(flat), "", true) : '<div class="mu">' + (u[0][C.uaSold] ? "United economy award sold out" : "no price") + "</div>";
  markBest(flat, classKey); const ch = cheaperDay(flat);
  return u.map((r, i) => '<div class="fp-day">' + esc(T.daysShort[r[C.d]]) + (ch == r[C.id] ? cheaperTag : "") + "</div>" + (per[i].length ? faresHTML(per[i], "", true) : '<div class="mu">no price</div>')).join("");
}
const RID = new Map(R.map(r => [r[C.id], r]));
const rowsOf = ids => ids.map(i => RID.get(i)).filter(Boolean);
const dayIdx = r => Math.round(Date.parse(T.dayDates[String(r[C.d])] + "T12:00:00") / 864e5);
const TZOFF = (() => { const a = R.map(r => r[C.arr] - r[C.dep] - r[C.dur]).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; })();  // arrival clock minus departure clock minus trip time = time zone gap
const place = c => T.destNames[c] || T.origins[c] || (T.city[c] && T.city[c] != c ? T.city[c] : c);
const legTime = s => String(s || "").replace(/\s+/g, "").toLowerCase();
const cheapestOf = u => u.slice().sort((a, b) => (bestCost(a) ?? 1e9) - (bestCost(b) ?? 1e9))[0];
const dayShort = r => String(T.daysShort[r[C.d]] || "").split(" ")[0];
function heldDiff(r) { const h = T.held; if (!h || r[C.cash] == null) return ""; const d = r[C.cash] - h.price, parts = [(d < 0 ? money(-d) + " less" : d > 0 ? money(d) + " more" : "same price") + " than your ticket"]; if (String(r[C.d]) == String(h.d)) { const a = r[C.arr] - h.arr; parts.push(a < 0 ? "lands " + du(-a) + " earlier" : a > 0 ? "lands " + du(a) + " later" : "lands at the same time"); } else parts.push("travels " + T.daysShort[r[C.d]] + " instead"); return parts.join(", "); }
function detailShort(r) { const cr = credit(r), out = []; if (cr && cr.used) out.push("Uses " + money(cr.used) + " credit"); const hd = heldDiff(r); if (hd) out.push(hd); if (r[C.notes]) out.push(esc(r[C.notes])); return out.join("; "); }
// ---------- twin rows: with Day on Both, a flight that runs on both days (same flight numbers, or same airline and times) is one row ----------
const twinOn = () => DAYS.length > 1 && F.days.length > 1;
function makeUnits(rows) {
  if (!twinOn()) return rows.map(r => [r]);
  const fk = r => { const s = String(r[C.fl] || "").replace(/\s+/g, ""); return s ? r[C.org] + "|" + r[C.to] + "|" + s : null; };
  const tk = r => r[C.org] + "|" + r[C.to] + "|" + r[C.al] + "|" + r[C.dep] + "|" + r[C.arr];
  const byF = {}, byT = {}, used = new Set(), out = [];
  for (const r of rows) { const a = fk(r); if (a) (byF[a] = byF[a] || []).push(r); (byT[tk(r)] = byT[tk(r)] || []).push(r); }
  for (const r of rows) {
    if (used.has(r)) continue; used.add(r); const u = [r], days = new Set([r[C.d]]);
    for (const pool of [byF[fk(r)] || [], byT[tk(r)]]) for (const o of pool) if (!used.has(o) && !days.has(o[C.d])) { u.push(o); used.add(o); days.add(o[C.d]); }
    out.push(u.sort((a, b) => dayIdx(a) - dayIdx(b)));
  }
  return out;
}
// ---------- list rows (desktop) and cards (phone): tap anywhere except star, hide and Book to open the flight panel ----------
const idsOf = u => u.map(r => r[C.id]).join(" ");
const marks = u => ({lk: u.some(r => Store.has("like", r[C.id])), hd: u.every(r => Store.has("hide", r[C.id]))});
const fpOn = u => FP.open && FP.ids[0] == u[0][C.id];
function flightLabel(u) { const r = u[0]; return r[C.al] + " " + tm(r[C.dep]) + " to " + tm(r[C.arr]) + ", " + u.map(x => T.daysShort[x[C.d]]).join(" and ") + ". Open details"; }
const open1 = '<span class="chev" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></span>';
let ONE = false;
const sortTh = (k, lab) => '<th><button class="sth' + (F.sort == k ? " on" : "") + '" data-sort="' + k + '">' + lab + (F.sort == k ? " ↓" : "") + "</button></th>";
function rowHTML(u) {
  const r = u[0], ids = idsOf(u), {lk, hd} = marks(u), tw = u.length > 1, ch = cheapestOf(u);
  return '<tr id="r-' + esc(r[C.id]) + '" data-ids="' + esc(ids) + '" data-open tabindex="0" aria-label="' + esc(flightLabel(u)) + '" class="fr' + (tw ? " twin" : "") + (lk ? " liked" : "") + (hd ? " hid" : "") + (fpOn(u) ? " fpon" : "") + '"><td>' + likeHide(ids, lk, hd) + "</td><td>" + logoTile(r[C.al]) +
    '</td><td class="t"><div class="mu">' + esc(tw ? u.map(dayShort).join(" + ") : T.daysShort[r[C.d]]) + (MULTI ? " · " + r[C.org] : "") + '</div><b class="big">' + tm(r[C.dep]) + '</b></td><td class="t"><div class="mu">' + esc(T.destNames[r[C.to]]) + '</div><b class="big">' + tm(r[C.arr]) + (nextDay(r) ? " +1" : "") + '</b></td><td class="t">' + du(r[C.dur]) +
    "</td><td>" + stopsTxt(r) + '<div class="mu">' + layTxt(r) + '</div><div class="mu">' + esc(r[C.al]) + (r[C.fl] ? " · " + esc(r[C.fl]) : "") + '</div></td><td class="cost">' + rowFares(u) + '</td><td class="t">' + bookBtn(ch) + (tw ? '<div class="mu bkd">' + esc(dayShort(ch)) + "</div>" : "") +
    '</td><td class="mu nt">' + detailShort(ch) + '</td><td class="chevc">' + open1 + "</td></tr>";
}
function cardHTML(u) {
  const r = u[0], ids = idsOf(u), {lk, hd} = marks(u), tw = u.length > 1, ch = cheapestOf(u);
  return '<div id="r-' + esc(r[C.id]) + '" data-ids="' + esc(ids) + '" data-open tabindex="0" aria-label="' + esc(flightLabel(u)) + '" class="card box' + (tw ? " twin" : "") + (lk ? " liked" : "") + (hd ? " hid" : "") + (fpOn(u) ? " fpon" : "") + '"><div class="c1">' + logoTile(r[C.al]) + '<div class="cm"><div class="ct1">' + tm(r[C.dep]) + " <small>" + T.tzOrigin + "</small> → " + tm(r[C.arr]) + dayMark(r) + " <small>" + T.tzDest + '</small></div><div class="ct2">' + du(r[C.dur]) + " · " + stopsTxt(r) + " · " + layTxt(r) + "</div>" +
    (ONE && !MULTI && !tw ? "" : '<div class="ct3">' + esc(tw ? u.map(dayShort).join(" + ") : T.daysShort[r[C.d]]) + " · " + (MULTI ? r[C.org] + " → " : "") + r[C.to] + "</div>") + "</div>" + open1 + "</div>" +
    '<div class="cc">' + rowFares(u) + "</div>" +
    '<div class="c2"><span class="mu">' + esc(r[C.al]) + (tw ? " · book " + esc(dayShort(ch)) : "") + '</span><span class="sp"></span>' + bookBtn(ch) + likeHide(ids, lk, hd) + "</div></div>";
}
// Keep what you are looking at in place when the list redraws (works in Safari too, which has no scroll anchoring)
function stickyH() { const cb = $("chipbar"), b = cb.getBoundingClientRect(); return getComputedStyle(cb).position == "sticky" && b.top <= 1 ? b.bottom : 0; }
function keepPlace(fn) {
  const list = $("list"), lt = list.getBoundingClientRect().top, sh = stickyH(); let a = null, at = 0;
  if (lt < sh) for (const el of list.querySelectorAll('[id^="r-"]')) { const b = el.getBoundingClientRect(); if (b.bottom > sh + 4) { a = el.id; at = b.top; break; } }
  fn();
  if (a) { const el = document.getElementById(a); if (el) { const d = el.getBoundingClientRect().top - at; if (Math.abs(d) > 1) window.scrollBy(0, d); return; } }
  if (lt < sh) { const nt = $("list").getBoundingClientRect().top; window.scrollBy(0, nt - stickyH() - 8); }
}
const unitEl = id => document.querySelector('#list [data-ids~="' + CSS.escape(id) + '"]');
function updateRow(id) { const el = unitEl(id); if (!el) return; const u = rowsOf(el.dataset.ids.split(" ")); if (!u.length) return; keepPlace(() => { el.outerHTML = wide.matches ? rowHTML(u) : cardHTML(u); }); }
function countTxt(rows, units) {
  const sim = F.similar; F.similar = true; const folded = R.filter(r => passes(r)).length - (sim ? R.filter(r => passes(r)).length : rows.length); F.similar = sim;
  const tw = units ? units.filter(u => u.length > 1).length : 0;
  $("count").innerHTML = "<b>" + rows.length + "</b> of " + R.length + " flights" + (tw ? ' · <span title="With Day on Both, a flight that runs on both days shares one row">' + tw + " run both days, one row each</span>" : "") + (F.similar ? ' · <button class="lnk" id="simT">fold similar flights</button>' : folded ? " · " + folded + ' similar, slower or pricier flights folded <button class="lnk" id="simT">show</button>' : "");
}
let UNITS = [];
function render() {
  const rows = R.filter(r => passes(r)), k = sortKey[F.sort]; rows.sort((a, b) => k(a) - k(b) || a[C.dur] - b[C.dur]);
  const units = UNITS = makeUnits(rows);
  keepPlace(() => {
    renderTop(); renderChips(); renderPicks(rows); renderGrid(); countTxt(rows, units); paintMini();
    ONE = F.days.length == 1 && F.to.length == 1;
    const L = $("list");
    if (!rows.length) { L.innerHTML = '<div class="box empty">No flights match. Clear a filter above, or <button class="lnk" data-chip="reset">reset all</button>.</div>'; return; }
    const cs = k => '<button class="sth sm' + (F.sort == k ? " on" : "") + '" data-sort="' + k + '">' + {best: "best", cash: "cash", ptsv: "points", mc: "pts + cash"}[k] + (F.sort == k ? " ↓" : "") + "</button>";
    L.innerHTML = wide.matches ? '<div class="box scrollx"><table class="res"><thead><tr><th></th><th></th>' + sortTh("dep", "Departs (" + T.tzOrigin + ")") + sortTh("arr", "Arrives (" + T.tzDest + ")") + sortTh("dur", "Total") + sortTh("lay", "Stops and layovers") + '<th class="costh">Cost <span class="mu">sort:</span> ' + ["best", "cash", "ptsv"].concat(hasMc() ? ["mc"] : []).map(cs).join("") + "</th><th>Book</th><th>Notes</th><th></th></tr></thead><tbody>" + units.map(rowHTML).join("") + "</tbody></table></div>" : units.map(cardHTML).join("");
  });
  paintFab();
}
function openFilters() {
  curSheet = "filters"; $("shTitle").textContent = "Filters"; $("shTools").innerHTML = ""; $("shBody").innerHTML = '<div class="chips">' + $("chips").innerHTML + "</div>"; $("shGo").textContent = "Show " + R.filter(r => passes(r)).length + " flights";
  Sheet.show("sheet", null);
}
// Phone: a one-line bar (Filters, Sort, Liked) appears once the wrapped chips scroll away
function paintMini() {
  const m = $("mini"); if (!m) return; const off = !wide.matches;
  if (off) { const n = chipDefs().filter(([k, , v]) => v && k != "sort").length; m.innerHTML = '<button class="chip" data-mini="filters">Filters' + (n ? " (" + n + ")" : "") + '</button><button class="chip" data-mini="sort">Sort: ' + esc(SORTS.find(x => x[0] == F.sort)[1].split(" (")[0]) + '</button><button class="chip' + (F.liked ? " on" : "") + '" data-mini="liked">★ ' + Object.keys(Store.v.like).length + "</button>"; }
  m.classList.toggle("open", off);
}
window.addEventListener("scroll", paintMini, {passive: true});
// ---------- the flight panel: one way into a flight (side panel on a wide screen, bottom sheet on a phone); it never moves the page ----------
const FP = {open: false, ids: [], back: null};
// The panel opens with the times, one summary line, the fares and Book. Everything else is a folded section whose closed line carries
// the key fact (warnings in red or amber). Sections opened during the visit stay open for the next flight (kept for this tab only).
const FPSEC = (() => { try { return new Set(JSON.parse(sessionStorage.getItem("prism-fp-open") || "[]")); } catch (e) { return new Set(); } })();
const keepSecs = () => { try { sessionStorage.setItem("prism-fp-open", JSON.stringify([...FPSEC])); } catch (e) {} };
const foldChev = '<svg class="fchev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
const fold = (key, title, sum, body) => body ? '<details class="fp-sec fp-fold" data-sec="' + key + '"' + (FPSEC.has(key) ? " open" : "") + '><summary><span class="fs-tx"><span class="fs-t">' + title + '</span><span class="fs-s">' + sum + "</span></span>" + foldChev + '</summary><div class="fs-b">' + body + "</div></details>"
  : '<div class="fp-sec fp-fold fp-flat" data-sec="' + key + '"><div class="fp-fl"><span class="fs-tx"><span class="fs-t">' + title + '</span><span class="fs-s">' + sum + "</span></span></div></div>";
document.addEventListener("toggle", e => { const d = e.target; if (!d.classList || !d.classList.contains("fp-fold")) return; if (d.open) FPSEC.add(d.dataset.sec); else FPSEC.delete(d.dataset.sec); keepSecs(); }, true);
const warnSpan = (lvl, t) => lvl >= 2 ? '<span class="' + (lvl == 3 ? "bad" : "warnt") + '">' + t + "</span>" : t;
// weather at a connection on the flight's own day(s): "storms Tue night, Wed day and night" on a Wed flight reads "storms Wed"
function wxOn(code, days) {
  const w = T.wx[code]; if (!w) return ""; const m = /^(\S+)\s+(.*)$/.exec(w); if (!m) return "";
  const WK = new Set(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  const on = [...new Set(m[2].split(/,\s*/).map(s => { const d = s.split(" ")[0]; return WK.has(d) ? (days.has(d) ? d : null) : s; }).filter(Boolean))];
  return on.length ? m[1] + " " + on.join(" and ") : "";
}
const wkday = (d, plus) => new Date(Date.parse(T.dayDates[String(d)] + "T12:00:00Z") + (plus || 0) * 864e5).toLocaleDateString("en-US", {weekday: "short", timeZone: "UTC"});
function legsSum(u) {
  const r = u[0]; if (!r[C.st]) return "Nonstop";
  const days = new Set(u.flatMap(x => nextDay(x) ? [wkday(x[C.d]), wkday(x[C.d], 1)] : [wkday(x[C.d])]));
  const via = r[C.via] || [], lays = r[C.lays] || [], ls = [];
  for (let i = 0; i < Math.max(via.length, lays.length); i++) {
    const code = via[i], m = lays[i], w = []; let lvl = 0;
    if (m != null) { if (m < 45) { w.push("tight"); lvl = 3; } else if (m < 60) { w.push("short"); lvl = 2; } else if (m >= 180) { w.push("long"); lvl = 1; } }
    const x = code ? wxOn(code, days) : ""; if (x) { w.push(x); lvl = Math.max(lvl, 2); }
    ls.push({code, m, w, lvl});
  }
  const warn = ls.filter(x => x.lvl >= 2), long = ls.filter(x => x.lvl == 1), show = warn.length ? warn : long.length ? long : ls;
  const out = [r[C.st] + (r[C.st] > 1 ? " stops" : " stop")].concat(show.filter(x => x.m != null || x.code).map(x => warnSpan(x.lvl, (x.m != null ? du(x.m) + (x.code ? " in " : "") : "") + (x.code ? esc(place(x.code)) : "") + (x.w.length ? " (" + esc(x.w.join("; ")) + ")" : ""))));
  if (!lays.length) out.push("layover length not listed"); if (viaUnl(r)) out.push("second stop not listed");
  return out.join(", ");
}
function legsHTML(r) {
  const L = r[C.legs] && r[C.legs].length ? r[C.legs] : null, lays = r[C.lays] || [];
  if (!L) return '<div class="legs-none">' + stopsTxt(r) + (r[C.st] ? " · " + layTxt(r) : "") + (r[C.fl] ? '<div class="mu">Flights ' + esc(r[C.fl]) + ". Times for each flight were not listed for this one.</div>" : "") + "</div>";
  let h = '<ol class="legs">';
  L.forEach((l, i) => {
    const [a, b, cc, num, dt, at] = l;
    h += '<li class="leg"><span class="lg-fl">' + esc(cc + " " + num) + '</span><div class="lg-pt"><b>' + esc(legTime(dt)) + "</b> " + esc(place(a)) + ' <span class="mu">' + esc(a) + '</span></div><div class="lg-pt"><b>' + esc(legTime(at)) + "</b> " + esc(place(b)) + ' <span class="mu">' + esc(b) + "</span></div></li>";
    if (i < L.length - 1) { const m = lays[i]; h += '<li class="lay' + (m != null && m < 45 ? " bad" : "") + '">' + (m != null ? "<b>" + du(m) + "</b> layover" : "Layover") + " in " + esc(place(b)) + (m != null ? (m < 45 ? '<span class="tag bad">tight</span>' : m < 60 ? '<span class="tag tight">short</span>' : m >= 180 ? '<span class="tag long">long</span>' : "") : "") + (T.wx[b] ? '<span class="wx">' + esc(T.wx[b]) + "</span>" : "") + "</li>"; }
  });
  return h + '</ol><div class="mu">Times are local at each airport.</div>';
}
// against the ticket already held: price (per day), landing time, trip time; better is green, worse is red
function heldParts(u) {
  const h = T.held, r = u[0], hd = Math.round(Date.parse(T.dayDates[String(h.d)] + "T12:00:00") / 864e5), hdur = h.arr - h.dep - TZOFF, out = [];
  for (const x of u) {
    const day = u.length > 1 ? esc(dayShort(x)) : "";
    if (x[C.cash] != null) { const d = Math.round(x[C.cash] - h.price); out.push({k: "price", day, t: d < 0 ? money(-d) + " less" : d > 0 ? money(d) + " more" : "same price", good: d == 0 ? null : d < 0}); }
    const la = (dayIdx(x) - hd) * 1440 + x[C.arr] - h.arr;
    out.push({k: "lands", day, t: la == 0 ? "lands at the same time" : "lands " + (Math.abs(la) >= 2880 ? Math.round(Math.abs(la) / 1440) + " days " : du(Math.abs(la)) + " ") + (la < 0 ? "earlier" : "later"), good: la == 0 ? null : la < 0});
  }
  const dd = r[C.dur] - hdur; if (hdur > 0) out.push({k: "dur", day: "", t: dd == 0 ? "same trip time" : du(Math.abs(dd)) + (dd < 0 ? " shorter trip" : " longer trip"), good: dd == 0 ? null : dd < 0});
  return out;
}
const heldTxt = p => p.good == null ? p.t : '<span class="' + (p.good ? "good" : "bad") + '">' + p.t + "</span>";
// closed line: price and landing time (each day's, for a flight on both days); the opened section adds the ticket and the trip time, not the same facts again
function heldSum(u) { const ps = heldParts(u).filter(p => p.k != "dur"), days = [...new Set(ps.map(p => p.day))]; return days.map(d => (d ? d + " " : "") + ps.filter(p => p.day == d).map(heldTxt).join(d ? ", " : " · ")).join(" · "); }
function heldBody(u) { const h = T.held, dur = heldParts(u).filter(p => p.k == "dur"); return '<div class="mu">Your ticket: ' + esc(h.flight) + ", " + esc(T.daysShort[h.d] || "") + " " + tm(h.dep) + " → " + tm(h.arr) + " " + T.tzDest + ", " + money(h.price) + "</div>" + (dur.length ? '<div class="dps">' + dur.map(p => '<span class="dpill' + (p.good == null ? "" : p.good ? " good" : " bad") + '">' + p.t + "</span>").join("") + "</div>" : ""); }
function creditsSum(u) {
  const r = cheapestOf(u), als = String(r[C.al]).split("/"), out = [];
  for (const a of als) {
    const p = AL_PROG[a], bal = p ? T.balances[p] : null, c = T.credits[a];
    if (bal != null) out.push(bal.toLocaleString() + " " + esc(PNAME[p] || a));
    if (c && c.sure) out.push(money(c.sure) + " " + esc(a) + " credit");
    if (c && c.soon && c.soonDate) out.push('<span class="bad">' + money(c.soon) + " expires in " + monthsLeft(c.soonDate) + "</span>");
  }
  return out.join(" · ") || "None on file for " + esc(als.join(" or "));
}
function creditsHTML(u) {
  const r = cheapestOf(u), als = String(r[C.al]).split("/"), out = [];
  for (const a of als) {
    const p = AL_PROG[a], bal = p ? T.balances[p] : null, c = T.credits[a];
    if (bal != null) out.push("<div>You have <b>" + bal.toLocaleString() + " " + esc(PNAME[p] || a) + "</b>" + (VAL[p] ? ' <span class="eqc">(~' + money(bal * VAL[p] / 100) + " at " + VAL[p] + "¢)</span>" : "") + "</div>");
    if (c && c.items && c.items.length) for (const i of c.items) out.push('<div class="crl">' + (i.amount != null ? "<b>" + money(i.amount, true) + "</b>" : i.original != null ? "up to " + money(i.original, true) : i.miles ? kfmt(i.miles) + " miles off" : "") + " " + esc(a) + " " + esc(String(i.what || "credit").toLowerCase()) + (i.useBy ? ' · <span class="' + (i.days != null && i.days <= 183 ? "bad" : "mu") + '">' + esc((i.label || "use by").toLowerCase()) + " " + new Date(i.useBy + "T12:00:00").toLocaleDateString("en-US", {month: "short", day: "numeric", year: "numeric"}) + "</span>" : "") + (i.flagged ? ' · <span class="bad">may be used (check)</span>' : "") + "</div>");
  }
  const cr = credit(r);
  if (cr && cr.used) out.push('<div class="good"><b>' + money(cr.after) + " after credits</b> on the cheapest cash fare" + (u.length > 1 ? " (" + esc(dayShort(r)) + ")" : "") + ": uses " + money(cr.used, true) + " of your " + money(cr.c.sure, true) + " " + esc(r[C.al]) + " credit. Credit rules can limit use; confirm at checkout.</div>");
  return out.length ? out.join("") : '<div class="mu">No points or travel credit on file for ' + esc(als.join(" or ")) + ".</div>";
}
const primaryOf = r => primaryBook(r);
function linksHTML(r) { const p = primaryOf(r); return '<div class="bl">' + bookLinks(r).filter(l => l.url != p.url).map(l => '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.label) + "</a>").join("") + "</div>"; }
const otherLinks = r => { const p = primaryOf(r); return bookLinks(r).filter(l => l.url != p.url); };
function panelBody(u) {
  const r = u[0], tw = u.length > 1, ko = FPSEC.has("key"), np = [...new Set(u.flatMap(x => String(x[C.notes] || "").split(/;\s*/)).map(x => x.trim()).filter(Boolean))], notes = np.filter(n => !np.some(o => o != n && o.includes(n)));
  let h = '<div class="fp-sum">' + logoTile(r[C.al], 1) + '<div class="fp-line">' + ["<b>" + esc(r[C.al]) + "</b>"].concat(r[C.fl] ? [esc(r[C.fl])] : [], [du(r[C.dur]) + " total", stopsTxt(r)]).map(x => "<span>" + x + "</span>").join("\u00a0· ") + "</div></div>";
  h += '<section class="fp-sec fp-main" id="fpFares"><div class="fp-h"><h3>Fares and ways to pay</h3><button class="qb" type="button" data-fpkey aria-expanded="' + ko + '" aria-controls="fpKey" aria-label="What the colors mean"><span aria-hidden="true">?</span></button></div>' +
    '<p class="fp-key" id="fpKey"' + (ko ? "" : " hidden") + ">Green: the cheapest way to pay in each fare class" + (tw ? ", compared across the two days (the cheaper day is tagged)" : "") + ". Purple: points at a typical value (hover or tap for the math). Bars: how good a use of points the fare is.</p>" + panelFares(u) + "</section>";
  h += '<div class="fp-folds">' + fold("legs", "Flights and layovers", legsSum(u), legsHTML(r));
  if (T.held) h += fold("held", "Compared with your ticket", heldSum(u), heldBody(u));
  h += fold("credits", "Credits and points", creditsSum(u), creditsHTML(u));
  if (notes.length || r[C.fare]) h += fold("notes", "Notes", notes.length ? notes.map(esc).join("; ") : "Prices from " + esc(r[C.fare]), notes.length && r[C.fare] ? '<div class="mu">Prices from: ' + esc(r[C.fare]) + "</div>" : "");
  const nl = u.map(x => otherLinks(x).length), tot = nl.reduce((a, b) => a + b, 0);
  h += fold("links", "Other ways to book", tot + (tot == 1 ? " link" : " links") + (tw && nl.every(n => n == nl[0]) ? ", " + nl[0] + " for each day" : ""), u.map(x => (tw ? '<div class="fp-day">' + esc(T.daysShort[x[C.d]]) + "</div>" : "") + linksHTML(x)).join("") + '<div class="mu">Airline links open that airline\'s search for the day and route; pick ' + esc(r[C.fl] || "the flight shown") + ". Nothing is bought from here.</div>");
  return h + "</div>";
}
function panelFoot(u) {
  const ch = cheapestOf(u), order = [ch].concat(u.filter(x => x !== ch));
  return order.map((x, i) => { const b = primaryOf(x); return '<a class="btn ' + (i ? "" : "pri ") + 'fpbook" href="' + esc(b.url) + '" target="_blank" rel="noopener" title="' + esc(b.label) + '">Book' + (u.length > 1 ? " " + esc(dayShort(x)) : "") + "</a>"; }).join("") + '<span class="mu fpbl">' + esc(primaryOf(ch).label) + "</span>";
}
function paintPanelHead() {
  const u = rowsOf(FP.ids); if (!u.length) return; const r = u[0], {lk, hd} = marks(u);
  $("fpSub").textContent = u.map(x => T.daysShort[x[C.d]]).join(" and ") + " · " + place(r[C.org]) + " → " + place(r[C.to]);
  $("fpT").innerHTML = tm(r[C.dep]) + " <small>" + T.tzOrigin + "</small> → " + tm(r[C.arr]) + dayMark(r) + " <small>" + T.tzDest + "</small>";
  $("fpLH").innerHTML = likeHide(idsOf(u), lk, hd);
}
function markOpenRow() { document.querySelectorAll("#list .fpon").forEach(e => e.classList.remove("fpon")); if (FP.open) { const el = unitEl(FP.ids[0]); if (el) el.classList.add("fpon"); } }
function openPanel(ids, at) {
  const u = rowsOf(ids); if (!u.length) return;
  Sheet.hide(); Tip.hide();
  if (!FP.open) FP.back = document.activeElement;
  FP.ids = u.map(r => r[C.id]); FP.open = true;
  paintPanelHead(); $("fpBody").innerHTML = panelBody(u); $("fpFoot").innerHTML = panelFoot(u);
  $("fp").classList.add("open"); $("fp").setAttribute("aria-hidden", "false"); $("fpScrim").classList.add("open"); markOpenRow();
  const b = $("fpBody"); b.scrollTop = 0; if (at == "fares") { const s = $("fpFares"); if (s) { b.scrollTop = s.offsetTop - 8; s.classList.remove("hl"); void s.offsetWidth; s.classList.add("hl"); } }
  $("fpX").focus({preventScroll: true});
}
function closePanel() {
  if (!FP.open) return; FP.open = false; Tip.hide();
  $("fp").classList.remove("open"); $("fp").setAttribute("aria-hidden", "true"); $("fpScrim").classList.remove("open");
  const id = FP.ids[0]; markOpenRow(); FP.ids = [];
  let b = FP.back; FP.back = null; if (b && !b.isConnected && id) b = unitEl(id);
  if (b && b.isConnected && b.focus) b.focus({preventScroll: true});
}
// ---------- compare liked flights side by side; in each ranked row the best is green and the worst red ----------
const CMP = {open: false, ids: []};
const likedIds = () => Object.keys(Store.v.like).filter(id => RID.has(id));
function paintFab() {
  const b = $("cmpFab"); if (!b) return; const n = likedIds().length;
  b.innerHTML = ICON.star + "<span>Compare " + n + " liked</span>";
  b.classList.toggle("open", n >= 2 && !CMP.open); b.classList.toggle("up", $("draftbar").classList.contains("open"));
}
function cmpRows() {
  const pf = r => bestPtsFare(r);
  const ratio = r => { const f = pf(r); if (!f) return null; const p = f[FA.prog], v = VAL[p], cash = f[FA.cash] != null ? f[FA.cash] : r[C.cash]; if (!v || cash == null || cash > CASHCAP) return null; return (cash - (f[FA.tax] || 0)) / f[FA.pts] * 100 / v; };
  return [
    ["Day", r => ({h: esc(T.daysShort[r[C.d]])}), null],
    ["Depart", r => ({h: "<b>" + tm(r[C.dep]) + "</b> " + T.tzOrigin + '<div class="mu">' + esc(place(r[C.org])) + "</div>"}), null],
    ["Arrive", r => ({v: dayIdx(r) * 1440 + r[C.arr], h: "<b>" + tm(r[C.arr]) + dayMark(r) + "</b> " + T.tzDest + '<div class="mu">' + esc(place(r[C.to])) + "</div>"}), "lo"],
    ["Total time", r => ({v: r[C.dur], h: "<b>" + du(r[C.dur]) + "</b>"}), "lo"],
    ["Stops and layovers", r => ({v: r[C.st], h: stopsTxt(r) + '<div class="mu">' + layTxt(r) + "</div>"}), "lo"],
    ["Cheapest cash", r => { const c = credit(r); return {v: r[C.cash], h: r[C.cash] != null ? "<b>" + money(r[C.cash]) + "</b>" + (c && c.used ? '<div class="mu">' + money(c.after) + " after credits</div>" : "") : '<span class="mu">none</span>'}; }, "lo"],
    ["Cheapest points", r => { const f = pf(r); return f ? {v: ptsEq(f), h: "<b>" + kfmt(f[FA.pts]) + "</b> " + unitOf(f[FA.prog]) + ' <span class="eqc">~' + money(ptsEq(f)) + '</span><div class="mu">' + esc(fareLab(f)) + "</div>"} : {h: '<span class="mu">none</span>'}; }, "lo"],
    ["Best value", r => ({v: bestCost(r), h: bestWay(r).h}), "lo"],
    ["Points value", r => { const f = pf(r), x = ratio(r); if (!f || x == null) return {h: '<span class="mu">–</span>'}; return {v: x, h: meter(f, r) + ' <span class="mu">' + (x * VAL[f[FA.prog]]).toFixed(2) + "¢ each</span>"}; }, "hi"],
    ["Book", r => ({h: bookBtn(r)}), null]
  ];
}
function paintCompare() {
  const rs = rowsOf(CMP.ids), h0 = T.held;
  $("cmpT").textContent = "Compare " + rs.length + " liked flights";
  let h = '<table class="cmpt"><thead><tr><th class="rl"></th>' + (h0 ? '<th class="held">' + logoTile(h0.airline, 1) + '<div class="cmh"><b>Your ticket</b><div class="mu">' + esc(h0.flight) + "</div></div></th>" : "") +
    rs.map(r => { const lk = Store.has("like", r[C.id]); return '<th class="cmc' + (lk ? "" : " off") + '" data-open data-ids="' + esc(r[C.id]) + '" tabindex="0" aria-label="' + esc(flightLabel([r])) + '"><div class="cmh1">' + logoTile(r[C.al], 1) + '<span class="lh"><button class="star' + (lk ? " on" : "") + '" data-like="' + esc(r[C.id]) + '" aria-pressed="' + lk + '" aria-label="' + (lk ? "Unlike" : "Like") + '">' + (lk ? ICON.star : ICON.starO) + '</button></span></div><div class="cmh"><b>' + esc(r[C.al]) + '</b><div class="mu">' + esc(r[C.fl] || "") + '</div><span class="lnk cmd">Details</span></div></th>'; }).join("") + "</tr></thead><tbody>";
  const hd = h0 ? Math.round(Date.parse(T.dayDates[String(h0.d)] + "T12:00:00") / 864e5) : 0;
  const heldCell = {Day: () => esc(T.daysShort[h0.d] || ""), Depart: () => "<b>" + tm(h0.dep) + "</b> " + T.tzOrigin + '<div class="mu">' + esc(h0.fromName || "") + "</div>", Arrive: () => "<b>" + tm(h0.arr) + "</b> " + T.tzDest + '<div class="mu">' + esc(place(h0.to)) + "</div>", "Total time": () => h0.arr - h0.dep - TZOFF > 0 ? "<b>" + du(h0.arr - h0.dep - TZOFF) + "</b>" : "–", "Cheapest cash": () => "<b>" + money(h0.price) + "</b>" + '<div class="mu">what you paid</div>'};
  for (const [label, fn, dir] of cmpRows()) {
    const cells = rs.map(fn), vals = cells.map(c => c.v).filter(v => v != null), distinct = new Set(vals.map(v => Math.round(v * 100))).size > 1;
    const best = dir == "hi" ? Math.max(...vals) : Math.min(...vals), worst = dir == "hi" ? Math.min(...vals) : Math.max(...vals);
    h += '<tr><th class="rl">' + label + "</th>" + (h0 ? '<td class="held">' + (heldCell[label] ? heldCell[label]() : '<span class="mu">–</span>') + "</td>" : "") +
      cells.map(c => '<td class="' + (dir && distinct && c.v != null ? (Math.abs(c.v - best) < 1e-6 ? "cg" : Math.abs(c.v - worst) < 1e-6 ? "cr" : "") : "") + '">' + c.h + "</td>").join("") + "</tr>";
  }
  $("cmpBody").innerHTML = h + '</tbody></table><p class="fp-key cmpk">Green is the best in each row and red the worst. Day and departure time are not ranked. Arrival counts the day too. Tap a flight\'s name for its details; unliked flights stay until you close this.</p>';
}
function openCompare() { CMP.ids = likedIds().sort((a, b) => { const x = RID.get(a), y = RID.get(b); return dayIdx(x) - dayIdx(y) || x[C.dep] - y[C.dep]; }); if (CMP.ids.length < 2) return; Sheet.hide(); Tip.hide(); CMP.back = document.activeElement; CMP.open = true; paintCompare(); $("cmp").classList.add("open"); $("cmp").setAttribute("aria-hidden", "false"); $("cmpScrim").classList.add("open"); paintFab(); $("cmpX").focus({preventScroll: true}); }
function closeCompare() { if (!CMP.open) return; CMP.open = false; Tip.hide(); $("cmp").classList.remove("open"); $("cmp").setAttribute("aria-hidden", "true"); $("cmpScrim").classList.remove("open"); paintFab(); const b = CMP.back; CMP.back = null; if (b && b.isConnected && b.focus) b.focus({preventScroll: true}); }
// The page under a panel never scrolls: wheel and touch moves on the dimmed area are dropped, and the panels contain their own scrolling
for (const id of ["fpScrim", "cmpScrim"]) for (const ev of ["wheel", "touchmove"]) $(id).addEventListener(ev, e => e.preventDefault(), {passive: false});
for (const [id, inner] of [["fp", ".fp-body"], ["cmp", ".cmp-body"]]) for (const ev of ["wheel", "touchmove"]) $(id).addEventListener(ev, e => { if (!e.target.closest(inner)) e.preventDefault(); }, {passive: false});
$("fpBody").addEventListener("scroll", () => Tip.hide(), {passive: true}); $("cmpBody").addEventListener("scroll", () => Tip.hide(), {passive: true});
function trap(e, box) { const f = [...box.querySelectorAll('a[href],button:not([disabled]),summary,[tabindex="0"]')].filter(x => x.offsetParent !== null); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus({preventScroll: true}); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus({preventScroll: true}); } }
document.addEventListener("keydown", e => {
  if (e.key == "Escape") { if (FP.open) { e.stopImmediatePropagation(); closePanel(); } else if (CMP.open) { e.stopImmediatePropagation(); closeCompare(); } return; }
  if (e.key == "Tab") { if (FP.open) trap(e, $("fp")); else if (CMP.open) trap(e, $("cmp")); return; }
  if ((e.key == "Enter" || e.key == " ") && e.target.matches && e.target.matches("[data-open]")) { e.preventDefault(); openPanel(e.target.dataset.ids.split(" ")); }
}, true);
// The query box (ask.js) uses these
window.TripAPI = {
  slug: T.slug,
  context: () => ({slug: T.slug, title: T.title, filters: JSON.parse(JSON.stringify(F)), visibleIds: R.filter(r => passes(r)).map(r => r[C.id]), total: R.length}),
  setQuery: q => { F.q = q && q.ids ? {label: String(q.label || "your question").slice(0, 60), ids: q.ids.map(String)} : null; changed(); },
  clearQuery: () => { F.q = null; changed(); }
};
// ---------- events ----------
function toggleMark(kind, ids) {
  const on = kind == "like" ? !ids.some(i => Store.has("like", i)) : !ids.every(i => Store.has("hide", i));
  for (const i of ids) if (Store.has(kind, i) != on) Store.set(kind, i, on);
}
document.addEventListener("click", e => {
  const t = e.target;
  const clr = t.closest("[data-clear]"); if (clr) { e.stopPropagation(); clearChip(clr.dataset.clear); changed(); return; }
  const chip = t.closest("[data-chip]");
  if (chip) { const k = chip.dataset.chip; if (k == "liked") { F.liked = !F.liked; changed(); } else if (k == "allf") { F.allFares = !F.allFares; changed(); } else if (k == "hid") { F.hid = !F.hid; changed(); } else if (k == "reset") { F = DEF(); changed(); } else openSheet(k, chip); return; }
  const lk = t.closest("[data-like]"); if (lk) { toggleMark("like", lk.dataset.like.split(" ")); return; }
  const hd = t.closest("[data-hide]"); if (hd) { toggleMark("hide", hd.dataset.hide.split(" ")); return; }
  const kb = t.closest("[data-fpkey]"); if (kb) { const on = kb.getAttribute("aria-expanded") != "true", k = $("fpKey"); kb.setAttribute("aria-expanded", on); if (k) k.hidden = !on; if (on) FPSEC.add("key"); else FPSEC.delete("key"); keepSecs(); return; }
  if (t.closest("#fpX") || t.id == "fpScrim") { closePanel(); return; }
  if (t.closest("#cmpX") || t.id == "cmpScrim") { closeCompare(); return; }
  if (t.closest("#cmpFab")) { openCompare(); return; }
  const sg = t.closest("[data-seg]"); if (sg) { const v = sg.dataset.v; if (sg.dataset.seg == "from") F.from = v == "*" ? [...ORGS] : [v]; else F.days = v == "*" ? [...DAYS] : [v]; changed(); return; }
  const st = t.closest("[data-sort]"); if (st) { F.sort = st.dataset.sort; changed(); return; }
  const mb = t.closest("[data-mini]"); if (mb) { const k = mb.dataset.mini; if (k == "liked") { F.liked = !F.liked; changed(); } else if (k == "sort") openSheet("sort", null); else openFilters(); return; }
  const mf = t.closest("[data-fpfares]"); if (mf) { const el = unitEl(mf.dataset.fpfares); openPanel(el ? el.dataset.ids.split(" ") : [mf.dataset.fpfares], "fares"); return; }
  const only = t.closest("[data-only]"); if (only) { e.preventDefault(); const v = only.dataset.only; if (curSheet == "from") F.from = [v]; if (curSheet == "day") F.days = [v]; if (curSheet == "to") F.to = [v]; if (curSheet == "al") F.xal = ALS.filter(a => a != v); if (curSheet == "conn") F.xconn = VIAS.filter(a => a != v); changed(); return; }
  const all = t.closest("[data-all]"), none = t.closest("[data-none]");
  if (all || none) { const k = (all || none).dataset[all ? "all" : "none"]; if (k == "from") F.from = all ? [...ORGS] : []; if (k == "day") F.days = all ? [...DAYS] : []; if (k == "to") F.to = all ? [...DESTS] : []; if (k == "al") F.xal = all ? [] : [...ALS]; if (k == "conn") { F.xconn = all ? [] : [...VIAS]; F.unl = !!all; } changed(); return; }
  const lq = t.closest("[data-lq]"); if (lq) { const [a, b] = lq.dataset.lq.split(","); F.lay = [a == "min" ? RG.lay[0] : +a, b == "max" ? RG.lay[1] : +b]; ranges.lay.set(F.lay[0], F.lay[1]); changed(); return; }
  const tw = t.closest("[data-tw]"); if (tw) { const w = tw.dataset.tw, lo = Math.max(RG[w][0], +tw.dataset.lo), hi = Math.min(RG[w][1], +tw.dataset.hi); F[w] = [lo, hi]; ranges[w].set(lo, hi); changed(); return; }
  const gc = t.closest("[data-gd]"); if (gc) { F.days = [gc.dataset.gd]; F.to = [gc.dataset.gt]; if (gc.dataset.go2) F.from = [gc.dataset.go2]; changed(); return; }
  const gd = t.closest("[data-gday]"); if (gd) { F.days = [gd.dataset.gday]; F.to = [...DESTS]; if (gd.dataset.gorg) F.from = [gd.dataset.gorg]; changed(); return; }
  const gt = t.closest("[data-gto]"); if (gt) { F.to = [gt.dataset.gto]; F.days = [...DAYS]; F.from = [...ORGS]; changed(); return; }
  const go = t.closest("[data-go]"); if (go) { const el = unitEl(go.dataset.go); openPanel(el ? el.dataset.ids.split(" ") : [go.dataset.go]); return; }
  if (t.closest("#simT")) { F.similar = !F.similar; changed(); return; }
  if (t.id == "shGo" || t.id == "shX" || t.id == "scrim") { Sheet.hide(); return; }
  const op = t.closest("[data-open]"); if (op && !t.closest("button,a,input,label,summary,.eq,.vm")) { openPanel(op.dataset.ids.split(" ")); return; }
});
document.addEventListener("change", e => {
  const o = e.target.closest("[data-opt]"); if (!o || !curSheet) return; const v = o.dataset.opt, on = o.checked, k = curSheet;
  const tog = (arr, x, inc) => inc ? (arr.includes(x) ? arr : arr.concat([x])) : arr.filter(y => y != x);
  if (k == "from") F.from = tog(F.from, v, on); if (k == "day") F.days = tog(F.days, v, on); if (k == "to") F.to = tog(F.to, v, on);
  if (k == "al") F.xal = tog(F.xal, v, !on);
  if (k == "conn") { if (v == "__unl") F.unl = on; else F.xconn = tog(F.xconn, v, !on); }
  if (k == "stops") F.stops = v; if (k == "sort") F.sort = v;
  if (k == "pay") { F.pay = v; F.miles = RG.miles[1]; }
  changed();
  if (["stops", "sort", "pay"].includes(k)) Sheet.hide();  // single-choice lists apply on tap
});
Sheet.onhide = () => { curSheet = null; };
wide.addEventListener("change", () => { render(); if (CMP.open) paintCompare(); });
Store.onchange = (kind, id) => {
  if (!kind) { render(); if (FP.open) paintPanelHead(); return; }
  KEEP.add(id); updateRow(id); keepPlace(() => { renderChips(); const rows = R.filter(r => passes(r)); countTxt(rows, UNITS); paintMini(); });
  paintFab(); if (FP.open && FP.ids.includes(id)) paintPanelHead(); if (CMP.open) paintCompare();
};
Requests.onpaint = () => paintFab();
// #go=<flight id> (from the home page's best picks) opens that flight's panel without scrolling or changing filters
function goTo() { const m = location.hash.match(/go=([^&]+)/); if (!m) return; const id = decodeURIComponent(m[1]); if (!RID.has(id)) return; const el = unitEl(id); if (el) { el.classList.remove("hl"); void el.offsetWidth; el.classList.add("hl"); } openPanel(el ? el.dataset.ids.split(" ") : [id]); }
loadHash(); renderTop(); render();
(async () => { await Store.load(T.slug); await Requests.load(); renderTop(); render(); goTo(); })();
window.addEventListener("hashchange", () => { if (/go=/.test(location.hash)) goTo(); });
