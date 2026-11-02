# -*- coding: utf-8 -*-
"""Print what the owner typed in a Claude Code session, oldest first, to collect lessons after a summary.

    python3 owner_messages.py <session.jsonl> [since ISO time, e.g. 2026-11-01T11:07]

Skips tool results, app text (system reminders, canvas view context, notifications), session summaries
and slash-command scaffolding, and image placeholders. Session files live in
~/.claude/projects/<project folder>/<session id>.jsonl.
"""
import json
import re
import sys

APP_TEXT = re.compile(
    r"<(system-reminder|task-notification|artifact-view-context|ci-monitor-event|command-name|command-message|"
    r"command-args|local-command-stdout|user-prompt-submit-hook)\b[^>]*>.*?</\1>",
    re.S,
)
NOT_OWNER = ("This session is being continued", "Base directory for this skill", "<artifact-content-authored-by-others",
             "[Request interrupted")


def owner_text(entry: dict) -> str:
    """The owner's own words in one user record, or ""."""
    if entry.get("type") != "user" or entry.get("toolUseResult"):
        return ""
    content = entry.get("message", {}).get("content")
    if isinstance(content, str):
        parts = [content]
    elif isinstance(content, list):
        parts = [b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text"]
    else:
        return ""
    text = APP_TEXT.sub("", " ".join(parts))
    text = re.sub(r"\[Image[^\]]*\]", "", text).strip()
    if not text or any(text.startswith(p) for p in NOT_OWNER):
        return ""
    return text


def main(path: str, since: str = "") -> None:
    for line in open(path, encoding="utf-8"):
        try:
            entry = json.loads(line)
        except ValueError:
            continue
        stamp = entry.get("timestamp", "")
        if since and stamp < since:
            continue
        text = owner_text(entry)
        if text:
            print(f"{stamp[:16]} | {text}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "")
