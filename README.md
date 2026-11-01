# claude-chat-namer

[![CI](https://github.com/Jamaalx/claude-chat-namer/actions/workflows/ci.yml/badge.svg)](https://github.com/Jamaalx/claude-chat-namer/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/claude-chat-namer)](https://www.npmjs.com/package/claude-chat-namer)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Claude Code plugin** that names, searches, and helps you resume your conversations. No more UUID chaos.

Listed in Anthropic's plugin directory.

Claude Code stores conversations as UUID-named `.jsonl` files. This plugin names them, searches everything you typed across all your projects, gives you a `claude --resume` command that works from anywhere, and can pull an old conversation's context into the one you are in.

> Works wherever Claude Code keeps its transcripts on disk: the terminal, the desktop app and the IDE extensions. In claude.ai chats there are no local transcripts to read.

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

### Real names, from wherever they come from

Every conversation gets the best name available, tagged with its source:

| Tag | Source |
|-----|--------|
| `[renamed]` | you used `/rename` inside Claude Code |
| `[named]` | you named it with chat-namer |
| `[ai]` | the title Claude Code generated |
| `[summary]` | the compaction summary |
| `[auto]` | the first thing you typed (slash commands are skipped) |

A `Stop` hook also gives each new conversation a first-message name after its first exchange, as a fallback. No configuration needed.

### Search everything you typed, in every project

```
> /chat-namer:search stripe webhook

2 result(s) for "stripe webhook":

  1. [renamed] Stripe billing
     Oct 28, 09:12 PM | 214 msgs | 1890 KB | /home/me/shop | eeee5555-...
  2. [ai] Checkout refactor
     Oct 12, 04:40 PM | 96 msgs | 702 KB | /home/me/api | 1a2b3c4d-...
     "...then verify the stripe webhook signature before we mark the order paid..."
```

Every word must match, in any order. Title hits come first; content hits show where they matched. Subagent traffic and tool output are left out.

### Resume from anywhere

`claude --resume <uuid>` only finds a conversation from the directory it was started in. chat-namer gives you the full command:

```
> /chat-namer:resume stripe

  Stripe billing

  Run in a new terminal:
    cd /home/me/shop && claude --resume eeee5555-5555-4555-8555-555555555555
```

From a terminal, `claude-chat-namer resume stripe` launches it directly.

### Recap: continue an old thread here

```
> /chat-namer:recap checkout refactor
```

Claude reads the last exchanges of that conversation (your messages and its answers, no tool output) and tells you where it stopped, so you can carry on in the current session without switching.

### Slash Commands (inside Claude Code)

| Command | Description |
|---------|-------------|
| `/chat-namer:list [all]` | List conversations (this project, or all) |
| `/chat-namer:search <query>` | Search titles and everything you typed, across all projects |
| `/chat-namer:resume <query>` | Get the `cd <dir> && claude --resume <uuid>` command |
| `/chat-namer:recap <query>` | Pull an earlier conversation's last messages into this one |
| `/chat-namer:rename` | Rename a conversation |
| `/chat-namer:auto-name` | Give a first-message name to every unnamed conversation |

### CLI Usage

```bash
claude-chat-namer                          # Interactive mode (browse + rename)
claude-chat-namer list [--all]             # List conversations
claude-chat-namer search stripe --all      # Search titles and content
claude-chat-namer resume stripe --all      # Jump back in, in the right directory
claude-chat-namer recap stripe --all       # Print the last messages
claude-chat-namer name c348 "Wolt Automation"  # Name by UUID prefix
claude-chat-namer unname c348              # Remove a name
claude-chat-namer auto                     # Auto-name all unnamed
claude-chat-namer help                     # All commands and options
```

Options: `--all`, `--project <name>`, `--limit <n>`, `--json` (machine-readable, for scripts and agents), `--print` (resume: only print), `--turns <n>` (recap).

### Fast on big histories

Transcripts are streamed, never loaded whole, and the metadata is cached. Transcripts are append-only, so a grown file is read only from where the last run stopped. On 8 GB of transcripts (577 conversations): about 4 s the first time, about 0.3 s after that.

## How it Works

1. Scans `~/.claude/projects/` (or `$CLAUDE_CONFIG_DIR/projects/`) for conversation `.jsonl` files
2. Reads titles, the directory, and what you typed from each transcript
3. Stores your names in a `chat-names.json` file (per project directory) and a speed cache in `~/.claude/chat-namer/`
4. **Never modifies conversation files** and makes no network requests. See [PRIVACY.md](PRIVACY.md)

## Plugin Structure

```
claude-chat-namer/
├── .claude-plugin/
│   ├── plugin.json           # Plugin manifest
│   └── marketplace.json      # Marketplace manifest (lets you `claude plugin install` this repo)
├── assets/icon.svg           # Directory icon
├── skills/
│   ├── list/SKILL.md         # /chat-namer:list
│   ├── search/SKILL.md       # /chat-namer:search
│   ├── rename/SKILL.md       # /chat-namer:rename
│   ├── resume/SKILL.md       # /chat-namer:resume
│   ├── recap/SKILL.md        # /chat-namer:recap
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
