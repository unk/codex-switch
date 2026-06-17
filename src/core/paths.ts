import os from 'node:os';
import path from 'node:path';

/**
 * Central path resolver for all runtime artifacts.
 *
 * The root can be overridden via CODEX_SWITCH_HOME (used by tests and advanced
 * users). Everything the tool manages lives under this root, except the wrapper
 * scripts which go to a user-chosen bin dir (default ~/.local/bin).
 */

export function home(): string {
  return process.env.CODEX_SWITCH_HOME && process.env.CODEX_SWITCH_HOME.trim().length > 0
    ? path.resolve(process.env.CODEX_SWITCH_HOME)
    : os.homedir();
}

/** Root directory the tool manages: ~/.codex-switch */
export function rootDir(): string {
  return path.join(home(), '.codex-switch');
}

/** Central registry file: ~/.codex-switch/profiles.json */
export function registryPath(): string {
  return path.join(rootDir(), 'profiles.json');
}

/** A profile's isolated CODEX_HOME: ~/.codex-switch/<alias> */
export function codexHomeFor(alias: string): string {
  return path.join(rootDir(), alias);
}

/** A profile's config.toml (lives inside its CODEX_HOME). */
export function configPathFor(alias: string): string {
  return path.join(codexHomeFor(alias), 'config.toml');
}

/** Optional provider-secret env file sourced by the internal launcher. */
export function secretEnvPathFor(alias: string): string {
  return path.join(codexHomeFor(alias), '.env');
}

/** Internal launcher used by aliases and external wrapper scripts. */
export function internalLauncherPathFor(alias: string): string {
  return path.join(codexHomeFor(alias), 'launcher');
}

/** Default install dir for wrapper scripts. */
export function defaultBinDir(): string {
  return path.join(home(), '.local', 'bin');
}

/**
 * Expand a leading ~ to the home directory so user-entered paths like
 * "~/.local/bin" resolve correctly.
 */
export function expandHome(p: string): string {
  if (p === '~') return home();
  if (p.startsWith('~/')) return path.join(home(), p.slice(2));
  return path.resolve(p);
}

/** Render an absolute path back with ~ for display. */
export function tildify(p: string): string {
  const h = home();
  return p.startsWith(h) ? `~${p.slice(h.length)}` : p;
}
