---
description: Find a previous conversation by name or keyword and get the exact command to resume it, including the right directory
---

Help the user find and resume a previous Claude Code conversation.

**Step 1**: If the user gave a query or UUID prefix (e.g. `/chat-namer:resume wolt`), run:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" resume "$ARGUMENTS" --all --print
```

It prints the conversation title and a ready-to-run command. If several conversations match, it lists them instead: show the list, ask which one, and run it again with that UUID.

If no arguments were given, list recent conversations first:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" list --all --limit 15
```

**Step 2**: Give the user the exact command, to run in a NEW terminal:

```
cd <directory> && claude --resume <full-uuid>
```

Notes:
- `claude --resume` only finds a conversation from the directory it was started in; that is why the command starts with `cd`. Copy it exactly.
- Outside Claude Code, `claude-chat-namer resume <query>` launches it directly.
- If the user wants the earlier context here, in THIS session, offer `/chat-namer:recap` instead.

If the command says no Claude Code transcripts were found, tell the user that chat-namer works in Claude Code (terminal, desktop app, IDE), where conversations are stored on their machine, and stop.
