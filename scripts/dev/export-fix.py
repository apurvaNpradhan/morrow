#!/usr/bin/env python3
"""Fix `morrow/vertical-boundaries` violations in the web app.

Reads `vp lint` output, adds the imported symbols to the target vertical's
index.ts, and points the importing statements at that index.
usage: export-fix.py <web-src-dir> < lint-output
"""
import os, re, sys, collections

SRC = os.path.abspath(sys.argv[1])
ALIAS = "@/"
violation = re.compile(
    r'^(?P<file>\S+?):(?P<line>\d+):\d+: error morrow\(vertical-boundaries\): Import "(?P<spec>[^"]+)" reaches into the "(?P<vert>[\w-]+)" vertical'
)
by_file = collections.defaultdict(set)
for line in sys.stdin:
    m = violation.match(line.strip())
    if m:
        by_file[os.path.abspath(m["file"])].add((m["spec"], m["vert"]))


def resolve_target(importer, spec):
    base = os.path.join(SRC, spec[len(ALIAS):]) if spec.startswith(ALIAS) else os.path.normpath(os.path.join(os.path.dirname(importer), spec))
    for ext in (".ts", ".tsx"):
        if os.path.isfile(base + ext):
            return base + ext
    for idx in ("index.ts", "index.tsx"):
        if os.path.isfile(os.path.join(base, idx)):
            return os.path.join(base, idx)
    return None


IMPORT = re.compile(r'import\s+(type\s+)?(?P<clause>[^;]*?)\s+from\s+(?P<q>["\'])(?P<spec>[^"\']+)(?P=q);?\n?', re.S)
index_exports = collections.defaultdict(lambda: collections.OrderedDict())  # vert -> key -> statement
default_names = {}  # target file -> canonical default export name


def read_index_exports(vert):
    path = os.path.join(SRC, vert, "index.ts")
    return open(path).read() if os.path.exists(path) else ""


def parse_clause(clause):
    default = None
    named = []
    clause = clause.strip()
    m = re.match(r"^(\w+)\s*,\s*(\{.*\})$", clause, re.S)
    if m:
        default, clause = m.group(1), m.group(2)
    elif not clause.startswith("{") and not clause.startswith("*"):
        return clause, [], False
    if clause.startswith("{"):
        for part in clause.strip("{} \n").split(","):
            part = part.strip()
            if not part:
                continue
            is_type = part.startswith("type ")
            part = part[5:] if is_type else part
            name, _, local = part.partition(" as ")
            named.append((name.strip(), (local or name).strip(), is_type))
        return default, named, False
    return None, [], True  # namespace import


changed = 0
for importer, items in by_file.items():
    text = open(importer).read()
    for spec, vert in sorted(items):
        target = resolve_target(importer, spec)
        if not target:
            print("UNRESOLVED", importer, spec)
            continue
        inside = os.path.relpath(target, os.path.join(SRC, vert))
        inside = re.sub(r"\.(tsx?)$", "", inside)
        rel_in_index = "./" + inside
        if os.path.basename(inside) == "index":
            rel_in_index = "./" + os.path.dirname(inside) if os.path.dirname(inside) else "./"
        def rewrite(m):
            if m["spec"] != spec:
                return m.group(0)
            is_type_stmt = bool(m.group(1))
            default, named, ns = parse_clause(m["clause"])
            if ns:
                print("NAMESPACE import needs manual fix", importer, spec)
                return m.group(0)
            new_named = []
            for name, local, is_type in named:
                key = name
                kw = "type " if (is_type or is_type_stmt) else ""
                index_exports[vert].setdefault(("n", rel_in_index, name), (kw, name))
                new_named.append(f"{kw}{name}" + (f" as {local}" if local != name else ""))
            if default:
                canon = default_names.setdefault(target, default)
                index_exports[vert].setdefault(("d", rel_in_index, canon), ("", canon))
                if canon == default:
                    new_named.append(default if False else canon)
                else:
                    new_named.append(f"{canon} as {default}")
            quote = m["q"]
            target_spec = ALIAS + vert if spec.startswith(ALIAS) else (os.path.relpath(os.path.join(SRC, vert), os.path.dirname(importer)))
            if not spec.startswith(ALIAS) and not target_spec.startswith("."):
                target_spec = "./" + target_spec
            prefix = "import type " if is_type_stmt and not any(n.startswith("type ") for n in new_named) else "import "
            return f"{prefix}{{ {', '.join(new_named)} }} from {quote}{target_spec}{quote};\n"
        text = IMPORT.sub(rewrite, text)
    open(importer, "w").write(text)
    changed += 1

for vert, entries in index_exports.items():
    path = os.path.join(SRC, vert, "index.ts")
    existing = read_index_exports(vert)
    lines = []
    for (kind, rel, name), (kw, _) in entries.items():
        if re.search(rf"\b{re.escape(name)}\b", existing):
            continue
        if kind == "n":
            lines.append(f'export {{ {kw}{name} }} from "{rel}";')
        else:
            lines.append(f'export {{ default as {name} }} from "{rel}";')
    if lines:
        body = existing + ("\n" if existing and not existing.endswith("\n") else "") + "\n".join(lines) + "\n"
        open(path, "w").write(body)
print("rewrote", changed, "files")
