import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildInternalLauncher,
  buildScript,
  isOurScript,
  removeWrapperScript,
  writeInternalLauncher,
  writeWrapperScript,
} from '../src/installers/script.js';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cxp-script-'));
  process.env.CODEX_SWITCH_HOME = tmp;
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  delete process.env.CODEX_SWITCH_HOME;
});

describe('buildInternalLauncher', () => {
  it('exports CODEX_HOME, sources optional .env, and execs codex', () => {
    const body = buildInternalLauncher(
      'codex-o',
      path.join(tmp, '.codex-switch', 'codex-o'),
      path.join(tmp, '.codex-switch', 'codex-o', '.env'),
    );
    expect(body).toContain('#!/bin/sh');
    expect(body).toContain('. "$HOME/.codex-switch/codex-o/.env"');
    expect(body).toContain('export CODEX_HOME="$HOME/.codex-switch/codex-o"');
    expect(body).toContain('exec codex "$@"');
  });
});

describe('buildScript', () => {
  it('delegates to the internal launcher without exposing secrets', () => {
    const body = buildScript('codex-o', path.join(tmp, '.codex-switch', 'codex-o', 'launcher'));
    expect(body).toContain('#!/bin/sh');
    expect(body).toContain('exec "$HOME/.codex-switch/codex-o/launcher" "$@"');
    expect(body).not.toContain('API_KEY');
    expect(body).not.toContain('TOKEN');
  });
});

describe('writeInternalLauncher', () => {
  it('writes an owner-only executable launcher', () => {
    const sp = path.join(tmp, '.codex-switch', 'codex-o', 'launcher');
    const res = writeInternalLauncher(sp, 'codex-o', path.join(tmp, '.codex-switch', 'codex-o'));
    expect(res.action).toBe('created');
    expect(fs.statSync(sp).mode & 0o777).toBe(0o700);
  });
});

describe('writeWrapperScript', () => {
  it('writes an executable (0755) script we recognize as ours', () => {
    const sp = path.join(tmp, 'bin', 'codex-o');
    const res = writeWrapperScript(
      sp,
      'codex-o',
      path.join(tmp, '.codex-switch', 'codex-o', 'launcher'),
    );
    expect(res.action).toBe('created');
    expect(fs.statSync(sp).mode & 0o777).toBe(0o755);
    expect(isOurScript(sp)).toBe(true);
  });

  it('overwrites its own script (idempotent updates)', () => {
    const sp = path.join(tmp, 'bin', 'codex-o');
    writeWrapperScript(sp, 'codex-o', path.join(tmp, 'a'));
    const res = writeWrapperScript(sp, 'codex-o', path.join(tmp, 'b'));
    expect(res.action).toBe('updated');
  });

  it('refuses to clobber a foreign file', () => {
    const sp = path.join(tmp, 'bin', 'codex-o');
    fs.mkdirSync(path.dirname(sp), { recursive: true });
    fs.writeFileSync(sp, '#!/bin/sh\necho not ours\n');
    expect(() => writeWrapperScript(sp, 'codex-o', path.join(tmp, 'a'))).toThrow(
      /Refusing to overwrite/,
    );
  });
});

describe('removeWrapperScript', () => {
  it('removes our script and ignores foreign files', () => {
    const sp = path.join(tmp, 'bin', 'codex-o');
    writeWrapperScript(sp, 'codex-o', path.join(tmp, 'a'));
    expect(removeWrapperScript(sp)).toBe(true);
    expect(fs.existsSync(sp)).toBe(false);

    const foreign = path.join(tmp, 'bin', 'other');
    fs.mkdirSync(path.dirname(foreign), { recursive: true });
    fs.writeFileSync(foreign, 'echo hi\n');
    expect(removeWrapperScript(foreign)).toBe(false);
    expect(fs.existsSync(foreign)).toBe(true);
  });
});
