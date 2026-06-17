# Codex 설정 메커니즘

> 출처: OpenAI Codex 공식 매뉴얼 (`CODEX_HOME`, config basics, authentication,
> custom model providers, environment variables).

## `CODEX_HOME`

- Codex 로컬 상태 루트. 기본값은 `~/.codex`.
- `config.toml`, 인증 캐시(`auth.json` 또는 keyring), history, logs, sessions, skills 등
  로컬 상태가 이 경로 아래에 저장된다.
- `CODEX_HOME`을 바꾸면 CLI 실행 시 다른 상태 루트를 사용한다.
- 이 도구는 프로필별 `CODEX_HOME=~/.codex-switch/<alias>`를 사용한다.

## `config.toml`

프로필별 `config.toml`에는 durable 설정을 기록한다.

```toml
cli_auth_credentials_store = "file"
model = "gpt-5.5"
```

`cli_auth_credentials_store = "file"`을 기본으로 넣어 인증 캐시가 해당 `CODEX_HOME` 아래에
저장되도록 한다.

## 권한 / 승인 / auto-review

Codex CLI의 권한 동작은 실행 후 "auto mode"를 토글하는 방식이 아니라 `config.toml`의
durable 설정으로 지정할 수 있다.

```toml
approval_policy = "on-request"
approvals_reviewer = "auto_review"
sandbox_mode = "workspace-write"
```

대화형 플로우의 preset은 다음 TOML 조합을 생성한다.

| preset                 | 생성되는 설정                                                                 |
| ---------------------- | ----------------------------------------------------------------------------- |
| Codex default          | 권한 관련 키를 쓰지 않음                                                      |
| Read-only              | `sandbox_mode = "read-only"`, `approval_policy = "on-request"`, user reviewer |
| Auto (manual approval) | `sandbox_mode = "workspace-write"`, `approval_policy = "on-request"`          |
| Auto-review            | Auto preset + `approvals_reviewer = "auto_review"`                            |
| No approval prompts    | `sandbox_mode = "workspace-write"`, `approval_policy = "never"`               |

`approvals_reviewer = "auto_review"`는 sandbox 경계를 넓히지 않는다. `approval_policy`가
`"on-request"`처럼 interactive approval을 남기는 경우, 그 approval 요청을 사용자 대신
reviewer agent에 라우팅한다. `approval_policy = "never"`에서는 review할 approval이 없다.

## custom model providers

Codex custom provider는 `config.toml`의 `[model_providers.<id>]`로 정의한다.

```toml
model = "anthropic/claude-sonnet-4.5"
model_provider = "codex_or"

[model_providers.codex_or]
name = "codex_or"
base_url = "https://openrouter.ai/api/v1"
wire_api = "chat"
env_key = "CODEX_SWITCH_CODEX_OR_API_KEY"
```

`wire_api`는 대화형 질문으로 고른다. 기본값은 `chat`(Chat Completions)으로, OpenRouter를
비롯한 대부분의 OpenAI 호환 게이트웨이가 이 프로토콜을 쓴다. OpenAI Responses API를
구현한 게이트웨이에서만 `responses`를 선택한다.

지원하는 인증 형태:

- `env_key`: provider API key env var
- `env_http_headers = { "Authorization" = "ENV" }`
- `env_http_headers = { "X-Api-Key" = "ENV" }`
- no auth

이 도구는 secret 값을 `config.toml`에 직접 쓰지 않고 `.env`에 저장한 뒤 내부 launcher에서
source한다.
