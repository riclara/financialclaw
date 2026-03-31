/**
 * ensure-plugins-allow.mjs
 *
 * Run this script once after `openclaw plugins install` to configure
 * financialclaw in the OpenClaw config file (~/openclaw.json).
 *
 * What it does:
 *   1. Adds "financialclaw" to plugins.allow (preserving active channels
 *      and plugins so they don't get blocked)
 *   2. Sets plugins.entries.financialclaw.config.dbPath if not already set
 *
 * Usage:
 *   node scripts/ensure-plugins-allow.mjs [--db-path /ruta/a/financialclaw.db]
 *
 * If --db-path is omitted, defaults to ~/.openclaw/workspace/financialclaw.db
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const configPath = join(homedir(), "openclaw.json");

if (!existsSync(configPath)) {
  console.error(`Config not found: ${configPath}`);
  process.exit(1);
}

// Parse --db-path argument
const dbPathArg = process.argv.indexOf("--db-path");
const dbPath =
  dbPathArg !== -1 && process.argv[dbPathArg + 1]
    ? process.argv[dbPathArg + 1]
    : join(homedir(), ".openclaw", "workspace", "financialclaw.db");

const cfg = JSON.parse(readFileSync(configPath, "utf-8"));
const plugins = (cfg.plugins ??= {});

// 1. Ensure plugins.allow includes financialclaw and all active entries
if (plugins.allow) {
  if (!plugins.allow.includes("financialclaw")) {
    plugins.allow.push("financialclaw");
    console.log(`Added financialclaw to plugins.allow`);
  } else {
    console.log(`financialclaw already in plugins.allow`);
  }
} else {
  // plugins.allow did not exist — discover all active entries to avoid
  // breaking channels (telegram, etc.) and other plugins
  const allow = new Set(["financialclaw"]);

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
  console.log(`Created plugins.allow:`, JSON.stringify(plugins.allow));
}

// 2. Set dbPath in plugins.entries.financialclaw.config if not already set
const entry = (plugins.entries ??= {});
const fc = (entry.financialclaw ??= { enabled: true, config: {} });
fc.config ??= {};

if (!fc.config.dbPath) {
  // Ensure parent directory exists
  mkdirSync(dirname(dbPath), { recursive: true });
  fc.config.dbPath = dbPath;
  console.log(`Set dbPath: ${dbPath}`);
} else {
  console.log(`dbPath already set: ${fc.config.dbPath}`);
}

writeFileSync(configPath, JSON.stringify(cfg, null, 2) + "\n");
console.log("Done. Restart gateway: openclaw gateway stop && openclaw gateway");
