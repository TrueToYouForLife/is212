"""Builds a read-only SQL query that says which migrations are applied on a Supabase project.

Run from the repo root:
    python3 backend/supabase/scripts/check_applied_migrations.py > /tmp/check_migrations.sql
then paste /tmp/check_migrations.sql into the Supabase SQL editor (pbcopy < /tmp/check_migrations.sql).

One row per migration file: applied is true, false, or null where the script cannot tell (check
those by hand). Add "where not applied or applied is null" to see only what needs attention.
How it decides, per migration:
  - it creates something no earlier migration did (table, column, function, policy, trigger,
    index, type): that object exists;
  - it only replaces functions: the live function contains a line only this version has;
  - it re-adds a named constraint: the live constraint contains a value only this version has;
  - it changes a column type or only drops a function or policy: that change is in place;
  - a later migration rewrote the same function (or dropped the index): it counts as applied when
    that later migration is, since its own change is superseded there.
Tested against databases stopped at 25 points from 0001 to 0106: correct at all of them except a
database stopped before 0011, where 0002, 0011 and 0014 (which only tighten or remove something)
can read as applied. Every later migration depends on them, so a real project is not affected.
It only knows the migrations in your repo: claimed numbers not yet merged are not listed.
"""
import glob, os, re, sys

MIGRATIONS = 'backend/supabase/migrations'

PATTERNS = [
    ('table',  re.compile(r'create table (?:if not exists )?public\.([a-z_0-9]+)', re.I)),
    ('index',  re.compile(r'create (?:unique )?index (?:if not exists )?([a-z_0-9]+)\s+on', re.I)),
    ('func',   re.compile(r'create (?:or replace )?function public\.([a-z_0-9]+)\s*\(', re.I)),
    ('column', re.compile(r'alter table (?:only )?(?:if exists )?public\.([a-z_0-9]+)\s+add column (?:if not exists )?([a-z_0-9]+)', re.I)),
    ('column2', re.compile(r'add column (?:if not exists )?([a-z_0-9]+)', re.I)),
    ('policy', re.compile(r'create policy "?([a-z_0-9]+)"?\s+on (?:public\.)?([a-z_0-9]+)', re.I)),
    ('trigger', re.compile(r'create (?:or replace )?trigger ([a-z_0-9]+)', re.I)),
    ('type',   re.compile(r'create type public\.([a-z_0-9]+)', re.I)),
]


def q(text):
    return "'" + text.replace("'", "''") + "'"


def strip_comments(sql):
    out = []
    for line in sql.splitlines():
        if line.lstrip().startswith('--'):
            continue
        out.append(re.sub(r'\s--\s.*$', '', line) if "'" not in line else line)
    return '\n'.join(out)


def functions(sql):
    found = {}
    for m in re.finditer(r'create (?:or replace )?function public\.([a-z_0-9]+)\s*\(', sql, re.I):
        end = sql.find('$$;', m.start())
        body_start = sql.find('$$', m.start())
        if body_start == -1 or end == -1:
            continue
        found.setdefault(m.group(1).lower(), []).append(sql[body_start + 2:end])
    return found


def column_adds(sql):
    adds = []
    for stmt in re.finditer(r'alter table (?:only )?(?:if exists )?public\.([a-z_0-9]+)(.*?);', sql, re.I | re.S):
        for col in re.finditer(r'add column (?:if not exists )?([a-z_0-9]+)', stmt.group(2), re.I):
            adds.append((stmt.group(1).lower(), col.group(1).lower()))
    return adds


def objects(sql):
    objs = []
    for kind, rx in PATTERNS:
        if kind in ('column', 'column2'):
            continue
        for m in rx.finditer(sql):
            objs.append((m.start(), kind, tuple(g.lower() for g in m.groups())))
    for table, col in column_adds(sql):
        pos = sql.lower().find(f'add column if not exists {col}')
        objs.append((pos if pos >= 0 else 0, 'column', (table, col)))
    return [(k, g) for _, k, g in sorted(objs)]


