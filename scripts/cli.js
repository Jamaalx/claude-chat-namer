#!/usr/bin/env node

import { existsSync } from "fs";
import {
  getProjects,
  findProjectForDir,
  getConversations,
  nameConversation,
  unnameConversation,
  searchConversations,
  getAllConversations,
  findConversations,
  resumeCommand,
  readRecap,
  autoNameAll,
  formatConversation,
  createPrompt,
  ask,
  VERSION,
  PROJECTS_DIR,
} from "./index.js";

const args = process.argv.slice(2);
const command = args[0] || "interactive";

// Positional arguments: everything after the command that is not a flag
// (and not the value of --project).
const VALUE_FLAGS = new Set(["--project", "--limit", "--turns"]);
const positional = [];
for (let i = 1; i < args.length; i++) {
  if (VALUE_FLAGS.has(args[i])) {
    i++; // skip its value
  } else if (!args[i].startsWith("--")) {
    positional.push(args[i]);
  }
}

const flag = (f) => args.includes(f);
const flagValue = (f) => {
  const i = args.indexOf(f);
  return i !== -1 ? args[i + 1] : undefined;
};
const ALL = flag("--all");
const JSON_OUT = flag("--json");
const LIMIT = parseInt(flagValue("--limit"), 10) || (ALL ? 40 : Infinity);

