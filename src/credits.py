# Claude · 2026-11-22 · Session 8e680ddd-6b26-44d7-8b07-e667fe163a25 · flights portal: credits history, notes snapshot, booking '?' flags
"""Credits history for the flights portal.

  python3 credits.py record           after a credits check: appends one ledger row per balance and credit from
                                      data/credits/wallet.json, updates data/credits/tracking.json, and drops a dated
                                      snapshot into the notes inbox folder (config notes_inbox), when one is set
  python3 credits.py flags [--since ISO]
                                      reads email through the email archive command (config email_archive_cmd, read
                                      only) for airline booking emails sent after each airline's last live check; writes
                                      data/credits/flags.json. A booking on an airline where you hold credit marks that
                                      airline's credits '?' (maybe used)
  python3 credits.py status           prints what is tracked and which airlines still need a full email scan
  python3 credits.py add-airline NAME bumps the tracker version and adds NAME with no email scan yet
  python3 credits.py requests         lists live-check and re-run requests submitted on the portal
  python3 credits.py done ID RESULT   marks one request done (after doing it)

Why the history: the ledger and snapshots show what the credits were at each check, and the tracker version shows
when an airline was added, so a newly tracked airline is known to still need a scan of all past email.
The booking scan runs only during checks; there is no timer.
No confirmation numbers, PINs or account numbers are written anywhere by this script.
Settings (config.local.json, all optional): notes_inbox, email_archive_cmd, email_archive_db, box, box_port.
"""
import datetime as dt, json, os, re, subprocess, sys, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import portal_config

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRED = os.path.join(os.path.abspath(os.environ.get('FLIGHTS_DATA') or os.path.join(ROOT, 'data')), 'credits')
WALLET, LEDGER, TRACK, FLAGS = (os.path.join(CRED, f) for f in ('wallet.json', 'ledger.jsonl', 'tracking.json', 'flags.json'))
NOTES_INBOX = portal_config.user_path('notes_inbox')   # dated snapshots go here; unset = no snapshots
PT = dt.timezone(dt.timedelta(hours=-8), 'PT')   # November to March; good enough for labels
BOOKING = {   # airline -> (sender pattern, subject pattern) for booking or receipt emails
    'United':    (r'united\.com', r'booking confirmation|eTicket Itinerary and Receipt'),
    'Southwest': (r'ifly\.southwest|southwestairlines@ifly', r"^You.re going to|Your trip is booked|confirmation"),
    'American':  (r'aa\.com', r'Your trip confirmation|trip confirmation'),
    'Delta':     (r'delta\.com', r'Flight Receipt|eTicket|Trip Confirmation|Your .* Trip Details'),
    'Alaska':    (r'alaskaair', r'confirmation|receipt'),
}

def load(p, default):
    return json.load(open(p)) if os.path.exists(p) else default

def save(p, obj):
    tmp = p + '.tmp'
    json.dump(obj, open(tmp, 'w'), indent=1)
    os.replace(tmp, p)

def credit_key(c):
    base = '-'.join([c['airline'], c['what'], c.get('useBy') or 'none', str(c.get('amount') if c.get('amount') is not None else c.get('original') or c.get('miles') or '')])
    return re.sub(r'[^a-z0-9]+', '-', base.lower()).strip('-')

def parse_asof(s):
    m = re.search(r'([A-Z][a-z]{2}) (\d{1,2}), (\d{4}), (\d{1,2}):(\d{2})(am|pm)', s)
    if not m: return dt.datetime.now(PT)
    mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].index(m[1]) + 1
    h = int(m[4]) % 12 + (12 if m[6] == 'pm' else 0)
    return dt.datetime(int(m[3]), mon, int(m[2]), h, int(m[5]), tzinfo=PT)

