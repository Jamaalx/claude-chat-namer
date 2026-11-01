---
name: move
description: Move a whole Claude Code conversation from one of the user's machines to another so it can be resumed there with `claude --resume`. Use when the user asks to "send this chat to my laptop", "move the conversation about X to the server", "bring the chat from the server here", "trimite chat-ul ăsta pe laptop", "adu chat-ul de pe server". Needs chat-namer sync (the `sync-setup` skill).
---

Moving a conversation copies its full transcript through the user's sync folder. It is experimental: the transcript format belongs to Claude Code and is not documented, so it may need updating when Claude Code changes. It only happens when the user asks.

If `node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" sync status` says sync is not set up, offer the `sync-setup` skill first (on both machines). Do not suggest continuing on the other machine without it: without sync the other machine cannot see this one's conversations.

## On the machine that has the conversation: send

This conversation, or one found by keywords:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" send "<keywords or uuid>" --all --to <machine>
```
For the current conversation use its session id (from the transcript path or `/status`). The full transcript is not redacted: if the sync folder is a cloud folder, say so before sending.

Then tell the user to open Claude Code on the other machine and ask there to bring the conversation (or run `claude-chat-namer receive`).

## On the machine that should continue it: receive

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" receive                  # list what was sent
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" receive "<keywords or uuid>"
```
If it asks where the project lives on this machine, ask the user and either pass `--cwd "<local folder>"` or save the mapping once:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" sync map "<path on the other machine>" "<path here>"
```
If this machine already has that conversation, `--force` replaces it and keeps the old copy as a backup; ask first.

Give the user the printed resume command, to run in a new terminal, and remind them to update the project's code there first (for example `git pull`), so Claude sees the same files the conversation was about.

If the conversation was not sent yet, the user (or Claude on that machine) has to send it first; you cannot reach the other machine from here. Once sync is set up, a recap of a conversation from another machine (`recap` skill) works right away without sending anything. Without sync, no machine can see another machine's conversations at all.
