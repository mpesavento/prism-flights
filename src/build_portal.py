# Claude · 2026-11-22 · Session 8e680ddd-6b26-44d7-8b07-e667fe163a25 · flights portal page builder
"""Builds the portal's self-contained pages from data/ into site/:
  site/index.html            /flights home (trips, credits with '?' flags, balances)
  site/<slug>/index.html     /flights/<slug>/ one saved search (data/searches/<slug>/trip.json + page-rows.json)
Usage: python3 src/build_portal.py   (from anywhere; data/ and site/ next to src/ unless set)
  FLIGHTS_DATA=examples FLIGHTS_SITE=sample-site python3 src/build_portal.py   builds the made-up sample instead
Settings: FLIGHTS_DATA (data folder), FLIGHTS_SITE (output folder); relative paths are from the current folder.
Old trip folders in the output (named like a trip, YY-MM-DD-name) that no longer have data are removed.
Links for the bottom of the home page come from config.local.json (old_links).
"""
import urllib.parse, shutil
import datetime as dt, glob, html, json, os, re, sys
SRC = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(SRC)
sys.path.insert(0, SRC)
from credits import credit_key
import portal_config
UI = os.path.join(SRC, 'ui')
SITE = os.path.abspath(os.environ.get('FLIGHTS_SITE') or os.path.join(ROOT, 'site'))
DATA = os.path.abspath(os.environ.get('FLIGHTS_DATA') or os.path.join(ROOT, 'data'))
TRIP_DIR = re.compile(r'^\d{2}-\d{2}-\d{2}-[a-z0-9-]+$')   # a built trip folder; nothing else is ever removed
rd = lambda p: open(p).read()
load = lambda p, d=None: json.load(open(p)) if os.path.exists(p) else d
LOGOS = load(os.path.join(SRC, 'logos.json'), {})   # optional airline logo images (name -> image URL)
# Without logos.json, logos load from Google's hosted airline logo images (the ones Google Flights uses) and bank favicons;
# set "hosted_logos": false in config.local.json to keep pages free of outside requests (they then show short codes).
IATA = {'Southwest': 'WN', 'Delta': 'DL', 'American': 'AA', 'United': 'UA', 'Alaska': 'AS', 'Hawaiian': 'HA', 'JetBlue': 'B6', 'Frontier': 'F9',
        'Spirit': 'NK', 'Sun Country': 'SY', 'Allegiant': 'G4', 'Breeze': 'MX', 'Air Canada': 'AC', 'WestJet': 'WS', 'Aeromexico': 'AM',
        'Korean Air': 'KE', 'Asiana Airlines': 'OZ', 'ANA': 'NH', 'JAL': 'JL', 'Japan Airlines': 'JL', 'Singapore Airlines': 'SQ', 'Cathay Pacific': 'CX',
        'EVA Air': 'BR', 'China Airlines': 'CI', 'Starlux Airlines': 'JX', 'Philippine Airlines': 'PR', 'Vietnam Airlines': 'VN', 'VietJet Air': 'VJ',
        'Thai Airways': 'TG', 'China Southern Airlines': 'CZ', 'China Eastern Airlines': 'MU', 'Air China': 'CA', 'Qantas': 'QF', 'Air New Zealand': 'NZ',
        'Emirates': 'EK', 'Etihad Airways': 'EY', 'Qatar Airways': 'QR', 'Turkish Airlines': 'TK', 'Lufthansa': 'LH', 'British Airways': 'BA',
        'Air France': 'AF', 'KLM': 'KL', 'Iberia': 'IB', 'Aer Lingus': 'EI', 'Virgin Atlantic': 'VS', 'TAP Air Portugal': 'TP', 'Aegean Airlines': 'A3'}
BANKS = {'Chase': 'chase.com', 'Amex': 'americanexpress.com', 'Citi': 'citi.com', 'Capital One': 'capitalone.com', 'Bilt': 'biltrewards.com'}
if not LOGOS and portal_config.get('hosted_logos', True):
    LOGOS = {**{n: f'https://www.gstatic.com/flights/airline_logos/70px/{c}.png' for n, c in IATA.items()},
             **{n: f'https://www.google.com/s2/favicons?domain={d}&sz=64' for n, d in BANKS.items()}}
