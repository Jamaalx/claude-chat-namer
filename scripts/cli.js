#!/usr/bin/env node

import {
  getProjects,
  getConversations,
  nameConversation,
  unnameConversation,
  searchConversations,
  autoNameAll,
  formatConversation,
  createPrompt,
  ask,
} from "./index.js";

const args = process.argv.slice(2);
const command = args[0] || "interactive";

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

function header() {
  console.log(
    `\n${C.cyan}${C.bold}  Claude Chat Namer${C.reset} ${C.dim}v1.0.0${C.reset}`
  );
  console.log(
    `${C.dim}  Name your Claude Code conversations${C.reset}\n`
  );
}

// ─── Commands ───────────────────────────────────────────────────────────────

async function listCommand(projectPath) {
  const conversations = getConversations(projectPath);

  if (conversations.length === 0) {
    console.log(`${C.yellow}  No conversations found.${C.reset}`);
    return;
  }

  console.log(
    `${C.bold}  ${conversations.length} conversation(s):${C.reset}\n`
  );
  conversations.forEach((conv, i) => {
    console.log(formatConversation(conv, i));
  });
  console.log();
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

async function searchCommand(projectPath, query) {
  if (!query) {
    console.log(
      `${C.yellow}  Usage: claude-chat-namer search <query>${C.reset}`
    );
    return;
  }

  const results = searchConversations(projectPath, query);

  if (results.length === 0) {
    console.log(
      `${C.yellow}  No conversations matching "${query}"${C.reset}`
    );
    return;
  }

  console.log(
    `${C.bold}  ${results.length} result(s) for "${query}":${C.reset}\n`
  );
  results.forEach((conv, i) => {
    console.log(formatConversation(conv, i));
  });
  console.log();
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
    console.log(`${C.yellow}  No Claude Code projects found.${C.reset}`);
    process.exit(0);
  }

  let projectPath;

  if (projects.length === 1) {
    projectPath = projects[0].path;
    console.log(`${C.dim}  Project: ${projects[0].displayName}${C.reset}\n`);
  } else {
    console.log(`${C.bold}  Select a project:${C.reset}\n`);
    projects.forEach((p, i) => {
      console.log(`    ${i + 1}. ${p.displayName}`);
    });

    const rl = createPrompt();
    const choice = await ask(rl, `\n  ${C.cyan}>${C.reset} `);
    rl.close();

    const idx = parseInt(choice) - 1;
    if (idx < 0 || idx >= projects.length) {
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
      convs.forEach((conv, i) => {
        console.log(formatConversation(conv, i));
      });
      continue;
    }

    const num = parseInt(trimmed);
    if (!isNaN(num) && num >= 1 && num <= conversations.length) {
      const conv = conversations[num - 1];
      console.log(
        `\n  ${C.dim}Current: ${conv.name || conv.autoName}${C.reset}`
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
    console.log(`${C.yellow}  No Claude Code projects found.${C.reset}`);
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

  // Default to first project
  return projects[0].path;
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
        const p = await selectProject();
        await listCommand(p);
        break;
      }

      case "name":
      case "rename": {
        header();
        const p = await selectProject();
        const uuid = args.find((a) => !a.startsWith("--") && a !== command);
        const nameArgs = args.filter(
          (a) => !a.startsWith("--") && a !== command && a !== uuid
        );
        await nameCommand(p, uuid, nameArgs.join(" "));
        break;
      }

      case "unname":
      case "remove": {
        header();
        const p = await selectProject();
        const uuid = args.find((a) => !a.startsWith("--") && a !== command);
        await unnameCommand(p, uuid);
        break;
      }

      case "search":
      case "find": {
        header();
        const p = await selectProject();
        const query = args
          .filter((a) => !a.startsWith("--") && a !== command)
          .join(" ");
        await searchCommand(p, query);
        break;
      }

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
        console.log();
        console.log(`${C.bold}  Options:${C.reset}`);
        console.log(
          `    --project <name>   Select project (default: first found)`
        );
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
