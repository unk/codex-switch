import { ensureDir } from '../util/fs.js';
import { injectAlias, type AliasInjectResult } from '../installers/alias.js';
import {
  writeInternalLauncher,
  writeWrapperScript,
  type ScriptWriteResult,
} from '../installers/script.js';
import type { ShellInfo } from '../installers/shell.js';
import { codexHomeFor, internalLauncherPathFor } from './paths.js';
import type {
  ApprovalPolicy,
  ApprovalsReviewer,
  AuthMethod,
  Launcher,
  Profile,
  SandboxMode,
  WireApi,
} from './profile.js';
import { upsertProfile } from './registry.js';
import { writeProfileSettings } from './settings.js';

/** A fully-resolved profile spec produced by the interactive flow (or a test). */
export interface CreateSpec {
  alias: string;
  custom: boolean;
  baseUrl?: string;
  authMethod?: AuthMethod;
  /** Wire protocol for the custom provider. Defaults to 'responses'. */
  wireApi?: WireApi;
  /** Secret value. Written to .env only. */
  secret?: string;
  model?: string;
  approvalPolicy?: ApprovalPolicy;
  sandboxMode?: SandboxMode;
  approvalsReviewer?: ApprovalsReviewer;
  launchers: Launcher[];
  /** Resolved absolute path for the wrapper script (when 'script' is selected). */
  scriptPath?: string;
  /** Detected shell, used when 'alias' is selected. */
  shell: ShellInfo;
  /** ISO creation timestamp. */
  createdAt: string;
}

export interface ApplyResult {
  profile: Profile;
  configPath: string;
  secretEnvPath?: string;
  internalLauncherResult: ScriptWriteResult;
  aliasResult?: AliasInjectResult;
  scriptResult?: ScriptWriteResult;
}

/**
 * Side-effecting apply step shared by `runCreate` and tests: writes CODEX_HOME,
 * config.toml, optional .env, launchers, and records the profile
 * in the registry. Pure of any prompting so it can be exercised headlessly.
 */
export function applyProfile(spec: CreateSpec): ApplyResult {
  const codexHome = codexHomeFor(spec.alias);
  ensureDir(codexHome, 0o700);
  const authMethod = spec.custom ? (spec.authMethod ?? 'envKey') : spec.authMethod;
  const wireApi = spec.custom ? (spec.wireApi ?? 'responses') : undefined;

  const profileFiles = writeProfileSettings(spec.alias, {
    custom: spec.custom,
    baseUrl: spec.baseUrl,
    authMethod,
    wireApi,
    secret: spec.secret,
    model: spec.model,
    approvalPolicy: spec.approvalPolicy,
    sandboxMode: spec.sandboxMode,
    approvalsReviewer: spec.approvalsReviewer,
  });
  const launcherPath = internalLauncherPathFor(spec.alias);
  const internalLauncherResult = writeInternalLauncher(
    launcherPath,
    spec.alias,
    codexHome,
    profileFiles.secretEnvPath,
  );

  let aliasResult: AliasInjectResult | undefined;
  if (spec.launchers.includes('alias')) {
    aliasResult = injectAlias(spec.shell.rcPath, spec.alias, launcherPath, spec.shell.name);
  }

  let scriptResult: ScriptWriteResult | undefined;
  if (spec.launchers.includes('script') && spec.scriptPath) {
    scriptResult = writeWrapperScript(spec.scriptPath, spec.alias, launcherPath);
  }

  const profile: Profile = {
    alias: spec.alias,
    codexHome,
    configPath: profileFiles.configPath,
    launcherPath,
    secretEnvPath: profileFiles.secretEnvPath,
    custom: spec.custom,
    baseUrl: spec.custom ? spec.baseUrl : undefined,
    authMethod: spec.custom ? authMethod : undefined,
    wireApi,
    providerId: profileFiles.providerId,
    envVar: profileFiles.envVar,
    model: spec.model,
    approvalPolicy: spec.approvalPolicy,
    sandboxMode: spec.sandboxMode,
    approvalsReviewer: spec.approvalsReviewer,
    launchers: spec.launchers,
    scriptPath: spec.scriptPath,
    shellRc: spec.launchers.includes('alias') ? spec.shell.rcPath : undefined,
    createdAt: spec.createdAt,
  };
  upsertProfile(profile);

  return {
    profile,
    configPath: profileFiles.configPath,
    secretEnvPath: profileFiles.secretEnvPath,
    internalLauncherResult,
    aliasResult,
    scriptResult,
  };
}
