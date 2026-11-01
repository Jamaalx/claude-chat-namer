---
name: rename
description: Give a conversation a clear name, or name all unnamed conversations at once. Use when the user wants to name, rename or title a chat or session, in any language, e.g. "name this chat", "rename the X conversation to Y", "give my chats proper names", "redenumește chat-ul".
---

## A. Claude Code (you can run shell commands)

This conversation: run `/rename <name>`, which is built into Claude Code, and the name shows up everywhere, including `claude --resume`. Suggest a name of 2–5 words from what the conversation is about.

Another conversation: find it (see the `find` skill), then:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" name <uuid-prefix> "<name>" --project <project>
```
Remove a name with `unname <uuid-prefix>`. To name every conversation that has no name yet from its first message: `auto` (this project) and show the result with `list`.

## B. Claude.ai and other Claude apps

You can't rename chats yourself here. Suggest a clear name of 2–5 words for the chat in question and tell the user to set it from the chat's menu (click the chat title, or the "..." next to it in the sidebar, then Rename).
