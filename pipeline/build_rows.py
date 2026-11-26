# Claude · 2026-11-22 · Session 8e680ddd · builds page data, economy only (v2: sliders and layover airport filter)
import json, re, os
# Reads itineraries.json (from merge.py) and trip.json from the current folder; writes page-rows.json (economy only).
# Row columns (the page script's C map): 0 id, 1 day, 2 dest, 3 dep (origin minutes), 4 arr (dest minutes, +1440 next day), 5 duration,
# 6 stops, 7 via list, 8 layover minutes list, 9 airlines, 10 flights, 11 cash, 12 cash fare, 13 Delta Main, 14 SW Basic pts,
# 15 SW Choice pts, 16 AA Main, 17 United Economy, 18 SW cash Basic, 19 SW cash Choice, 20 notes, 21 near-duplicate flag, 22 United economy sold out,
# 23 legs [[from, to, airline code, flight number, dep, arr], ...] when Google Flights supplied them,
# 24 fares [[airline code, class, tier 0-3, cash, points, program, award tax, [[points, cash] miles+cash options], note], ...].
# Near-duplicate: leaves within an hour of another option that is no slower, has no more stops and costs no more in any economy price;
# of two identical options, the one with the larger id is flagged. Rows with no economy price at all are dropped and listed.
TRIP = json.load(open('trip.json')) if os.path.exists('trip.json') else {}
TZ_DIFF = int(TRIP.get('tz_diff', 180))
its = json.load(open('itineraries.json'))
short = {'American Airlines':'American','Alaska Airlines':'Alaska','United Airlines':'United','Multiple airlines':'Mixed'}
PREMIUM = re.compile(r'first|business|premium', re.I)
def mins(s):
    m = re.fullmatch(r'\s*(?:(\d+)h)?\s*(?:(\d+)m)?\s*', s)
    if not m or not (m.group(1) or m.group(2)): return None
    return int(m.group(1) or 0) * 60 + int(m.group(2) or 0)
items = []
dropped = []
for x in its:
    p = x['pay']; dl = p.get('delta') or {}; sw = p.get('sw') or {}; ua = p.get('ua') or {}; aa = p.get('aa') or {}
    notes = list(x['notes'])
    cash, fare = x['cash'], x['cashFare'] or ''
    if cash is not None and PREMIUM.search(fare): cash, fare = None, ''
    if cash is None and (sw.get('cashBasic') or sw.get('cashChoice')):
        cash, fare = (sw.get('cashBasic'), 'Basic') if sw.get('cashBasic') else (sw.get('cashChoice'), 'Choice')
    uae = ua.get('econ')
    ua_sold = bool(uae and uae >= 100000 and not ua.get('first'))
    if ua_sold: uae = None
    for u in TRIP.get('unchecked', []):
        prog = {'American Airlines': aa, 'Delta': dl, 'Southwest': sw, 'United Airlines': ua}.get(u['airline'])
        if x['d'] == str(u['day']) and u['airline'] in x['airlines'] and not prog: notes.append(u['note'])
    e = dict(cash=cash, dl=dl.get('econ'), sw=sw.get('econ'), swc=sw.get('choice'), aa=aa.get('econ'), ua=uae)
    al = '/'.join(dict.fromkeys(short.get(a, a) for a in x['airlines']))  # 'American' and 'American Airlines' are one airline
    if all(v is None for v in e.values()):
        dropped.append(f"{x['d']} {x['dest']} {x['dep']} {al} {x['cashFare']}"); continue
    via = [v for v in x['via'].split(',') if v]
    lays = [] if x['lay'] in ('', 'long') else [mins(s) for s in x['lay'].split('+')]
    lays = [v for v in lays if v is not None]
    rid = re.sub(r'[^a-z0-9]+', '-', f"{x['d']}-{x['dest']}-{x['dep']}-{x['arr']}-{al}".lower())
    nd = (x['dep'] + x['dur'] + TZ_DIFF) // 1440   # days after departure the flight lands (2 on some long-haul trips, -1 westbound over the date line)
    items.append(dict(x=x, e=e, rid=rid, al=al, via=via, lays=lays, nd=nd, notes=notes, fare=fare, sw=sw, ua_sold=ua_sold))
def worse(a, b):  # b makes a pointless: leaves within an hour, no slower, no more stops, no dearer in any economy price
    A, B = a['x'], b['x']
    if a is b or A['d'] != B['d'] or A['dest'] != B['dest'] or abs(A['dep'] - B['dep']) > 60: return False
    if B['dur'] > A['dur'] or B['stops'] > A['stops']: return False
    for k, v in a['e'].items():
        if v is not None and (b['e'][k] is None or b['e'][k] > v): return False
    return B['dur'] < A['dur'] or B['stops'] < A['stops'] or any(v is not None and b['e'][k] < v for k, v in a['e'].items()) or b['rid'] < a['rid']
old_ids = {}
if os.path.exists('page-rows.json'):   # keep ids stable across re-runs, so likes and hides survive
    for r in json.load(open('page-rows.json')): old_ids[(r[1], r[2], r[3], r[4])] = r[0]
rows = []
for it in items:
    x, e = it['x'], it['e']
    rid = old_ids.get((int(x['d']), x['dest'], x['dep'], x['arr'] + 1440 * it['nd']), it['rid'])
    rows.append([rid, int(x['d']), x['dest'], x['dep'], x['arr'] + 1440 * it['nd'], x['dur'], x['stops'],
                 it['via'], it['lays'], it['al'], x['flights'], e['cash'], it['fare'],
                 e['dl'], e['sw'], e['swc'], e['aa'], e['ua'], it['sw'].get('cashBasic'), it['sw'].get('cashChoice'),
                 '; '.join(it['notes']), 1 if any(worse(it, o) for o in items) else 0, 1 if it['ua_sold'] else 0, x.get('legs') or [],
                 [[f['al'], f['cls'], f['tier'], f['cash'], f['pts'], f['prog'], f['tax'], f['mc'], f['note']] for f in x.get('fares', [])]])
rows.sort(key=lambda r: (r[1], r[2], r[3]))
assert len({r[0] for r in rows}) == len(rows), 'ids not unique'
json.dump(rows, open('page-rows.json', 'w'), separators=(',', ':'))
print(len(rows), 'economy rows,', sum(1 for r in rows if not r[21]), 'shown by default; dropped (no economy price):', len(dropped))
for d in dropped: print('  dropped', d)
print('rows with a connection airport not listed:', sum(1 for r in rows if len(r[7]) < r[6]))
print('rows with no layover length:', sum(1 for r in rows if not r[8]), '; partly listed:', sum(1 for r in rows if r[8] and len(r[8]) < r[6]))
