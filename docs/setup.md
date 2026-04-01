# financialclaw — Setup and configuration

> [Versión en español](setup.es.md)

This guide covers everything needed to get the plugin running: prerequisites, installation, OpenClaw configuration, and the external reminders runner.

---

## Prerequisites

| Requirement | Minimum version | How to check |
|---|---|---|
| Node.js | 22.14+ (recommended: 24) | `node --version` |
| OpenClaw CLI | installed and configured | `openclaw --version` |

---

## 1. Install the plugin

```bash
openclaw plugins install @riclara/financialclaw
```

---

## 2. Configure OpenClaw

Run the setup command:

```bash
npx @riclara/financialclaw financialclaw-setup
```

This configures two required fields in `~/.openclaw/openclaw.json`:

**`plugins.allow`** — once this field exists, OpenClaw uses it as an explicit allowlist: anything not listed stops working, including active channels like Telegram. The setup command discovers all currently active channels and plugins and adds `financialclaw` alongside them so nothing breaks.

**`plugins.entries.financialclaw.config.dbPath`** — without this, the database is created inside the plugin directory and gets deleted on reinstall. Default: `~/.openclaw/workspace/financialclaw.db`.

### Options

```bash
# Custom database path
npx @riclara/financialclaw financialclaw-setup --db-path /your/path/financialclaw.db

# If the OpenClaw config is in a non-standard location
npx @riclara/financialclaw financialclaw-setup --config /path/to/openclaw.json
```

---

## 3. Restart the gateway

```bash
openclaw gateway restart
```

---

## 4. Verify the installation

Send a message to your OpenClaw bot through your configured channel. Ask it to register an expense:

> "Log a $50 expense at the supermarket"

It should respond with a confirmation. You can also verify the database directly:

```bash
sqlite3 ~/.openclaw/workspace/financialclaw.db \
  "SELECT amount, description, category, date FROM expenses ORDER BY created_at DESC LIMIT 5;"
```

### Receipt OCR

If your channel supports sending images, you can send a photo of a receipt. The OpenClaw agent will extract the data and call `log_expense_from_receipt` automatically — no local OCR setup required.

---

## 5. Set up the daily sync (optional)

The plugin includes a `run_daily_sync` tool that generates recurring expenses, marks overdue ones, and delivers reminders. To run it automatically every day, set it up via OpenClaw's built-in cron system:

Ask your OpenClaw agent to create a daily schedule:

> "Create a daily cron job at 8am that runs the financialclaw daily sync"

The agent will call `cron.add` with an `agentTurn` payload targeting `run_daily_sync`. You can verify it's active by asking the agent to list scheduled tasks.

---

## 6. Updating the plugin

```bash
openclaw plugins update financialclaw
openclaw gateway restart
```

The database and all your data are preserved across updates. Schema migrations run automatically on startup.

To preview what would change before updating:

```bash
openclaw plugins update financialclaw --dry-run
```

The daily sync will also notify you automatically when a new version is available.

---

## Troubleshooting

**Plugin tools are not available to the agent**
→ Run `financialclaw-setup` and restart the gateway. Check that `plugins.allow` includes `financialclaw`.

**Database is deleted on reinstall**
→ Make sure `dbPath` points outside the plugin directory. Run `financialclaw-setup` to configure it automatically.

**Channel stops working after install**
→ `plugins.allow` was set without including the channel. Run `financialclaw-setup` again — it will add the missing entries.

**`better-sqlite3` fails with `NODE_MODULE_VERSION` or `ERR_DLOPEN_FAILED`**
→ The native binary was compiled for a different Node version. Run:
```bash
npm install
```

**`better-sqlite3` fails to build from source**
→ Install build tools:
```bash
# macOS
xcode-select --install

# Ubuntu / Debian
sudo apt install build-essential
```
