---
description: Search conversations by title or by anything you typed in them, in this project or across all projects
---

Search Claude Code conversations. Every word must match, in any order; title matches rank first and content matches show a snippet. Search all projects by default:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" search "$ARGUMENTS" --all
```

If the user only wants the current project, drop `--all`. If no arguments were given, ask the user what they want to search for.

Show the results and offer to:
1. Rename one (`node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" name <uuid-prefix> "<name>" --project <project>`)
2. Resume one (see `/chat-namer:resume`)
3. Pull its context into this session (see `/chat-namer:recap`)

If the command says no Claude Code transcripts were found, tell the user that chat-namer works in Claude Code (terminal, desktop app, IDE), where conversations are stored on their machine, and stop.
