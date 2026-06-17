import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildConfigToml,
  buildSecretEnv,
  envVarForAlias,
  providerIdForAlias,
  writeProfileSettings,
} from '../src/core/settings.js';
import { configPathFor, secretEnvPathFor } from '../src/core/paths.js';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cxp-set-'));
  process.env.CODEX_SWITCH_HOME = tmp;
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  delete process.env.CODEX_SWITCH_HOME;
});

describe('profile naming helpers', () => {
  it('derives safe provider ids and env vars from aliases', () => {
    expect(providerIdForAlias('codex-glm')).toBe('codex_glm');
    expect(envVarForAlias('codex-glm')).toBe('CODEX_SWITCH_CODEX_GLM_API_KEY');
  });
});

describe('buildConfigToml', () => {
  it('builds a standard profile config with file-scoped credentials', () => {
    const toml = buildConfigToml({ custom: false, model: 'gpt-5.5' });
    expect(toml).toContain('cli_auth_credentials_store = "file"');
    expect(toml).toContain('model = "gpt-5.5"');
    expect(toml).not.toContain('model_provider');
  });

  it('builds Codex approval and auto-review settings when requested', () => {
    const toml = buildConfigToml({
      custom: false,
      approvalPolicy: 'on-request',
      sandboxMode: 'workspace-write',
      approvalsReviewer: 'auto_review',
    });
    expect(toml).toContain('approval_policy = "on-request"');
    expect(toml).toContain('approvals_reviewer = "auto_review"');
    expect(toml).toContain('sandbox_mode = "workspace-write"');
  });

  it('builds a custom provider using env_key auth and defaults to chat wire_api', () => {
    const toml = buildConfigToml({
      custom: true,
      baseUrl: 'https://openrouter.ai/api/v1',
      authMethod: 'envKey',
      providerId: 'codex_or',
      envVar: 'CODEX_SWITCH_CODEX_OR_API_KEY',
      model: 'anthropic/claude-sonnet-4.5',
    });
    expect(toml).toContain('model = "anthropic/claude-sonnet-4.5"');
    expect(toml).toContain('model_provider = "codex_or"');
    expect(toml).toContain('[model_providers.codex_or]');
    expect(toml).toContain('base_url = "https://openrouter.ai/api/v1"');
    expect(toml).toContain('wire_api = "chat"');
    expect(toml).toContain('env_key = "CODEX_SWITCH_CODEX_OR_API_KEY"');
  });

  it('honors an explicit responses wire_api', () => {
    const toml = buildConfigToml({
      custom: true,
      baseUrl: 'https://gw.example/v1',
      authMethod: 'envKey',
      providerId: 'gw',
      envVar: 'GW_KEY',
      wireApi: 'responses',
    });
    expect(toml).toContain('wire_api = "responses"');
  });

  it('builds custom header auth when requested', () => {
    const toml = buildConfigToml({
      custom: true,
      baseUrl: 'https://gw.example/v1',
      authMethod: 'bearerHeader',
      providerId: 'proxy',
      envVar: 'PROXY_TOKEN',
    });
    expect(toml).toContain('env_http_headers = { "Authorization" = "PROXY_TOKEN" }');
  });
});

describe('buildSecretEnv', () => {
  it('writes a shell-safe env export and prefixes bearer tokens', () => {
    const env = buildSecretEnv({
      custom: true,
      authMethod: 'bearerHeader',
      secret: "tok'en",
      envVar: 'TOKEN',
    });
    expect(env).toContain("export TOKEN='Bearer tok'\\''en'");
  });
});

describe('writeProfileSettings', () => {
  it('writes config.toml and .env with 0600 perms', () => {
    const res = writeProfileSettings('codex-glm', {
      custom: true,
      authMethod: 'envKey',
      baseUrl: 'https://g.example/v1',
      secret: 'sk-secret',
      model: 'glm-5.1',
    });

    expect(res.configPath).toBe(configPathFor('codex-glm'));
    expect(res.secretEnvPath).toBe(secretEnvPathFor('codex-glm'));
    expect(fs.readFileSync(res.configPath, 'utf8')).toContain('model_provider = "codex_glm"');
    expect(fs.readFileSync(res.secretEnvPath as string, 'utf8')).toContain('sk-secret');
    expect(fs.statSync(res.configPath).mode & 0o777).toBe(0o600);
    expect(fs.statSync(res.secretEnvPath as string).mode & 0o777).toBe(0o600);
  });

  it('removes stale .env when rewriting as a no-auth profile', () => {
    writeProfileSettings('codex-local', {
      custom: true,
      authMethod: 'envKey',
      baseUrl: 'https://g.example/v1',
      secret: 'sk-secret',
    });
    writeProfileSettings('codex-local', {
      custom: true,
      authMethod: 'none',
      baseUrl: 'http://localhost:11434/v1',
    });
    expect(fs.existsSync(secretEnvPathFor('codex-local'))).toBe(false);
  });
});
