import { readFileSync, writeFileSync } from 'node:fs';

const pkgPath = new URL('../package.json', import.meta.url);
const pluginPath = new URL('../openclaw.plugin.json', import.meta.url);

const { version } = JSON.parse(readFileSync(pkgPath, 'utf8'));
const plugin = JSON.parse(readFileSync(pluginPath, 'utf8'));

plugin.version = version;
writeFileSync(pluginPath, JSON.stringify(plugin, null, 2) + '\n', 'utf8');
console.log(`synced openclaw.plugin.json → ${version}`);
