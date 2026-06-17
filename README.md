# codex-switch

**한국어** | [English](README.en.md)

여러 개의 **Codex 프로필**(서로 다른 로그인 / 커스텀 모델 provider / 권한·auto-review
설정)을 대화형으로 세팅해 주는 CLI 도구입니다.

```bash
npx @naram/codex-switch
```

실행하면 몇 가지 질문에 답하는 것만으로 `codex-o`, `codex-gpt`, `codex-glm` 같은
명령으로 서로 다른 Codex 환경을 바로 띄울 수 있게 됩니다.

## "프로필"이란?

Codex에는 `--profile` 설정 레이어가 있지만, 그 자체는 계정·세션 격리용이 아닙니다.
이 도구가 말하는 프로필은:

> **격리된 `CODEX_HOME`** + **프로필별 `config.toml`** + (선택) **provider secret
> `.env`** + **실행 런처(alias/스크립트)** 의 묶음

`CODEX_HOME`은 Codex의 설정, 인증 캐시, 로그, 세션, 스킬 등을 저장하는 루트입니다.
프로필마다 이 디렉토리를 분리하면 로그인과 세션을 분리해서 운용할 수 있습니다.

## 빠른 시작

```bash
# 대화형으로 프로필 생성
npx @naram/codex-switch

# 또는 전역 설치 후
npm i -g @naram/codex-switch
codex-switch            # = codex-switch create
codex-switch list
codex-switch doctor
codex-switch remove codex-glm
```

### 예시 1 - 표준 Codex 로그인 분리

```
alias          : codex-o
custom provider: No
model          : gpt-5.5
permissions    : Codex default
launchers      : alias
```

새 셸에서 `codex-o login`으로 로그인하면 기본 `~/.codex`와 분리된
`~/.codex-switch/codex-o`에 인증과 세션이 저장됩니다.

### 예시 2 - 커스텀 provider (OpenRouter)

```
alias          : codex-or
custom provider: Yes
auth method    : env_key
base URL       : https://openrouter.ai/api/v1
wire protocol  : chat
secret         : ********   (OpenRouter API 키)
model          : anthropic/claude-sonnet-4.5
permissions    : Auto-review
launchers      : alias + script
```

`codex-or` 명령은 해당 프로필의 `config.toml`을 사용하고, provider secret은
`~/.codex-switch/codex-or/.env`에서만 로드합니다.

> OpenRouter처럼 대부분의 OpenAI 호환 게이트웨이는 **Chat Completions** API를 쓰므로
> wire 프로토콜 기본값은 `chat`입니다. OpenAI Responses 호환 게이트웨이를 쓸 때만
> `responses`를 고르면 됩니다.

## 권한 / auto-review preset

대화형 질문에서 Codex 권한 preset을 선택하면 프로필별 `config.toml`에 durable 설정으로
저장됩니다.

| preset                 | 생성되는 설정                                                        |
| ---------------------- | -------------------------------------------------------------------- |
| Codex default          | 권한 관련 키를 쓰지 않음                                             |
| Read-only              | `sandbox_mode = "read-only"`, `approval_policy = "on-request"`       |
| Auto (manual approval) | `sandbox_mode = "workspace-write"`, `approval_policy = "on-request"` |
| Auto-review            | Auto preset + `approvals_reviewer = "auto_review"`                   |
| No approval prompts    | `sandbox_mode = "workspace-write"`, `approval_policy = "never"`      |

Auto-review는 sandbox나 네트워크 권한을 넓히지 않습니다. `approval_policy = "on-request"`처럼
approval 요청이 남아 있을 때, 그 요청을 사용자 대신 reviewer agent에 라우팅합니다.

## 명령어