CSS, COMMON = rd(os.path.join(UI, 'base.css')), rd(os.path.join(UI, 'common.js'))
LOGOCSS = ''.join('.L-%s{background-image:url("%s")}\n' % (re.sub(r'[^A-Za-z0-9]', '', k), v) for k, v in LOGOS.items())   # class names: letters and digits only
CITY = {"ATL": "Atlanta", "AUS": "Austin", "BNA": "Nashville", "CLT": "Charlotte", "DAL": "Dallas Love Field", "DEN": "Denver", "DFW": "Dallas Fort Worth", "EWR": "Newark", "HOU": "Houston Hobby", "IAD": "Washington Dulles", "IAH": "Houston Bush", "LAS": "Las Vegas", "LAX": "Los Angeles", "MDW": "Chicago Midway", "MSP": "Minneapolis", "ORD": "Chicago O'Hare", "PHX": "Phoenix", "SAN": "San Diego", "SEA": "Seattle", "SFO": "San Francisco", "SLC": "Salt Lake City", "PDX": "Portland", "BWI": "Baltimore", "MCO": "Orlando", "JFK": "New York JFK", "LGA": "New York LaGuardia", "BOS": "Boston", "PHL": "Philadelphia", "DTW": "Detroit", "ONT": "Ontario", "BUR": "Burbank", "SNA": "Orange County", "SMF": "Sacramento", "LGB": "Long Beach", "STL": "St. Louis", "MCI": "Kansas City", "MSY": "New Orleans", "TPA": "Tampa", "RDU": "Raleigh-Durham", "PIT": "Pittsburgh", "CVG": "Cincinnati", "IND": "Indianapolis", "CMH": "Columbus", "SAT": "San Antonio", "ELP": "El Paso", "ABQ": "Albuquerque", "OKC": "Oklahoma City", "MEM": "Memphis", "BHM": "Birmingham", "JAX": "Jacksonville", "RSW": "Fort Myers", "SJU": "San Juan", "ORF": "Norfolk", "CLE": "Cleveland", "MKE": "Milwaukee", "OAK": "Oakland", "SJC": "San Jose"}
PROGS = {'dl': ([13], 'DL'), 'sw': ([14, 15], 'WN'), 'aa': ([16], 'AA'), 'ua': ([17], 'UA')}
BAL_KEY = {'Delta': 'dl', 'Southwest': 'sw', 'American': 'aa', 'United': 'ua', 'Alaska': 'as',
           'Chase': 'ur', 'Amex': 'mr', 'Citi': 'ty', 'Capital One': 'c1', 'Bilt': 'bilt'}
balkey = lambda name: BAL_KEY.get(name) or re.sub(r'[^a-z0-9]', '', name.lower())   # any other program in wallet.json gets a key from its name
# pills for every program in wallet.json: [name, key, short unit]; airlines first in the page's own order, then banks and others
pill_progs = lambda wallet: [[p['airline'], balkey(p['airline']), 'mi' if p.get('unit', '').startswith('mile') else 'pts'] for p in wallet['programs']]
DUR_DEFAULT = 11 * 60   # the trip page's default duration filter, in minutes; trip.json dur_default_hours changes it
COLS = ['id', 'day', 'dest', 'dep_min_origin_time', 'arr_min_dest_time_plus1440_next_day', 'duration_min', 'stops', 'via', 'layover_mins', 'airlines', 'flights', 'cash_lowest', 'cash_fare_source', 'delta_main_miles', 'sw_basic_pts', 'sw_choice_pts', 'aa_main_miles', 'ua_economy_miles', 'sw_cash_basic', 'sw_cash_choice', 'notes', 'similar_folded', 'ua_award_sold_out', 'legs', 'origin', 'fares[airline,class,tier,cash,points,program,award_tax,[[points,cash]],note]']
VALUES = json.load(open(os.path.join(SRC, 'point_values.json')))
ASSETS = os.path.join(SRC, 'assets')
LOGO_SVG = rd(os.path.join(ASSETS, 'logo.svg')).strip()
FAVICON = '<link rel="icon" href="data:image/svg+xml,' + urllib.parse.quote(LOGO_SVG) + '">'
HERO = rd(os.path.join(UI, 'header.html')).strip().replace('<!--__LOGO__-->', LOGO_SVG.replace('<svg ', '<svg class="logo" ', 1))  # header design lives in src/ui/header.html
opt = lambda name: rd(os.path.join(UI, name)) if os.path.exists(os.path.join(UI, name)) and not os.environ.get('FLIGHTS_NO_ASK') else ''  # FLIGHTS_NO_ASK=1 leaves the query box out
now = dt.datetime.now(dt.timezone(dt.timedelta(hours=-8)))
today = now.date()

