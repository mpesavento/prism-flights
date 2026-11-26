// Claude · 2026-11-22, updated 2026-11-23 · Session 8e680ddd · flights portal shared script (inlined into every page by build_portal.py)
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const tm = m => { m = ((m % 1440) + 1440) % 1440; let h = Math.floor(m / 60), mi = m % 60, ap = h >= 12 ? "pm" : "am"; h = h % 12 || 12; return h + ":" + String(mi).padStart(2, "0") + ap; };
const du = m => m < 60 ? m + "m" : Math.floor(m / 60) + "h" + (m % 60 ? " " + String(m % 60).padStart(2, "0") + "m" : "");
const kfmt = n => n == null ? "" : (n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0).replace(/\.0$/, "") + "k" : String(n));
const money = (n, cents) => n == null ? "" : "$" + Number(n).toLocaleString("en-US", cents ? {minimumFractionDigits: 2, maximumFractionDigits: 2} : {maximumFractionDigits: 0});
const API = location.protocol.startsWith("http") && location.pathname.startsWith("/flights") ? "/flights/api" : null;
const ICON = {
  star: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.9l-5.4 2.8 1-6.1L3.2 9.3l6.1-.9z"/></svg>',
  starO: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.9l-5.4 2.8 1-6.1L3.2 9.3l6.1-.9z"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A9.7 9.7 0 0 1 12 5c5 0 8.5 4.5 9.5 7a13 13 0 0 1-2.6 3.8M6.2 6.3C4.4 7.6 3.1 9.5 2.5 12c1 2.5 4.5 7 9.5 7 1.7 0 3.2-.5 4.5-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
};
function likeHide(id, liked, hidden) {
  return '<span class="lh"><button class="star' + (liked ? " on" : "") + '" data-like="' + esc(id) + '" aria-pressed="' + liked + '" aria-label="' + (liked ? "Unlike" : "Like") + '">' + (liked ? ICON.star : ICON.starO) + '</button>' +
    '<button class="hide' + (hidden ? " on" : "") + '" data-hide="' + esc(id) + '" aria-pressed="' + hidden + '" aria-label="' + (hidden ? "Unhide" : "Hide") + '">' + ICON.eyeOff + '</button></span>';
}
function logoTile(al, sm) {
  const a = String(al || "").split("/").filter(x => LOGOS.has(x));
  if (!a.length) return '<div class="tile' + (sm ? " sm" : "") + '"></div>';
  return '<div class="tile ' + (a.length > 1 ? "two" : "one") + (sm ? " sm" : "") + '" title="' + esc(al.replace("/", " and ")) + '">' + a.slice(0, 2).map(x => '<span class="li L-' + x + '" role="img" aria-label="' + esc(x) + '"></span>').join("") + "</div>";
}
// Likes and hides: saved through the portal service (all devices), cached in localStorage
const Store = {
  page: null, rev: 0, remote: false, v: {like: {}, hide: {}}, pending: {}, onchange: null,
  lsKey() { return "flights-marks-" + this.page; },
  lsSave() { try { localStorage.setItem(this.lsKey(), JSON.stringify(this.v)); } catch (e) {} },
  async load(page) {
    this.page = page;
    try { const l = JSON.parse(localStorage.getItem(this.lsKey()) || "null"); if (l) this.v = {like: l.like || {}, hide: l.hide || {}}; } catch (e) {}
    if (!API) { this.status("Saved on this device only"); return; }
    try {
      const r = await fetch(API + "/state/" + page, {cache: "no-store"}); if (!r.ok) throw 0;
      const d = await r.json(); this.rev = d.revision || 0;
      if (d.value) this.v = {like: d.value.like || {}, hide: d.value.hide || {}};
      this.remote = true; this.lsSave(); this.status("Likes and hides save across your devices");
    } catch (e) { this.status("Saved on this device only (portal not reachable)"); }
  },
  status(t) { const s = $("save"); if (s) s.textContent = t; },
  has(kind, id) { return !!this.v[kind][id]; },
  chain: Promise.resolve(),
  set(kind, id, on) {
    if (on) this.v[kind][id] = true; else delete this.v[kind][id];
    this.pending[kind + ":" + id] = on; this.lsSave(); if (this.onchange) this.onchange(kind, id);
    if (this.remote) this.chain = this.chain.then(() => this.push());
    return this.chain;
  },
  async push() {
    if (!Object.keys(this.pending).length) return;
    for (let i = 0; i < 4; i++) {
      const sent = Object.assign({}, this.pending);
      const r = await fetch(API + "/state/" + this.page, {method: "POST", headers: {"Content-Type": "application/json", "X-Flights": "1"}, body: JSON.stringify({value: this.v, revision: this.rev})}).catch(() => null);
      if (r && r.ok) { this.rev = (await r.json()).revision; for (const k in sent) if (this.pending[k] === sent[k]) delete this.pending[k]; this.status("Saved across your devices"); return; }
      if (r && r.status == 409) {
        const cur = await r.json(); this.rev = cur.revision || 0; const v = cur.value || {like: {}, hide: {}};
        const nv = {like: Object.assign({}, v.like || {}), hide: Object.assign({}, v.hide || {})};
        for (const key in this.pending) { const [k, i2] = key.split(":"); if (this.pending[key]) nv[k][i2] = true; else delete nv[k][i2]; }
        this.v = nv; this.lsSave(); continue;
      }
      break;
    }
    this.status("Saved on this device only (sync failed)");
  }
};
// Requests (live credit checks, search re-runs): drafts until Submit, then one record through the service
const Requests = {
  drafts: (() => { try { return JSON.parse(localStorage.getItem("flights-drafts") || "[]"); } catch (e) { return []; } })(), list: [],
  keep() { try { localStorage.setItem("flights-drafts", JSON.stringify(this.drafts)); } catch (e) {} },
  async load() { if (!API) return; try { const r = await fetch(API + "/checks", {cache: "no-store"}); if (r.ok) this.list = (await r.json()).checks || []; } catch (e) {} },
  pendingFor(item) { return this.list.filter(c => c.status == "requested" && c.items.includes(item)).slice(-1)[0]; },
  toggle(item, label) { const i = this.drafts.findIndex(d => d.item == item); if (i >= 0) this.drafts.splice(i, 1); else this.drafts.push({item, label}); this.keep(); this.paint(); },
  has(item) { return this.drafts.some(d => d.item == item); },
  paint() {
    const bar = $("draftbar"); if (!bar) return;
    bar.classList.toggle("open", this.drafts.length > 0);
    $("draftText").textContent = this.drafts.length + (this.drafts.length == 1 ? " request" : " requests") + " ready: " + this.drafts.map(d => d.label).join(", ") + ". Nothing is sent until you press Submit.";
    if (this.onpaint) this.onpaint();
  },
  async submit() {
    const items = this.drafts.map(d => d.item), labels = this.drafts.map(d => d.label).join(", ");
    if (!items.length) return;
    if (!API) { this.fallback(labels); return; }
    const r = await fetch(API + "/checks", {method: "POST", headers: {"Content-Type": "application/json", "X-Flights": "1"}, body: JSON.stringify({items, note: labels})}).catch(() => null);
    if (!r || !r.ok) { this.fallback(labels); return; }
    this.list.push(await r.json()); this.drafts = []; this.keep(); this.paint();
    $("draftText").textContent = ""; toast("Sent. Claude does these at the next credits check or flight search; ask in chat to do it now.");
  },
  fallback(labels) { toast("Could not send from this device. Ask Claude in chat: " + labels); }
};
function toast(t) { let el = $("toast"); if (!el) { el = document.createElement("div"); el.id = "toast"; el.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:84px;z-index:60;background:var(--ink);color:var(--bg);padding:10px 16px;border-radius:12px;max-width:min(92vw,520px);font-size:14px;box-shadow:var(--shadow)"; document.body.appendChild(el); } el.textContent = t; el.style.display = "block"; clearTimeout(el._t); el._t = setTimeout(() => el.style.display = "none", 6000); }
// Sheets: bottom sheet on a phone, popover under the chip on a wider screen
const Sheet = {
  open: null,
  show(id, anchor) {
    this.hide(); const s = $(id); if (!s) return; this.open = id;
    s.classList.add("open"); $("scrim").classList.add("open");
    if (window.innerWidth >= 700 && anchor) {
      // never scroll the page to make room: open below the chip, or above it when there is more room there
      const r = anchor.getBoundingClientRect(), w = 380, below = window.innerHeight - r.bottom - 18, above = r.top - 18;
      s.style.left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left)) + "px"; s.style.right = "auto";
      if (below >= 320 || below >= above) { s.style.top = (r.bottom + 6) + "px"; s.style.bottom = "auto"; s.style.maxHeight = Math.max(200, below) + "px"; }
      else { s.style.top = "auto"; s.style.bottom = (window.innerHeight - r.top + 6) + "px"; s.style.maxHeight = Math.max(200, above) + "px"; }
    } else { s.style.left = s.style.top = s.style.right = s.style.maxHeight = ""; s.style.bottom = ""; }
    const f = s.querySelector("input,button"); if (f && window.innerWidth >= 700) f.focus({preventScroll: true});
  },
  hide() { if (!this.open) return; const s = $(this.open); if (s) s.classList.remove("open"); $("scrim").classList.remove("open"); this.open = null; if (this.onhide) this.onhide(); }
};
document.addEventListener("keydown", e => { if (e.key == "Escape") Sheet.hide(); });
// Range slider (single max, or dual from-to)
function makeRange(host, o, onChange) {
  host.innerHTML = '<div class="sl"><div class="slh"><span class="ink2">' + esc(o.label) + '</span><b data-o></b></div><div class="rng"><div class="trk"></div><div class="fill" data-f></div>' +
    (o.dual ? '<input type="range" data-lo min="' + o.min + '" max="' + o.max + '" step="' + o.step + '" aria-label="' + esc(o.label) + ' from">' : "") +
    '<input type="range" data-hi min="' + o.min + '" max="' + o.max + '" step="' + o.step + '" aria-label="' + esc(o.label) + (o.dual ? " to" : "") + '"></div><div class="ends"><span>' + esc(o.fmt(o.min)) + "</span><span>" + esc(o.fmt(o.max)) + "</span></div></div>";
  const lo = host.querySelector("[data-lo]"), hi = host.querySelector("[data-hi]"), out = host.querySelector("[data-o]"), fill = host.querySelector("[data-f]");
  const api = {
    get() { const l = lo ? +lo.value : o.min, h = +hi.value; return {lo: l, hi: h, full: l <= o.min && h >= o.max, hiAny: h >= o.max}; },
    set(l, h) { if (lo) lo.value = l == null ? o.min : l; hi.value = h == null ? o.max : h; paint(); },
    paint
  };
  function paint() {
    const v = api.get(), w = o.max - o.min;
    fill.style.left = ((v.lo - o.min) / w * 100) + "%"; fill.style.width = ((v.hi - v.lo) / w * 100) + "%";
    out.textContent = o.dual ? (v.full ? o.any : o.fmt(v.lo) + " to " + o.fmt(v.hi)) : (v.hiAny ? o.any : "up to " + o.fmt(v.hi));
    out.style.color = (o.dual ? v.full : v.hiAny) ? "var(--muted)" : "";
  }
  const on = e => { if (lo && +lo.value > +hi.value) { if (e.target === lo) lo.value = hi.value; else hi.value = lo.value; } if (lo) lo.style.zIndex = +lo.value >= o.max - o.step ? 3 : 1; paint(); onChange(); };
  hi.addEventListener("input", on); if (lo) lo.addEventListener("input", on);
  api.set(o.value ? o.value[0] : null, o.value ? o.value[1] : null);
  return api;
}
// Tooltip / small popover: hover with a mouse, tap on a phone; fixed position so a scrolling box never clips it
const Tip = {
  el() { let t = $("tip"); if (!t) { t = document.createElement("div"); t.id = "tip"; t.setAttribute("role", "tooltip"); document.body.appendChild(t); } return t; },
  show(anchor, html) { const t = this.el(); t.innerHTML = html; t.style.display = "block"; const b = anchor.getBoundingClientRect(), w = t.offsetWidth, h = t.offsetHeight; t.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, b.left + b.width / 2 - w / 2)) + "px"; t.style.top = (b.top - h - 8 < 8 ? b.bottom + 8 : b.top - h - 8) + "px"; },
  hide() { const t = $("tip"); if (t) t.style.display = "none"; }
};
document.addEventListener("mouseover", e => { const q = e.target.closest && e.target.closest("[data-tip],[data-tiph]"); if (q) Tip.show(q, q.dataset.tiph != null ? q.dataset.tiph : esc(q.dataset.tip)); });
document.addEventListener("mouseout", e => { if (e.target.closest && e.target.closest("[data-tip],[data-tiph]")) Tip.hide(); });
document.addEventListener("focusin", e => { const q = e.target.closest && e.target.closest("[data-tip],[data-tiph]"); if (q) Tip.show(q, q.dataset.tiph != null ? q.dataset.tiph : esc(q.dataset.tip)); });
document.addEventListener("focusout", e => { if (e.target.closest && e.target.closest("[data-tip],[data-tiph]")) Tip.hide(); });
window.addEventListener("scroll", () => Tip.hide(), {passive: true});
// Airline pills: logo, points, confirmed credit; a red line when credit expires within 6 months; hover or tap for the breakdown
const PILL_AL = [["Southwest", "sw", "pts"], ["Delta", "dl", "mi"], ["American", "aa", "mi"], ["United", "ua", "mi"], ["Alaska", "as", "pts"]];
function monthsLeft(iso) { const d = (new Date(iso + "T12:00:00") - new Date()) / 864e5; return d < 45 ? Math.max(0, Math.round(d)) + " days" : Math.round(d / 30.4) + "mo"; }
// progs (optional): [[name, key, unit]] for every program in the wallet; ones not in PILL_AL (Chase, other banks) are added after the airlines
function airlinePills(balances, cv, values, only, progs) {
  const V = (values || {}).cents || {}, src = (values || {}).source || "";
  const AL = PILL_AL.concat((progs || []).filter(([a]) => !PILL_AL.some(([b]) => b == a)));
  return '<div class="pills">' + AL.filter(([a]) => !only || only.includes(a)).map(([a, p, u]) => {
    const b = (balances || {})[p], c = (cv || {})[a]; if (b == null && !c) return "";
    const worth = b != null && V[p] ? b * V[p] / 100 : null;
    let tip = "<b>" + esc(a) + "</b>" + (b != null ? "<div>" + b.toLocaleString() + " " + u + (worth ? ' <span class="eqc">(~' + money(worth) + " at " + V[p] + "¢)</span>" : "") + "</div>" : "");
    if (c && c.items && c.items.length) tip += c.items.map(i => "<div>" + (i.amount != null ? money(i.amount, true) : i.original != null ? "up to " + money(i.original, true) : i.miles ? kfmt(i.miles) + " miles off" : "") + " " + esc(i.what) + (i.useBy ? ' · <span class="' + (i.days <= 183 ? "badt" : "") + '">' + esc((i.label || "").toLowerCase() || "use by") + " " + new Date(i.useBy + "T12:00:00").toLocaleDateString("en-US", {month: "short", day: "numeric", year: "numeric"}) + " (" + monthsLeft(i.useBy) + ")</span>" : "") + (i.flagged ? " · may be used (check)" : "") + "</div>").join("");
    if (src && worth) tip += '<div class="mu2">Point values: ' + esc(src) + "</div>";
    return '<button class="apill" data-tiph="' + esc(tip) + '">' + logoTile(a, 1) + '<span class="apt"><b>' + (b != null ? kfmt(b) + " " + u : "") + "</b>" + (c && c.sure ? '<span class="apc">' + money(c.sure) + " credit</span>" : "") + (c && c.soon ? '<span class="aps">' + money(c.soon) + " expires in " + monthsLeft(c.soonDate) + "</span>" : "") + "</span></button>";
  }).join("") + "</div>";
}
