# codex-switch

[한국어](README.md) | **English**

A CLI tool that interactively sets up multiple **Codex profiles** with isolated
login/session state, optional custom model providers, and permission/auto-review
settings.

```bash
npx @naram/codex-switch
```

After answering a few prompts, you can launch Codex with commands such as
`codex-o`, `codex-gpt`, or `codex-glm`.

## What is a "profile"?

Codex has a `--profile` configuration layer, but that layer alone is not account
or session isolation. In this tool, a profile means:

> an isolated **`CODEX_HOME`** + profile-local **`config.toml`** + optional
> provider-secret **`.env`** + launcher aliases/scripts

`CODEX_HOME` is the Codex state root for config, auth cache, logs, sessions,
skills, and other local state. Separating it per profile lets you keep logins and
sessions separate.

## Quick start

```bash
npx @naram/codex-switch

npm i -g @naram/codex-switch
codex-switch
codex-switch list
codex-switch doctor
codex-switch remove codex-glm
```

## What gets created

```text
~/.codex-switch/
├── profiles.json
├── codex-glm/
│   ├── config.toml
│   ├── .env
│   ├── launcher
│   └── ...
└── codex-o/
    ├── config.toml
    └── launcher
```

Secrets are not written to shell rc files or PATH scripts. Custom provider
secrets live only in the profile `.env` file with `0600` permissions. The
generated `config.toml` references the env var name through `env_key` or
`env_http_headers`.

## Permission / Auto-review Presets

The interactive flow can write Codex permission settings into each profile's
`config.toml`.

| Preset                 | Generated settings                                                   |
| ---------------------- | -------------------------------------------------------------------- |
| Codex default          | No permission keys written                                           |
| Read-only              | `sandbox_mode = "read-only"`, `approval_policy = "on-request"`       |
| Auto (manual approval) | `sandbox_mode = "workspace-write"`, `approval_policy = "on-request"` |
| Auto-review            | Auto preset + `approvals_reviewer = "auto_review"`                   |
| No approval prompts    | `sandbox_mode = "workspace-write"`, `approval_policy = "never"`      |

Auto-review does not expand the sandbox or network permissions. It routes
eligible approval requests to a reviewer agent when approvals remain interactive.

## Commands

| Command                       | Description                                        |
| ----------------------------- | -------------------------------------------------- |
| `codex-switch` / `create`     | Create or update a profile interactively           |
| `codex-switch list`           | List registered profiles                           |
| `codex-switch remove <alias>` | Remove launchers and registry entry                |
| `codex-switch doctor`         | Check codex installation, PATH, and profile health |
| `codex-switch help`           | Show help                                          |

## Requirements

- Node.js **18+**
- **macOS / Linux** (Windows/PowerShell is out of scope for v1)
- Shells: **zsh / bash / fish**
- Codex CLI (`codex`) installed

Custom providers use Codex custom model provider config. Enter an OpenAI-compatible
base URL (for example OpenRouter `https://openrouter.ai/api/v1`); the wire protocol
defaults to `chat` (Chat Completions). Choose `responses` only for OpenAI
Responses-compatible gateways.

## Tab completion

When you install the `alias` launcher, the generated marker block also wires
shell completion onto the alias. If you already installed Codex's own completion
(`codex completion <shell>`), then `codex-or <TAB>` completes Codex subcommands
just like `codex <TAB>`.

| Shell | Injected line                                                     |
| ----- | ----------------------------------------------------------------- |
| zsh   | `(( $+functions[compdef] )) && compdef <alias>=codex 2>/dev/null` |
| bash  | `type _codex &>/dev/null && complete -F _codex <alias>`           |
| fish  | `complete -c <alias> -w codex`                                    |

If Codex completion is not installed, these lines no-op quietly at shell startup.
With a `script`-only launcher no rc file is touched, so completion is not wired.

## Development

```bash
npm install
npm run build
npm test
npm run lint
```

## License

MIT
