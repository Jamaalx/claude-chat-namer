#!/usr/bin/env node

/**
 * Claude Code Hook: Auto-name conversations on Stop event.
 * Reads the transcript, extracts first user message, saves name.
 *
 * Input (stdin JSON): { session_id, transcript_path, cwd, ... }
 * Output: { continue: true }
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname, basename } from "path";

const NAMES_FILE = "chat-names.json";

function loadNames(path) {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return {};
  }
}

function saveNames(path, names) {
  writeFileSync(path, JSON.stringify(names, null, 2), "utf-8");
}

function extractText(message) {
  if (!message) return null;
  const content = message.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block.type === "text" && block.text) return block.text;
    }
  }
  return null;
}

function generateName(text) {
  if (!text) return null;
  let clean = text
    .replace(/```[\s\S]*?```/g, "[code]")
    .replace(/\[Request interrupted[^\]]*\]/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean || clean.length < 3) return null;

  if (clean.length > 60) {
    clean = clean.substring(0, 60);
    const lastSpace = clean.lastIndexOf(" ");
    if (lastSpace > 30) clean = clean.substring(0, lastSpace);
    clean += "...";
  }
  return clean;
}

async function main() {
  try {
    // Read hook input from stdin
    let input = "";
    for await (const chunk of process.stdin) {
      input += chunk;
    }

    const hookData = JSON.parse(input);
    const transcriptPath = hookData.transcript_path;

    if (!transcriptPath || !existsSync(transcriptPath)) {
      process.stdout.write(JSON.stringify({ continue: true }));
      process.exit(0);
    }

    const projectDir = dirname(transcriptPath);
    const uuid = basename(transcriptPath, ".jsonl");
    const namesPath = join(projectDir, NAMES_FILE);
    const names = loadNames(namesPath);

    // Already named? Skip.
    if (names[uuid]?.name) {
      process.stdout.write(JSON.stringify({ continue: true }));
      process.exit(0);
    }

    // Read transcript and find first user message
    const content = readFileSync(transcriptPath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());

    let firstMessage = null;
    let messageCount = 0;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type === "user" || entry.type === "assistant") {
          messageCount++;
        }
        if (entry.type === "user" && !firstMessage) {
          firstMessage = extractText(entry.message);
        }
      } catch {
        // skip
      }
    }

    // Only name conversations with at least 2 messages (a real conversation)
    if (messageCount < 2) {
      process.stdout.write(JSON.stringify({ continue: true }));
      process.exit(0);
    }

    const name = generateName(firstMessage);
    if (name) {
      names[uuid] = {
        name,
        namedAt: new Date().toISOString(),
        auto: true,
      };
      saveNames(namesPath, names);
    }

    process.stdout.write(JSON.stringify({ continue: true }));
    process.exit(0);
  } catch {
    // Never block Claude on errors
    process.stdout.write(JSON.stringify({ continue: true }));
    process.exit(0);
  }
}

main();
