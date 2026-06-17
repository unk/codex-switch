# 개발 규칙

## 개발 명령

```bash
npm install
npm run build
npm test
npm run lint
npm run format
```

버전은 빌드 시 `process.env.CODEX_SWITCH_VERSION` 으로 주입된다.

## 빠른 검증

```bash
npm run build && npm test && npm run lint
```

- 대화형 수동 확인: `CODEX_SWITCH_HOME=$(mktemp -d) node dist/index.js create` (TTY 필요)
- 모든 테스트는 `CODEX_SWITCH_HOME` 으로 격리되어 실제 사용자 환경
  (`~/.zshrc`, `~/.codex-switch`, `~/.local/bin`)을 건드리지 않는다.

## 커밋 규칙

- 커밋 메시지에 AI 에이전트 관련 표기를 넣지 않는다.
- 커밋/푸시는 사용자가 요청할 때만 수행한다.
