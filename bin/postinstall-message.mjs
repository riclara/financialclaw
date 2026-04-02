#!/usr/bin/env node
// Skip in CI environments
if (process.env.CI || process.env.GITHUB_ACTIONS) process.exit(0);

console.log(`
╔══════════════════════════════════════════════════════════════╗
║              financialclaw — setup required                  ║
╠══════════════════════════════════════════════════════════════╣
║  Run this before restarting the gateway:                     ║
║                                                              ║
║    npx financialclaw financialclaw-setup                     ║
║                                                              ║
║  This adds financialclaw to plugins.allow and configures     ║
║  a persistent database path. Without it, active channels     ║
║  (Telegram, etc.) may stop working.                          ║
╚══════════════════════════════════════════════════════════════╝
`);
