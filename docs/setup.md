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

After installing, restart the gateway to load the plugin (see step 3).

To use a custom database path (default: `~/.openclaw/workspace/financialclaw.db`), add it to `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "financialclaw": {
        "config": {
          "dbPath": "/your/path/financialclaw.db"
        }
      }
    }
  }
}
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
→ Restart the gateway with `openclaw gateway restart`. If the problem persists, verify the plugin is enabled in `~/.openclaw/openclaw.json`.

**Database is deleted on reinstall**
→ Configure a persistent `dbPath` outside the plugin directory in `~/.openclaw/openclaw.json` (see step 2).

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
