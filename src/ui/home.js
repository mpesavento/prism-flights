// Claude · 2026-11-22, credits view 2026-11-23 · Session 8e680ddd · Prism home page: airline pills, trips, travel credits (expiry timeline, time bars, codes on tap, rechecks), balances with point values
// Green marks good things and red marks bad things. Codes are never in this page's source: they are fetched from credit-codes.json when Show code is tapped, kept in memory only.
const H = HOME;
const parseD = s => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); };
const dayStart = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
let today = dayStart();  // reset when a tab left open comes back on a new day
const daysTo = s => s ? Math.round((parseD(s) - today) / 864e5) : null;  // null = no end date
const fmtD = s => s ? parseD(s).toLocaleDateString("en-US", {month: "short", day: "numeric", year: "numeric"}) : "no end date";
const agoH = iso => (Date.now() - new Date(iso).getTime()) / 36e5;
const agoTxt = h => h < 1 ? "under an hour ago" : h < 48 ? Math.round(h) + " hours ago" : Math.round(h / 24) + " days ago";
const ptTime = iso => new Date(iso).toLocaleString("en-US", {timeZone: "America/Los_Angeles", weekday: "short", hour: "numeric", minute: "2-digit"}).replace(" AM", "am").replace(" PM", "pm") + " PT";
const credits = H.credits.slice().sort((a, b) => (a.useBy || "9999").localeCompare(b.useBy || "9999"));
const openC = new Set();
const SIX = 183, YEAR = 365, ALL = "credits:all";
const zone = n => n == null ? "good" : n < 0 ? "exp" : n <= SIX ? "bad" : n <= YEAR ? "warn" : "good";
const live = c => { const n = daysTo(c.useBy); return n == null || n >= 0; };  // expired credits are not money
const leftTxt = n => n == null ? "no end date" : n < 0 ? "expired" : n == 0 ? "last day" : n < 45 || (n >= 152 && n <= 214) ? n + " days left" : Math.round(n / 30.4) + "mo left";  // days near the 6-month line, so 183 (red) and 184 (amber) never both read "6mo"
const BALKEY = Object.assign({Delta: "dl", Southwest: "sw", American: "aa", United: "ua", Alaska: "as"}, H.balKeys || {});
const CENTS = (H.values || {}).cents || {};
const money0 = n => money(Math.round(n));

function needs() {
  const out = [], fl = credits.filter(c => c.flag), un = H.programs.filter(p => p.creditsStatus == "unchecked"), stale = H.trips.filter(t => !t.past && agoH(t.searched) > 24), pend = Requests.list.filter(r => r.status == "requested");
  if (fl.length) out.push(fl.length + (fl.length == 1 ? " credit" : " credits") + " may have been used (a booking email came after the last check) · <a href=\"#creditsH\">Review</a>");
  if (un.length) out.push("Credits not checked at " + un.map(p => esc(p.airline)).join(", ") + " · <a href=\"#creditsH\">Review</a>");
  if (stale.length) out.push(stale.length + (stale.length == 1 ? " search is" : " searches are") + " over a day old; prices may have moved");
  if (pend.length) out.push(pend.length + (pend.length == 1 ? " request" : " requests") + " waiting for Claude (last sent " + ptTime(pend[pend.length - 1].requested_at) + ")");
  $("needs").innerHTML = out.length ? '<div class="box needs">' + out.map(x => "<div>" + x + "</div>").join("") + "</div>" : "";
}
function renderTrips() {
  const cur = H.trips.filter(t => !t.past), past = H.trips.filter(t => t.past);
  const card = t => { const lk = Store.has("like", t.slug), hd = Store.has("hide", t.slug); if (hd && !showHidTrips) return ""; const h = agoH(t.searched);
    return '<div class="box trip' + (lk ? " liked" : "") + (hd ? " hid" : "") + '"><a class="tl" href="/flights/' + esc(t.slug) + '/"><div class="tn">' + esc(t.name) + '</div><div class="mu">' + esc(t.route) + '</div><div class="ink2 tm">' + t.count + " flights · searched " + esc(t.searchedLabel) + " (" + agoTxt(h) + ")" + (h > 24 ? ' <span class="pill warn">prices may have moved</span>' : "") + "</div>" +
      t.picks.map(p => '<div class="tp" data-href="' + esc(p.href || "") + '"><span class="pl">' + esc(p.label) + "</span> <b>" + p.value + "</b> · " + esc(p.detail) + "</div>").join("") + (t.held ? '<div class="mu">You hold: ' + esc(t.held) + "</div>" : "") + "</a>" +
      '<div class="tf"><span class="mu">Open the trip to filter and compare</span><span class="sp"></span>' + likeHide(t.slug, lk, hd) + "</div></div>"; };
  $("trips").innerHTML = (cur.map(card).join("") || '<div class="mu">No upcoming trips saved.</div>') + (past.length ? '<details class="past"><summary class="lnk">Past trips (' + past.length + ")</summary>" + past.map(card).join("") + "</details>" : "");
  const nH = H.trips.filter(t => Store.has("hide", t.slug)).length; $("tripHid").innerHTML = nH ? '<button class="lnk" id="tripHidT">' + (showHidTrips ? "Hide" : "Show") + " hidden (" + nH + ")</button>" : "";
}
let showHidTrips = false;

