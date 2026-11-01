---
description: Give a chat-namer name (from the first message) to every conversation that has no name yet
---

Auto-name all conversations that don't have a custom name yet:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" auto
```

Then show the updated list:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" list
```