def tm(m):
    m %= 1440; h, mi = divmod(m, 60); ap = 'pm' if h >= 12 else 'am'; h = h % 12 or 12
    return f'{h}:{mi:02d}{ap}'
def du(m): return f'{m}m' if m < 60 else f'{m // 60}h' + (f' {m % 60:02d}m' if m % 60 else '')
def kf(n): return (f'{n / 1000:.1f}'.rstrip('0').rstrip('.') + 'k') if n >= 1000 else str(n)

def weather_badges(trip_dir, dates):
    w = load(os.path.join(trip_dir, 'weather', 'nws.json'), {})
    out = {}
    for code, d in w.items():
        if not isinstance(d, dict) or 'periods' not in d: continue
        found = []
        for p in d['periods']:
            if p['start'][:10] not in dates or (p.get('pop') or 0) < 50: continue
            s = p['short'].lower()
            kind = 'snow' if 'snow' in s else 'storms' if 'thunder' in s else 'rain' if ('rain' in s or 'shower' in s) else 'fog' if 'fog' in s else None
            if not kind: continue
            night = 'night' in p['name'].lower()   # NWS names periods "Tonight", "Wednesday Night", "Thanksgiving Day"; label by weekday instead
            label = dt.date.fromisoformat(p['start'][:10]).strftime('%a') + (' night' if night else '')
            found.append((['fog', 'rain', 'storms', 'snow'].index(kind), f'{kind} {label}'))
        if found:
            worst = max(k for k, _ in found); kind = ['fog', 'rain', 'storms', 'snow'][worst]
            days = {}
            for k, f in found:
                if k != worst: continue
                w = f.split(' ', 1)[1]; days.setdefault(w.split()[0], set()).add('night' if 'night' in w else 'day')
            out[code] = kind + ' ' + ', '.join(d + (' day and night' if len(s) > 1 else ' night' if 'night' in s else '') for d, s in days.items())
    return out

def credit_view(wallet, flags):
    fl = (flags or {}).get('flags', {})
    by = {}
    for c in wallet['credits']:
        k = credit_key(c); a = by.setdefault(c['airline'], {'sure': 0.0, 'unsure': 0.0, 'next': None, 'soon': 0.0, 'soonDate': None, 'items': []})
        days = (dt.date.fromisoformat(c['useBy']) - today).days if c.get('useBy') else None
        a['items'].append({'key': k, 'what': c.get('what', ''), 'amount': c.get('amount'), 'original': c.get('original'), 'miles': c.get('miles'), 'useBy': c.get('useBy'), 'label': c.get('useByLabel') or '', 'days': days, 'flagged': k in fl})
        if c.get('amount') and days is not None and 0 <= days <= 183 and k not in fl:
            a['soon'] += c['amount']
            if not a['soonDate'] or c['useBy'] < a['soonDate']: a['soonDate'] = c['useBy']
        if c.get('amount') is not None and k not in fl:
            a['sure'] += c['amount']
            if c.get('useBy') and (not a['next'] or c['useBy'] < a['next']): a['next'] = c['useBy']   # credits with no end date (useBy null) never set it
        elif c.get('amount') is not None or c.get('original'):
            a['unsure'] += c.get('amount') or c.get('original') or 0
    for a in by.values():
        a['sure'] = round(a['sure'], 2); a['unsure'] = round(a['unsure'], 2); a['soon'] = round(a['soon'], 2)
        a['items'].sort(key=lambda i: i['useBy'] or '9999')
        if a['next']: a['next'] = dt.date.fromisoformat(a['next']).strftime('%b %-d, %Y')
    return by