// ---- airline pills (shared component from common.js)
function liveCv() {
  const by = {};
  for (const c of credits) {
    if (!live(c)) continue;
    const n = daysTo(c.useBy), a = by[c.airline] = by[c.airline] || {sure: 0, unsure: 0, soon: 0, soonDate: null, items: []};
    a.items.push({key: c.key, what: c.what || "", amount: c.amount, original: c.original, miles: c.miles, useBy: c.useBy, label: c.useByLabel || "", days: n == null ? 9999 : n, flagged: !!c.flag});
    if (c.amount != null && !c.flag) { a.sure += c.amount; if (n != null && n <= SIX) { a.soon += c.amount; if (!a.soonDate || c.useBy < a.soonDate) a.soonDate = c.useBy; } }
    else a.unsure += c.amount != null ? c.amount : c.original || 0;
  }
  return by;
}
function renderPills() { $("pills").innerHTML = airlinePills(H.balances, liveCv(), H.values, null, H.pillProgs); }

// ---- Recheck controls: one look everywhere (per credit, per balance, all). Drafts until Submit.
function chkCtl(item, label) {
  const pend = Requests.pendingFor(item), pendAll = item != ALL && Requests.pendingFor(ALL);
  if (pend || pendAll) return '<span class="pill">' + (pend ? "Recheck" : "Recheck all") + " requested " + esc(ptTime((pend || pendAll).requested_at)) + ", waiting</span>";
  if (item != ALL && Requests.has(ALL)) return '<span class="pill">In Recheck all</span>';
  const q = Requests.has(item);
  return '<button class="btn sm' + (q ? " on" : "") + '" data-chk="' + esc(item) + '" data-lab="' + esc(label) + '" aria-pressed="' + q + '">' + (q ? "Recheck added (undo)" : item == ALL ? "Recheck all" : "Recheck") + "</button>";
}
const lastDone = item => Requests.list.filter(c => c.status == "done" && (c.items.includes(item) || c.items.includes(ALL))).slice(-1)[0];
function doneLine(item) { const d = lastDone(item); return d ? '<div class="mu">Last recheck ' + esc(ptTime(d.done_at || d.requested_at)) + (d.result ? ": " + esc(d.result) : "") + "</div>" : ""; }

