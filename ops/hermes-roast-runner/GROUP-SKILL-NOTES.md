# Group mode deploy checklist (see Task 10 of the plan)

Hermes needs, in addition to server.js:

- `~/.claude/skills/astro-roast-group/SKILL.md` (copy from Mac, same path)
- `~/synastry_offline.py` (copy from Mac ~/synastry_offline.py; check `python3 -c "import swisseph"` in /opt/roast-runner/venv first)
- Existing `~/.claude/skills/astro-roast/SKILL.md` untouched.

Smoke test: POST /roast with mode:"group", 2 people, expect charts[2] + roast.
