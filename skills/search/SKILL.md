---
description: Search conversations by name or content keyword
---

Search Claude Code conversations using the provided query. Run:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js search "$ARGUMENTS"
```

If no arguments provided, ask the user what they want to search for.

Show results and offer to:
1. Rename any result
2. Resume any result (provide the `claude --resume <uuid>` command)
