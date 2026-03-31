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

`openclaw plugins install` registers the plugin but does not fully activate it. Run the setup command:

```bash
npx @riclara/financialclaw financialclaw-setup
```

This configures two required fields in your OpenClaw config (`~/.openclaw/openclaw.json`):

**`plugins.allow`** — once this field exists, OpenClaw uses it as an explicit allowlist: anything not listed stops working, including active channels. The setup command discovers all currently active channels and plugins and includes them alongside `financialclaw`.

**`plugins.entries.financialclaw.config.dbPath`** — without this, the database is created inside the plugin directory and gets deleted on reinstall. Default: `~/.openclaw/workspace/financialclaw.db`.

### Options

```bash
# Custom database path
npx @riclara/financialclaw financialclaw-setup --db-path /your/path/financialclaw.db

# If the OpenClaw config is in a non-standard location
npx @riclara/financialclaw financialclaw-setup --config /path/to/openclaw.json
```

### Manual verification

```bash
node -e "const c=require(require('os').homedir()+'/.openclaw/openclaw.json'); console.log(c.plugins.allow)"
node -e "const c=require(require('os').homedir()+'/.openclaw/openclaw.json'); console.log(c.plugins.entries.financialclaw.config)"
```

Expected output:

```json
["financialclaw", "telegram"]
{ "dbPath": "/home/youruser/.openclaw/workspace/financialclaw.db" }
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

## 5. Set up the external reminders runner (optional)

The plugin does not run background automation. Recurring expense reminders are delivered by an external one-shot runner scheduled with `cron`, `systemd`, or `launchd`.

### Manual invocation

```bash
npx tsx src/bin/daily-reminder-runner.ts --target "<chat-or-destination>"
```

### Full options

```bash
npx tsx src/bin/daily-reminder-runner.ts \
  --target "<chat-or-destination>" \
  --channel telegram \
  --account "<optional-account>" \
  --db-path ~/.openclaw/workspace/financialclaw.db \
  --openclaw-cmd openclaw
```

### Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `FINANCIALCLAW_REMINDER_TARGET` | Yes (if no `--target`) | — | Destination chat or peer |
| `FINANCIALCLAW_DB_PATH` | No | `~/.openclaw/workspace/financialclaw.db` | Path to SQLite database |
| `FINANCIALCLAW_REMINDER_CHANNEL` | No | `telegram` | Channel for delivery |
| `FINANCIALCLAW_REMINDER_ACCOUNT_ID` | No | — | OpenClaw account (maps to `--account`) |
| `FINANCIALCLAW_OPENCLAW_CMD` | No | `openclaw` | Path to OpenClaw CLI binary |

Exit code `0` = all reminders sent successfully. Exit code `1` = partial or total failure. The runner only marks `sent = 1` after each successful delivery.

### cron example

```cron
0 8 * * * FINANCIALCLAW_REMINDER_TARGET="<destination>" FINANCIALCLAW_DB_PATH="$HOME/.openclaw/workspace/financialclaw.db" npx tsx /path/to/financialclaw/src/bin/daily-reminder-runner.ts >> /var/log/financialclaw-reminders.log 2>&1
```

### systemd example

`/etc/systemd/system/financialclaw-reminders.service`:

```ini
[Unit]
Description=financialclaw daily reminders
After=network-online.target

[Service]
Type=oneshot
Environment=FINANCIALCLAW_REMINDER_TARGET=<destination>
Environment=FINANCIALCLAW_DB_PATH=/home/youruser/.openclaw/workspace/financialclaw.db
ExecStart=/usr/bin/env npx tsx /path/to/financialclaw/src/bin/daily-reminder-runner.ts
```

`/etc/systemd/system/financialclaw-reminders.timer`:

```ini
[Unit]
Description=Run financialclaw reminders daily

[Timer]
OnCalendar=*-*-* 08:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now financialclaw-reminders.timer
```

### launchd example (macOS)

`~/Library/LaunchAgents/dev.riclara.financialclaw.reminders.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>dev.riclara.financialclaw.reminders</string>
    <key>ProgramArguments</key>
    <array>
      <string>/usr/bin/env</string>
      <string>npx</string>
      <string>tsx</string>
      <string>/path/to/financialclaw/src/bin/daily-reminder-runner.ts</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
      <key>FINANCIALCLAW_REMINDER_TARGET</key>
      <string><destination></string>
      <key>FINANCIALCLAW_DB_PATH</key>
      <string>/Users/youruser/.openclaw/workspace/financialclaw.db</string>
    </dict>
    <key>StartCalendarInterval</key>
    <dict>
      <key>Hour</key><integer>8</integer>
      <key>Minute</key><integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/var/log/financialclaw-reminders.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/financialclaw-reminders.err.log</string>
  </dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/dev.riclara.financialclaw.reminders.plist
```

---

## 6. Updating the plugin

```bash
openclaw plugins uninstall financialclaw
openclaw plugins install @riclara/financialclaw
npx @riclara/financialclaw financialclaw-setup
openclaw gateway restart
```

`financialclaw-setup` will detect that `dbPath` is already set and skip it. The database is preserved across updates.

Schema migrations run automatically on startup — no data is lost.

---

## Troubleshooting

**Plugin tools are not available to the agent**
→ Run `financialclaw-setup` and restart the gateway. Check that `plugins.allow` includes `financialclaw`.

**Database is deleted on reinstall**
→ Make sure `dbPath` points outside the plugin directory. Run `financialclaw-setup` to set it to `~/.openclaw/workspace/financialclaw.db`.

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
