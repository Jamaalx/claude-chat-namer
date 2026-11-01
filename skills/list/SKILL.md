---
description: List Claude Code conversations with their names, dates, message counts and resume commands. Pass "all" to list every project.
---

List the conversations of the current project:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" list
```

If the user asked for all projects (e.g. `/chat-namer:list all`), add `--all` (newest 40 first; add `--limit <n>` for more).

Present the output in a clean format. The tag says where each name comes from:
- `[renamed]` = set with `/rename` inside Claude Code
- `[named]` = set by the user with chat-namer
- `[ai]` = title Claude Code generated
- `[summary]` = compaction summary
- `[auto]` = derived from the first message

Each entry shows the date, message count, size and full UUID.

If the user wants to rename one, ask which number and what name to give it, then run:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" name <uuid-prefix> "<new-name>"
```

If the command says no Claude Code transcripts were found, tell the user that chat-namer works in Claude Code (terminal, desktop app, IDE), where conversations are stored on their machine, and stop.
