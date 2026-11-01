---
name: inbox
description: Get files the user sent from another device, such as a screenshot or photo, without scp. Use when the user says "look at the screenshot I just sent", "check the latest picture in the inbox", "am trimis o poză", "uită-te la ultimul screenshot", or asks how to send a file from their laptop or phone to this machine.
---

Files arrive in the `inbox` subfolder of the chat-namer sync folder. With Tailscale, files sent to this machine with Taildrop ("Send with Tailscale" from the file's menu on Windows, macOS, iOS or Android) are collected into it automatically when you check.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" inbox --latest --json
```
Use `--limit <n>` instead of `--latest` for several files. Open the returned path with your file-reading tool (images are shown to you) and continue with what the user asked about it.

If sync is not set up, explain the two ways to send files here:
- with Tailscale: "Send with Tailscale" on the file, pick this machine, then ask again;
- otherwise: put the file in the `inbox` folder inside the synced folder on the other device (set up with the `sync-setup` skill).

If the inbox is empty and the user just sent something, the folder may still be syncing: wait a few seconds and check again once.
