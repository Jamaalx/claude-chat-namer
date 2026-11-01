# Privacy Policy - chat-namer

## Data Collection

This plugin does **not** collect, store, or transmit any user data to external servers.

## How it Works

- The plugin reads Claude Code conversation files stored locally on your machine (`~/.claude/projects/`)
- Conversation names are stored in a local `chat-names.json` file alongside your existing conversation files
- All processing happens locally on your machine
- No network requests are made by the plugin
- No analytics or telemetry

## Data Storage

The plugin creates two kinds of local files, both inside your Claude Code
config directory (`~/.claude`, or `$CLAUDE_CONFIG_DIR`):

1. `chat-names.json` in each project directory under `~/.claude/projects/`:
   - Conversation UUIDs (already present in the filenames)
   - Names you set, or names generated from the first message
   - Timestamps of when names were created
2. `~/.claude/chat-namer/cache.json` (since 1.1.0), a speed cache so listing
   and searching thousands of conversations stays fast:
   - Per transcript: size, modification time and how far it was read
   - Its title, directory, message count, first message, and up to 64 KB of
     the text you typed in it (used for full-text search)

   It holds a subset of what is already in your transcripts, in the same
   directory, and never leaves your machine. Delete it at any time; it is
   rebuilt on the next run.

## Across machines (optional, off until you set it up)

When you run `sync init`, chat-namer writes into the folder you chose:

- `machines/<this machine>/index.json` and `recaps/`: for up to 300 recent
  conversations, the title, working directory, message count, the first
  message, up to 16 KB of what you typed, and the last exchanges between you
  and Claude (no tool output). Before writing, it replaces anything that
  looks like a secret (API keys, tokens, JWTs, private keys, passwords,
  credentials in URLs, long random strings) with `[redacted]`. Redaction is
  pattern-based and can miss things, so exclude projects with sensitive
  data (`sync init --exclude ...`); excluded projects are never written.
- `sent/<id>/`: the **full, unredacted** transcript of a conversation, only
  when you run `send` for it.
- `inbox/`: files you put there yourself.

Where that folder goes is up to you. With a cloud folder (Dropbox, OneDrive,
Google Drive, iCloud) its contents are stored by that provider; with
Syncthing they travel encrypted between your own devices.

chat-namer itself still makes no network requests. Locally it may run
`tailscale status` (to name the machine) and `tailscale file get` (to
collect files sent to this machine with Taildrop into the inbox, when you
ask for the inbox).

`receive` writes a sent conversation into Claude Code's own projects folder
(`~/.claude/projects/`) so `claude --resume` can find it, with its working
directory changed to the local path. If a copy already exists it is only
replaced with `--force`, and the old copy is kept as a backup.

## Permissions

The plugin requires filesystem access only to read conversation files, write the `chat-names.json` naming metadata and the cache file, and, when you set up sync, read and write the folder you chose.

## Contact

For questions about this privacy policy, open an issue at https://github.com/Jamaalx/claude-chat-namer/issues
