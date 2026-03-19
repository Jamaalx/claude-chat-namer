# claude-chat-namer

**Claude Code plugin** that names, searches, and helps you resume your conversations. No more UUID chaos.

Claude Code stores conversations as UUID-named `.jsonl` files. This plugin auto-names them, lets you search/rename, and makes `claude --resume` actually usable.

## Install as Plugin

```bash
# Test locally
claude --plugin-dir /path/to/claude-chat-namer

# Or install from marketplace (once published)
claude plugin install chat-namer@marketplace
```

## Install as CLI

```bash
npm install -g claude-chat-namer
```

## Plugin Features (inside Claude Code)

### Slash Commands

| Command | Description |
|---------|-------------|
| `/chat-namer:list` | List all conversations with names |
| `/chat-namer:search <query>` | Search conversations by keyword |
| `/chat-namer:rename` | Rename a conversation |
| `/chat-namer:resume <query>` | Find a conversation to resume |
| `/chat-namer:auto-name` | Auto-name all unnamed conversations |

### Auto-Naming Hook

The plugin includes a `Stop` hook that automatically names every conversation after the first exchange. Names are generated from the first user message. No configuration needed.

### Resume Helper

Instead of scrolling through UUIDs, use `/chat-namer:resume`:

```
> /chat-namer:resume wolt

Found 4 conversations matching "wolt":

  1. [named] Wolt Automation - Camoufox
     Mar 19 | 1088 msgs | c348d36f...

  2. [auto] Implement Wolt Purchases plan...
     Feb 18 | 361 msgs | c0e56e5c...

Which one? > 1

Run in a new terminal:
  claude --resume c348d36f-8002-40ca-8523-17821d6a0bea
```

## CLI Usage (standalone)

```bash
# Interactive mode
claude-chat-namer

# List all conversations
claude-chat-namer list

# Name a conversation (use UUID prefix)
claude-chat-namer name c348d36f "Wolt automation"

# Search
claude-chat-namer search "wolt"

# Auto-name all unnamed
claude-chat-namer auto

# Remove a name
claude-chat-namer unname c348d36f

# Select specific project
claude-chat-namer list --project alexd
```

## How it Works

1. Scans `~/.claude/projects/` for conversation `.jsonl` files
2. Reads the first user message to generate auto-names
3. Stores names in a `chat-names.json` file (per project)
4. **Never modifies conversation files** — names are separate metadata

## Plugin Structure

```
claude-chat-namer/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest
├── skills/
│   ├── list/SKILL.md        # /chat-namer:list
│   ├── search/SKILL.md      # /chat-namer:search
│   ├── rename/SKILL.md      # /chat-namer:rename
│   ├── resume/SKILL.md      # /chat-namer:resume
│   └── auto-name/SKILL.md   # /chat-namer:auto-name
├── hooks/
│   └── hooks.json            # Stop hook for auto-naming
├── scripts/
│   ├── index.js              # Core API
│   ├── cli.js                # CLI interface
│   └── hook-auto-name.js     # Hook script
├── package.json
└── README.md
```

## Zero Dependencies

Uses only Node.js built-ins (`fs`, `path`, `os`, `readline`). No npm install needed.

## License

MIT