// ---- summary tiles: green = confirmed money, red = expiring within 6 months
function amt(c) { return c.amount != null ? money(c.amount, true) : c.miles ? c.miles.toLocaleString() + " miles off" : "up to " + money(c.original, true); }
function renderTiles() {
  const act = credits.filter(live), expired = credits.length - act.length;
  const sure = act.reduce((s, c) => s + (c.amount != null && !c.flag ? c.amount : 0), 0), unsure = act.reduce((s, c) => s + (c.amount == null && c.original ? c.original : c.flag && c.amount ? c.amount : 0), 0);
  const soonC = act.filter(c => { const n = daysTo(c.useBy); return n != null && n <= SIX; });
  const sSure = soonC.reduce((s, c) => s + (c.amount != null && !c.flag ? c.amount : 0), 0), sUp = soonC.reduce((s, c) => s + (c.amount == null && c.original ? c.original : c.flag && c.amount ? c.amount : 0), 0), sMi = soonC.reduce((s, c) => s + (c.amount == null && !c.original && c.miles ? c.miles : 0), 0);
  const next = act.find(c => c.useBy), need = credits.filter(c => c.flag).length + H.programs.filter(p => p.creditsStatus == "unchecked").length;
  const als = [...new Set(soonC.map(c => c.airline))], soonDates = new Set(soonC.map(c => c.useBy)).size;
  const sVal = sSure ? money(sSure, true) : sUp ? "up to " + money0(sUp) : sMi ? kfmt(sMi) + " mi" : soonC.length ? soonC.length + " credits" : "None";
  const sMore = [sSure && sUp ? "+ up to " + money0(sUp) : "", (sSure || sUp) && sMi ? "+ " + kfmt(sMi) + " mi" : ""].filter(Boolean).join(" ");
  $("tiles").innerHTML = '<div class="tile2 box"><div class="k">Confirmed credit</div><div class="v t-good">' + money(sure, true) + '</div><div class="d">' + ([unsure ? "+ up to " + money(unsure, true) + " at checkout" : "", expired ? expired + " expired, not counted" : ""].filter(Boolean).join(" · ") || "&nbsp;") + "</div></div>" +
    '<div class="tile2 box"><div class="k">Expires in 6 months</div><div class="v ' + (soonC.length ? "t-bad" : "t-good") + '">' + sVal + '</div><div class="d">' + (soonC.length ? esc(als.join(", ")) + ", " + (soonDates > 1 ? "first " : "") + fmtD(soonC[0].useBy) + (sMore ? " " + sMore : "") : next ? "Next: " + fmtD(next.useBy) : "&nbsp;") + "</div></div>" +
    '<div class="tile2 box"><div class="k">Needs a check</div><div class="v' + (need ? " t-warn" : "") + '">' + need + '</div><div class="d">' + (need ? "flagged or unchecked credits" : "all " + H.programs.length + " airlines checked") + "</div></div>";
}

