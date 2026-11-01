---
name: find
description: Find, list or get back to an earlier conversation with Claude. Use whenever the user refers to a past chat or session in any language, e.g. "where did we talk about X", "that chat about X", "find the conversation where...", "open/resume the X chat", "what were my recent chats", "unde am vorbit despre X", "găsește chat-ul cu X". Not for searching code or files.
---

Find the earlier conversation the user means and help them get back to it. Use the first path that works.

## A. Claude Code (you can run shell commands)

Search everything the user typed, in every project (all words must match, any order):
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" search "<keywords>" --all --json --limit 8
```
With no topic ("my recent chats"), list instead:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" list --all --json --limit 10
```
Pick 2–4 short keywords from the user's words; if nothing matches, retry once with fewer or synonym keywords.

Reply with a short numbered list: title, date, directory, and for content matches the snippet. When one result clearly fits, give its `resume` field as the command to run in a new terminal, exactly as printed (it starts with `cd`, because `claude --resume` only works from the session's directory). If they would rather continue here, offer to recap it (the `recap` skill).

If the command says no Claude Code transcripts were found, use path B.

## B. Claude.ai and other Claude apps

If you have tools for searching or listing the user's past chats (such as `conversation_search` or `recent_chats`), use them with the user's keywords. Reply with a short numbered list: a clear title of a few words for each chat (write one if the chat has none), when it happened, one line on what it was about, and its link.

## C. Neither is available

Say plainly that you can't see past conversations here. In Claude.ai that needs the setting that lets Claude search and reference past chats (Settings > Capabilities, on plans that include it); in Claude Code it works out of the box.
