import { listProfiles } from '../core/registry.js';
import { tildify } from '../core/paths.js';
import type { Profile } from '../core/profile.js';
import { color, info } from '../util/log.js';

function pad(s: string, width: number): string {
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

function permissionLabel(profile: Profile): string {
  if (!profile.approvalPolicy && !profile.sandboxMode && !profile.approvalsReviewer) {
    return 'default';
  }

  if (
    profile.approvalPolicy === 'on-request' &&
    profile.sandboxMode === 'workspace-write' &&
    profile.approvalsReviewer === 'auto_review'
  ) {
    return 'auto-review';
  }
  if (
    profile.approvalPolicy === 'on-request' &&
    profile.sandboxMode === 'workspace-write' &&
    profile.approvalsReviewer === 'user'
  ) {
    return 'auto';
  }
  if (profile.approvalPolicy === 'on-request' && profile.sandboxMode === 'read-only') {
    return 'read-only';
  }
  if (profile.approvalPolicy === 'never' && profile.sandboxMode === 'workspace-write') {
    return 'no-prompts';
  }

  return [
    profile.sandboxMode ?? 'sandbox-default',
    profile.approvalPolicy ?? 'approval-default',
    profile.approvalsReviewer ?? 'reviewer-default',
  ].join('/');
}

export function runList(): number {
  const profiles = listProfiles();
  if (profiles.length === 0) {
    info('No profiles yet. Run `codex-switch create` to add one.');
    return 0;
  }

  const rows = profiles.map((p) => ({
    alias: p.alias,
    model: p.model ?? (p.custom ? '(provider default)' : '(account default)'),
    type: p.custom ? 'custom' : 'standard',
    permissions: permissionLabel(p),
    launchers: p.launchers.join(', ') || '-',
    codexHome: tildify(p.codexHome),
  }));

  const headers = {
    alias: 'ALIAS',
    model: 'MODEL',
    type: 'TYPE',
    permissions: 'PERMISSIONS',
    launchers: 'LAUNCHERS',
    codexHome: 'CODEX HOME',
  };
  const widths = {
    alias: Math.max(headers.alias.length, ...rows.map((r) => r.alias.length)),
    model: Math.max(headers.model.length, ...rows.map((r) => r.model.length)),
    type: Math.max(headers.type.length, ...rows.map((r) => r.type.length)),
    permissions: Math.max(headers.permissions.length, ...rows.map((r) => r.permissions.length)),
    launchers: Math.max(headers.launchers.length, ...rows.map((r) => r.launchers.length)),
  };

  info(
    color.bold(
      `${pad(headers.alias, widths.alias)}  ${pad(headers.model, widths.model)}  ${pad(headers.type, widths.type)}  ${pad(headers.permissions, widths.permissions)}  ${pad(headers.launchers, widths.launchers)}  ${headers.codexHome}`,
    ),
  );
  for (const r of rows) {
    info(
      `${pad(r.alias, widths.alias)}  ${pad(r.model, widths.model)}  ${pad(r.type, widths.type)}  ${pad(r.permissions, widths.permissions)}  ${pad(r.launchers, widths.launchers)}  ${color.dim(r.codexHome)}`,
    );
  }
  return 0;
}