// ---- expiry timeline: today to the last expiry (at least 12 months); red band under 6 months, amber 6 to 12; one marker per airline and date, sized by amount
const textW = (() => { let c; return (t, font) => { c = c || document.createElement("canvas").getContext("2d"); c.font = font; return Math.ceil(c.measureText(t).width); }; })();
function tlGroups() {
  const gs = [];
  for (const c of credits) {
    if (!c.useBy) continue;
    let g = gs.find(x => x.date == c.useBy && x.airline == c.airline);
    if (!g) gs.push(g = {date: c.useBy, airline: c.airline, n: daysTo(c.useBy), list: [], sure: 0, upto: 0, miles: 0});
    g.list.push(c);
    if (c.amount != null && !c.flag) g.sure += c.amount; else if (c.amount != null || c.original) g.upto += c.amount != null ? c.amount : c.original; else if (c.miles) g.miles += c.miles;
  }
  for (const g of gs) {
    g.val = g.sure + g.upto + g.miles * (CENTS[BALKEY[g.airline]] || 1) / 100;
    g.label = g.sure ? money0(g.sure) + (g.upto ? " + up to " + money0(g.upto) : "") : g.upto ? "up to " + money0(g.upto) : g.miles ? kfmt(g.miles) + " mi off" : "";
    g.z = zone(g.n); g.solid = g.sure > 0;
    g.tip = "<b>" + esc(g.airline) + "</b>" + g.list.map(c => "<div>" + amt(c) + " " + esc(c.what.toLowerCase()) + (c.flag ? " · may be used (check)" : "") + "</div>").join("") +
      '<div class="' + (g.z == "bad" || g.z == "exp" ? "badt" : "") + '">' + esc((g.list[0].useByLabel || "Use by").toLowerCase()) + " " + fmtD(g.date) + (g.n < 0 ? " (expired)" : " (" + monthsLeft(g.date) + ")") + "</div>";
  }
  return gs.sort((a, b) => a.n - b.n || b.val - a.val);
}
let tlW = 0;
function renderTimeline() {
  const host = $("xt"), gs = tlGroups();
  if (!gs.length) { host.style.display = "none"; return; }
  host.style.display = "";
  const W = tlW = host.clientWidth || 360, pad = 16, span = Math.max(YEAR, Math.max(...gs.map(g => g.n)) + 20), inner = W - 2 * pad;
  const x = n => pad + Math.max(0, Math.min(1, n / span)) * inner;
  const maxV = Math.max(...gs.map(g => g.val), 1), font = "700 12.5px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
  const lanes = [];
  for (const g of gs) {
    g.d = Math.round(22 + 14 * Math.sqrt(g.val / maxV)); g.cx = Math.max(x(g.n), g.d / 2 + 6); g.lw = textW(g.label, font) + 10;
    const r = g.d / 2 + 4; let L = g.cx - r, R = g.cx + r + 5 + g.lw; g.fl = false;
    if (R > W - 4) { g.fl = true; L = g.cx - r - 5 - g.lw; R = g.cx + r; }
    let li = lanes.findIndex(lane => lane.every(([a, b]) => R + 4 <= a || L >= b + 4));
    if (li < 0) { lanes.push([]); li = lanes.length - 1; }
    lanes[li].push([L, R]); g.lane = li; g.L = L;
  }
  const LH = 44, top = 18, axisY = top + lanes.length * LH + 4;
  const cy = g => axisY - 4 - LH / 2 - g.lane * LH;
  let h = '<div class="xh"><b>When your credits expire</b><span class="lg"><i class="o"></i>Bigger = more money</span></div>';
  h += '<div class="xp" style="height:' + (axisY + 34) + 'px">';
  const x6 = x(SIX), x12 = x(YEAR);
  h += '<div class="xz r" style="left:' + pad + "px;width:" + (x6 - pad) + "px;height:" + axisY + 'px"></div><div class="xz a" style="left:' + x6 + "px;width:" + (x12 - x6) + "px;height:" + axisY + 'px"></div>';
  h += '<div class="xzl t-bad" style="left:' + (pad + 7) + 'px">Under 6 months</div><div class="xzl t-warn" style="left:' + (x6 + 6) + 'px">6 to 12 months</div>';
  h += '<div class="xa" style="left:' + pad + "px;width:" + inner + "px;top:" + axisY + 'px"></div><div class="xtd" style="left:' + pad + "px;height:" + (axisY + 6) + 'px"></div>';
  // month ticks
  h += '<div class="xk l" style="left:' + (pad - 1) + "px;top:" + (axisY + 8) + 'px">Today</div>';
  let lastX = pad + 30, lastYear = today.getFullYear();
  for (let i = 1; i <= 40; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1), n = Math.round((d - today) / 864e5);
    if (n > span) break;
    const tx = x(n); h += '<div class="xkm" style="left:' + tx + "px;top:" + (axisY - 2) + 'px"></div>';
    const yr = d.getFullYear() != lastYear, lab = d.toLocaleDateString("en-US", {month: "short"});
    if (tx - lastX < (yr ? 34 : 28) || tx > W - 14) continue;
    h += '<div class="xk" style="left:' + tx + "px;top:" + (axisY + 8) + 'px">' + lab + (yr ? "<br>" + d.getFullYear() : "") + "</div>"; lastX = tx; lastYear = d.getFullYear();
  }
  // stems first (so no stem crosses a label), then markers: round logo sized by amount, ring in the zone color (dashed when the amount is not confirmed)
  for (const g of gs) { const y = cy(g); h += '<div class="xs" style="left:' + g.cx + "px;top:" + (y + g.d / 2 + 3) + "px;height:" + Math.max(0, axisY - y - g.d / 2 - 3) + 'px"></div>'; }
  for (const g of gs) {
    const y = cy(g), keys = g.list.map(c => c.key).join(" "), aria = g.airline + " " + g.label + ", " + (g.list[0].useByLabel || "use by") + " " + fmtD(g.date);
    h += '<button class="xm z-' + g.z + (g.fl ? " fl" : "") + '" style="left:' + Math.round(g.L + 4) + "px;top:" + Math.round(y - g.d / 2) + 'px" data-go="' + esc(keys) + '" data-tiph="' + esc(g.tip) + '" aria-label="' + esc(aria) + '">' +
      '<span class="xd' + (g.solid ? "" : " dash") + '" style="width:' + g.d + "px;height:" + g.d + 'px">' + (LOGOS.has(g.airline) ? '<span class="li L-' + logoCls(g.airline) + '"></span>' : "") + '</span><span class="xl">' + esc(g.label) + "</span></button>";
  }
  // credits with no end date are not on the line; name them under it
  const open = credits.filter(c => !c.useBy);
  if (open.length) h += '</div><div class="mu" style="padding:0 ' + pad + 'px 8px">No end date: ' + open.map(c => esc(c.airline) + " " + amt(c) + " " + esc(c.what.toLowerCase())).join(", ") + ".";
  host.innerHTML = h + "</div>";
}

