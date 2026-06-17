/** Authentication method for a custom model provider profile. */
export type AuthMethod = 'envKey' | 'bearerHeader' | 'xApiKeyHeader' | 'none';

/**
 * Wire protocol Codex uses to talk to a custom provider. Most OpenAI-compatible
 * gateways (OpenRouter, Groq, Together, …) speak Chat Completions; only
 * OpenAI-native / Responses gateways implement the Responses API.
 */
export type WireApi = 'chat' | 'responses';

/** A launcher kind the user can install for a profile. */
export type Launcher = 'alias' | 'script';

/** Codex approval prompt policy written to config.toml. */
export type ApprovalPolicy = 'untrusted' | 'on-request' | 'never';

/** Codex command/file sandbox mode written to config.toml. */
export type SandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access';

/** Who reviews approval prompts that remain interactive. */
export type ApprovalsReviewer = 'user' | 'auto_review';

/**
 * A profile as persisted in the central registry (~/.codex-switch/profiles.json).
 *
 * SECURITY: secrets are NEVER stored here. They live only in the profile's
 * .env file (0600). The registry holds reconstruction
 * metadata so we can list/remove/edit profiles without exposing secrets.
 */
export interface Profile {
  /** Launch command name, e.g. "codex-o". Unique key. */
  alias: string;
  /** Absolute path to this profile's CODEX_HOME. */
  codexHome: string;
  /** Absolute path to this profile's config.toml. */
  configPath: string;
  /** Absolute path to this profile's internal launcher. */
  launcherPath: string;
  /** Optional absolute path to a 0600 env file containing provider secrets. */
  secretEnvPath?: string;
  /** Whether this profile routes to a custom model provider. */
  custom: boolean;
  /** Provider base URL (custom only). */
  baseUrl?: string;
  /** How the gateway authenticates (custom only). */
  authMethod?: AuthMethod;
  /** Wire protocol for the custom provider (custom only). Defaults to 'chat'. */
  wireApi?: WireApi;
  /** Codex model provider id written to config.toml (custom only). */
  providerId?: string;
  /** Environment variable name used by the provider secret, if any. */
  envVar?: string;
  /** Default model override (e.g. "glm-5.1"). */
  model?: string;
  /** Codex approval policy override, when explicitly configured. */
  approvalPolicy?: ApprovalPolicy;
  /** Codex sandbox mode override, when explicitly configured. */
  sandboxMode?: SandboxMode;
  /** Reviewer for interactive approval prompts, when explicitly configured. */
  approvalsReviewer?: ApprovalsReviewer;
  /** Which launchers were installed. */
  launchers: Launcher[];
  /** Absolute path of the wrapper script, when a 'script' launcher exists. */
  scriptPath?: string;
  /** rc file the alias block was injected into, when an 'alias' launcher exists. */
  shellRc?: string;
  /** ISO timestamp of creation. */
  createdAt: string;
}

export interface Registry {
  version: 1;
  profiles: Profile[];
}

export function emptyRegistry(): Registry {
  return { version: 1, profiles: [] };
}