def exists_check(kind, g):
    if kind in ('table', 'index'):
        return f"to_regclass({q('public.' + g[0])}) is not null"
    if kind == 'func':
        return f"exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = {q(g[0])})"
    if kind == 'column':
        return f"exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = {q(g[0])} and column_name = {q(g[1])})"
    if kind == 'policy':
        return f"exists (select 1 from pg_policies where schemaname = 'public' and tablename = {q(g[1])} and policyname = {q(g[0])})"
    if kind == 'trigger':
        return f"exists (select 1 from pg_trigger where not tgisinternal and tgname = {q(g[0])})"
    if kind == 'type':
        return f"to_regtype({q('public.' + g[0])}) is not null"


def distinctive_line(new_body, old_bodies):
    # A line of the new version that appears nowhere in the old ones, not even inside a longer
    # line, since the check searches the live function's text for it.
    old_text = '\n'.join(old_bodies)
    candidates = [l.strip() for l in new_body.splitlines()
                  if len(l.strip()) >= 20 and l.strip() not in old_text and not l.strip().startswith('--')]
    candidates.sort(key=len, reverse=True)
    return candidates[0] if candidates else None


def policies(sql):
    out = {}
    for m in re.finditer(r'create policy "?([a-z_0-9]+)"?\s+on (?:public\.)?([a-z_0-9]+)(.*?);', sql, re.I | re.S):
        out[(m.group(1).lower(), m.group(2).lower())] = m.group(3)
    return out


def constraints(sql):
    out = {}
    for m in re.finditer(r'add constraint ([a-z_0-9]+)\s+check\s*(\(.*?\))\s*(?:not valid\s*)?;', sql, re.I | re.S):
        out[m.group(1).lower()] = m.group(2)
    return out