// ---- credit codes: fetched only when he taps Show code; kept in memory, never in storage
let CODES = null, codesErr = "", codesBusy = false;
const shownCode = new Set();
async function loadCodes() {
  if (CODES || codesBusy) return; codesBusy = true; codesErr = "";
  try {
    const r = await fetch("credit-codes.json", {cache: "no-store"});
    if (!r.ok) throw new Error(r.status == 404 ? "the portal does not serve codes yet (404)" : "the portal answered " + r.status);
    const d = await r.json(); CODES = {}; for (const k in d) if (k[0] != "_") CODES[k] = d[k];
  } catch (e) { codesErr = e && e.message && !/fetch|network|load/i.test(e.message) ? e.message : "could not reach the portal"; }
  codesBusy = false;
}
function codeBox(c) {
  if (!shownCode.has(c.key)) return "";
  if (codesBusy && !CODES) return '<div class="cbox"><div class="mu">Loading code...</div></div>';
  if (!CODES) return '<div class="cbox"><div class="mu">Could not load codes: ' + esc(codesErr) + '.</div><div class="crw"><button class="btn sm" data-codere="' + esc(c.key) + '">Try again</button></div></div>';
  const f = codeFor(c), e = f && f.e;
  if (!e) return '<div class="cbox"><div class="ck">No code on file</div><div class="mu">No code is on file for this credit as it stands now: none was found in your email with confidence, or the credit changed after the codes were collected. Check the ' + esc(c.airline) + " account page, or ask Claude to look again.</div></div>";
  const where = e.where ? '<div class="mu">Found in: ' + esc(e.where) + "</div>" : "";
  if (!e.code) return '<div class="cbox"><div class="ck">No code needed</div><div class="mu">' + esc(e.note || "") + "</div>" + where + "</div>";
  return '<div class="cbox"><div class="ck">' + esc(e.kind || "Code") + '</div><div class="crw"><code class="cv" id="cv-' + esc(c.key) + '">' + esc(e.code) + '</code><button class="btn sm pri" data-copy="' + esc(c.key) + '">Copy</button></div>' +
    (e.note ? '<div class="mu">' + esc(e.note) + "</div>" : "") + (f.loose ? '<div class="mu">Matched by airline, type and date; the amount changed after this code was found.</div>' : "") + where + "</div>";
}
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");  // same as credit_key in src/credits.py
function codeFor(c) {
  if (CODES[c.key]) return {e: CODES[c.key], loose: false};
  const pre = slug(c.airline + "-" + c.what + "-" + (c.useBy || "")) + "-", taken = new Set(credits.map(x => x.key));
  const cand = Object.keys(CODES).filter(k => k.startsWith(pre) && !taken.has(k));
  return cand.length == 1 ? {e: CODES[cand[0]], loose: true} : null;
}
async function copyCode(key, btn) {
  const cr = credits.find(c => c.key == key), f = CODES && cr && codeFor(cr), t = f && f.e.code, el = $("cv-" + key); if (!t) return;
  let ok = false;
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(t); ok = true; } } catch (e) {}
  if (!ok) {  // plain http on a private network is not a secure context, so the clipboard API is missing there: copy through a hidden text box
    try { const ta = document.createElement("textarea"); ta.value = t; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px";
      document.body.appendChild(ta); ta.focus({preventScroll: true}); ta.select(); ta.setSelectionRange(0, t.length); ok = document.execCommand("copy"); ta.remove(); btn.focus({preventScroll: true}); } catch (e) {}
  }
  if (!ok && el) { try { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {} }
  btn.textContent = ok ? "Copied" : "Selected, now copy"; btn.classList.remove("pri"); btn.classList.add(ok ? "ok" : "on");
  clearTimeout(btn._t); btn._t = setTimeout(() => { btn.textContent = "Copy"; btn.classList.remove("ok", "on"); btn.classList.add("pri"); }, 2200);
}

