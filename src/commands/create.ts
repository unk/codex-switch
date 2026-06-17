import * as p from '@clack/prompts';
import path from 'node:path';
import { applyProfile } from '../core/apply.js';
import { codexHomeFor, defaultBinDir, expandHome, tildify } from '../core/paths.js';
import type {
  ApprovalPolicy,
  ApprovalsReviewer,
  AuthMethod,
  Launcher,
  SandboxMode,
  WireApi,
} from '../core/profile.js';
import { getProfile } from '../core/registry.js';
import { codexInstalled, commandExists, detectShell, isOnPath } from '../installers/shell.js';
import { color } from '../util/log.js';
import { validateAlias, validateBaseUrl, validateRequired } from '../util/validate.js';

/** Unwrap a clack prompt result, exiting cleanly on Ctrl-C / cancel. */
function ensure<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel('Cancelled. Nothing was changed.');
    process.exit(130);
  }
  return value as T;
}

type PermissionPreset = 'codexDefault' | 'readOnly' | 'auto' | 'autoReview' | 'noPrompts';

interface PermissionSettings {
  approvalPolicy?: ApprovalPolicy;
  sandboxMode?: SandboxMode;
  approvalsReviewer?: ApprovalsReviewer;
}

const PERMISSION_SETTINGS: Record<PermissionPreset, PermissionSettings> = {
  codexDefault: {},
  readOnly: {
    approvalPolicy: 'on-request',
    sandboxMode: 'read-only',
    approvalsReviewer: 'user',
  },
  auto: {
    approvalPolicy: 'on-request',
    sandboxMode: 'workspace-write',
    approvalsReviewer: 'user',
  },
  autoReview: {
    approvalPolicy: 'on-request',
    sandboxMode: 'workspace-write',
    approvalsReviewer: 'auto_review',
  },
  noPrompts: {
    approvalPolicy: 'never',
    sandboxMode: 'workspace-write',
  },
};

