# Claude · 2026-11-22 · merges cash (Kayak) and award searches into one itinerary list
import json, glob, re, os
# Reads raw search files (cash-*, dl-*, wn-*, wnc-*, ua-*, aa-*.txt) from the current folder and writes itineraries.json.
# Trip settings come from trip.json in the same folder: tz_diff (minutes the destination clock is ahead of the origin; PT to ET is 180)
# and skip_airlines (cash rows from these airlines are ignored). Built-in rules: DJT is treated as PBI, 'AS' in American's flight
# list marks Alaska, Frontier gets a bags-and-seats note; red-eyes (leave 8pm origin time or later, or land next day 3am or later),
# trips over 14 hours and trips with no duration are dropped.
TRIP = json.load(open('trip.json')) if os.path.exists('trip.json') else {}
_glob = glob.glob
glob.glob = lambda pat: sorted(set(_glob(pat) + _glob(os.path.join('raw', pat))))  # raw files may sit in ./raw (portal layout)
TZ_DIFF = int(TRIP.get('tz_diff', 180))
SKIP = TRIP.get('skip_airlines', [])
LATEST_DEP, LATEST_NEXTDAY_ARR, MAX_DUR = 20*60, 3*60, 14*60
# International trips: trip.json "drop_redeyes": false keeps overnight flights, "max_hours": 30 raises the duration cap
DROP_REDEYES = TRIP.get('drop_redeyes', True)
MAX_DUR = int(float(TRIP.get('max_hours', MAX_DUR / 60)) * 60)
def load(f):
    s = open(f).read()
    try: s = json.loads(s)
    except Exception: pass
    return [l.split('|') for l in s.splitlines() if l.strip()]
def tmin(s):
    m = re.match(r'(\d{1,2}):(\d{2}) ?([ap]m)', s.strip().lower())
    h, mi, ap = int(m[1]), int(m[2]), m[3]
    if ap == 'pm' and h != 12: h += 12
    if ap == 'am' and h == 12: h = 0
    return h*60 + mi
def dmin(s):
    h = re.search(r'(\d+)h', s or ''); m = re.search(r'(\d+)m', s or '')
    return (int(h[1]) if h else 0)*60 + (int(m[1]) if m else 0)
def k(s):
    s = (s or '').strip().lower().replace(',', '')
    if not s: return None
    return int(round(float(s[:-1])*1000)) if s.endswith('k') else int(float(s))
def nstops(s):
    s = (s or '').lower()
    return 0 if 'non' in s else int(re.search(r'\d', s)[0]) if re.search(r'\d', s) else None
IT = {}
# Fare classes (economy only): one entry per airline fare class, kept in it['fares'] as {"AL|Class": {...}}.
# fare-*.txt rows (from the airlines' own result pages, all fare columns): d|dest|dep|arr|airline|stops|via|lay|dur|flights|class|tier|cash|pts|tax|mcPts|mcCash
CODE = {'Southwest': 'WN', 'Delta': 'DL', 'United': 'UA', 'United Airlines': 'UA', 'American': 'AA', 'American Airlines': 'AA', 'Alaska': 'AS', 'Alaska Airlines': 'AS'}
PROG = {'WN': 'sw', 'DL': 'dl', 'UA': 'ua', 'AA': 'aa', 'AS': 'as'}
def num(s):
    try: return float(str(s).replace('$', '').replace(',', '')) if str(s).strip() not in ('', 'None') else None
    except ValueError: return None
def addfare(it, al, cls, tier, cash=None, pts=None, tax=None, mc=None, note='', legacy=False, low=False):
    # legacy: from the older one-column files (dropped when the airline's all-class page was read for this flight)
    # low: two routings can share a departure and arrival time; keep the lower price for the class
    f = it.setdefault('fares', {}).setdefault(al + '|' + cls, dict(al=al, cls=cls, tier=tier, prog=PROG.get(al, ''), cash=None, pts=None, tax=None, mc=[], note='', legacy=legacy))
    if not legacy:
        if f.get('legacy'): f['legacy'] = False; f['cash'] = f['pts'] = None if low else f['cash']
    if cash is not None and (not low or f['cash'] is None or cash < f['cash']): f['cash'] = cash
    if pts is not None and (not low or f['pts'] is None or pts < f['pts']): f['pts'] = pts
    if tax is not None: f['tax'] = tax
    for pair in mc or []:
        if pair not in f['mc']: f['mc'].append(pair)
    if note and not f['note']: f['note'] = note