def trip_data(tdir, wallet, flags):
    t = json.load(open(os.path.join(tdir, 'trip.json')))
    origins = t.get('origins') or {t['origin']: {'name': t.get('origin_name', ''), 'dir': '.'}}
    prim = t.get('primary_origin') or next(iter(origins))
    rows = []
    for code, o in origins.items():
        for r in json.load(open(os.path.join(tdir, o['dir'], 'page-rows.json'))):
            fares = r[24] if len(r) > 24 else []
            r = r + [[]] * (24 - len(r)) if len(r) < 24 else r[:24]
            if code != prim: r[0] = code.lower() + '-' + r[0]
            rows.append(r + [code, fares])
    dates = t['dates']
    dayd = {str(int(d[-2:])): d for d in dates}
    days = {k: dt.date.fromisoformat(v).strftime('%a %b %-d') for k, v in dayd.items()}
    vias = {v for r in rows for v in r[7]}
    bal = {balkey(p['airline']): p['balance'] for p in wallet['programs']}
    dur_default = int(float(t.get('dur_default_hours', DUR_DEFAULT / 60)) * 60)
    return t, rows, dict(slug=t['slug'], title=t['title'], short=t['short'], scope=t.get('scope', ''), searched=t['searched'], searchedLabel=t.get('searched_label', ''),
        days=days, daysShort=days, dayDates=dayd, destNames=t['dest_names'], destDefault=t.get('dest_default', list(t['dest_names'])),
        tzOrigin=t.get('tz_origin', 'PT'), tzDest=t.get('tz_dest', 'ET'), originName=t.get('origin_name', t.get('origin', '')), destRegion=t.get('dest_region', 'destination'),
        origins={k: v['name'] for k, v in origins.items()}, dates=dates,
        city={v: CITY.get(v, v) for v in vias}, wx=weather_badges(tdir, set(dates)), held=t.get('held'), credits=credit_view(wallet, flags), balances=bal, pillProgs=pill_progs(wallet), durDefault=dur_default, values=VALUES, fromDefault=t.get('from_default'), why=t.get('why', ''), rows=rows)

def picks(rows, cv, days, tzo, dest_default=None, slug='', from_default=None, dur_default=DUR_DEFAULT):
    rows = [r for r in rows if not r[21] and (not dest_default or r[2] in dest_default) and (not from_default or r[24] in from_default) and r[5] <= dur_default] or rows
    def miles(r):
        best = None
        for p, (cols, code) in PROGS.items():
            for c in cols:
                if r[c] is not None and (best is None or r[c] < best[0]): best = (r[c], code)
        return best
    det = lambda r: f"{r[9]} {r[24] + ' ' if len(r) > 24 else ''}{tm(r[3])} {tzo}, {r[6]} stop{'s' if r[6] > 1 else ''} {', '.join(r[7])}, {du(r[5])}, {days.get(str(r[1]), '')}"
    out = []
    def add(label, r, value):
        for o in out:
            if o['_id'] == r[0]: o['labels'].append(label.lower()); o['value'] += ' · ' + value; return
        out.append(dict(_id=r[0], labels=[label], value=value, detail=det(r), href=f'/flights/{slug}/#go={r[0]}'))
    c = sorted([r for r in rows if r[11] is not None], key=lambda r: (r[11], r[5], r[3]))
    if c:
        r = c[0]; cr = cv.get(r[9]); after = max(0, r[11] - cr['sure']) if cr and cr['sure'] else None
        add('Cheapest', r, f'${r[11]:,.0f}' + (f' (${after:.0f} after credits)' if after is not None else ''))
    m = sorted([r for r in rows if miles(r)], key=lambda r: (miles(r)[0], r[5], r[3]))
    if m: add('Fewest miles', m[0], f'{kf(miles(m[0])[0])} {miles(m[0])[1]}')
    f = sorted(rows, key=lambda r: (r[5], r[3]))
    if f: add('Fastest', f[0], du(f[0][5]))
    for o in out:
        o.pop('_id'); L = o.pop('labels'); o['label'] = L[0] if len(L) < 2 else ', '.join(L[:-1]) + ' and ' + L[-1]
    return out

