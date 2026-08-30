# claude-chat-namer

[![CI](https://github.com/Jamaalx/claude-chat-namer/actions/workflows/ci.yml/badge.svg)](https://github.com/Jamaalx/claude-chat-namer/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/claude-chat-namer)](https://www.npmjs.com/package/claude-chat-namer)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Claude Code plugin** that names, searches, and helps you resume your conversations. No more UUID chaos.

Claude Code stores conversations as UUID-named `.jsonl` files. This plugin auto-names them, lets you search/rename, and makes `claude --resume` actually usable.

## Install

### As Claude Code Plugin (recommended)

The repo is its own plugin marketplace. Add it once, then install the plugin:

```bash
claude plugin marketplace add Jamaalx/claude-chat-namer
claude plugin install chat-namer@claude-chat-namer
```

Or from inside Claude Code:

```
/plugin marketplace add Jamaalx/claude-chat-namer
/plugin install chat-namer@claude-chat-namer
```

Restart Claude Code (or run `/reload-plugins`) and the `/chat-namer:*` commands and the auto-naming hook are active. Update later with `claude plugin update chat-namer@claude-chat-namer`.

### Try it without installing

```bash
git clone https://github.com/Jamaalx/claude-chat-namer.git
claude --plugin-dir ./claude-chat-namer
```

### As standalone CLI

```bash
npx claude-chat-namer
```

Or install globally:

```bash
npm install -g claude-chat-namer
claude-chat-namer list
```

## Features

### Auto-Naming (Hook)

The plugin includes a `Stop` hook that **automatically names every conversation** after the first exchange. Names are generated from the first user message. No configuration needed - just install and forget.

Slash commands (`/model`, `/login`, ...) and their output are ignored, so the name comes from the first thing you actually typed.

### Slash Commands (inside Claude Code)

| Command | Description |
|---------|-------------|
| `/chat-namer:list` | List all conversations with names |
| `/chat-namer:search <query>` | Search conversations by keyword |
| `/chat-namer:rename` | Rename a conversation |
| `/chat-namer:resume <query>` | Find a conversation and get the `claude --resume` command |
| `/chat-namer:auto-name` | Auto-name all unnamed conversations at once |

### Resume Helper

Instead of scrolling through UUIDs, find any conversation by keyword:

```
> /chat-namer:resume wolt

Found 4 conversations matching "wolt":

  1. [named] Wolt Automation - Camoufox
     Mar 19 | 1088 msgs | c348d36f...

  2. [named] Implement Wolt Purchases plan...
     Feb 18 | 361 msgs | c0e56e5c...

Run in a new terminal:
  claude --resume c348d36f-8002-40ca-8523-17821d6a0bea
```

### CLI Usage

```bash
claude-chat-namer              # Interactive mode (browse + rename)
claude-chat-namer list          # List all conversations
claude-chat-namer search "wolt" # Search by keyword
claude-chat-namer name c348 "Wolt Automation"  # Name by UUID prefix
claude-chat-namer unname c348   # Remove a name
claude-chat-namer auto          # Auto-name all unnamed
claude-chat-namer help          # Show all commands
```

## How it Works

1. Scans `~/.claude/projects/` for conversation `.jsonl` files
2. Reads the first user message to generate auto-names
3. Stores names in a `chat-names.json` file (per project directory)
4. **Never modifies conversation files** - names are separate metadata

## Plugin Structure

```
claude-chat-namer/
├── .claude-plugin/
│   ├── plugin.json           # Plugin manifest
│   └── marketplace.json      # Marketplace manifest (lets you `claude plugin install` this repo)
├── skills/
│   ├── list/SKILL.md         # /chat-namer:list
│   ├── search/SKILL.md       # /chat-namer:search
│   ├── rename/SKILL.md       # /chat-namer:rename
│   ├── resume/SKILL.md       # /chat-namer:resume
│   └── auto-name/SKILL.md    # /chat-namer:auto-name
├── hooks/
│   └── hooks.json            # Stop hook for auto-naming
├── scripts/
│   ├── index.js              # Core API
│   ├── cli.js                # CLI interface
│   └── hook-auto-name.js     # Hook script
├── test/
│   └── smoke.sh              # End-to-end test against a throwaway HOME
├── package.json
└── README.md
```

## Development

```bash
bash test/smoke.sh          # runs the CLI + hook against fake transcripts
claude plugin validate .    # checks plugin.json / marketplace.json
```

CI runs the smoke test on Node 18, 20 and 22. See [CHANGELOG.md](CHANGELOG.md) for release notes.

## Zero Dependencies

Uses only Node.js built-ins (`fs`, `path`, `os`, `readline`). No `npm install` needed.

## License

MIT