| 명령                                   | 설명                                               |
| -------------------------------------- | -------------------------------------------------- |
| `codex-switch` / `codex-switch create` | 대화형 프로필 생성 (기존 alias 재실행 시 업데이트) |
| `codex-switch list`                    | 등록된 프로필 목록                                 |
| `codex-switch remove <alias>`          | 프로필 제거 (런처 정리; CODEX_HOME은 확인 후 삭제) |
| `codex-switch doctor`                  | codex 설치 / PATH / 프로필 상태 점검               |
| `codex-switch help`                    | 도움말                                             |

## 무엇이 어디에 생성되나

```text
~/.codex-switch/
├── profiles.json          # 중앙 레지스트리 (메타데이터, 0600) - 비밀은 저장 안 함
├── codex-glm/             # 프로필의 CODEX_HOME
│   ├── config.toml        # Codex 설정 (0600)
│   ├── .env               # provider secret (0600, custom일 때만)
│   ├── launcher           # 내부 런처 (0700)
│   └── ...                # 로그인 후 auth/log/sessions 등 Codex 상태
└── codex-o/
    ├── config.toml
    └── launcher
```

alias 런처는 셸 rc 파일에 마커 블록으로 주입됩니다.

```bash
# >>> codex-switch: codex-glm >>>
alias codex-glm='"$HOME/.codex-switch/codex-glm/launcher"'
# <<< codex-switch: codex-glm <<<
```

PATH 스크립트는 내부 런처만 호출합니다.

```sh
#!/bin/sh
# codex-switch launcher: codex-glm
exec "$HOME/.codex-switch/codex-glm/launcher" "$@"
```

## 보안 설계

- 토큰/API 키는 rc 파일이나 PATH 스크립트에 쓰지 않습니다.
- custom provider secret은 해당 프로필의 `.env`에만 저장하며 권한은 `0600`입니다.
- `config.toml`은 secret 값을 직접 저장하지 않고 `env_key` 또는 `env_http_headers`로
  env var 이름만 참조합니다.
- 권한/auto-review preset은 `approval_policy`, `sandbox_mode`, `approvals_reviewer` 같은
  Codex 설정 키로만 기록합니다.
- 내부 런처는 `.env`를 source한 뒤 `CODEX_HOME`을 export하고 `codex`를 실행합니다.
- 중앙 `profiles.json`에는 재구성용 메타데이터만 저장하고 비밀은 저장하지 않습니다.
- rc 파일을 수정하기 전에 항상 백업(`<rc>.codex-switch.bak`)을 만듭니다.

## 요구 사항

- Node.js **18+**
- **macOS / Linux** (Windows/PowerShell은 현재 범위 외)
- 셸: **zsh / bash / fish**
- Codex CLI (`codex`) 설치

custom provider는 Codex의 custom model provider 설정을 사용합니다. base URL은 OpenAI
호환 엔드포인트(예: OpenRouter `https://openrouter.ai/api/v1`)를 넣으면 되고, wire
프로토콜 기본값은 `chat`(Chat Completions)입니다. OpenAI Responses 호환 게이트웨이를
쓸 때만 `responses`를 선택하세요.

## 탭 자동완성

`alias` 런처를 설치하면, 생성되는 마커 블록에 셸별 completion 연결도 함께 들어갑니다.
이미 Codex 자체 completion(`codex completion <shell>`)을 설치해 두었다면 `codex-or <TAB>`
처럼 별칭에서도 Codex 서브커맨드가 그대로 완성됩니다.

| 셸   | 주입되는 줄                                                       |
| ---- | ----------------------------------------------------------------- |
| zsh  | `(( $+functions[compdef] )) && compdef <alias>=codex 2>/dev/null` |
| bash | `type _codex &>/dev/null && complete -F _codex <alias>`           |
| fish | `complete -c <alias> -w codex`                                    |

Codex completion이 설치돼 있지 않으면 이 줄들은 셸 시작 시 조용히 무시됩니다(에러 없음).
`script` 런처만 설치한 경우에는 rc를 건드리지 않으므로 completion도 연결되지 않습니다.

## 개발

```bash
npm install
npm run build
npm test
npm run lint
```

## 라이선스

MIT