def main():
    paths = sorted(glob.glob(os.path.join(MIGRATIONS, '*.sql')))
    if not paths:
        sys.exit(f'No migrations found under {MIGRATIONS}. Run this from the repo root.')
    seen = set()
    history_funcs, history_cons, history_pols = {}, {}, {}
    entries = []      # dicts: name, own (check), how, func (replaced function or None), sql
    last_definer = {}  # function -> index of the latest migration (so far) that defines it
    for i, path in enumerate(paths):
        name = os.path.basename(path)[:-4]
        sql = strip_comments(open(path).read())
        objs = objects(sql)
        pick = next(((k, g) for k, g in objs if (k, g) not in seen), None)
        funcs = functions(sql)
        cons = constraints(sql)
        own, how, replaced = None, None, None
        if pick:
            own, how = exists_check(*pick), f'{pick[0]} {".".join(pick[1])} exists'
            if pick[0] == 'index':
                replaced = ('index', pick[1][0])
        else:
            for fname, bodies in funcs.items():
                previous = history_funcs.get(fname, [])
                line = distinctive_line(bodies[-1], previous)
                needs_previous = False
                if not line:
                    line = distinctive_line(bodies[-1], previous[-1:])
                    needs_previous = True
                if line:
                    own = (f"exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace "
                           f"where n.nspname = 'public' and p.proname = {q(fname)} and position({q(line)} in p.prosrc) > 0)")
                    if needs_previous and fname in last_definer and entries[last_definer[fname]]['own']:
                        own = f"({own} and {entries[last_definer[fname]]['own']})"
                    how = f"{fname}() has this version's change"
                    replaced = ('func', fname)
                    break
            if not own:
                for cname, cdef in cons.items():
                    values = re.findall(r"'([^']+)'", cdef)
                    old = ' '.join(history_cons.get(cname, []))
                    new_values = [v for v in values if f"'{v}'" not in old] or values
                    if new_values:
                        own = (f"exists (select 1 from pg_constraint where conname = {q(cname)} "
                               f"and position({q(new_values[0])} in pg_get_constraintdef(oid)) > 0)")
                        how = f'constraint {cname} includes {new_values[0]}'
                        # It may also drop an older constraint in its place: that must be gone too.
                        for dropped in re.findall(r'drop constraint (?:if exists )?([a-z_0-9]+)', sql, re.I):
                            if dropped.lower() not in cons:
                                own = f"({own} and not exists (select 1 from pg_constraint where conname = {q(dropped.lower())}))"
                                how += f', {dropped.lower()} dropped'
                        break
            if not own:
                for (pname, ptable), ptext in policies(sql).items():
                    old = ' '.join(history_pols.get((pname, ptable), []))
                    words = [w for w in re.findall(r'[a-z_][a-z_0-9]{5,}', ptext.lower())
                             if w not in old.lower() and w not in ('authenticated', 'public', 'select', 'insert', 'update', 'delete')]
                    if old and words:
                        own = (f"exists (select 1 from pg_policies where schemaname = 'public' and tablename = {q(ptable)} "
                               f"and policyname = {q(pname)} and position({q(words[0])} in coalesce(qual, '') || ' ' || coalesce(with_check, '')) > 0)")
                        how = f'policy {pname} uses {words[0]}'
                        break
            if not own:
                m = re.search(r'alter table (?:only )?public\.([a-z_0-9]+)\s+alter column ([a-z_0-9]+)\s+(?:set data )?type\s+([a-z_0-9\[\]]+)', sql, re.I)
                if m:
                    want = 'ARRAY' if m.group(3).endswith('[]') else m.group(3).lower()
                    own = (f"exists (select 1 from information_schema.columns where table_schema = 'public' "
                           f"and table_name = {q(m.group(1).lower())} and column_name = {q(m.group(2).lower())} "
                           f"and (data_type = {q(want)} or udt_name = {q(want)}))")
                    how = f'{m.group(1)}.{m.group(2)} is {m.group(3)}'
            if not own:
                m = re.search(r'drop function (?:if exists )?public\.([a-z_0-9]+)', sql, re.I)
                if m and not funcs:
                    own = (f"not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace "
                           f"where n.nspname = 'public' and p.proname = {q(m.group(1).lower())})")
                    how = f'{m.group(1)}() removed'
            if not own:
                m = re.search(r'drop policy (?:if exists )?"?([a-z_0-9]+)"? on (?:public\.)?([a-z_0-9]+)', sql, re.I)
                if m and 'create policy' not in sql.lower():
                    # The table must exist, or the policy is only missing because nothing made it yet.
                    own = (f"(to_regclass({q('public.' + m.group(2).lower())}) is not null and "
                           f"not exists (select 1 from pg_policies where schemaname = 'public' "
                           f"and tablename = {q(m.group(2).lower())} and policyname = {q(m.group(1).lower())}))")
                    how = f'policy {m.group(1)} removed'
        entries.append({'name': name, 'own': own, 'how': how, 'replaced': replaced, 'sql': sql.lower(), 'funcs': set(funcs)})
        for k, g in objs:
            seen.add((k, g))
        for fname, bodies in funcs.items():
            history_funcs.setdefault(fname, []).extend(bodies)
            last_definer[fname] = i
        for cname, cdef in cons.items():
            history_cons.setdefault(cname, []).append(cdef)
        for key, ptext in policies(sql).items():
            history_pols.setdefault(key, []).append(ptext)

    # A migration whose function a later one rewrites, or whose index a later one drops, counts
    # as applied when that later migration is (its own change is superseded there).
    final = [None] * len(entries)
    for i in range(len(entries) - 1, -1, -1):
        e = entries[i]
        check, how = e['own'], e['how']
        superseder = None
        if e['replaced']:
            kind, obj = e['replaced']
            for j in range(i + 1, len(entries)):
                later = entries[j]
                if kind == 'func' and obj in later['funcs']:
                    superseder = j; break
                if kind == 'index' and re.search(r'drop index (?:if exists )?(?:public\.)?' + obj + r'\b', later['sql']):
                    superseder = j; break
        if check and superseder is not None and final[superseder][0]:
            check = f"({check} or {final[superseder][0]})"
            how = f"{how}, or superseded by {entries[superseder]['name'][:4]}"
        final[i] = (check, how)
    rows = [(e['name'], final[i][0] or 'null', final[i][1] or 'cannot tell: check by hand') for i, e in enumerate(entries)]
    print('-- Which migrations are applied on this Supabase project? Read-only; changes nothing.')
    print(f'-- Built from {len(rows)} migration files by check_applied_migrations.py.')
    print('select migration, applied, checked_by\nfrom (values')
    print(',\n'.join(f"  ({q(n)}, {c}, {q(h)})" for n, c, h in rows))
    print(') as m(migration, applied, checked_by)\norder by migration;')


if __name__ == '__main__':
    main()