// Colors
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[90m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

const NO_TRANSCRIPTS =
  `${C.yellow}  No Claude Code transcripts found in ${PROJECTS_DIR}.${C.reset}\n` +
  `${C.dim}  chat-namer reads the conversations Claude Code keeps on this machine, so it\n` +
  `  works in Claude Code (terminal, desktop app, IDE). In claude.ai chats there are\n` +
  `  no local transcripts to read.${C.reset}`;

function header() {
  if (JSON_OUT) return;
  console.log(
    `\n${C.cyan}${C.bold}  Claude Chat Namer${C.reset} ${C.dim}v${VERSION}${C.reset}`
  );
  console.log(
    `${C.dim}  Name your Claude Code conversations${C.reset}\n`
  );
}

// ─── Commands ───────────────────────────────────────────────────────────────

function toJson(conv) {
  return {
    uuid: conv.uuid,
    title: conv.title,
    source: conv.source,
    cwd: conv.cwd,
    project: conv.project,
    messages: conv.messageCount,
    lastModified: conv.lastModified.toISOString(),
    sizeKb: Math.round(conv.size / 1024),
    resume: resumeCommand(conv),
    ...(conv.match ? { match: conv.match } : {}),
    ...(conv.snippet ? { snippet: conv.snippet } : {}),
  };
}

function printConversations(list, heading) {
  const shown = list.slice(0, LIMIT);
  if (JSON_OUT) {
    console.log(JSON.stringify(shown.map(toJson), null, 2));
    return;
  }
  console.log(`${C.bold}  ${heading}${C.reset}\n`);
  shown.forEach((conv, i) => {
    console.log(formatConversation(conv, i, { showProject: ALL }));
  });
  if (list.length > shown.length) {
    console.log(`\n${C.dim}  ... ${list.length - shown.length} more (use --limit <n>)${C.reset}`);
  }
  console.log();
}

// --all → every project; otherwise the selected one.
async function loadConversations() {
  if (ALL) return getAllConversations();
  return getConversations(await selectProject());
}

async function listCommand() {
  const conversations = await loadConversations();

  if (conversations.length === 0) {
    if (JSON_OUT) console.log("[]");
    else console.log(`${C.yellow}  No conversations found.${C.reset}`);
    return;
  }

  printConversations(conversations, `${conversations.length} conversation(s)${ALL ? " in all projects" : ""}:`);
}

async function nameCommand(projectPath, uuid, name) {
  if (!uuid || !name) {
    console.log(
      `${C.yellow}  Usage: claude-chat-namer name <uuid-prefix> <name>${C.reset}`
    );
    return;
  }

  const conversations = getConversations(projectPath);
  const match = conversations.find((c) => c.uuid.startsWith(uuid));

  if (!match) {
    console.log(`${C.yellow}  No conversation matching "${uuid}"${C.reset}`);
    return;
  }

  nameConversation(projectPath, match.uuid, name);
  console.log(
    `${C.green}  ✓ Named "${match.uuid.substring(0, 8)}..." → "${name}"${C.reset}`
  );
}

async function searchCommand(query) {
  if (!query) {
    console.log(
      `${C.yellow}  Usage: claude-chat-namer search <query> [--all]${C.reset}`
    );
    return;
  }

  const results = searchConversations(await loadConversations(), query);

  if (results.length === 0) {
    if (JSON_OUT) console.log("[]");
    else console.log(`${C.yellow}  No conversations matching "${query}"${C.reset}`);
    return;
  }

  printConversations(results, `${results.length} result(s) for "${query}":`);
}

// Pick one conversation from a UUID prefix or a query; print the choices
// when it is ambiguous.
async function pickOne(ref, usage) {
  if (!ref) {
    console.log(`${C.yellow}  Usage: ${usage}${C.reset}`);
    return null;
  }
  const matches = findConversations(await loadConversations(), ref);
  if (matches.length === 0) {
    console.log(`${C.yellow}  No conversation matching "${ref}"${C.reset}`);
    return null;
  }
  if (matches.length > 1 && !matches[0].uuid.startsWith(ref)) {
    // Several search hits: take the best one only if it is clearly best.
    const titleHits = matches.filter((m) => m.match === "title");
    if (titleHits.length !== 1) {
      printConversations(matches, `${matches.length} conversations match "${ref}", pick one by UUID:`);
      return null;
    }
    return titleHits[0];
  }
  return matches[0];
}

async function resumeCmd(ref) {
  const conv = await pickOne(ref, "claude-chat-namer resume <uuid-prefix | query> [--all] [--print]");
  if (!conv) return;
  const cmd = resumeCommand(conv);

  if (JSON_OUT) {
    console.log(JSON.stringify(toJson(conv), null, 2));
    return;
  }
  // Inside Claude Code (or with --print) we can only show the command.
  if (flag("--print") || process.env.CLAUDECODE || !process.stdout.isTTY) {
    console.log(`  ${C.bold}${conv.title}${C.reset}\n`);
    console.log(`  Run in a new terminal:\n    ${C.cyan}${cmd}${C.reset}\n`);
    return;
  }
  console.log(`${C.dim}  Resuming "${conv.title}" in ${conv.cwd || "the current directory"}...${C.reset}\n`);
  const { spawn } = await import("child_process");
  const child = spawn("claude", ["--resume", conv.uuid], {
    cwd: conv.cwd && existsSync(conv.cwd) ? conv.cwd : process.cwd(),
    stdio: "inherit",
  });
  child.on("error", () => {
    console.log(`${C.yellow}  Could not start claude. Run:${C.reset}\n    ${cmd}`);
  });
  child.on("exit", (code) => process.exit(code ?? 0));
}

async function recapCmd(ref) {
  const conv = await pickOne(ref, "claude-chat-namer recap <uuid-prefix | query> [--all] [--turns n]");
  if (!conv) return;
  const turns = parseInt(flagValue("--turns"), 10) || 12;
  const items = readRecap(conv.path, { turns });

  if (JSON_OUT) {
    console.log(JSON.stringify({ ...toJson(conv), recap: items }, null, 2));
    return;
  }
  console.log(`# Recap: ${conv.title}`);
  console.log(`uuid: ${conv.uuid}`);
  if (conv.cwd) console.log(`directory: ${conv.cwd}`);
  console.log(`last activity: ${conv.lastModified.toISOString()}`);
  console.log(`resume: ${resumeCommand(conv)}\n`);
  console.log(`## Last ${items.length} message(s)\n`);
  for (const it of items) {
    console.log(`### ${it.role === "user" ? "User" : "Claude"}${it.at ? ` (${it.at})` : ""}\n${it.text}\n`);
  }
}

async function autoNameCommand(projectPath) {
  const count = autoNameAll(projectPath);
  console.log(
    `${C.green}  ✓ Auto-named ${count} conversation(s)${C.reset}`
  );
}

async function unnameCommand(projectPath, uuid) {
  if (!uuid) {
    console.log(
      `${C.yellow}  Usage: claude-chat-namer unname <uuid-prefix>${C.reset}`
    );
    return;
  }

  const conversations = getConversations(projectPath);
  const match = conversations.find((c) => c.uuid.startsWith(uuid));

  if (!match) {
    console.log(`${C.yellow}  No conversation matching "${uuid}"${C.reset}`);
    return;
  }

  unnameConversation(projectPath, match.uuid);
  console.log(
    `${C.green}  ✓ Removed name from "${match.uuid.substring(0, 8)}..."${C.reset}`
  );
}

// ─── Interactive mode ───────────────────────────────────────────────────────

async function interactiveMode() {
  header();

  const projects = getProjects();
  if (projects.length === 0) {
    console.log(NO_TRANSCRIPTS);
    process.exit(0);
  }

  let projectPath;
  const here = findProjectForDir(projects, process.env.CLAUDE_PROJECT_DIR || process.cwd());
  const single = projects.length === 1 ? projects[0] : here;

  if (single) {
    projectPath = single.path;
    console.log(`${C.dim}  Project: ${single.displayName}${C.reset}\n`);
  } else {
    console.log(`${C.bold}  Select a project:${C.reset}\n`);
    projects.forEach((p, i) => {
      console.log(`    ${i + 1}. ${p.displayName}`);
    });

    const rl = createPrompt();
    const choice = await ask(rl, `\n  ${C.cyan}>${C.reset} `);
    rl.close();

    const idx = parseInt(choice, 10) - 1;
    if (Number.isNaN(idx) || idx < 0 || idx >= projects.length) {
      console.log(`${C.yellow}  Invalid choice.${C.reset}`);
      process.exit(1);
    }
    projectPath = projects[idx].path;
  }

  const conversations = getConversations(projectPath);
  if (conversations.length === 0) {
    console.log(`${C.yellow}  No conversations found.${C.reset}`);
    process.exit(0);
  }

  console.log(
    `${C.bold}  ${conversations.length} conversation(s):${C.reset}\n`
  );
  conversations.forEach((conv, i) => {
    console.log(formatConversation(conv, i));
  });

  console.log(
    `\n${C.dim}  Commands: [number] to rename, [s]earch, [a]uto-name all, [q]uit${C.reset}`
  );

  // The numbers the user types refer to the list printed last
  // (the full list, a search result or a refreshed list).
  let shown = conversations;
  const rl = createPrompt();

  while (true) {
    const input = await ask(rl, `\n  ${C.cyan}>${C.reset} `);
    const trimmed = input.trim().toLowerCase();

    if (trimmed === "q" || trimmed === "quit" || trimmed === "exit") {
      break;
    }

    if (trimmed === "s" || trimmed === "search") {
      const query = await ask(rl, `  ${C.cyan}Search:${C.reset} `);
      const results = searchConversations(projectPath, query.trim());
      if (results.length === 0) {
        console.log(`${C.yellow}  No results.${C.reset}`);
      } else {
        shown = results;
        results.forEach((conv, i) => {
          console.log(formatConversation(conv, i));
        });
      }
      continue;
    }

    if (trimmed === "a" || trimmed === "auto") {
      const count = autoNameAll(projectPath);
      console.log(
        `${C.green}  ✓ Auto-named ${count} conversation(s)${C.reset}`
      );
      continue;
    }

    if (trimmed === "l" || trimmed === "list") {
      const convs = getConversations(projectPath);
      shown = convs;
      convs.forEach((conv, i) => {
        console.log(formatConversation(conv, i));
      });
      continue;
    }

    const num = parseInt(trimmed, 10);
    if (!isNaN(num) && num >= 1 && num <= shown.length) {
      const conv = shown[num - 1];
      console.log(
        `\n  ${C.dim}Current: ${conv.title}${C.reset}`
      );
      console.log(
        `  ${C.dim}UUID: ${conv.uuid}${C.reset}`
      );
      if (conv.firstMessage) {
        const preview =
          conv.firstMessage.length > 120
            ? conv.firstMessage.substring(0, 120) + "..."
            : conv.firstMessage;
        console.log(`  ${C.dim}First msg: ${preview}${C.reset}`);
      }

      const newName = await ask(
        rl,
        `  ${C.cyan}New name (empty to cancel):${C.reset} `
      );
      if (newName.trim()) {
        nameConversation(projectPath, conv.uuid, newName.trim());
        console.log(`${C.green}  ✓ Renamed!${C.reset}`);
      }
      continue;
    }

    console.log(
      `${C.dim}  [number] rename, [s]earch, [a]uto-name, [l]ist, [q]uit${C.reset}`
    );
  }

  rl.close();
  console.log(`\n${C.dim}  Bye!${C.reset}\n`);
}

// ─── Router ─────────────────────────────────────────────────────────────────

async function selectProject() {
  const projects = getProjects();
  if (projects.length === 0) {
    console.log(NO_TRANSCRIPTS);
    process.exit(0);
  }

  // Check --project flag
  const projIdx = args.indexOf("--project");
  if (projIdx !== -1 && args[projIdx + 1]) {
    const query = args[projIdx + 1].toLowerCase();
    const match = projects.find(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.displayName.toLowerCase().includes(query)
    );
    if (match) return match.path;
    console.log(`${C.yellow}  Project "${args[projIdx + 1]}" not found.${C.reset}`);
    process.exit(1);
  }

  // Default to the project of the current directory (the skills run inside
  // Claude Code, so that is the conversation list the user expects), then
  // fall back to the first project.
  const here = findProjectForDir(projects, process.env.CLAUDE_PROJECT_DIR || process.cwd());
  return (here || projects[0]).path;
}

async function main() {
  try {
    switch (command) {
      case "interactive":
      case "i":
        await interactiveMode();
        break;

      case "list":
      case "ls": {
        header();
        await listCommand();
        break;
      }

      case "name":
      case "rename": {
        header();
        const p = await selectProject();
        const [uuid, ...nameArgs] = positional;
        await nameCommand(p, uuid, nameArgs.join(" "));
        break;
      }

      case "unname":
      case "remove": {
        header();
        const p = await selectProject();
        await unnameCommand(p, positional[0]);
        break;
      }

      case "search":
      case "find": {
        header();
        await searchCommand(positional.join(" "));
        break;
      }

      case "resume":
      case "open": {
        header();
        await resumeCmd(positional.join(" "));
        break;
      }

      case "recap":
        await recapCmd(positional.join(" "));
        break;

      case "auto":
      case "auto-name": {
        header();
        const p = await selectProject();
        await autoNameCommand(p);
        break;
      }

      case "help":
      case "--help":
      case "-h":
        header();
        console.log(`${C.bold}  Usage:${C.reset}`);
        console.log(
          `    claude-chat-namer                     Interactive mode`
        );
        console.log(
          `    claude-chat-namer list                 List all conversations`
        );
        console.log(
          `    claude-chat-namer name <uuid> <name>   Name a conversation`
        );
        console.log(
          `    claude-chat-namer unname <uuid>         Remove a name`
        );
        console.log(
          `    claude-chat-namer search <query>        Search conversations`
        );
        console.log(
          `    claude-chat-namer auto                  Auto-name all unnamed`
        );
        console.log(
          `    claude-chat-namer resume <uuid|query>   Jump back into a conversation (right directory)`
        );
        console.log(
          `    claude-chat-namer recap <uuid|query>    Print the last messages, to continue elsewhere`
        );
        console.log();
        console.log(`${C.bold}  Options:${C.reset}`);
        console.log(
          `    --project <name>   Select project (default: current directory, else first found)`
        );
        console.log(`    --all              Every project (list, search, resume, recap)`);
        console.log(`    --limit <n>        Show at most n results (default 40 with --all)`);
        console.log(`    --json             Machine-readable output (list, search, resume, recap)`);
        console.log(`    --print            resume: only print the command, do not launch`);
        console.log(`    --turns <n>        recap: how many exchanges (default 12)`);
        console.log();
        break;

      default:
        console.log(
          `${C.yellow}  Unknown command "${command}". Use --help for usage.${C.reset}`
        );
        break;
    }
  } catch (err) {
    console.error(`${C.yellow}  Error: ${err.message}${C.reset}`);
    process.exit(1);
  }
}

main();
