---
description: Rename a conversation by its number or UUID prefix
---

First, list all conversations so the user can pick one:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js list
```

Then ask the user which conversation number they want to rename and what name to give it.

To rename, run:
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js name <uuid-prefix> "<new-name>"
```

To remove a name:
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js unname <uuid-prefix>
```
