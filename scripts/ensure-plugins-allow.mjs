import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Only run when installed as an OpenClaw plugin
if (!process.cwd().includes(".openclaw/extensions")) process.exit(0);

const configPath = join(homedir(), "openclaw.json");
if (!existsSync(configPath)) process.exit(0);

const cfg = JSON.parse(readFileSync(configPath, "utf-8"));
const plugins = (cfg.plugins ??= {});

if (plugins.allow) {
  // plugins.allow already exists — just add financialclaw
  if (plugins.allow.includes("financialclaw")) {
    process.exit(0);
  }
  plugins.allow.push("financialclaw");
} else {
  // plugins.allow does not exist — discover all active entries
  const allow = new Set(["financialclaw"]);

  // Active channels (telegram, discord, etc.)
  if (cfg.channels) {
    for (const [name, ch] of Object.entries(cfg.channels)) {
      if (ch.enabled !== false) allow.add(name);
    }
  }

  // Active plugins in entries
  if (plugins.entries) {
    for (const [name, entry] of Object.entries(plugins.entries)) {
      if (entry.enabled) allow.add(name);
    }
  }

  plugins.allow = [...allow];
}

writeFileSync(configPath, JSON.stringify(cfg, null, 2) + "\n");
console.log("plugins.allow:", JSON.stringify(plugins.allow));
