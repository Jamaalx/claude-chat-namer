---
description: Find and resume a previous conversation by name or keyword instead of UUID
---

Help the user find and resume a previous Claude Code conversation.

**Step 1**: If the user provided arguments (e.g. `/chat-namer:resume wolt`), search for it:
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js search "$ARGUMENTS"
```

If no arguments, list recent conversations:
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js list
```

**Step 2**: Show the results and ask the user which conversation they want to resume.

**Step 3**: Once they pick one, give them the exact command to run in a NEW terminal:

```
claude --resume <full-uuid>
```

Important notes:
- The `claude --resume` command must be run in a NEW terminal session, not inside this one
- Always provide the FULL UUID (not just the prefix) so the resume command works correctly
- You can also mention they can use `claude --resume` without arguments to open the interactive picker
- If they want to continue THIS session, they don't need resume - they're already in it
