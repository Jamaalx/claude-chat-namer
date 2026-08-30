#!/usr/bin/env node

/**
 * Claude Code Hook: Auto-name conversations on Stop event.
 * Reads the transcript, extracts first user message, saves name.
 *
 * Input (stdin JSON): { session_id, transcript_path, cwd, hook_event_name, ... }
 * Output: { continue: true }
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname, basename } from "path";
import { readTranscript, generateAutoName } from "./index.js";

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

// Note: no process.exit() after writing. On macOS/Windows a piped stdout is
// asynchronous, so exiting right away can truncate the JSON Claude reads.
function done() {
  process.stdout.write(JSON.stringify({ continue: true }));
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

    if (!transcriptPath || !existsSync(transcriptPath)) return done();

    const projectDir = dirname(transcriptPath);
    const uuid = basename(transcriptPath, ".jsonl");
    const namesPath = join(projectDir, NAMES_FILE);
    const names = loadNames(namesPath);

    // Already named? Skip.
    if (names[uuid]?.name) return done();

    const { firstMessage, messageCount } = readTranscript(transcriptPath);

    // Only name conversations with at least 2 messages (a real conversation)
    if (messageCount < 2) return done();

    const name = generateAutoName(firstMessage);
    if (name) {
      names[uuid] = {
        name,
        namedAt: new Date().toISOString(),
        auto: true,
      };
      saveNames(namesPath, names);
    }

    done();
  } catch {
    // Never block Claude on errors
    done();
  }
}

main();
