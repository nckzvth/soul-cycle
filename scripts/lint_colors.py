#!/usr/bin/env python3
"""
Reports raw color literals that should be replaced by semantic tokens.

Default: report-only (exit 0).
Strict:  `python3 scripts/lint_colors.py --strict` (exit 1 if any findings).
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class Finding:
    file: str
    line: int
    col: int
    kind: str
    snippet: str


HEX_RE = re.compile(r"#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b")
# Only flag *numeric* rgb(a)/hsl(a). `rgba(var(--token-rgb), 0.5)` is allowed.
RGBA_RE = re.compile(r"\brgba?\(\s*\d")
HSLA_RE = re.compile(r"\bhsla?\(\s*\d")
NAMED_RE = re.compile(r"""(["'`])(?:white|black|red|green|blue|purple|orange|gold|gray|grey)\1""")
ROLE_BORROW_WORLD_RE = re.compile(r"\bPALETTE\.(?:moss|rotwood|rust|deepStone|midStone)\b")


def iter_files(root: Path) -> Iterable[Path]:
    exclude_dirs = {".git", "node_modules", "notes"}
    include_ext = {".js", ".html", ".css"}

    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in exclude_dirs]
        for name in filenames:
            p = Path(dirpath) / name
            if p.suffix in include_ext:
                yield p


def line_col(text: str, idx: int) -> tuple[int, int]:
    line = 1
    last_nl = -1
    for m in re.finditer(r"\n", text[:idx]):
        line += 1
        last_nl = m.start()
    col = idx - last_nl
    return line, col


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true")
    args = ap.parse_args()

    root = Path.cwd()
    exclude_files = {
        root / "src" / "data" / "Palette.js",
        root / "src" / "render" / "Color.js",
    }

    patterns = [
        ("hex", HEX_RE),
        ("rgb/rgba", RGBA_RE),
        ("hsl/hsla", HSLA_RE),
        ("named", NAMED_RE),
    ]

    findings: list[Finding] = []
    sensitive_role_files = {
        "src/data/Balance.js",
        "src/entities/Enemy.js",
        "src/entities/Projectile.js",
        "src/states/TownState.js",
        "src/systems/UI.js",
    }

    for p in iter_files(root):
        if p in exclude_files:
            continue
        try:
            text = p.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue

        rel = str(p.relative_to(root))

        if rel in sensitive_role_files:
            for m in ROLE_BORROW_WORLD_RE.finditer(text):
                ln, col = line_col(text, m.start())
                findings.append(Finding(file=rel, line=ln, col=col, kind="role-borrow", snippet=m.group(0)))

        # Allow palette hexes inside the first `:root{...}` block in `index.html`.
        root_block = None
        if rel == "index.html":
            start = text.find(":root{")
            if start != -1:
                end = text.find("}", start)
                if end != -1:
                    root_block = (start, end)

        for kind, rx in patterns:
            for m in rx.finditer(text):
                if kind == "hex" and root_block and root_block[0] <= m.start() <= root_block[1]:
                    continue
                if kind == "hex" and m.group(0).lower() == "#000":
                    ln, _ = line_col(text, m.start())
                    line_text = text.splitlines()[ln - 1] if ln - 1 < len(text.splitlines()) else ""
                    if "mask" in line_text:
                        continue
                ln, col = line_col(text, m.start())
                findings.append(Finding(file=rel, line=ln, col=col, kind=kind, snippet=m.group(0)))

    if not findings:
        return 0

    findings.sort(key=lambda f: (f.file, f.line, f.col))
    for f in findings:
        sys.stdout.write(f"{f.file}:{f.line}:{f.col} [{f.kind}] {f.snippet}\n")

    return 1 if args.strict else 0


if __name__ == "__main__":
    raise SystemExit(main())
