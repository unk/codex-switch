# AGENTS.md

`codex-switch` - Codex 프로필(로그인/모델/provider)을 대화형으로 세팅하는 CLI 도구.

이 파일은 **인덱스**입니다. 작업과 관련된 주제 문서를 먼저 읽으세요.

## 문서 인덱스

| 문서                                                          | 내용                                                              |
| ------------------------------------------------------------- | ----------------------------------------------------------------- |
| [개요](./agent-docs/overview.md)                              | 무엇을/왜 만드는가, "프로필" 정의, 명령어, 요구사항·범위          |
| [아키텍처](./agent-docs/architecture.md)                      | 설계 결정, 디렉토리 레이아웃, 소스 구조, 데이터 모델, 시크릿 흐름 |
| [Codex 설정 메커니즘](./agent-docs/codex-internals.md)        | `CODEX_HOME`, `config.toml`, custom model providers               |
| [대화형 플로우 & 런처 포맷](./agent-docs/interactive-flow.md) | 질문 순서, 마커/스크립트 포맷, 대화형 테스트(PTY)                 |
| [개발 규칙](./agent-docs/conventions.md)                      | 빌드/테스트/lint 명령, 빠른 검증, 커밋 규칙                       |
| [미해결 사항](./agent-docs/open-questions.md)                 | 남은 검증·결정                                                    |

## 필수 준수

- 커밋 메시지에 AI 공동작성자/생성 표기를 넣지 않는다.
- 변경 후 `npm run build && npm test && npm run lint` 그린 확인.
