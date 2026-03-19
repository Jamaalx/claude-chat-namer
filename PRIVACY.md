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

The only file created by this plugin is `chat-names.json` in each project directory under `~/.claude/projects/`. This file contains:

- Conversation UUIDs (already present in the filenames)
- Human-readable names generated from the first message
- Timestamps of when names were created

## Permissions

The plugin requires filesystem access only to read conversation files and write the `chat-names.json` naming metadata.

## Contact

For questions about this privacy policy, open an issue at https://github.com/Jamaalx/claude-chat-namer/issues
