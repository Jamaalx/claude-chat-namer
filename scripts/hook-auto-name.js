#!/usr/bin/env node

/**
 * Claude Code Hook: Auto-name conversations on Stop event.
 * Reads the transcript, extracts first user message, saves name.
 *
 * Input (stdin JSON): { session_id, transcript_path, cwd, hook_event_name, ... }
 * Output: { continue: true }
 */

import { existsSync, statSync } from "fs";
import { join, dirname, basename } from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { readTranscript, generateAutoName, loadNames, saveNames, CLAUDE_DIR } from "./index.js";

const EXPORT_EVERY_MS = 2 * 60 * 1000;

// When sync is set up, refresh this machine's shared index in a detached
// process (at most every 2 minutes), so the hook itself stays instant.
function maybeExport() {
  try {
    const cfg = join(CLAUDE_DIR, "chat-namer", "config.json");
    if (!existsSync(cfg)) return;
    const state = join(CLAUDE_DIR, "chat-namer", "export-state.json");
    if (existsSync(state) && Date.now() - statSync(state).mtimeMs < EXPORT_EVERY_MS) return;
    const cli = join(dirname(fileURLToPath(import.meta.url)), "cli.js");
    spawn(process.execPath, [cli, "sync", "export", "--quiet"], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    }).unref();
  } catch {
    // never block Claude
  }
}

const NAMES_FILE = "chat-names.json";

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

    maybeExport();
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
