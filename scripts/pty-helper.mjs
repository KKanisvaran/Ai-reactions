import { accessSync, chmodSync, constants, existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

/**
 * node-pty 1.1.0 ships its macOS/Linux prebuilt `spawn-helper` without the
 * execute bit, so every spawn fails with "posix_spawnp failed". Restore it.
 */
export function ensureSpawnHelper() {
  if (process.platform === 'win32') return;
  const root = dirname(createRequire(import.meta.url).resolve('node-pty/package.json'));
  const candidates = [join(root, 'build', 'Release', 'spawn-helper')];
  const prebuilds = join(root, 'prebuilds');
  if (existsSync(prebuilds)) {
    for (const target of readdirSync(prebuilds)) candidates.push(join(prebuilds, target, 'spawn-helper'));
  }
  for (const helper of candidates.filter((path) => existsSync(path))) {
    try { accessSync(helper, constants.X_OK); }
    catch { try { chmodSync(helper, 0o755); } catch { /* Read-only install: spawn reports the error. */ } }
  }
}
