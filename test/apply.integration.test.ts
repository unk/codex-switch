import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyProfile } from '../src/core/apply.js';
import { getProfile } from '../src/core/registry.js';
import type { ShellInfo } from '../src/installers/shell.js';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cxp-e2e-'));
  process.env.CODEX_SWITCH_HOME = tmp;
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  delete process.env.CODEX_SWITCH_HOME;
});

function shell(): ShellInfo {
  return { name: 'zsh', rcPath: path.join(tmp, '.zshrc') };
}

describe('applyProfile (end-to-end)', () => {
  it('writes CODEX_HOME, config, env, launchers and registers a custom profile', () => {
    fs.writeFileSync(shell().rcPath, '# rc\n');
    const scriptPath = path.join(tmp, 'bin', 'codex-glm');

    const res = applyProfile({
      alias: 'codex-glm',
      custom: true,
      baseUrl: 'https://api.example.com/v1',
      authMethod: 'envKey',
      secret: 'sk-secret',
      model: 'glm-5.1',
      approvalPolicy: 'on-request',
      sandboxMode: 'workspace-write',
      approvalsReviewer: 'auto_review',
      launchers: ['alias', 'script'],
      scriptPath,
      shell: shell(),
      createdAt: '2026-06-14T00:00:00.000Z',
    });

    expect(fs.existsSync(path.join(tmp, '.codex-switch', 'codex-glm'))).toBe(true);
    const config = fs.readFileSync(res.configPath, 'utf8');
    expect(config).toContain('model_provider = "codex_glm"');
    expect(config).toContain('wire_api = "chat"');
    expect(config).toContain('env_key = "CODEX_SWITCH_CODEX_GLM_API_KEY"');
    expect(config).toContain('model = "glm-5.1"');
    expect(config).toContain('approval_policy = "on-request"');
    expect(config).toContain('sandbox_mode = "workspace-write"');
    expect(config).toContain('approvals_reviewer = "auto_review"');
    expect(fs.statSync(res.configPath).mode & 0o777).toBe(0o600);
    expect(fs.readFileSync(res.secretEnvPath as string, 'utf8')).toContain('sk-secret');
    expect(fs.statSync(res.secretEnvPath as string).mode & 0o777).toBe(0o600);
    expect(fs.statSync(res.profile.launcherPath).mode & 0o777).toBe(0o700);

    const rcText = fs.readFileSync(shell().rcPath, 'utf8');
    expect(rcText).toContain('# >>> codex-switch: codex-glm >>>');
    expect(rcText).toContain('compdef codex-glm=codex');
    expect(fs.statSync(scriptPath).mode & 0o777).toBe(0o755);

    const stored0 = getProfile('codex-glm');
    expect(stored0?.wireApi).toBe('chat');

    const stored = getProfile('codex-glm');
    expect(stored?.baseUrl).toBe('https://api.example.com/v1');
    expect(stored?.providerId).toBe('codex_glm');
    expect(stored?.approvalPolicy).toBe('on-request');
    expect(stored?.sandboxMode).toBe('workspace-write');
    expect(stored?.approvalsReviewer).toBe('auto_review');
    expect(JSON.stringify(stored)).not.toContain('sk-secret');
  });

  it('generated wrapper script exports CODEX_HOME and provider env to codex', () => {
    const fakeBin = path.join(tmp, 'fakebin');
    fs.mkdirSync(fakeBin, { recursive: true });
    const fakeCodex = path.join(fakeBin, 'codex');
    fs.writeFileSync(
      fakeCodex,
      '#!/bin/sh\nprintf "%s|%s|%s" "$CODEX_HOME" "$CODEX_SWITCH_CODEX_GLM_API_KEY" "$1"\n',
      { mode: 0o755 },
    );
    fs.chmodSync(fakeCodex, 0o755);

    const scriptPath = path.join(tmp, 'bin', 'codex-glm');
    applyProfile({
      alias: 'codex-glm',
      custom: true,
      baseUrl: 'https://api.example.com/v1',
      authMethod: 'envKey',
      secret: 'sk-secret',
      launchers: ['script'],
      scriptPath,
      shell: shell(),
      createdAt: '2026-06-14T00:00:00.000Z',
    });

    const out = execFileSync(scriptPath, ['--version'], {
      env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH ?? ''}`, HOME: tmp },
      encoding: 'utf8',
    });
    expect(out).toBe(`${path.join(tmp, '.codex-switch', 'codex-glm')}|sk-secret|--version`);
  });
});