def cmd_record():
    w = load(WALLET, None)
    if not w: sys.exit('no data/credits/wallet.json')
    track = load(TRACK, None)
    if not track: sys.exit('no data/credits/tracking.json')
    when = parse_asof(w['asof']).isoformat()
    ver = track['tracker_version']
    rows, keys = [], set()
    for p in w['programs']:
        src = p.get('creditsSource', 'live')
        rows.append(dict(kind='balance', checked_at=when, tracker_version=ver, airline=p['airline'], program=p['program'], unit=p['unit'], balance=p['balance'], balance_as_of=p['balanceAsOf'], source='live'))
        mine = [c for c in w['credits'] if c['airline'] == p['airline']]
        if p.get('creditsStatus') == 'unchecked':
            rows.append(dict(kind='credits_unchecked', checked_at=when, tracker_version=ver, airline=p['airline'], note=p.get('creditsNote', '')))
        elif not mine:
            rows.append(dict(kind='no_credits', checked_at=when, tracker_version=ver, airline=p['airline'], source=src))
        for c in mine:
            k = credit_key(c)
            while k in keys: k += '-b'
            keys.add(k)
            rows.append(dict(kind='credit', checked_at=when, tracker_version=ver, airline=c['airline'], key=k, what=c['what'], amount=c.get('amount'), original=c.get('original'), miles=c.get('miles'), use_by=c.get('useBy'), use_by_label=c.get('useByLabel'), came_from=c.get('from'), note=c.get('note'), source=src))
        a = track['airlines'].setdefault(p['airline'], dict(tracked_since=when[:10], email_backfill=None))
        if p.get('creditsStatus') != 'unchecked':
            a['last_live_check'] = when
    with open(LEDGER, 'a') as f:
        for r in rows: f.write(json.dumps(r) + '\n')
    track['last_record'] = when
    save(TRACK, track)
    snap = write_snapshot(w, track, when)
    print(f'ledger: +{len(rows)} rows at {when}; snapshot: {snap}')

def write_snapshot(w, track, when):
    t = dt.datetime.fromisoformat(when)
    name = f"Airline credits snapshot {t:%Y-%m-%d %H%M} PT.md"
    lines = [f"# Airline credits snapshot, {t:%a %b %d %Y}, {t:%I:%M%p}".replace(' 0', ' ').replace('AM', 'am').replace('PM', 'pm') + ' PT', '',
             'Kept by the flights portal so your notes keep the history of your airline balances and travel credits. '
             'Each live check adds one snapshot; the newest one is the current state.', '',
             f"Tracker version {track['tracker_version']}. Airlines tracked: {', '.join(sorted(track['airlines']))}.", '',
             '| Airline | Program | Balance | Credits checked |', '|---|---|---|---|']
    for p in w['programs']:
        lines.append(f"| {p['airline']} | {p['program']} | {p['balance']:,} {p['unit']} | {'not checked' if p.get('creditsStatus') == 'unchecked' else p.get('balanceAsOf', '')} |")
    lines += ['', '| Airline | Credit | Amount | Use by | Where it came from |', '|---|---|---|---|---|']
    for c in sorted(w['credits'], key=lambda c: c.get('useBy') or '9999'):
        amt = f"${c['amount']:,.2f}" if c.get('amount') is not None else (f"{c['miles']:,} miles off an award" if c.get('miles') else f"up to ${c.get('original', 0):,.2f} (usable amount at checkout)")
        lines.append(f"| {c['airline']} | {c['what']} | {amt} | {c.get('useByLabel', 'Use by') + ' ' + c['useBy'] if c.get('useBy') else 'No end date'} | {c.get('from', '')} |")
    none = [p['airline'] for p in w['programs'] if p.get('creditsStatus') != 'unchecked' and not any(c['airline'] == p['airline'] for c in w['credits'])]
    if none: lines += ['', f"No credits at: {', '.join(none)}."]
    lines += ['', 'Confirmation numbers, PINs and account numbers are deliberately left out.', '', '---', f"_Claude flights portal · {t:%Y-%m-%d} · source: data/credits/ledger.jsonl_"]
    if not NOTES_INBOX:
        return 'no notes_inbox in config.local.json; snapshot not written'
    if not os.path.isdir(NOTES_INBOX):
        return f'notes inbox folder not found at {NOTES_INBOX}; snapshot not written'
    path = os.path.join(NOTES_INBOX, name)
    open(path, 'w').write('\n'.join(lines) + '\n')
    return path

def email_archive(sql):
    """One read-only SQL query through the configured email archive command (stdin: JSON request, stdout: {rows})."""
    cmd = portal_config.get('email_archive_cmd')
    if not cmd: raise SystemExit('The email check is off: set email_archive_cmd (and email_archive_db) in config.local.json')
    req = {'op': 'sql', 'db': portal_config.get('email_archive_db', 'mail.db'), 'table': 'emails_fts', 'sql': sql}
    p = subprocess.run(cmd if isinstance(cmd, list) else [cmd], input=json.dumps(req), capture_output=True, text=True, timeout=110)
    if p.returncode != 0: raise SystemExit(f'Email archive query failed: {p.stderr.strip()[:300]}')
    return json.loads(p.stdout)

