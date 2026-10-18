"""Collect already-generated Slice 2 results without changing Slice 1 evidence."""
from pathlib import Path
import csv
import json
import re
import shutil

DEST = Path(__file__).resolve().parent
ROOT = DEST.parents[2]
SOURCES = [
    'backend/supabase/tests/retired_venue_replacement.sql',
    'backend/supabase/tests/retired_venue_replacement_races.sh',
    'backend/supabase/tests/run_change_request_review.sh',
    'frontend/src/features/venues/__tests__/venueReplacementService.test.ts',
    'frontend/src/features/venues/__tests__/VenueReplacementPanel.test.tsx',
    'frontend/src/features/venues/__tests__/VenueBookingQueuePage.test.tsx',
    'frontend/src/features/venues/__tests__/MyVenueBookingsNotifications.test.tsx',
]
SCENARIOS = {
    3: 'boundary', 4: 'boundary', 5: 'failure', 6: 'failure', 7: 'failure',
    8: 'boundary', 10: 'conflict', 12: 'conflict', 13: 'failure', 14: 'conflict',
    15: 'failure', 16: 'failure', 18: 'conflict', 20: 'boundary',
    31: 'failure', 33: 'boundary', 35: 'boundary', 36: 'failure', 37: 'failure',
    53: 'conflict', 54: 'conflict', 55: 'conflict', 56: 'failure', 57: 'failure',
    59: 'conflict', 60: 'failure', 61: 'failure',
}
rows = []
seen = set()
for source in SOURCES:
    for match in re.finditer(r"(AC-020\.3\.(\d+)): ([^'\n]+)", (ROOT / source).read_text(encoding='utf-8')):
        case, number, title = match.groups()
        if case in seen:
            raise ValueError(f'Duplicate case ID: {case}')
        seen.add(case)
        rows.append([case, 'US20 / SCRUM-65', '', title,
                     'unit' if source.endswith('Service.test.ts') else 'integration',
                     SCENARIOS.get(int(number), 'normal'), '', '', source])
rows.sort(key=lambda row: int(row[0].split('.')[-1]))
with (DEST / 'traceability.csv').open('w', newline='', encoding='utf-8-sig') as stream:
    writer = csv.writer(stream)
    writer.writerow(['AC', 'Story', 'Owner', 'Test name', 'Test type', 'Scenario', 'PR', 'Forced-break log', 'Source'])
    writer.writerows(rows)

for path in DEST.glob('*.log'):
    raw = path.read_bytes()
    content = raw.decode('utf-16' if raw.startswith((b'\xff\xfe', b'\xfe\xff')) else 'utf-8-sig')
    content = re.sub(r'\x1b\[[0-9;]*[A-Za-z]', '', content)
    path.write_text('\n'.join(line.rstrip() for line in content.splitlines()).rstrip() + '\n', encoding='utf-8')
coverage = ROOT / 'frontend/coverage'
shutil.copyfile(coverage / 'coverage-summary.json', DEST / 'coverage-summary.json')
shutil.make_archive(str(DEST / 'frontend-coverage'), 'zip', coverage)
summary = json.loads((DEST / 'coverage-summary.json').read_text(encoding='utf-8'))
print(f'Traceability: {len(rows)} cases')
for name, entry in summary.items():
    if name == 'total' or 'VenueReplacementPanel' in name or 'venueReplacementService' in name:
        print(name, {metric: entry[metric]['pct'] for metric in ('lines', 'statements', 'branches', 'functions')})
