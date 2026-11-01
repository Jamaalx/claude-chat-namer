// Conversations across machines.
//
// chat-namer never talks to the network. Each machine writes a small,
// redacted index of its conversations into a folder the user keeps in sync
// with whatever they like (Syncthing over Tailscale, a cloud folder, git...).
// Other machines read those indexes to search and recap; a full transcript
// only goes into the folder when the user explicitly sends one.
//
// <syncDir>/
//   machines/<machine>/index.json     what that machine has (no transcripts)
//   machines/<machine>/recaps/<uuid>.json   last exchanges, for recap
//   sent/<uuid>/                      full transcripts the user chose to send
//   inbox/                            files (screenshots...) to pass around

import {
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  readdirSync,
  statSync,
  mkdirSync,
  copyFileSync,
  rmSync,
} from "fs";
import { join, basename, dirname, isAbsolute } from "path";
import { hostname } from "os";
import { execFileSync } from "child_process";
import {
  CLAUDE_DIR,
  PROJECTS_DIR,
  getAllConversations,
  readRecap,
  resolveTitle,
  generateAutoName,
  scanLines,
  resumeCommand,
  shellQuote,
} from "./index.js";

const CONFIG_FILE = join(CLAUDE_DIR, "chat-namer", "config.json");
const EXPORT_STATE = join(CLAUDE_DIR, "chat-namer", "export-state.json");
const MAX_EXPORT = 300; // newest conversations shared per machine
const MAX_SEARCH = 16 * 1024;

// ─── Config ─────────────────────────────────────────────────────────────────

export function loadConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
  } catch {
    return null;
  }
}

function writeJson(path, data, pretty = false) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, pretty ? 2 : 0), "utf-8");
  renameSync(tmp, path);
}

function readJson(path, fallback = null) {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return fallback;
  }
}

/** The name other machines see. Tailscale's name when there is one. */
export function defaultMachineName() {
  try {
    const out = execFileSync("tailscale", ["status", "--json"], {
      encoding: "utf-8",
      timeout: 3000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const name = JSON.parse(out)?.Self?.HostName;
    if (name) return name;
  } catch {
    // no tailscale
  }
  return hostname().split(".")[0];
}

export function initSync({ dir, machine, exclude = [] }) {
  if (!dir) throw new Error("Pass the folder to sync: sync init --dir <path>");
  if (!isAbsolute(dir)) throw new Error("Use an absolute path for --dir");
  const name = (machine || defaultMachineName()).replace(/[^A-Za-z0-9._-]/g, "-");
  for (const sub of [join("machines", name), "sent", "inbox"]) {
    mkdirSync(join(dir, sub), { recursive: true });
  }
  const prev = loadConfig() || {};
  const config = {
    syncDir: dir,
    machine: name,
    exclude: exclude.length ? exclude : prev.exclude || [],
    pathMap: prev.pathMap || [],
  };
  writeJson(CONFIG_FILE, config, true);
  return config;
}

export function addPathMap(from, to) {
  const config = requireConfig();
  config.pathMap = (config.pathMap || []).filter((m) => m.from !== from);
  config.pathMap.push({ from, to });
  writeJson(CONFIG_FILE, config, true);
  return config;
}

function requireConfig() {
  const c = loadConfig();
  if (!c?.syncDir) {
    throw new Error("Sync is not set up on this machine. Run: claude-chat-namer sync init --dir <folder>");
  }
  return c;
}

// ─── Redaction ──────────────────────────────────────────────────────────────

// What leaves this machine in the shared index never carries obvious secrets.
const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\b(?:sk|pk|rk)[-_](?:live|test|proj|ant)?[-_]?[A-Za-z0-9_-]{16,}/g, // Stripe, OpenAI, Anthropic style
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bAIza[0-9A-Za-z_-]{30,}/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT
  /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]+@/gi, // credentials in URLs
  /\b1\/\/0[A-Za-z0-9_-]{20,}/g, // Google OAuth refresh token
  /\bya29\.[A-Za-z0-9_-]{20,}/g, // Google OAuth access token
];

