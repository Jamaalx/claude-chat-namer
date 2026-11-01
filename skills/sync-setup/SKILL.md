---
name: sync-setup
description: Set up chat-namer across several machines (laptop, server, desktop) so the user can search, recap and move conversations between them. Use when the user wants their Claude Code conversations available on another computer, asks to "sync chats between machines", "connect my laptop and my server", "sincronizează chat-urile între mașini", or to check that sync works.
---

chat-namer never talks to the network itself. Each machine writes a small, redacted index of its conversations into one folder, and the user keeps that folder in sync between machines with a tool of their choice. Your job: pick the transport with the user, set it up on THIS machine, and run `sync init`. You can only configure the machine you run on; the user repeats this on each machine (2–3 minutes each).

## 1. See what this machine has

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" sync status
tailscale status 2>/dev/null | head -5
syncthing --version 2>/dev/null
```
Also look for cloud folders: `~/Dropbox`, `~/OneDrive*`, `~/Google Drive`, `~/Library/CloudStorage/*`, `~/Library/Mobile Documents/com~apple~CloudDocs` (macOS), `%USERPROFILE%\OneDrive` (Windows).

## 2. Recommend a transport, and let the user choose

1. **Syncthing over Tailscale**, when Tailscale is running on the machines: direct and private, nothing goes through a cloud. Recommended for anyone with client data in their chats.
2. **A cloud folder they already have** (Dropbox, OneDrive, Google Drive, iCloud): nothing to install. Say plainly that the index (titles, what they typed, recent exchanges, with secrets redacted) is then stored by that provider.
3. **Syncthing without Tailscale**: works over the internet, end-to-end encrypted, through Syncthing relays when needed.
4. **A private git repo**: for developers who prefer it; they commit and push the folder themselves (or schedule it).

## 3. Set up the transport on this machine

**Cloud folder:** use a subfolder such as `<cloud folder>/chat-namer`. Nothing else to install.

**Syncthing** (ask before installing anything; use the system's package manager):
- Linux: `sudo apt install syncthing` (or the distro equivalent), then `systemctl --user enable --now syncthing` (or `sudo systemctl enable --now syncthing@$USER` on servers without a user session).
- macOS: `brew install syncthing && brew services start syncthing`
- Windows: `winget install Syncthing.Syncthing`, then start it once (`syncthing` in a terminal, or enable "Start at login" in its tray app).

Then, with Syncthing running (commands verified on Syncthing 2.x):
```bash
syncthing device-id                                   # this machine's code
syncthing cli config folders add --id chat-namer --label chat-namer --path <folder>
```
Show the user this machine's device ID and ask for the other machine's ID. To connect them:
```bash
syncthing cli config devices add --device-id <OTHER-ID> --name <other machine name> [--addresses tcp://<other tailscale ip>:22000]
syncthing cli config folders chat-namer devices add --device-id <OTHER-ID>
```
With Tailscale, pass `--addresses` with the other machine's Tailscale IP (`tailscale status` lists them) so traffic stays on the tailnet. If the other machine already added this one, `syncthing cli show pending devices` lists it; add it with the two commands above.

## 4. Turn on chat-namer sync

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" sync init --dir "<folder>" [--exclude <project1,project2>]
```
Ask whether any projects must never leave this machine (client data, secrets) and pass them in `--exclude`. The machine name defaults to its Tailscale name, else its hostname; `--machine <name>` overrides it.

## 5. Check

After the other machine is set up too and the folder has synced (a minute or two):
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" sync status
```
Both machines should be listed. From then on the index refreshes on its own after each Claude reply (at most every 2 minutes).
