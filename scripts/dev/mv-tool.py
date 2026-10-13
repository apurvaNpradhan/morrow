#!/usr/bin/env python3
"""Move files and rewrite every import that points at them.

usage: mv-tool.py [--alias PREFIX=DIR] <mapping.json> <key-root> <scope-dir> ...
Mapping keys/values are paths relative to <key-root>. Imports are rewritten in
every .ts/.tsx file under the scope dirs. An alias such as `@/=apps/web/src`
(DIR relative to <key-root>) makes `@/x` specifiers follow moves too.
"""
import json, os, re, subprocess, sys

args = sys.argv[1:]
alias_prefix = alias_dir = None
if args and args[0] == "--alias":
    alias_prefix, alias_dir = args[1].split("=", 1)
    args = args[2:]
mapping_file, key_root = args[0], os.path.abspath(args[1])
scopes = [os.path.abspath(p) for p in args[2:]]
alias_root = os.path.join(key_root, alias_dir) if alias_dir else None
mapping = {
    os.path.join(key_root, k): os.path.join(key_root, v)
    for k, v in json.load(open(mapping_file)).items()
}

files = []
for scope in scopes:
    for dp, dn, fn in os.walk(scope):
        dn[:] = [d for d in dn if d not in ("node_modules", "dist", ".git", ".claude")]
        files += [os.path.join(dp, f) for f in fn if f.endswith((".ts", ".tsx"))]


def resolve(base_dir, spec):
    cand = os.path.normpath(os.path.join(base_dir, spec))
    for ext in (".ts", ".tsx"):
        if os.path.isfile(cand + ext):
            return cand + ext, "bare"
    if os.path.isfile(cand):
        return cand, "ext"
    for idx in ("index.ts", "index.tsx"):
        if os.path.isfile(os.path.join(cand, idx)):
            return os.path.join(cand, idx), "dir"
    return None, None


PATTERN = re.compile(
    r"""((?:from\s+|import\s*\(\s*|import\s+|vi\.mock\(\s*|vi\.doMock\(\s*|vi\.importActual\(\s*|require\(\s*))(["'])((?:\.{1,2}(?:/[^"']*)?)|(?:@/[^"']*))\2"""
)
problems, new_contents = [], {}
for f in files:
    new_f = mapping.get(f, f)

    def repl(m):
        spec = m.group(3)
        aliased = bool(alias_prefix) and spec.startswith(alias_prefix)
        if aliased:
            target, kind = resolve(alias_root, spec[len(alias_prefix):])
        else:
            target, kind = resolve(os.path.dirname(f), spec)
        if target is None:
            problems.append((f, spec))
            return m.group(0)
        new_target = mapping.get(target, target)
        # A directory import of a file renamed away from index.* must now name the file.
        if kind == "dir" and not re.match(r"index\.tsx?$", os.path.basename(new_target)):
            kind = "bare"
        if kind == "dir":
            path = os.path.dirname(new_target)
        elif kind == "bare":
            path = re.sub(r"\.(tsx?)$", "", new_target)
        else:
            path = new_target
        if aliased:
            return f"{m.group(1)}{m.group(2)}{alias_prefix}{os.path.relpath(path, alias_root)}{m.group(2)}"
        rel = os.path.relpath(path, os.path.dirname(new_f))
        if rel == "." and kind == "bare":
            # a file next to a directory of the same name
            rel = "../" + os.path.basename(path)
        if rel != "." and not rel.startswith("."):
            rel = "./" + rel
        return f"{m.group(1)}{m.group(2)}{rel}{m.group(2)}"

    new_contents[f] = PATTERN.sub(repl, open(f).read())

for f, spec in problems:
    print("UNRESOLVED", os.path.relpath(f), spec)
for old, new in mapping.items():
    if not os.path.exists(old):
        print("MISSING SOURCE", old)
        continue
    os.makedirs(os.path.dirname(new), exist_ok=True)
    subprocess.check_call(["git", "mv", old, new])
for f, content in new_contents.items():
    dest = mapping.get(f, f)
    if open(dest).read() != content:
        open(dest, "w").write(content)
print("moved", len(mapping), "files; checked", len(files))