// Long random-looking strings (keys without a known prefix): 32+ chars that
// mix upper case, lower case and digits. UUIDs and hex hashes are left alone.
const LONG_TOKEN = /(?<![A-Za-z0-9_\-+=%])[A-Za-z0-9_\-+=%]{32,}(?![A-Za-z0-9_\-+=%])/g;
function looksRandom(t) {
  if (/^[0-9a-f-]+$/i.test(t)) return false; // uuid, sha, hex ids
  return /[A-Z]/.test(t) && /[a-z]/.test(t) && /[0-9]/.test(t);
}
const ASSIGNMENT =
  /\b((?:api[_-]?key|access[_-]?key|secret|token|password|passwd|pwd|auth|bearer)[A-Za-z0-9_-]*)(\s*[:=]\s*|\s+)(["']?)[^\s"',;]{8,}\3/gi;

export function redact(text) {
  if (!text) return text;
  let out = text;
  for (const re of SECRET_PATTERNS) out = out.replace(re, "[redacted]");
  out = out.replace(ASSIGNMENT, (_m, key, sep) => `${key}${sep}[redacted]`);
  out = out.replace(LONG_TOKEN, (t) => (looksRandom(t) ? "[redacted]" : t));
  return out;
}

// ─── Export (this machine → sync folder) ───────────────────────────────────

function isExcluded(conv, exclude) {
  if (!exclude?.length) return false;
  const hay = `${conv.cwd || ""} ${conv.project}`.toLowerCase();
  return exclude.some((e) => e && hay.includes(String(e).toLowerCase()));
}

/**
 * Write this machine's index (and recaps of conversations that changed)
 * into the sync folder.
 */
export function exportIndex({ force = false } = {}) {
  const config = requireConfig();
  const mdir = join(config.syncDir, "machines", config.machine);
  const rdir = join(mdir, "recaps");
  mkdirSync(rdir, { recursive: true });

  const state = force ? {} : readJson(EXPORT_STATE, {});
  const nextState = {};
  const conversations = getAllConversations()
    .filter((c) => c.messageCount > 0 && !isExcluded(c, config.exclude))
    .slice(0, MAX_EXPORT);

  let recapsWritten = 0;
  const entries = conversations.map((c) => {
    const key = `${c.size}:${c.lastModified.getTime()}`;
    nextState[c.uuid] = key;
    const recapPath = join(rdir, `${c.uuid}.json`);
    if (state[c.uuid] !== key || !existsSync(recapPath)) {
      try {
        const items = readRecap(c.path, { turns: 12, maxChars: 12000 }).map((i) => ({
          ...i,
          text: redact(i.text),
        }));
        writeJson(recapPath, items);
        recapsWritten++;
      } catch {
        // unreadable transcript: index entry without recap
      }
    }
    return {
      uuid: c.uuid,
      title: redact(c.title),
      source: c.source,
      cwd: c.cwd,
      project: c.project,
      messageCount: c.messageCount,
      lastModified: c.lastModified.toISOString(),
      size: c.size,
      firstMessage: redact(c.firstMessage ? c.firstMessage.slice(0, 2000) : null),
      searchText: redact((c.searchText || "").slice(0, MAX_SEARCH)),
    };
  });

  // Recaps of conversations no longer shared go away.
  const keep = new Set(entries.map((e) => `${e.uuid}.json`));
  for (const f of readdirSync(rdir)) {
    if (f.endsWith(".json") && !keep.has(f)) rmSync(join(rdir, f), { force: true });
  }

  writeJson(join(mdir, "index.json"), {
    machine: config.machine,
    platform: process.platform,
    exportedAt: new Date().toISOString(),
    conversations: entries,
  });
  writeJson(EXPORT_STATE, nextState);
  return { machine: config.machine, conversations: entries.length, recapsWritten, dir: mdir };
}

// ─── Other machines ─────────────────────────────────────────────────────────

/** Conversations other machines exported, shaped like local ones. */
export function getRemoteConversations() {
  const config = loadConfig();
  if (!config?.syncDir) return [];
  const root = join(config.syncDir, "machines");
  if (!existsSync(root)) return [];
  const out = [];
  for (const m of readdirSync(root)) {
    if (m === config.machine) continue;
    const idx = readJson(join(root, m, "index.json"));
    if (!idx?.conversations) continue;
    for (const e of idx.conversations) {
      const conv = {
        ...e,
        machine: m,
        platform: idx.platform,
        remote: true,
        path: null,
        recapPath: join(root, m, "recaps", `${e.uuid}.json`),
        name: null,
        auto: false,
        nativeTitle: null,
        aiTitle: null,
        summary: null,
        autoName: generateAutoName(e.firstMessage) || e.title,
        lastModified: new Date(e.lastModified),
      };
      // Keep the title as the other machine resolved it.
      conv.title = e.title;
      conv.source = e.source || resolveTitle(conv).source;
      out.push(conv);
    }
  }
  return out;
}

export function listMachines() {
  const config = loadConfig();
  if (!config?.syncDir) return [];
  const root = join(config.syncDir, "machines");
  if (!existsSync(root)) return [];
  return readdirSync(root).map((m) => {
    const idx = readJson(join(root, m, "index.json"));
    return {
      machine: m,
      self: m === config.machine,
      platform: idx?.platform || null,
      exportedAt: idx?.exportedAt || null,
      conversations: idx?.conversations?.length || 0,
    };
  });
}

export function readRemoteRecap(conv) {
  return readJson(conv.recapPath, []);
}

// ─── Send / receive full conversations (explicit only) ─────────────────────

/**
 * Copy one local conversation (transcript + its subagent folder) into the
 * sync folder so another machine can resume it.
 */
export function sendConversation(conv, { to = null } = {}) {
  const config = requireConfig();
  if (conv.remote) throw new Error("That conversation lives on another machine; send it from there.");
  const dest = join(config.syncDir, "sent", conv.uuid);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  copyFileSync(conv.path, join(dest, `${conv.uuid}.jsonl`));
  const extra = join(dirname(conv.path), conv.uuid);
  if (existsSync(extra) && statSync(extra).isDirectory()) copyDir(extra, join(dest, "files"));
  const meta = {
    uuid: conv.uuid,
    title: conv.title,
    from: config.machine,
    fromPlatform: process.platform,
    to,
    cwd: conv.cwd,
    sentAt: new Date().toISOString(),
    size: conv.size,
  };
  writeJson(join(dest, "meta.json"), meta, true);
  return meta;
}

function copyDir(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const f of readdirSync(src)) {
    const s = join(src, f);
    const d = join(dst, f);
    if (statSync(s).isDirectory()) copyDir(s, d);
    else copyFileSync(s, d);
  }
}

export function listSent() {
  const config = loadConfig();
  if (!config?.syncDir) return [];
  const root = join(config.syncDir, "sent");
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .map((d) => readJson(join(root, d, "meta.json")))
    .filter(Boolean)
    .sort((a, b) => (b.sentAt || "").localeCompare(a.sentAt || ""));
}

/** Map a path from another machine onto this one. */
export function mapPath(path, pathMap = []) {
  if (!path) return null;
  const norm = (p) => p.replace(/\\/g, "/").replace(/\/+$/, "");
  const p = norm(path);
  let best = null;
  for (const m of pathMap) {
    const from = norm(m.from);
    if ((p === from || p.startsWith(from + "/")) && (!best || from.length > norm(best.from).length)) best = m;
  }
  if (!best) return existsSync(path) ? path : null;
  const rest = p.slice(norm(best.from).length);
  const windows = /^[A-Za-z]:[\\/]/.test(best.to) || best.to.includes("\\");
  return windows ? best.to.replace(/[\\/]+$/, "") + rest.replace(/\//g, "\\") : norm(best.to) + rest;
}

// Same rule Claude Code uses for ~/.claude/projects/<dir>.
export function encodeProjectDir(dir) {
  return dir.replace(/[^a-zA-Z0-9]/g, "-");
}

function rewriteCwd(srcFile, dstFile, newCwd) {
  const lines = [];
  scanLines(srcFile, (line) => {
    if (line.includes('"cwd"')) {
      try {
        const e = JSON.parse(line);
        if (typeof e.cwd === "string") {
          e.cwd = newCwd;
          lines.push(JSON.stringify(e));
          return;
        }
      } catch {
        // keep the line as is
      }
    }
    lines.push(line);
  });
  const tmp = `${dstFile}.${process.pid}.tmp`;
  writeFileSync(tmp, lines.join("\n") + "\n", "utf-8");
  renameSync(tmp, dstFile);
}

/**
 * Install a sent conversation into this machine's Claude Code projects so
 * `claude --resume` finds it. Experimental: the transcript format is
 * Claude Code's own and undocumented.
 */
export function receiveConversation(meta, { cwd = null, force = false } = {}) {
  const config = requireConfig();
  const target = cwd || mapPath(meta.cwd, config.pathMap);
  if (!target) {
    throw new Error(
      `Where is this project on this machine? It ran in ${meta.cwd} on ${meta.from}.\n` +
        `  Pass --cwd <local folder>, or map it once: claude-chat-namer sync map "${meta.cwd}" "<local folder>"`
    );
  }
  const src = join(config.syncDir, "sent", meta.uuid);
  const projDir = join(PROJECTS_DIR, encodeProjectDir(target));
  mkdirSync(projDir, { recursive: true });
  const dst = join(projDir, `${meta.uuid}.jsonl`);
  let backup = null;
  if (existsSync(dst)) {
    if (!force) {
      throw new Error(
        `This machine already has that conversation (${dst}).\n  Pass --force to replace it (the current copy is kept as a backup).`
      );
    }
    backup = `${dst}.chat-namer-backup-${Date.now()}`;
    renameSync(dst, backup);
  }
  rewriteCwd(join(src, `${meta.uuid}.jsonl`), dst, target);
  const files = join(src, "files");
  if (existsSync(files)) {
    const dstFiles = join(projDir, meta.uuid);
    copyDir(files, dstFiles);
    // Subagent transcripts carry the cwd too.
    const walk = (d) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (f.endsWith(".jsonl")) rewriteCwd(p, p, target);
      }
    };
    walk(dstFiles);
  }
  return {
    ...meta,
    installedAt: dst,
    localCwd: target,
    backup,
    resume: resumeCommand({ uuid: meta.uuid, cwd: target }),
  };
}

// ─── Inbox ──────────────────────────────────────────────────────────────────

/**
 * Files in the shared inbox, newest first. With Tailscale, files sent to this
 * machine with Taildrop ("Send with Tailscale") are collected first.
 */
export function listInbox({ taildrop = true } = {}) {
  const config = requireConfig();
  const dir = join(config.syncDir, "inbox");
  mkdirSync(dir, { recursive: true });
  let collected = 0;
  if (taildrop && process.platform !== "win32") {
    try {
      const before = readdirSync(dir).length;
      execFileSync("tailscale", ["file", "get", "--wait=false", "--conflict=rename", dir], {
        timeout: 8000,
        stdio: "ignore",
      });
      collected = readdirSync(dir).length - before;
    } catch {
      // no tailscale, no permission, or nothing waiting
    }
  }
  const files = readdirSync(dir)
    .filter((f) => !f.startsWith(".") && !f.endsWith(".tmp"))
    .map((f) => {
      const p = join(dir, f);
      const st = statSync(p);
      return st.isFile() ? { name: f, path: p, size: st.size, modified: st.mtime } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.modified - a.modified);
  return { dir, collected, files };
}

export { shellQuote, basename };