// ---- credit rows: amount (green when confirmed), a bar of time left (12 months = full; red under 6), Show code, Recheck, when it was last checked
function renderCredits() {
  $("credits").innerHTML = credits.map(c => {
    const n = daysTo(c.useBy), z = zone(n), item = "credit:" + c.key, op = openC.has(c.key), sh = shownCode.has(c.key);
    const amtCls = n != null && n < 0 ? "unk" : c.flag ? "warn" : c.amount != null ? "good" : "unk";  // expired money is not good money
    const pct = n == null ? 100 : n < 0 ? 0 : Math.max(2, Math.min(100, n / YEAR * 100)), dateTxt = c.useBy ? esc(c.useByLabel || "Use by") + " " + fmtD(c.useBy) : "No end date";
    const lab = c.airline + " " + c.what.toLowerCase() + " " + (c.amount != null ? money(c.amount, true) : c.original ? "up to " + money(c.original, true) : c.miles ? kfmt(c.miles) + " miles" : "");
    return '<div class="crow box' + (op ? " open" : "") + '" id="cr-' + esc(c.key) + '" data-crow="' + esc(c.key) + '"><div class="cr1">' + logoTile(c.airline) + '<div class="cm"><b>' + esc(c.what) + '</b> <span class="mu">' + esc(c.airline) + '</span><div class="mu from">' + esc(c.from || "") + (c.note ? " · " + esc(c.note) : "") + "</div></div>" +
      '<div class="cra"><div class="amt ' + amtCls + '">' + amt(c) + (c.flag ? '<span class="q" title="May have been used">?</span>' : "") + '</div><div class="dt t-' + (z == "good" ? "" : z) + '">' + dateTxt + "</div></div></div>" +
      '<div class="tb z-' + z + '" title="' + esc(leftTxt(n)) + '"><div class="tbt"><span class="tbz"></span><div class="tbf" style="width:' + pct.toFixed(1) + '%"></div></div><span class="tbl">' + leftTxt(n) + "</span></div>" +
      '<div class="ca"><button class="btn sm' + (sh ? " on" : "") + '" data-code="' + esc(c.key) + '" aria-expanded="' + sh + '">' + (sh ? "Hide code" : "Show code") + "</button>" + chkCtl(item, lab) +
      (c.useHref ? '<a class="btn sm" href="' + esc(c.useHref) + '">Use on a trip</a>' : "") + '<span class="mu chk">Checked ' + esc(c.checked) + "</span></div>" +
      codeBox(c) +
      (op ? '<div class="cdet">' + (c.flag ? "<div><b>May have been used:</b> " + esc(c.flag) + "</div>" : "") + "<div>From: " + esc(c.from || "not recorded") + (c.note ? ". " + esc(c.note) : "") + "</div>" +
        "<div>" + (n == null ? "No end date." : (n < 0 ? "Expired " + (-n) + " days ago" : n + " days left") + " (" + esc((c.useByLabel || "use by").toLowerCase()) + " " + fmtD(c.useBy) + ").") + "</div>" + doneLine(item) + "</div>" : "") + "</div>";
  }).join("") || '<div class="mu">No credits.</div>';
  const none = H.programs.filter(p => p.creditsStatus != "unchecked" && !credits.some(c => c.airline == p.airline)).map(p => p.airline);
  $("noneAt").textContent = none.length ? "No credits at " + none.join(", ") + "." : "";
  $("chkAll").innerHTML = chkCtl(ALL, "Recheck all (credits and balances, all " + H.programs.length + " airlines)");
}