def fill(tmpl, repl):
    for k, v in repl.items():
        if tmpl.count(k) != 1: sys.exit(f'template needs exactly one {k} (found {tmpl.count(k)})')
        tmpl = tmpl.replace(k, v)
    left = re.findall(r'<!--__[A-Z0-9]+__-->|/\*__[A-Z0-9]+__\*/', tmpl)
    if left: sys.exit(f'unfilled placeholders: {left}')
    return tmpl

def js(obj): return json.dumps(obj, separators=(',', ':')).replace('</', '<\\/')

def main():
    wallet = load(os.path.join(DATA, 'credits', 'wallet.json')); flags = load(os.path.join(DATA, 'credits', 'flags.json'), {'flags': {}})
    track = load(os.path.join(DATA, 'credits', 'tracking.json'))
    os.makedirs(SITE, exist_ok=True)
    trips = []
    for tdir in sorted(glob.glob(os.path.join(DATA, 'searches', '*', 'trip.json'))):
        tdir = os.path.dirname(tdir)
        t, rows, td = trip_data(tdir, wallet, flags)
        notes = ''.join(f'<li>{html.escape(n)}</li>' for n in t.get('notes', []))
        page = fill(rd(os.path.join(UI, 'trip.html')), {'<!--__TITLE__-->': html.escape(t['title']), '<!--__H1__-->': html.escape(t.get('h1', t['title'])), '<!--__NOTES__-->': notes,
            '/*__PROV__*/': f"data/searches/{t['slug']} built {now:%Y-%m-%d %H:%M} PT", '/*__CSS__*/': CSS, '/*__LOGOCSS__*/': LOGOCSS, '/*__LOGONAMES__*/[]': js(list(LOGOS)),
            '/*__DATA__*/null': js(td), '/*__COMMON__*/': COMMON, '/*__APP__*/': rd(os.path.join(UI, 'trip.js')), '/*__ASKCSS__*/': opt('ask.css'), '/*__ASKJS__*/': opt('ask.js'), '<!--__HERO__-->': HERO, '<!--__FAVICON__-->': FAVICON})
        os.makedirs(os.path.join(SITE, t['slug']), exist_ok=True)
        open(os.path.join(SITE, t['slug'], 'index.html'), 'w').write(page)
        open(os.path.join(SITE, t['slug'], 'trip-data.json'), 'w').write(js(dict(td, cols=COLS)))  # read by the ask helper on the box
        last = max(t['dates'])
        h = t.get('held')
        trips.append(dict(slug=t['slug'], name=t.get('card_name', t['short']), route=t.get('route', ''), count=len(rows), searched=t['searched'], searchedLabel=t.get('searched_label', ''),
                          past=dt.date.fromisoformat(last) < today, picks=picks(rows, td['credits'], td['days'], td['tzOrigin'], td['destDefault'], t['slug'], t.get('from_default'), td['durDefault']),
                          held=(f"{h['flight']}, {td['days'].get(str(h['d']), '')} {tm(h['dep'])} {td['tzOrigin']}, ${h['price']:.2f}" if h else None),
                          airlines=sorted({r[9] for r in rows}), first=min(t['dates'])))
        print(f"built {os.path.relpath(SITE)}/{t['slug']}/index.html ({len(page):,} bytes, {len(rows)} flights)")
    trips.sort(key=lambda x: (x['past'], x['first'] if not x['past'] else ''), reverse=False)
    fl = flags.get('flags', {})
    up = [x for x in trips if not x['past']]
    creds = []
    for c in wallet['credits']:
        k = credit_key(c); a = track['airlines'].get(c['airline'], {})
        prog = next((p for p in wallet['programs'] if p['airline'] == c['airline']), {})
        last = a.get('last_live_check'); src = prog.get('creditsSource', 'live')
        checked = (prog.get('creditsCheckedAt') or (dt.datetime.fromisoformat(last).strftime('%a %b %-d, %-I:%M%p').replace('AM', 'am').replace('PM', 'pm') + ' PT' if last else 'never')) + (' (from your screenshot)' if src == 'screenshot' else ' (live, signed in)')
        use = next((x for x in up if c['airline'] in x['airlines']), None)
        href = None
        if use:
            others = [al for al in use['airlines'] if al != c['airline']]
            href = f"/flights/{use['slug']}/#v=" + json.dumps({'xal': others, 'pay': 'cash', 'sort': 'new'}, separators=(',', ':')).replace('"', '%22').replace('{', '%7B').replace('}', '%7D').replace('[', '%5B').replace(']', '%5D').replace(',', '%2C').replace(':', '%3A')
        creds.append(dict(key=k, airline=c['airline'], what=c['what'], amount=c.get('amount'), original=c.get('original'), miles=c.get('miles'), useBy=c.get('useBy'), useByLabel=c.get('useByLabel'),
                          note=c.get('note'), **{'from': c.get('from')}, flag=fl.get(k, {}).get('reason'), checked=checked, useHref=href))
    need = [a for a, v in track['airlines'].items() if not v.get('email_backfill')]
    scan = sorted({v['email_backfill']['done'] for v in track['airlines'].values() if v.get('email_backfill')})
    home = dict(programs=[{k: p.get(k) for k in ('airline', 'program', 'unit', 'balance', 'balanceAsOf', 'expiry', 'creditsStatus')} for p in wallet['programs']], credits=creds,
                trips=[{k: v for k, v in x.items() if k not in ('airlines', 'first')} for x in trips],
                tracking=dict(version=track['tracker_version'], airlines=sorted(track['airlines']), needScan=need, scanDate=', '.join(scan)))
    home.update(cv=credit_view(wallet, flags), balances={balkey(p['airline']): p['balance'] for p in wallet['programs']}, pillProgs=pill_progs(wallet), balKeys={p['airline']: balkey(p['airline']) for p in wallet['programs']}, values=VALUES,
                oldLinks=[{'text': str(l.get('text', '')), 'url': str(l.get('url', ''))} for l in portal_config.get('old_links', []) if isinstance(l, dict) and l.get('url')])
    page = fill(rd(os.path.join(UI, 'home.html')), {'<!--__UPDATED__-->': html.escape(wallet['asof']), '/*__PROV__*/': f'data/credits + data/searches built {now:%Y-%m-%d %H:%M} PT',
        '/*__CSS__*/': CSS, '/*__LOGOCSS__*/': LOGOCSS, '/*__LOGONAMES__*/[]': js(list(LOGOS)), '/*__DATA__*/null': js(home), '/*__COMMON__*/': COMMON, '/*__APP__*/': rd(os.path.join(UI, 'home.js')), '/*__ASKCSS__*/': opt('ask.css'), '/*__ASKJS__*/': opt('ask.js'), '<!--__HERO__-->': HERO, '<!--__FAVICON__-->': FAVICON})
    open(os.path.join(SITE, 'index.html'), 'w').write(page)
    os.makedirs(os.path.join(SITE, 'assets'), exist_ok=True)
    for f in glob.glob(os.path.join(ASSETS, '*.jpg')): shutil.copy2(f, os.path.join(SITE, 'assets', os.path.basename(f)))
    codes = load(os.path.join(DATA, 'credits', 'codes.json'))
    cp = os.path.join(SITE, 'credit-codes.json')
    if codes: open(cp, 'w').write(js(codes))
    elif os.path.exists(cp): os.remove(cp)
    built = {x['slug'] for x in trips}
    for d in sorted(os.listdir(SITE)):
        if TRIP_DIR.match(d) and d not in built and os.path.isdir(os.path.join(SITE, d)):
            shutil.rmtree(os.path.join(SITE, d)); print(f'removed old trip folder {d} (no data for it any more)')
    print(f'built {os.path.relpath(SITE)}/index.html ({len(page):,} bytes, {len(trips)} trips, {len(creds)} credits, {len(fl)} flagged)')

if __name__ == '__main__':
    main()
