# 미해결 검증 / 결정 사항

## custom provider 실측

- `wire_api`는 대화형으로 선택하며 기본값은 `chat`(Chat Completions). OpenRouter 등
  대부분의 OpenAI 호환 게이트웨이가 chat을 쓴다. OpenAI Responses 호환 게이트웨이만
  `responses`를 고른다.
- Anthropic 전용 게이트웨이(OpenAI 비호환)는 여전히 지원 범위 밖이다.
- 실제 provider별 인증 방식(`env_key`, `Authorization`, `X-Api-Key`)은 provider 토큰으로
  실측해야 한다. OpenRouter는 `env_key`(= `Authorization: Bearer`)로 동작한다.

## 배포

- `npm publish`는 사용자 npm 로그인 후 진행한다.
- 패키지명은 `@naram/codex-switch`, 실행 명령은 `codex-switch`.
