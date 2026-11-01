# Privacy Policy - chat-namer

## Data Collection

This plugin does **not** collect, store, or transmit any user data to external servers.

## How it Works

- The plugin reads Claude Code conversation files stored locally on your machine (`~/.claude/projects/`)
- Conversation names are stored in a local `chat-names.json` file alongside your existing conversation files
- All processing happens locally on your machine
- No network requests are made
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

## Permissions

The plugin requires filesystem access only to read conversation files and write the `chat-names.json` naming metadata and the cache file.

## Contact

For questions about this privacy policy, open an issue at https://github.com/Jamaalx/claude-chat-namer/issues
