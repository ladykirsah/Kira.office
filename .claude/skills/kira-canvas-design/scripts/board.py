# -*- coding: utf-8 -*-
"""Tools for the Kira design canvas boards (`<Name>Phone.dc.html`).

Import it from a design-tools script:
    sys.path.insert(0, "<repo>/.claude/skills/kira-canvas-design/scripts")
    from board import phones, match_div, card_at, TAG, CHEV

Or run it:
    python3 board.py measure <board.dc.html>
        Prints the board's content height and each phone's frame/content height,
        e.g. "board 5687 · 0: 1700/1683 · 1: 1700/1683". Content must be ≤ frame.
    python3 board.py shot <board.dc.html> <x> <y> <w> <h> <out.png> [--scale 2]
        Screenshots one region of the whole board (board pixels). Read the PNG to look at it.
"""
import os
import re
import subprocess
import sys
import tempfile

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PHONE_OPEN = '<div style="position: relative; width: 390px; height: '
# A phone's block in a row: its label, then the phone. New phones go in as BLOCK_OPEN + label + phone + "</div>".
BLOCK_OPEN = '<div style="display: flex; flex-direction: column; gap: 12px; flex-shrink: 0;">'
LINE = "box-shadow: inset 0 -1px 0 #E5E5EA;"
CHEV = ('<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" '
        'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">'
        '<path d="M9 6l6 6-6 6"/></svg>')
# The board tag for something the server does not keep yet.
TAG = ('<span style="height: 24px; padding: 0 10px; border-radius: 12px; box-shadow: inset 0 0 0 1.5px #8A8A8E; '
       'color: #515154; font-size: 13px; line-height: 24px; font-weight: 600; white-space: nowrap;">ระบบยังไม่มี</span>')


def match_div(s: str, start: int) -> int:
    """The index just after the </div> that closes the <div> starting at `start`."""
    depth = 0
    for m in re.finditer(r"<div\b|</div>", s[start:]):
        depth += 1 if m.group(0) == "<div" else -1
        if depth == 0:
            return start + m.end()
    raise ValueError("unbalanced <div> from %d" % start)


def phones(s: str) -> list[tuple[int, int]]:
    """(start, end) of every phone frame on the board, in reading order. Edit them in reverse."""
    out, pos = [], 0
    while (i := s.find(PHONE_OPEN, pos)) >= 0:
        end = match_div(s, i)
        out.append((i, end))
        pos = end
    return out


def card_at(phone: str, needle: str, start: int = 0) -> tuple[int, int]:
    """(start, end) of the white card holding the first `needle` after `start`."""
    i = phone.find(needle, start)
    if i < 0:
        raise ValueError(f"not found: {needle!r}")
    c0 = phone.rfind('<div class="card"', 0, i)
    return c0, match_div(phone, c0)


def _page(board: str, extra_js: str, auto_height: bool = False) -> str:
    t = open(board, encoding="utf-8").read()
    if auto_height:
        t = re.sub(r'(<div style="width: \d+px; height: )\d+px', r"\g<1>auto", t, count=1)
    styles = "".join(re.findall(r"<style.*?</style>", t, flags=re.S))
    inner = t[t.index("<x-dc>") + 6:t.index("</x-dc>")]
    inner = re.sub(r"<helmet>.*?</helmet>", "", inner, flags=re.S)
    return ('<!doctype html><meta charset="utf-8"><body style="margin:0;font-family:-apple-system,'
            'BlinkMacSystemFont,sans-serif;">' + styles + inner + extra_js + "</body>")


def _chrome(args: list[str]) -> str:
    return subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                           "--virtual-time-budget=3000", *args], capture_output=True, text=True).stdout


def measure(board: str) -> str:
    js = """<script>window.onload=()=>{
const ph=[...document.querySelectorAll('div')].filter(d=>/width: 390px; height: \\d+px; border-radius: 48px/.test(d.getAttribute('style')||''));
const r=ph.map((p,i)=>{const c=[...p.children].find(k=>/padding: 59px/.test(k.getAttribute('style')||''));
 return i+': '+p.style.height.replace('px','')+'/'+(c?c.scrollHeight:'?')});
document.title='board '+document.querySelector('body>div').scrollHeight+' · '+r.join(' · ');}</script>"""
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as f:
        f.write(_page(board, js, auto_height=True))
    dom = _chrome(["--dump-dom", "file://" + f.name])
    os.unlink(f.name)
    m = re.search(r"<title>([^<]*)</title>", dom)
    return m.group(1) if m else "no result (is Chrome installed?)"


def shot(board: str, x: int, y: int, w: int, h: int, out: str, scale: int = 1) -> str:
    page = _page(board, "").replace('<body style="margin:0;', f'<body style="margin:-{y}px 0 0 -{x}px;', 1)
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as f:
        f.write(page)
    _chrome([f"--force-device-scale-factor={scale}", f"--window-size={w},{h}", f"--screenshot={out}",
             "file://" + f.name])
    os.unlink(f.name)
    return out


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "measure":
        print(measure(sys.argv[2]))
    elif len(sys.argv) >= 8 and sys.argv[1] == "shot":
        scale = int(sys.argv[sys.argv.index("--scale") + 1]) if "--scale" in sys.argv else 1
        print(shot(sys.argv[2], *map(int, sys.argv[3:7]), sys.argv[7], scale=scale))
    else:
        print(__doc__)
        sys.exit(1)
