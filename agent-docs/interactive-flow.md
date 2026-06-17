# 대화형 플로우 & 런처 포맷

## 질문 순서 (`create`)

1. 실행 별칭(alias): 예 `codex-o`
2. 커스텀 OpenAI-compatible provider 사용 여부
3. custom일 때:
   - 인증 방식: `env_key` / `Authorization: Bearer` / `X-Api-Key` / no auth
   - base URL: 예 `https://openrouter.ai/api/v1` (기본값 제시)
   - wire 프로토콜: `chat`(Chat Completions, 기본) / `responses`(OpenAI Responses)
   - secret: no auth가 아닐 때 마스킹 입력
   - model: 선택 입력 (예 `anthropic/claude-sonnet-4.5`)
4. standard일 때:
   - model pinning 여부와 모델명
5. Codex permissions / auto-review preset
   - Codex default: 권한 관련 TOML 키를 쓰지 않음
   - Read-only: `sandbox_mode = "read-only"`, `approval_policy = "on-request"`
   - Auto (manual approval): `sandbox_mode = "workspace-write"`,
     `approval_policy = "on-request"`, `approvals_reviewer = "user"`
   - Auto-review: Auto preset + `approvals_reviewer = "auto_review"`
   - No approval prompts: `sandbox_mode = "workspace-write"`, `approval_policy = "never"`
6. 실행 방식: alias / wrapper script / 둘 다
7. 요약 확인 -> 적용

## 런처 구조

alias는 내부 launcher만 호출한다. 마커 블록에는 셸별 탭 완성 연결 줄도 함께 들어간다
(Codex 자체 completion이 설치돼 있으면 `codex-o <TAB>`가 Codex 서브커맨드를 완성).

```bash
# >>> codex-switch: codex-o >>>
alias codex-o='"$HOME/.codex-switch/codex-o/launcher"'
(( $+functions[compdef] )) && compdef codex-o=codex 2>/dev/null
# <<< codex-switch: codex-o <<<
```

완성 연결 줄(셸별):

- zsh: `(( $+functions[compdef] )) && compdef <alias>=codex 2>/dev/null`
- bash: `type _codex &>/dev/null && complete -F _codex <alias>`
- fish: `complete -c <alias> -w codex`

Codex completion이 없으면 이 줄들은 셸 시작 시 조용히 무시된다. `script`만 설치하면
rc를 건드리지 않으므로 완성도 연결되지 않는다.

PATH wrapper script도 내부 launcher만 호출한다.

```sh
#!/bin/sh
# codex-switch launcher: codex-o
exec "$HOME/.codex-switch/codex-o/launcher" "$@"
```

내부 launcher는 secret과 `CODEX_HOME`을 적용한다.

```sh
#!/bin/sh
# codex-switch internal launcher: codex-o
if [ -f "$HOME/.codex-switch/codex-o/.env" ]; then
  . "$HOME/.codex-switch/codex-o/.env"
fi
export CODEX_HOME="$HOME/.codex-switch/codex-o"
exec codex "$@"
```

## 검증 / 엣지 케이스

- `codex` 설치 여부 점검
- 동일 alias 재실행 -> 덮어쓰기(업데이트) 확인
- alias가 기존 셸 명령과 충돌하는지 점검
- rc 파일 수정 전 백업 생성 (`<rc>.codex-switch.bak`)
- secret은 입력 마스킹, 화면 재출력 금지, 파일 0600
- 내부 launcher는 0700
- 헤드리스 테스트는 `CODEX_SWITCH_HOME`으로 격리
