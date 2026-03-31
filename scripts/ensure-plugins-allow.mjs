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
 *
 * Usage:
 *   node scripts/ensure-plugins-allow.mjs [--config /ruta/openclaw.json] [--db-path /ruta/financialclaw.db]
 *
 * Config path resolution order:
 *   1. --config argument
 *   2. OPENCLAW_CONFIG env var
 *   3. Output of `openclaw config path` (if CLI available)
 *   4. ~/openclaw.json (default)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { execSync } from "node:child_process";

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

  // 3. ask the CLI
  try {
    const out = execSync("openclaw config path", { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (out && existsSync(out)) return out;
  } catch {
    // CLI not available or doesn't support 'config path' — fall through
  }

  // 4. default
  return join(homedir(), "openclaw.json");
}

const configPath = resolveConfigPath();

if (!existsSync(configPath)) {
  console.error(`Config not found: ${configPath}`);
  console.error(`Use --config /ruta/al/openclaw.json to specify the path.`);
  process.exit(1);
}

console.log(`Using config: ${configPath}`);

// Parse --db-path argument
const dbPath =
  parseArg("--db-path") ??
  join(homedir(), ".openclaw", "workspace", "financialclaw.db");

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
const entries = (plugins.entries ??= {});
const fc = (entries.financialclaw ??= { enabled: true, config: {} });
fc.config ??= {};

if (!fc.config.dbPath) {
  mkdirSync(dirname(dbPath), { recursive: true });
  fc.config.dbPath = dbPath;
  console.log(`Set dbPath: ${dbPath}`);
} else {
  console.log(`dbPath already set: ${fc.config.dbPath}`);
}

writeFileSync(configPath, JSON.stringify(cfg, null, 2) + "\n");
console.log("Done. Restart gateway: openclaw gateway stop && openclaw gateway");
