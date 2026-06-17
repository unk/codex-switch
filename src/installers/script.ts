import fs from 'node:fs';
import path from 'node:path';
import { fileExists, readText } from '../util/fs.js';
import { renderShellPath } from './alias.js';

const SCRIPT_MARKER = '# codex-switch launcher:';
const INTERNAL_SCRIPT_MARKER = '# codex-switch internal launcher:';

/** Build the internal launcher. Secrets stay in .env and are sourced at runtime. */
export function buildInternalLauncher(
  alias: string,
  codexHome: string,
  secretEnvPath?: string,
): string {
  return [
    '#!/bin/sh',
    `${INTERNAL_SCRIPT_MARKER} ${alias}`,
    secretEnvPath ? `if [ -f ${renderShellPath(secretEnvPath)} ]; then` : '',
    secretEnvPath ? `  . ${renderShellPath(secretEnvPath)}` : '',
    secretEnvPath ? 'fi' : '',
    `export CODEX_HOME=${renderShellPath(codexHome)}`,
    'exec codex "$@"',
    '',
  ]
    .filter((line) => line.length > 0)
    .join('\n');
}

/** Build the public wrapper script. It delegates to the internal launcher. */
export function buildScript(alias: string, launcherPath: string): string {
  return [
    '#!/bin/sh',
    `${SCRIPT_MARKER} ${alias}`,
    `exec ${renderShellPath(launcherPath)} "$@"`,
    '',
  ].join('\n');
}

/** True when the file at scriptPath is one we generated (safe to overwrite/remove). */
export function isOurScript(scriptPath: string): boolean {
  if (!fileExists(scriptPath)) return false;
  try {
    return readText(scriptPath).includes(SCRIPT_MARKER);
  } catch {
    return false;
  }
}

export interface ScriptWriteResult {
  scriptPath: string;
  action: 'created' | 'updated';
}

export function writeInternalLauncher(
  launcherPath: string,
  alias: string,
  codexHome: string,
  secretEnvPath?: string,
): ScriptWriteResult {
  fs.mkdirSync(path.dirname(launcherPath), { recursive: true });
  const existed = fileExists(launcherPath);
  const tmp = path.join(
    path.dirname(launcherPath),
    `.${path.basename(launcherPath)}.tmp-${process.pid}`,
  );
  fs.writeFileSync(tmp, buildInternalLauncher(alias, codexHome, secretEnvPath), { mode: 0o700 });
  fs.chmodSync(tmp, 0o700);
  fs.renameSync(tmp, launcherPath);
  return { scriptPath: launcherPath, action: existed ? 'updated' : 'created' };
}

/**
 * Write an executable (0755) wrapper script. Refuses to clobber a pre-existing
 * file that we did not create.
 */
export function writeWrapperScript(
  scriptPath: string,
  alias: string,
  launcherPath: string,
): ScriptWriteResult {
  const existed = fileExists(scriptPath);
  if (existed && !isOurScript(scriptPath)) {
    throw new Error(
      `Refusing to overwrite ${scriptPath}: it exists and is not a codex-switch script.`,
    );
  }
  fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
  const tmp = path.join(
    path.dirname(scriptPath),
    `.${path.basename(scriptPath)}.tmp-${process.pid}`,
  );
  fs.writeFileSync(tmp, buildScript(alias, launcherPath), { mode: 0o755 });
  fs.chmodSync(tmp, 0o755);
  fs.renameSync(tmp, scriptPath);
  return { scriptPath, action: existed ? 'updated' : 'created' };
}

/** Remove a wrapper script if it is ours. Returns true if removed. */
export function removeWrapperScript(scriptPath: string): boolean {
  if (!isOurScript(scriptPath)) return false;
  fs.unlinkSync(scriptPath);
  return true;
}