NAMES = {'American Airlines': 'American', 'Alaska Airlines': 'Alaska', 'United Airlines': 'United', 'Delta Air Lines': 'Delta', 'Southwest Airlines': 'Southwest', 'Frontier Airlines': 'Frontier', 'Spirit Airlines': 'Spirit'}
norm = lambda a: NAMES.get(a.strip(), a.strip())
nparts = lambda s: len([p for p in re.split(r'[,+]', s or '') if p.strip()])
def key(d, dest, dep, arr):
    dest = 'PBI' if dest in ('DJT', 'PBI') else dest
    return (d, dest, tmin(dep), tmin(arr.replace('+1', '')))
def get(d, dest, dep, arr, dur, stops, via, lay):
    kk = key(d, dest, dep, arr)
    it = IT.get(kk)
    if not it:
        it = IT[kk] = dict(d=d, dest=kk[1], dep=kk[2], arr=kk[3], dur=dmin(dur), stops=stops, via=via, lay=lay,
                           airlines=set(), flights='', cash=None, cashFare='', notes=set(), pay={}, legs=[])
    if not it['dur'] and dur: it['dur'] = dmin(dur)
    if (it['stops'] is None) and stops is not None: it['stops'] = stops
    if via and nparts(via) > nparts(it['via']): it['via'] = via   # keep the most complete connection list
    if lay and lay != 'long' and (not it['lay'] or it['lay'] == 'long' or nparts(lay) > nparts(it['lay'])): it['lay'] = lay
    return it
for f in glob.glob('cash-*.txt'):
    for r in load(f):
        d, dest, dep, arr, al, st, via, lay, dur, price, fare = (r + ['']*11)[:11]
        if any(x.lower() in al.lower() for x in SKIP): continue
        it = get(d, dest, dep, arr, dur, nstops(st), via, lay)
        it['airlines'].add(norm(al))
        p = int(price)
        if it['cash'] is None or p < it['cash']: it['cash'], it['cashFare'] = p, fare
for f in glob.glob('dl-*.txt'):
    for r in load(f):
        d, dest, dep, arr, al, st, via, lay, dur, main, comf, first, fl, op = (r + ['']*14)[:14]
        n = len(fl.split('+')) - 1
        it = get(d, dest, dep, arr, dur, n, via, lay)
        it['airlines'].add('Delta'); it['flights'] = it['flights'] or fl.replace('+', ' + ')
        it['pay']['delta'] = dict(econ=k(main), econName='Main', comfort=k(comf), first=k(first))
        addfare(it, 'DL', 'Main', 1, pts=k(main), legacy=True); addfare(it, 'DL', 'Comfort', 2, pts=k(comf), legacy=True)
        if op: it['notes'].add('one leg on a small regional jet (SkyWest)')
for f in glob.glob('wn-*.txt'):
    for r in load(f):
        d, dest, dep, arr, al, st, via, lay, dur, basic, choice, tax, fl = (r + ['']*13)[:13]
        it = get(d, dest, dep, arr, dur, nstops(st), via.replace(' ', ''), lay)
        it['airlines'].add('Southwest'); it['flights'] = it['flights'] or fl.replace('/', ' + ')
        it['pay']['sw'] = dict(econ=k(basic), econName='Basic', choice=k(choice), tax=tax)
        addfare(it, 'WN', 'Basic', 0, pts=k(basic), tax=num(tax), legacy=True); addfare(it, 'WN', 'Choice', 1, pts=k(choice), tax=num(tax), legacy=True)
for f in glob.glob('wnc-*.txt'):
    for r in load(f):
        d, dest, dep, arr, al, st, via, lay, dur, basic, choice, tax, fl = (r + ['']*13)[:13]
        it = get(d, dest, dep, arr, dur, nstops(st), via.replace(' ', ''), lay)
        it['airlines'].add('Southwest'); it['flights'] = it['flights'] or fl.replace('/', ' + ')
        sw = it['pay'].setdefault('sw', {})
        sw['cashBasic'] = k(basic); sw['cashChoice'] = k(choice)
        addfare(it, 'WN', 'Basic', 0, cash=k(basic), legacy=True); addfare(it, 'WN', 'Choice', 1, cash=k(choice), legacy=True)
        b = k(basic) or k(choice)
        if b and (it['cash'] is None or b < it['cash']): it['cash'], it['cashFare'] = b, ('Basic' if k(basic) else 'Choice')
for f in glob.glob('ua-*.txt'):
    for r in load(f):
        d, dest, dep, arr, al, st, via, lay, dur, econ, first, cls, ops = (r + ['']*13)[:13]
        it = get(d, dest, dep, arr, dur, nstops(st), via, lay)
        it['airlines'].add('United Airlines')
        it['pay']['ua'] = dict(econ=k(econ), econName='Economy', first=k(first), firstMixed='Mixed' in cls.split('/')[-1])
        if k(econ) and not (k(econ) >= 100000 and not k(first)): addfare(it, 'UA', 'Economy', 1, pts=k(econ), legacy=True)