// ---- balances: points, what they are worth at NerdWallet's value, when read, Recheck
function renderBalances() {
  const V = H.values || {};
  $("bals").innerHTML = H.programs.map(p => {
    const k = BALKEY[p.airline], c = CENTS[k], worth = c ? p.balance * c / 100 : null, unit1 = p.unit.replace(/s$/, "");
    return '<div class="brow" id="bal-' + esc(p.airline) + '">' + logoTile(p.airline, 1) + '<div class="cm"><b>' + esc(p.airline) + '</b> <span class="mu">' + esc(p.program) + '</span><div class="mu">Checked ' + esc(p.balanceAsOf) +
      (p.expiry ? " · " + esc(p.expiry) : "") + "</div>" + doneLine("balance:" + p.airline) + "</div>" +
      '<div class="bv">' + p.balance.toLocaleString() + " <small>" + esc(p.unit) + "</small>" + (worth ? '<span class="eqv" title="NerdWallet values a ' + esc(unit1) + " at " + c.toFixed(1) + '¢">worth ~' + money0(worth) + " at " + c.toFixed(1) + "¢</span>" : "") + "</div>" +
      '<div class="bact">' + chkCtl("balance:" + p.airline, p.airline + " balance") + "</div></div>";
  }).join("");
  $("valSrc").innerHTML = V.source ? "Point values: " + (V.url ? '<a href="' + esc(V.url) + '">' + esc(V.source) + "</a>" : esc(V.source)) + (V.checked ? " (checked " + esc(V.checked) + ")" : "") + ". A rough guide; what a point is worth depends on the flight." : "";
  const tr = H.tracking; $("track").innerHTML = "Tracker version " + tr.version + ": " + esc(tr.airlines.join(", ")) + "." + (tr.needScan.length ? ' <span class="pill warn">Full email scan needed for ' + esc(tr.needScan.join(", ")) + "</span>" : " Email scanned for each (first pass, " + esc(tr.scanDate) + ").") + " History: a dated snapshot is saved after every live check.";
}
// Links to older pages come only from page data (a list of {text, url}), never from this file
function renderOldLinks() {
  const L = (H.oldLinks || []).filter(l => l && l.url && /^https?:\/\//.test(l.url)), el = $("oldLinks"); if (!el) return;
  el.innerHTML = L.length ? "Older pages: " + L.map(l => '<a href="' + esc(l.url) + '" rel="noopener">' + esc(l.text || l.url) + "</a>").join(L.length == 2 ? " and " : ", ") + "." : "";
}
function safe(f) { try { f(); } catch (e) { console.error("home: " + f.name + " failed", e); } }
function renderAll() { [renderPills, needs, renderTrips, renderTiles, renderTimeline, renderCredits, renderBalances, renderOldLinks].forEach(safe); }

function refocus(sel) { const el = document.querySelector(sel); if (el) el.focus({preventScroll: true}); }
function flash(el) { if (!el) return; el.classList.remove("hl"); void el.offsetWidth; el.classList.add("hl"); setTimeout(() => el.classList.remove("hl"), 1700); }
document.addEventListener("click", e => {
  const t = e.target;
  const lk = t.closest("[data-like]"); if (lk) { e.preventDefault(); Store.set("like", lk.dataset.like, !Store.has("like", lk.dataset.like)); return; }
  const hd = t.closest("[data-hide]"); if (hd) { e.preventDefault(); Store.set("hide", hd.dataset.hide, !Store.has("hide", hd.dataset.hide)); return; }
  const ph = t.closest("[data-href]"); if (ph && ph.dataset.href) { e.preventDefault(); location.href = ph.dataset.href; return; }
  if (t.closest("#tripHidT")) { showHidTrips = !showHidTrips; renderTrips(); return; }
  const ap = t.closest(".apill"); if (ap) { Tip.show(ap, ap.dataset.tiph); return; }  // tap on a phone shows the breakdown; hover does it with a mouse
  const go = t.closest("[data-go]"); if (go) { const el = $("cr-" + go.dataset.go.split(" ")[0]); if (el) { el.scrollIntoView({block: "center", behavior: "smooth"}); flash(el); } return; }
  const cp = t.closest("[data-copy]"); if (cp) { copyCode(cp.dataset.copy, cp); return; }
  const cd = t.closest("[data-code],[data-codere]"); if (cd) {
    const k = cd.dataset.code || cd.dataset.codere;
    const foc = document.activeElement === cd, back = () => { if (foc) refocus('[data-code="' + CSS.escape(k) + '"]'); };
    if (cd.dataset.code && shownCode.has(k)) { shownCode.delete(k); renderCredits(); back(); return; }
    shownCode.add(k); renderCredits(); back(); if (!CODES) loadCodes().then(() => { renderCredits(); back(); }); return;
  }
  const ck = t.closest("[data-chk]"); if (ck) { const foc = document.activeElement === ck, it = ck.dataset.chk; Requests.toggle(it, ck.dataset.lab); safe(renderCredits); safe(renderBalances); if (foc) refocus('[data-chk="' + CSS.escape(it) + '"]'); return; }
  if (!t.closest(".apill,[data-tiph]")) Tip.hide();
  const row = t.closest("[data-crow]"); if (row && !t.closest("a,button,.cbox") && !String(getSelection() || "")) { const k = row.dataset.crow; openC.has(k) ? openC.delete(k) : openC.add(k); renderCredits(); return; }
});
let rsz; window.addEventListener("resize", () => { clearTimeout(rsz); rsz = setTimeout(() => { if ($("xt").clientWidth != tlW) safe(renderTimeline); }, 120); });  // a phone toolbar hiding changes only the height
document.addEventListener("visibilitychange", () => { if (document.visibilityState == "visible" && dayStart() - today) { today = dayStart(); renderAll(); } });
Store.onchange = renderAll;
Requests.onpaint = () => {};
Requests.paint();
renderAll();
(async () => { await Store.load("home"); await Requests.load(); renderAll(); })();
