"""Collect local US20 evidence after test execution; does not run or fabricate tests."""
from pathlib import Path
import csv
import json
import re
import shutil

DEST = Path(__file__).resolve().parent
ROOT = DEST.parents[2]
SOURCES = [
    'backend/supabase/tests/event_planning_updates.sql',
    'backend/supabase/tests/event_planning_update_races.sh',
    'backend/supabase/tests/run_change_request_review.sh',
    'frontend/src/features/events/__tests__/planningUpdateService.test.ts',
    'frontend/src/features/events/__tests__/PlanningUpdatePanel.test.tsx',
]
SCENARIOS = {
    '1.2': 'boundary', '1.3': 'failure', '1.4': 'conflict', '1.5': 'boundary',
    '1.6': 'failure', '1.7': 'failure', '1.8': 'failure', '1.9': 'failure',
    '1.10': 'failure', '1.15': 'failure', '1.16': 'failure', '1.17': 'conflict',
    '1.31': 'boundary', '1.32': 'failure', '1.33': 'failure', '1.34': 'boundary',
    '1.51': 'boundary', '1.52': 'conflict', '1.53': 'conflict', '1.54': 'failure',
    '1.55': 'boundary', '2.2': 'boundary', '2.3': 'failure', '2.6': 'failure',
    '2.8': 'failure', '2.9': 'failure',
}

rows = []
seen = set()
for source in SOURCES:
    for match in re.finditer(r"(AC-020\.(\d+)\.(\d+)): ([^'\n]+)", (ROOT / source).read_text(encoding='utf-8')):
        case, ac, number, title = match.groups()
        if case in seen:
            raise ValueError(f'Duplicate AC ID: {case}')
        seen.add(case)
        kind = 'integration' if source.endswith(('.sql', '.sh', '.tsx')) else 'unit'
        rows.append([case, 'US20 / SCRUM-65', '', title, kind,
                     SCENARIOS.get(f'{ac}.{number}', 'normal'), '',
                     'AC-020.1.30-forced-break.log' if case == 'AC-020.1.30' else '', source])
rows.sort(key=lambda row: tuple(map(int, row[0].split('.')[1:])))
with (DEST / 'traceability.csv').open('w', newline='', encoding='utf-8-sig') as stream:
    writer = csv.writer(stream)
    writer.writerow(['AC', 'Story', 'Owner', 'Test name', 'Test type', 'Scenario', 'PR', 'Forced-break log', 'Source'])
    writer.writerows(rows)

# PowerShell redirects native output as UTF-16. Preserve its content, removing only
# terminal colour escapes and trailing whitespace, and store portable UTF-8 text.
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
    if name == 'total' or 'PlanningUpdatePanel' in name or 'planningUpdateService' in name:
        print(name, {metric: entry[metric]['pct'] for metric in ('lines', 'statements', 'branches', 'functions')})
