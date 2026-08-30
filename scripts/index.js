import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, basename, dirname } from "path";
import { homedir } from "os";
import { createInterface } from "readline";
import { fileURLToPath } from "url";

const CLAUDE_DIR = join(homedir(), ".claude");
const PROJECTS_DIR = join(CLAUDE_DIR, "projects");
const NAMES_FILE = "chat-names.json";

export const VERSION = (() => {
  try {
    const pkg = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
    return JSON.parse(readFileSync(pkg, "utf-8")).version;
  } catch {
    return "unknown";
  }
})();

// ─── Core API ───────────────────────────────────────────────────────────────

/**
 * Get all project directories inside .claude/projects/
 */
export function getProjects() {
  if (!existsSync(PROJECTS_DIR)) return [];
  return readdirSync(PROJECTS_DIR)
    .filter((f) => {
      try {
        return statSync(join(PROJECTS_DIR, f)).isDirectory();
      } catch {
        return false; // broken symlink, permission error, etc.
      }
    })
    .map((name) => ({
      name,
      path: join(PROJECTS_DIR, name),
      displayName: name.replace(/--/g, "\\").replace(/-/g, " "),
    }));
}

/**
 * Get all conversations for a project
 */
export function getConversations(projectPath) {
  if (!existsSync(projectPath)) return [];

  const files = readdirSync(projectPath).filter((f) => f.endsWith(".jsonl"));
  const namesPath = join(projectPath, NAMES_FILE);
  const names = loadNames(namesPath);

  return files
    .map((file) => {
      const uuid = basename(file, ".jsonl");
      const fullPath = join(projectPath, file);
      const stat = statSync(fullPath);
      const preview = extractPreview(fullPath);

      return {
        uuid,
        file,
        path: fullPath,
        name: names[uuid]?.name || null,
        autoName: preview.autoName,
        firstMessage: preview.firstMessage,
        messageCount: preview.messageCount,
        lastModified: stat.mtime,
        size: stat.size,
      };
    })
    .sort((a, b) => b.lastModified - a.lastModified);
}

/**
 * Parse a conversation JSONL file into the bits we care about:
 * the first real user message and the number of user/assistant turns.
 *
 * Shared by the CLI and the Stop hook so both produce the same names.
 */
export function readTranscript(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());

  let firstMessage = null;
  let messageCount = 0;

  for (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue; // skip malformed lines
    }
    if (entry.type !== "user" && entry.type !== "assistant") continue;
    if (entry.isSidechain) continue; // subagent traffic, not the conversation
    messageCount++;

    if (entry.type === "user" && !firstMessage && !entry.isMeta) {
      const text = extractTextFromMessage(entry.message);
      if (isRealUserText(text)) firstMessage = text;
    }
  }

  return { firstMessage, messageCount };
}

/**
 * Extract a preview from a conversation JSONL file
 */
function extractPreview(filePath) {
  try {
    const { firstMessage, messageCount } = readTranscript(filePath);
    const autoName = generateAutoName(firstMessage) || "Empty conversation";
    return { firstMessage, autoName, messageCount };
  } catch {
    return {
      firstMessage: null,
      autoName: "Unreadable",
      messageCount: 0,
    };
  }
}

/**
 * Extract text content from a message object
 */
export function extractTextFromMessage(message) {
  if (!message) return null;

  const content = message.content;
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    for (const block of content) {
      if (block.type === "text" && block.text) {
        return block.text;
      }
    }
  }
  return null;
}

/**
 * Claude Code writes slash commands and their output into the transcript as
 * "user" entries wrapped in <command-name>, <local-command-stdout>, etc.
 * Those are not something the user typed, so they make terrible names.
 */
export function isRealUserText(text) {
  if (!text) return false;
  const t = text.trimStart();
  return !/^<(command-name|command-message|command-args|local-command-stdout|local-command-stderr|local-command-caveat)>/.test(
    t
  );
}

/**
 * Generate a short auto-name from the first message.
 * Returns null when there is nothing usable.
 */
export function generateAutoName(text) {
  if (!text) return null;

  // Clean up the text
  let clean = text
    .replace(/```[\s\S]*?```/g, "[code]") // remove code blocks
    .replace(/\[Request interrupted[^\]]*\]/g, "") // interrupted-turn markers
    .replace(/<[^>]+>/g, "") // strip <tags> (system-reminder, command markup...)
    .replace(/\n+/g, " ") // collapse newlines
    .replace(/\s+/g, " ") // collapse spaces
    .trim();

  if (!clean || clean.length < 3) return null;

  // Take first ~60 chars, break at word boundary
  if (clean.length > 60) {
    clean = clean.substring(0, 60);
    const lastSpace = clean.lastIndexOf(" ");
    if (lastSpace > 30) {
      clean = clean.substring(0, lastSpace);
    }
    clean += "...";
  }

  return clean;
}

// ─── Names persistence ─────────────────────────────────────────────────────

function loadNames(namesPath) {
  if (!existsSync(namesPath)) return {};
  try {
    return JSON.parse(readFileSync(namesPath, "utf-8"));
  } catch {
    return {};
  }
}

function saveNames(namesPath, names) {
  writeFileSync(namesPath, JSON.stringify(names, null, 2), "utf-8");
}

/**
 * Set a custom name for a conversation
 */
export function nameConversation(projectPath, uuid, name) {
  const namesPath = join(projectPath, NAMES_FILE);
  const names = loadNames(namesPath);
  names[uuid] = {
    name,
    namedAt: new Date().toISOString(),
  };
  saveNames(namesPath, names);
  return true;
}

/**
 * Remove a custom name
 */
export function unnameConversation(projectPath, uuid) {
  const namesPath = join(projectPath, NAMES_FILE);
  const names = loadNames(namesPath);
  delete names[uuid];
  saveNames(namesPath, names);
  return true;
}

/**
 * Search conversations by name or content
 */
export function searchConversations(projectPath, query) {
  const conversations = getConversations(projectPath);
  const q = query.toLowerCase();

  return conversations.filter((c) => {
    if (c.name && c.name.toLowerCase().includes(q)) return true;
    if (c.autoName && c.autoName.toLowerCase().includes(q)) return true;
    if (c.firstMessage && c.firstMessage.toLowerCase().includes(q)) return true;
    return false;
  });
}

/**
 * Auto-name all unnamed conversations in a project
 */
export function autoNameAll(projectPath) {
  const conversations = getConversations(projectPath);
  let named = 0;

  for (const conv of conversations) {
    if (!conv.name && conv.autoName && conv.autoName !== "Empty conversation") {
      nameConversation(projectPath, conv.uuid, conv.autoName);
      named++;
    }
  }

  return named;
}

// ─── Formatting helpers ─────────────────────────────────────────────────────

/**
 * Format a conversation for display
 */
export function formatConversation(conv, index) {
  const name = conv.name || conv.autoName;
  const date = conv.lastModified.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const sizeKb = (conv.size / 1024).toFixed(0);
  const tag = conv.name ? "\x1b[32m[named]\x1b[0m" : "\x1b[90m[auto]\x1b[0m";

  return `  ${String(index + 1).padStart(3)}. ${tag} ${name}\n       ${date} | ${conv.messageCount} msgs | ${sizeKb} KB | ${conv.uuid.substring(0, 8)}...`;
}

// ─── Interactive CLI helpers ────────────────────────────────────────────────

export function createPrompt() {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

export function ask(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}
