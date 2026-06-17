import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  aliasLine,
  buildBlock,
  completionLine,
  injectAlias,
  removeAlias,
  renderShellPath,
} from '../src/installers/alias.js';

let tmp: string;
let rc: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cxp-alias-'));
  process.env.CODEX_SWITCH_HOME = tmp;
  rc = path.join(tmp, '.zshrc');
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  delete process.env.CODEX_SWITCH_HOME;
});

describe('renderShellPath', () => {
  it('prefers $HOME for paths under home', () => {
    expect(renderShellPath(path.join(tmp, '.codex-switch', 'codex-o', 'launcher'))).toBe(
      '"$HOME/.codex-switch/codex-o/launcher"',
    );
  });
  it('uses an absolute quoted path otherwise', () => {
    expect(renderShellPath('/opt/x')).toBe('"/opt/x"');
  });
});

describe('aliasLine', () => {
  it('points zsh/bash aliases at the internal launcher', () => {
    expect(
      aliasLine('codex-o', path.join(tmp, '.codex-switch', 'codex-o', 'launcher'), 'zsh'),
    ).toBe(`alias codex-o='"$HOME/.codex-switch/codex-o/launcher"'`);
  });
  it('uses fish alias syntax', () => {
    expect(
      aliasLine('codex-o', path.join(tmp, '.codex-switch', 'codex-o', 'launcher'), 'fish'),
    ).toBe(`alias codex-o "$HOME/.codex-switch/codex-o/launcher"`);
  });
});

describe('completionLine', () => {
  it('wires the alias onto codex completion per shell, guarded against startup errors', () => {
    expect(completionLine('codex-o', 'zsh')).toBe(
      '(( $+functions[compdef] )) && compdef codex-o=codex 2>/dev/null',
    );
    expect(completionLine('codex-o', 'bash')).toBe(
      'type _codex &>/dev/null && complete -F _codex codex-o',
    );
    expect(completionLine('codex-o', 'fish')).toBe('complete -c codex-o -w codex');
  });
  it('returns null for unknown shells', () => {
    expect(completionLine('codex-o', 'unknown')).toBeNull();
  });
});

describe('buildBlock', () => {
  it('includes the alias and the completion wiring inside the marker block', () => {
    const block = buildBlock(
      'codex-o',
      path.join(tmp, '.codex-switch', 'codex-o', 'launcher'),
      'zsh',
    );
    expect(block).toContain("alias codex-o='");
    expect(block).toContain('compdef codex-o=codex');
  });
});

describe('injectAlias', () => {
  it('creates a marker block in a fresh rc', () => {
    fs.writeFileSync(rc, '# my rc\nexport FOO=1\n');
    const res = injectAlias(
      rc,
      'codex-o',
      path.join(tmp, '.codex-switch', 'codex-o', 'launcher'),
      'zsh',
    );
    expect(res.action).toBe('created');
    const text = fs.readFileSync(rc, 'utf8');
    expect(text).toContain('# >>> codex-switch: codex-o >>>');
    expect(text).toContain("alias codex-o='");
    expect(text).toContain('export FOO=1');
  });

  it('is idempotent when re-running with the same values', () => {
    const launcher = path.join(tmp, '.codex-switch', 'codex-o', 'launcher');
    injectAlias(rc, 'codex-o', launcher, 'zsh');
    const first = fs.readFileSync(rc, 'utf8');
    const res = injectAlias(rc, 'codex-o', launcher, 'zsh');
    expect(res.action).toBe('unchanged');
    expect(fs.readFileSync(rc, 'utf8')).toBe(first);
  });

  it('replaces the block in place when values change', () => {
    injectAlias(rc, 'codex-o', path.join(tmp, 'a'), 'zsh');
    const res = injectAlias(rc, 'codex-o', path.join(tmp, 'b'), 'zsh');
    expect(res.action).toBe('updated');
    const text = fs.readFileSync(rc, 'utf8');
    expect(text.match(/# >>> codex-switch: codex-o >>>/g)).toHaveLength(1);
    expect(text).toContain('"$HOME/b"');
    expect(text).not.toContain('"$HOME/a"');
  });

  it('backs up the rc before modifying', () => {
    fs.writeFileSync(rc, 'orig\n');
    const res = injectAlias(rc, 'codex-o', path.join(tmp, 'a'), 'zsh');
    expect(res.backup).toBeTruthy();
    expect(fs.readFileSync(res.backup as string, 'utf8')).toBe('orig\n');
  });

  it('keeps blocks for different aliases independent', () => {
    injectAlias(rc, 'codex-o', path.join(tmp, 'a'), 'zsh');
    injectAlias(rc, 'codex-glm', path.join(tmp, 'b'), 'zsh');
    const text = fs.readFileSync(rc, 'utf8');
    expect(text).toContain('codex-switch: codex-o >>>');
    expect(text).toContain('codex-switch: codex-glm >>>');
  });
});

describe('removeAlias', () => {
  it('removes only the targeted block', () => {
    injectAlias(rc, 'codex-o', path.join(tmp, 'a'), 'zsh');
    injectAlias(rc, 'codex-glm', path.join(tmp, 'b'), 'zsh');
    const res = removeAlias(rc, 'codex-o');
    expect(res.removed).toBe(true);
    const text = fs.readFileSync(rc, 'utf8');
    expect(text).not.toContain('codex-switch: codex-o >>>');
    expect(text).toContain('codex-switch: codex-glm >>>');
  });

  it('returns removed=false when there is nothing to remove', () => {
    fs.writeFileSync(rc, 'nothing here\n');
    expect(removeAlias(rc, 'codex-o').removed).toBe(false);
  });
});
