import fs from 'node:fs';
import path from 'node:path';
import { rootDir, tildify } from '../core/paths.js';
import { listProfiles } from '../core/registry.js';
import { hasAlias } from '../installers/alias.js';
import { isOurScript } from '../installers/script.js';
import { codexInstalled, isOnPath } from '../installers/shell.js';
import { color, info } from '../util/log.js';

const OK = color.green('✔');
const BAD = color.red('✖');
const WARN = color.yellow('!');

function line(status: string, label: string, detail = ''): void {
  info(`  ${status} ${label}${detail ? color.dim(`  ${detail}`) : ''}`);
}

function modeOf(file: string): number | null {
  try {
    return fs.statSync(file).mode & 0o777;
  } catch {
    return null;
  }
}

/** Lightweight environment + profile health check. Returns 0 if no errors. */
export function runDoctor(): number {
  let errors = 0;

  info(color.bold('Environment'));
  if (codexInstalled()) {
    line(OK, 'codex is on PATH');
  } else {
    line(BAD, 'codex not found on PATH', 'install Codex first');
    errors += 1;
  }
  line(OK, 'profiles root', tildify(rootDir()));

  const profiles = listProfiles();
  info('');
  info(color.bold(`Profiles (${profiles.length})`));
  if (profiles.length === 0) {
    info(color.dim('  none yet - run `codex-switch create`'));
  }

  for (const p of profiles) {
    info(color.bold(`  ${p.alias}`));

    if (fs.existsSync(p.codexHome)) line(OK, 'CODEX_HOME', tildify(p.codexHome));
    else {
      line(BAD, 'CODEX_HOME missing', tildify(p.codexHome));
      errors += 1;
    }

    if (fs.existsSync(p.configPath)) {
      const mode = modeOf(p.configPath);
      if (mode === 0o600) line(OK, 'config.toml', '0600');
      else line(WARN, 'config.toml perms not 0600', mode === null ? '' : `0${mode.toString(8)}`);
    } else {
      line(BAD, 'config.toml missing', tildify(p.configPath));
      errors += 1;
    }

    if (p.secretEnvPath) {
      const mode = modeOf(p.secretEnvPath);
      if (mode === 0o600) line(OK, '.env', '0600');
      else if (mode === null) {
        line(BAD, '.env missing', tildify(p.secretEnvPath));
        errors += 1;
      } else {
        line(WARN, '.env perms not 0600', `0${mode.toString(8)}`);
      }
    }

    const launcherMode = modeOf(p.launcherPath);
    if (launcherMode === 0o700) line(OK, 'internal launcher', tildify(p.launcherPath));
    else if (launcherMode === null) {
      line(BAD, 'internal launcher missing', tildify(p.launcherPath));
      errors += 1;
    } else {
      line(WARN, 'internal launcher perms not 0700', `0${launcherMode.toString(8)}`);
    }

    if (p.launchers.includes('alias')) {
      if (p.shellRc && hasAlias(p.shellRc, p.alias)) {
        line(OK, 'alias installed', tildify(p.shellRc));
      } else {
        line(BAD, 'alias block missing from rc', p.shellRc ? tildify(p.shellRc) : '(unknown rc)');
        errors += 1;
      }
    }

    if (p.launchers.includes('script') && p.scriptPath) {
      if (isOurScript(p.scriptPath)) {
        line(OK, 'wrapper script', tildify(p.scriptPath));
        const dir = path.dirname(p.scriptPath);
        if (isOnPath(dir)) line(OK, 'script dir on PATH', tildify(dir));
        else line(WARN, 'script dir not on PATH', tildify(dir));
      } else {
        line(BAD, 'wrapper script missing', tildify(p.scriptPath));
        errors += 1;
      }
    }
  }

  info('');
  if (errors === 0) info(color.green('No problems found.'));
  else info(color.red(`${errors} problem(s) found.`));
  return errors === 0 ? 0 : 1;
}
