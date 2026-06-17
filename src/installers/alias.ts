import fs from 'node:fs';
import path from 'node:path';
import { backupFile, fileExists, readText } from '../util/fs.js';
import { home } from '../core/paths.js';
import type { ShellName } from './shell.js';

/**
 * Render a path for embedding in a shell command, preferring $HOME so the
 * line is portable and doesn't leak the absolute home path.
 */
export function renderShellPath(p: string): string {
  const h = home();
  if (p === h) return '"$HOME"';
  if (p.startsWith(h + path.sep)) {
    return `"$HOME/${p.slice(h.length + 1)}"`;
  }
  return `"${p}"`;
}

/** Build the single alias line for the given shell. */
export function aliasLine(alias: string, launcherPath: string, shell: ShellName): string {
  const launcher = renderShellPath(launcherPath);
  if (shell === 'fish') {
    return `alias ${alias} ${launcher}`;
  }
  return `alias ${alias}='${launcher}'`;
}

/**
 * Build the line that wires Codex's own shell completion onto the alias, so
 * `<alias> <TAB>` completes Codex subcommands just like `codex <TAB>`. Each
 * variant no-ops quietly when Codex's completion is not installed in the shell,
 * so it never errors on shell startup. Returns null for shells we can't wire up.
 */
export function completionLine(alias: string, shell: ShellName): string | null {
  switch (shell) {
    case 'zsh':
      return `(( $+functions[compdef] )) && compdef ${alias}=codex 2>/dev/null`;
    case 'bash':
      return `type _codex &>/dev/null && complete -F _codex ${alias}`;
    case 'fish':
      return `complete -c ${alias} -w codex`;
    default:
      return null;
  }
}

const markerStart = (alias: string) => `# >>> codex-switch: ${alias} >>>`;
const markerEnd = (alias: string) => `# <<< codex-switch: ${alias} <<<`;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function blockRegex(alias: string): RegExp {
  const start = escapeRe(markerStart(alias));
  const end = escapeRe(markerEnd(alias));
  // Match the marker block plus a single trailing newline if present.
  return new RegExp(`${start}[\\s\\S]*?${end}\\n?`, 'g');
}

export function buildBlock(alias: string, launcherPath: string, shell: ShellName): string {
  const completion = completionLine(alias, shell);
  const lines = [markerStart(alias), aliasLine(alias, launcherPath, shell)];
  if (completion) lines.push(completion);
  lines.push(markerEnd(alias));
  return `${lines.join('\n')}\n`;
}

function rcMode(rcPath: string): number {
  try {
    return fs.statSync(rcPath).mode & 0o777;
  } catch {
    return 0o644;
  }
}

function writeRc(rcPath: string, contents: string): void {
  const dir = path.dirname(rcPath);
  fs.mkdirSync(dir, { recursive: true });
  const mode = rcMode(rcPath);
  const tmp = path.join(dir, `.${path.basename(rcPath)}.tmp-${process.pid}`);
  fs.writeFileSync(tmp, contents, { mode });
  fs.chmodSync(tmp, mode);
  fs.renameSync(tmp, rcPath);
}

/** True when the rc file currently contains the marker block for `alias`. */
export function hasAlias(rcPath: string, alias: string): boolean {
  if (!fileExists(rcPath)) return false;
  return blockRegex(alias).test(readText(rcPath));
}

export interface AliasInjectResult {
  rcPath: string;
  backup: string | null;
  /** 'created' | 'updated' | 'unchanged' */
  action: 'created' | 'updated' | 'unchanged';
}

/**
 * Inject (or replace) the marker block for `alias` in the rc file. Idempotent:
 * re-running with the same values is a no-op; changed values replace the block
 * in place. A backup is taken before any modification.
 */
export function injectAlias(
  rcPath: string,
  alias: string,
  launcherPath: string,
  shell: ShellName,
): AliasInjectResult {
  const block = buildBlock(alias, launcherPath, shell);
  const exists = fileExists(rcPath);
  const original = exists ? readText(rcPath) : '';
  const re = blockRegex(alias);
  const hadBlock = re.test(original);

  let next: string;
  if (hadBlock) {
    next = original.replace(blockRegex(alias), block);
  } else {
    const sep = original.length === 0 || original.endsWith('\n') ? '' : '\n';
    const lead = original.length === 0 ? '' : '\n';
    next = `${original}${sep}${lead}${block}`;
  }

  if (next === original) {
    return { rcPath, backup: null, action: 'unchanged' };
  }

  const backup = backupFile(rcPath);
  writeRc(rcPath, next);
  return { rcPath, backup, action: hadBlock ? 'updated' : 'created' };
}

/** Remove the marker block for `alias`. Returns true if something was removed. */
export function removeAlias(
  rcPath: string,
  alias: string,
): { removed: boolean; backup: string | null } {
  if (!fileExists(rcPath)) return { removed: false, backup: null };
  const original = readText(rcPath);
  if (!blockRegex(alias).test(original)) return { removed: false, backup: null };

  let next = original.replace(blockRegex(alias), '');
  // Collapse any 3+ newline run left behind into a single blank line.
  next = next.replace(/\n{3,}/g, '\n\n');
  const backup = backupFile(rcPath);
  writeRc(rcPath, next);
  return { removed: true, backup };
}
