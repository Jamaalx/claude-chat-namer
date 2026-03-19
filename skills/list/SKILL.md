---
description: List all Claude Code conversations with their names, dates, and message counts
---

Run the chat-namer list command to show all conversations:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js list
```

Present the output to the user in a clean format. The output shows:
- `[named]` (green) = has a custom name
- `[auto]` (gray) = auto-generated name from first message
- Date, message count, size, and UUID prefix for each conversation

If the user wants to rename one, ask which number and what name to give it, then use:
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js name <uuid-prefix> "<new-name>"
```
