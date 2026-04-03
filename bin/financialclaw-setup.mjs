#!/usr/bin/env node
/**
 * ensure-plugins-allow.mjs
 *
 * Run this script once after `openclaw plugins install` to configure
 * financialclaw in the OpenClaw config file.
 *
 * What it does:
 *   1. Adds "financialclaw" to plugins.allow (preserving active channels
 *      and plugins so they don't get blocked)
 *   2. Sets plugins.entries.financialclaw.config.dbPath if not already set
 *   3. Warns if tools.profile is not "full" (does not modify it)
 *   4. Adds "financialclaw" to tools.allow as explicit allowlist entry
 *
 * Usage:
 *   node scripts/ensure-plugins-allow.mjs [--config /ruta/openclaw.json] [--db-path /ruta/financialclaw.db]
 *
 * Config path resolution order:
 *   1. --config argument
 *   2. OPENCLAW_CONFIG env var
 *   3. First existing file among known locations (see CANDIDATE_PATHS)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${question} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

function parseArg(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

function resolveConfigPath() {
  // 1. --config argument
  const arg = parseArg("--config");
  if (arg) return arg;

  // 2. env var
  if (process.env.OPENCLAW_CONFIG) return process.env.OPENCLAW_CONFIG;

  // 3. known locations in priority order
  const home = homedir();
  const CANDIDATE_PATHS = [
    join(home, ".openclaw", "openclaw.json"),   // most common
    join(home, "openclaw.json"),                // some installs
    join(home, ".config", "openclaw", "openclaw.json"),
  ];

  for (const p of CANDIDATE_PATHS) {
    if (existsSync(p)) return p;
  }

  // Return first candidate as default even if it doesn't exist yet
  // (will fail below with a helpful error)
  return CANDIDATE_PATHS[0];
}

const configPath = resolveConfigPath();

if (!existsSync(configPath)) {
  console.error(`Config not found: ${configPath}`);
  if (!parseArg("--config") && !process.env.OPENCLAW_CONFIG) {
    console.error(`Tried: ~/.openclaw/openclaw.json, ~/openclaw.json, ~/.config/openclaw/openclaw.json`);
    console.error(`Use --config /ruta/al/config to specify the path explicitly.`);
  }
  process.exit(1);
}

console.log(`Using config: ${configPath}`);

const dbPath =
  parseArg("--db-path") ??
  join(homedir(), ".openclaw", "workspace", "financialclaw.db");

const skipConfirm = process.argv.includes("--yes") || process.argv.includes("-y");

const cfg = JSON.parse(readFileSync(configPath, "utf-8"));
const plugins = (cfg.plugins ??= {});
const changes = [];

// 1. Ensure plugins.allow includes financialclaw and all active entries
// Always rediscover active channels and plugins so re-runs fix missing entries
{
  const prevAllow = new Set(plugins.allow ?? []);
  const allow = new Set(prevAllow);
  allow.add("financialclaw");

  if (cfg.channels) {
    for (const [name, ch] of Object.entries(cfg.channels)) {
      if (ch.enabled !== false) allow.add(name);
    }
  }

  if (plugins.entries) {
    for (const [name, entry] of Object.entries(plugins.entries)) {
      if (entry.enabled !== false) allow.add(name);
    }
  }

  plugins.allow = [...allow];
  const newEntries = [...allow].filter((e) => !prevAllow.has(e));
  if (newEntries.length > 0) {
    changes.push(`Add to plugins.allow: ${newEntries.join(", ")}`);
  }
}

// 2. Set dbPath in plugins.entries.financialclaw.config if not already set
const entries = (plugins.entries ??= {});
const fc = (entries.financialclaw ??= { enabled: true, config: {} });
fc.config ??= {};

let dbPathChanged = false;
if (!fc.config.dbPath) {
  fc.config.dbPath = dbPath;
  dbPathChanged = true;
  changes.push(`Set database path: ${dbPath}`);
}

// 3. Check tools.profile — warn if not "full" but don't modify it
// Profiles like "coding" or "minimal" exclude plugin tools entirely
{
  const tools = (cfg.tools ??= {});
  const prev = tools.profile;
  if (prev && prev !== "full") {
    console.log(`\n⚠ Warning: tools.profile is set to "${prev}".`);
    console.log(`  Profiles other than "full" may hide plugin tools from the agent.`);
    console.log(`  If financialclaw tools are not visible after setup, change it manually:`);
    console.log(`  Set tools.profile to "full" in ${configPath}\n`);
  }
}

// 4. Ensure tools.allow includes "financialclaw" as explicit allowlist entry
{
  const tools = (cfg.tools ??= {});
  const toolsAllow = new Set(tools.allow ?? []);
  if (!toolsAllow.has("financialclaw")) {
    changes.push(`Add "financialclaw" to tools.allow`);
  }
  toolsAllow.add("financialclaw");
  tools.allow = [...toolsAllow];
}

// Show summary and confirm before writing
if (changes.length === 0) {
  console.log("Nothing to change — financialclaw is already configured.");
  process.exit(0);
}

console.log(`\nThe following changes will be applied to ${configPath}:\n`);
for (const change of changes) {
  console.log(`  • ${change}`);
}
console.log();

if (!skipConfirm) {
  const ok = await confirm("Apply these changes?");
  if (!ok) {
    console.log("\nAborted. No changes were made.");
    console.log("\nTo configure financialclaw manually, add the following to your OpenClaw config:\n");
    console.log(`  1. Add "financialclaw" to plugins.allow`);
    console.log(`  2. Add "financialclaw" to tools.allow`);
    console.log(`  3. Set plugins.entries.financialclaw.config.dbPath to your desired path`);
    console.log(`  4. If plugin tools are not visible, set tools.profile to "full"`);
    console.log(`\nConfig file: ${configPath}`);
    console.log(`After making changes, restart the gateway: openclaw gateway restart`);
    process.exit(0);
  }
}

// Create db directory only if dbPath was set in this run
if (dbPathChanged && !existsSync(dirname(dbPath))) {
  mkdirSync(dirname(dbPath), { recursive: true });
}

writeFileSync(configPath, JSON.stringify(cfg, null, 2) + "\n");
console.log("\nDone. Restart gateway: openclaw gateway restart");