function permissionSummary(settings: PermissionSettings): string {
  const parts = [
    settings.sandboxMode ? `sandbox=${settings.sandboxMode}` : undefined,
    settings.approvalPolicy ? `approval=${settings.approvalPolicy}` : undefined,
    settings.approvalsReviewer ? `reviewer=${settings.approvalsReviewer}` : undefined,
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(', ') : 'Codex default';
}

export async function runCreate(): Promise<number> {
  p.intro(color.bold('codex-switch — new Codex profile'));

  if (!codexInstalled()) {
    p.log.warn(
      'The `codex` command was not found on PATH. The profile will still be created, but install Codex before launching it.',
    );
  }

  const alias = ensure(
    await p.text({
      message: 'Launch alias (the command you will type)',
      placeholder: 'codex-o',
      validate: (v) => validateAlias(v ?? '') ?? undefined,
    }),
  ).trim();

  const existing = getProfile(alias);
  if (existing) {
    const ov = ensure(
      await p.confirm({
        message: `Profile "${alias}" already exists. Update it?`,
        initialValue: true,
      }),
    );
    if (!ov) {
      p.cancel('Aborted.');
      return 0;
    }
  } else if (commandExists(alias)) {
    p.log.warn(
      `"${alias}" already resolves to an existing command. Your alias/script will shadow it in new shells.`,
    );
  }

  const custom = ensure(
    await p.confirm({
      message: 'Use a custom OpenAI-compatible provider? (No = standard Codex account/login)',
      initialValue: false,
    }),
  );

  let baseUrl: string | undefined;
  let authMethod: AuthMethod | undefined;
  let wireApi: WireApi | undefined;
  let secret: string | undefined;
  let model: string | undefined;

  if (custom) {
    authMethod = ensure(
      await p.select({
        message: 'Authentication method',
        initialValue: 'envKey' as AuthMethod,
        options: [
          { value: 'envKey', label: 'env_key', hint: 'provider API key env var (OpenRouter, …)' },
          { value: 'bearerHeader', label: 'Authorization: Bearer', hint: 'custom header' },
          { value: 'xApiKeyHeader', label: 'X-Api-Key', hint: 'custom header' },
          { value: 'none', label: 'No auth', hint: 'local or unauthenticated proxy' },
        ],
      }),
    );

    baseUrl = ensure(
      await p.text({
        message: 'Provider base URL',
        placeholder: 'https://openrouter.ai/api/v1',
        initialValue: 'https://openrouter.ai/api/v1',
        validate: (v) => validateBaseUrl(v ?? '') ?? undefined,
      }),
    ).trim();

    wireApi = ensure(
      await p.select({
        message: 'Wire protocol',
        initialValue: 'chat' as WireApi,
        options: [
          { value: 'chat', label: 'Chat Completions', hint: 'OpenRouter, Groq, Together, …' },
          { value: 'responses', label: 'Responses', hint: 'OpenAI-native / Responses gateways' },
        ],
      }),
    ) as WireApi;

    if (authMethod !== 'none') {
      secret = ensure(
        await p.password({
          message: authMethod === 'bearerHeader' ? 'Bearer token' : 'API key / token',
          validate: (v) => validateRequired('Value')(v ?? '') ?? undefined,
        }),
      );
    }

    const m = ensure(
      await p.text({
        message: 'Default model (optional, Enter to skip)',
        placeholder: 'anthropic/claude-sonnet-4.5',
        defaultValue: '',
      }),
    ).trim();
    model = m || undefined;
  } else {
    const fixModel = ensure(
      await p.confirm({
        message: 'Pin a default model for this profile?',
        initialValue: false,
      }),
    );
    if (fixModel) {
      const m = ensure(
        await p.text({
          message: 'Default model',
          placeholder: 'gpt-5.5',
          defaultValue: '',
        }),
      ).trim();
      model = m || undefined;
    }
  }

  const permissionPreset = ensure(
    await p.select({
      message: 'Codex permissions / auto-review preset',
      initialValue: 'codexDefault' as PermissionPreset,
      options: [
        {
          value: 'codexDefault',
          label: 'Codex default',
          hint: 'do not write sandbox or approval settings',
        },
        {
          value: 'autoReview',
          label: 'Auto-review',
          hint: 'workspace-write + on-request + approvals_reviewer=auto_review',
        },
        {
          value: 'auto',
          label: 'Auto (manual approval)',
          hint: 'workspace-write + on-request + approvals_reviewer=user',
        },
        {
          value: 'readOnly',
          label: 'Read-only',
          hint: 'read-only + on-request approvals',
        },
        {
          value: 'noPrompts',
          label: 'No approval prompts',
          hint: 'workspace-write + approval_policy=never',
        },
      ],
    }),
  ) as PermissionPreset;
  const permissionSettings = PERMISSION_SETTINGS[permissionPreset];
  if (permissionPreset === 'noPrompts') {
    p.log.warn(
      'No approval prompts still keeps the workspace-write sandbox. It does not grant full filesystem or network access.',
    );
  }

  const shell = detectShell();
  const launchers = ensure(
    await p.multiselect({
      message: 'How do you want to launch this profile?',
      required: true,
      initialValues: ['alias'] as Launcher[],
      options: [
        { value: 'alias', label: `Shell alias`, hint: `${shell.name} -> ${tildify(shell.rcPath)}` },
        { value: 'script', label: 'Wrapper script', hint: 'an executable on your PATH' },
      ],
    }),
  ) as Launcher[];

  let scriptPath: string | undefined;
  if (launchers.includes('script')) {
    const binDir = ensure(
      await p.text({
        message: 'Install the wrapper script into which directory?',
        placeholder: tildify(defaultBinDir()),
        initialValue: tildify(defaultBinDir()),
        validate: (v) => validateRequired('Directory')(v ?? '') ?? undefined,
      }),
    ).trim();
    const resolvedBin = expandHome(binDir);
    scriptPath = path.join(resolvedBin, alias);
    if (!isOnPath(resolvedBin)) {
      p.log.warn(
        `${tildify(resolvedBin)} is not on your PATH. Add it (e.g. export PATH="${binDir}:$PATH") or the "${alias}" command won't be found.`,
      );
    }
  }

  if (launchers.includes('alias') && shell.name === 'unknown') {
    p.log.warn(
      `Could not detect a supported shell (SHELL=${process.env.SHELL ?? 'unset'}). The alias will be written to ${tildify(shell.rcPath)} using POSIX syntax.`,
    );
  }

  const codexHome = codexHomeFor(alias);
  const summaryLines = [
    `${color.dim('alias')}      ${alias}`,
    `${color.dim('type')}       ${custom ? 'custom provider' : 'standard Codex account'}`,
    ...(custom
      ? [
          `${color.dim('baseUrl')}    ${baseUrl}`,
          `${color.dim('wireApi')}    ${wireApi}`,
          `${color.dim('auth')}       ${authMethod}`,
          ...(authMethod !== 'none'
            ? [`${color.dim('secret')}     ${'•'.repeat(8)} (stored in .env, 0600)`]
            : []),
        ]
      : []),
    ...(model ? [`${color.dim('model')}      ${model}`] : []),
    `${color.dim('permissions')} ${permissionSummary(permissionSettings)}`,
    `${color.dim('codexHome')}  ${tildify(codexHome)}`,
    `${color.dim('launchers')}  ${launchers.join(', ')}`,
    ...(scriptPath ? [`${color.dim('script')}     ${tildify(scriptPath)}`] : []),
    ...(launchers.includes('alias') ? [`${color.dim('rc')}         ${tildify(shell.rcPath)}`] : []),
  ];
  p.note(summaryLines.join('\n'), 'Summary');

  const go = ensure(await p.confirm({ message: 'Apply this configuration?', initialValue: true }));
  if (!go) {
    p.cancel('Aborted. Nothing was changed.');
    return 0;
  }

  const s = p.spinner();
  s.start('Writing profile');

  applyProfile({
    alias,
    custom,
    baseUrl,
    authMethod,
    wireApi,
    secret,
    model,
    approvalPolicy: permissionSettings.approvalPolicy,
    sandboxMode: permissionSettings.sandboxMode,
    approvalsReviewer: permissionSettings.approvalsReviewer,
    launchers,
    scriptPath,
    shell,
    createdAt: new Date().toISOString(),
  });

  s.stop('Profile written');

  const next: string[] = [];
  if (launchers.includes('alias')) {
    next.push(`Open a new shell, or run: ${color.cyan(`source ${tildify(shell.rcPath)}`)}`);
  }
  next.push(`Launch with: ${color.cyan(alias)}`);
  if (!custom) {
    next.push(`Run ${color.cyan(`${alias} login`)} if you want to sign in before opening Codex.`);
  }
  p.note(next.join('\n'), 'Next steps');
  p.outro(color.green(`Profile "${alias}" is ready.`));
  return 0;
}