def cmd_flags(since_override=None):
    w, track = load(WALLET, {}), load(TRACK, {})
    open_by_airline = {}
    for c in w.get('credits', []):
        open_by_airline.setdefault(c['airline'], []).append(credit_key(c))
    since = {a: (since_override or track['airlines'].get(a, {}).get('last_live_check')) for a in open_by_airline}
    if not since or not all(since.values()): sys.exit(f'missing last_live_check for: {[a for a, s in since.items() if not s]}')
    earliest = min(int(dt.datetime.fromisoformat(s).timestamp()) for s in since.values())
    r = email_archive("SELECT e.date, e.from_addr, e.subject FROM emails e JOIN emails_fts f ON f.rowid=e.rowid WHERE emails_fts MATCH "
              "'\"booking confirmation\" OR \"eticket itinerary\" OR \"going to\" OR \"trip confirmation\" OR \"flight receipt\" OR \"trip details\" OR \"trip is booked\"' "
              f"AND e.date > {earliest} ORDER BY e.date")
    flags = {}
    for row in r.get('rows', []):
        for airline, (frm, subj) in BOOKING.items():
            if airline not in open_by_airline: continue
            if not (re.search(frm, row['from_addr'] or '', re.I) and re.search(subj, row['subject'] or '', re.I)): continue
            if row['date'] <= int(dt.datetime.fromisoformat(since[airline]).timestamp()): continue
            day = dt.datetime.fromtimestamp(row['date'], PT)
            for k in open_by_airline[airline]:
                flags[k] = dict(airline=airline, email_date=day.isoformat(), reason=f"{airline} booking email on {day:%b %d}".replace(' 0', ' ') + '; a credit may have been used. Check it live to confirm.')
    out = dict(computed_at=dt.datetime.now(PT).isoformat(), since=since, flags=flags)
    save(FLAGS, out)
    print(f"flags: {len(flags)} credits marked '?'" + (f" ({', '.join(sorted({v['airline'] for v in flags.values()}))})" if flags else '') + f"; booking emails since last checks scanned: {len(r.get('rows', []))}")

def cmd_status():
    track = load(TRACK, {})
    print(f"tracker version {track.get('tracker_version')}; last record {track.get('last_record')}")
    for a, v in sorted(track.get('airlines', {}).items()):
        bf = v.get('email_backfill')
        print(f"  {a:10} since {v.get('tracked_since')}  last live check {v.get('last_live_check', 'never')}  email scan: {bf['scope'] + ' (' + bf['done'] + ')' if bf else 'NEEDED: scan all past email for this airline'}")

def cmd_add(name):
    track = load(TRACK, {})
    if name in track['airlines']: sys.exit(f'{name} is already tracked')
    track['tracker_version'] += 1
    today = dt.datetime.now(PT).date().isoformat()
    track['airlines'][name] = dict(tracked_since=today, email_backfill=None)
    track.setdefault('changes', []).append(dict(version=track['tracker_version'], date=today, what=f'Started tracking {name}; full email scan needed'))
    save(TRACK, track)
    print(f'added {name}; tracker version {track["tracker_version"]}; run a full email scan for it before trusting its credits')

def portal(method, path, body=None):
    """Calls the portal service: over ssh on the server (config box) when set, otherwise on this machine."""
    port = int(portal_config.get('box_port', 8873)); box = portal_config.get('box')
    if not box:
        req = urllib.request.Request(f'http://127.0.0.1:{port}{path}', method=method, data=json.dumps(body).encode() if body is not None else None,
                                     headers={'Content-Type': 'application/json', 'X-Flights': '1'})
        try:
            with urllib.request.urlopen(req, timeout=60) as r: return json.loads(r.read())
        except OSError as e: raise SystemExit(f'portal call failed: {e}')
    cmd = f"curl -s -X {method} -H 'Content-Type: application/json' -H 'X-Flights: 1' http://127.0.0.1:{port}{path}" + (" --data-binary @-" if body is not None else "")
    p = subprocess.run(['ssh', box, cmd], input=json.dumps(body) if body is not None else None, capture_output=True, text=True, timeout=60)
    if p.returncode != 0: raise SystemExit(f'portal call failed: {p.stderr.strip()[:300]}')
    return json.loads(p.stdout)

def cmd_requests():
    for c in portal('GET', '/flights/api/checks').get('checks', []):
        if c['status'] == 'requested': print(f"{c['id']}  {', '.join(c['items'])}  ({c.get('note', '')})")

def cmd_done(rid, result):
    print(json.dumps(portal('POST', '/flights/api/checks/done', {'id': rid, 'result': result})))

if __name__ == '__main__':
    a = sys.argv[1:]
    if not a: sys.exit(__doc__)
    if a[0] == 'record': cmd_record()
    elif a[0] == 'flags': cmd_flags(a[a.index('--since') + 1] if '--since' in a else None)
    elif a[0] == 'status': cmd_status()
    elif a[0] == 'add-airline' and len(a) > 1: cmd_add(' '.join(a[1:]))
    elif a[0] == 'requests': cmd_requests()
    elif a[0] == 'done' and len(a) > 2: cmd_done(a[1], ' '.join(a[2:]))
    else: sys.exit(__doc__)