for f in glob.glob('aa-*.txt'):
    for r in load(f):
        d, dest, dep, arr, al, st, via, lay, dur, main, first, fl, note = (r + ['']*13)[:13]
        it = get(d, dest, dep, arr, dur, nstops(st), via, lay)
        it['airlines'].add('American Airlines')
        if 'AS' in fl: it['airlines'].add('Alaska Airlines')
        it['flights'] = it['flights'] or fl
        it['pay']['aa'] = dict(econ=k(main), econName='Main', first=k(first))
        addfare(it, 'AA', 'Main', 1, pts=k(main), legacy=True)
        if note: it['notes'].add(note)
        if lay == 'long': it['notes'].add('American flags a long layover')
# Google Flights rows (gf-<DEST>-<DD>.txt from the portal's gf_to_rows.py): newest cash price, full connections, exact legs
for f in glob.glob('gf-*.txt'):
    for r in load(f):
        d, dest, dep, arr, als, st, via, lay, dur, price, legs = (r + ['']*11)[:11]
        it = get(d, dest, dep, arr, dur, nstops(st), via, lay)
        for a in als.split(','):
            if a: it['airlines'].add(norm(a))
        it['cash'], it['cashFare'] = int(price), 'Google Flights'
        try: it['legs'] = json.loads(legs)
        except Exception: pass
        if it['legs'] and not it['flights']: it['flights'] = ' + '.join(l[2] + l[3] for l in it['legs'])
for f in glob.glob('fare-*.txt'):
    for r in load(f):
        d, dest, dep, arr, al, st, via, lay, dur, fl, cls, tier, cash, pts, tax, mcp, mcc = (r + ['']*17)[:17]
        it = get(d, dest, dep, arr, dur, nstops(st), via, lay)
        it['airlines'].add(norm(al)); it['flights'] = it['flights'] or fl
        code = CODE.get(norm(al), al)
        mc = [[k(mcp), num(mcc)]] if k(mcp) and num(mcc) is not None else []
        addfare(it, code, cls, int(tier or 0), cash=num(cash), pts=k(pts), tax=num(tax), mc=mc, low=True)
out = []
for it in IT.values():
    fares = it.pop('fares', {})
    fresh = {f['al'] for f in fares.values() if not f.get('legacy')}
    fares = {k2: f for k2, f in fares.items() if not (f.get('legacy') and f['al'] in fresh and f['al'] != 'UA')}  # United miles were not re-read; keep its older miles
    for f in fares.values(): f.pop('legacy', None)
    if it['cash'] is not None and not any(f['cash'] is not None for f in fares.values()):
        al = sorted(it['airlines'])[0] if it['airlines'] else ''
        code = CODE.get(norm(al), '')
        if code and len(it['airlines'] - {'Multiple airlines'}) == 1:
            addfare(it, code, 'Lowest fare', 0, cash=it['cash'], note='Google Flights lowest fare; the fare class was not shown')
            fares.update(it.pop('fares'))
    it['fares'] = sorted(fares.values(), key=lambda f: (f['al'], f['tier'], f['cls']))
    own = [f['cash'] for f in it['fares'] if f['cash'] is not None and f['cls'] != 'Lowest fare']
    if own and len(it['airlines'] - {'Multiple airlines'}) == 1:   # the airline's own fare page is newer and exact; it sets the list price
        it['cash'], it['cashFare'] = min(own), next(f['al'] for f in it['fares'] if f['cash'] == min(own)) + ' site, all fare classes'
    arrPT = it['dep'] + it['dur']; nextday = it['dur'] > 0 and (arrPT + TZ_DIFF) >= 1440
    it['nextday'] = nextday
    # red-eye / overnight: leaves 8pm PT or later, or lands next day at 3am ET or later
    if DROP_REDEYES and (it['dep'] >= LATEST_DEP or (nextday and it['arr'] >= LATEST_NEXTDAY_ARR)): continue
    if it['dur'] > MAX_DUR or it['dur'] == 0: continue
    if nextday: it['notes'].add('lands after midnight')
    if it['airlines'] & {'Frontier', 'Spirit'}: it['notes'].add('Low-cost airline: bags and seats extra')
    al = sorted(it['airlines'] - {'Multiple airlines'}) or ['Multiple airlines']
    it['airlines'] = al; it['notes'] = sorted(it['notes'])
    out.append(it)
out.sort(key=lambda x: (x['d'], x['dest'], x['dep']))
json.dump(out, open('itineraries.json', 'w'), indent=0)
print(len(IT), 'raw ->', len(out), 'kept')
import collections
print(collections.Counter((x['d'], x['dest']) for x in out))
print('with cash:', sum(1 for x in out if x['cash']), ' with award:', sum(1 for x in out if x['pay']), ' both:', sum(1 for x in out if x['cash'] and x['pay']))
for x in out[:8]: print(x)
