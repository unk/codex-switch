# 프로젝트 개요

## 무엇을 만드는가

Codex를 **여러 개의 프로필**로 세팅하는 대화형 CLI 도구 (`codex-switch`).

- 배포: `npx @naram/codex-switch` 로 즉시 실행
- 실행하면 대화형 질문을 던지고, 답변대로 `CODEX_HOME`과 런처를 자동 구성
- 결과물: `codex-o`, `codex-gpt`, `codex-glm` 같은 명령으로 서로 다른 로그인/모델
  환경과 권한/auto-review 설정의 Codex를 실행

## "프로필"의 정의

Codex의 공식 `--profile`은 설정 레이어 전환 기능이다. 본 프로젝트의 "프로필"은:

> **격리된 `CODEX_HOME` + 프로필별 `config.toml` + (선택) provider `.env` + 실행
> 런처(alias/스크립트)** 의 묶음.

즉 이 도구는 `CODEX_HOME` 격리와 Codex custom model provider, 권한/auto-review 설정을
자동화하는 래퍼다.
자세한 메커니즘은 [codex-internals.md](./codex-internals.md) 참고.

## 명령어

| 커맨드             | 설명                                               |
| ------------------ | -------------------------------------------------- |
| `create` (기본)    | 대화형 프로필 생성 (기존 alias 재실행 시 업데이트) |
| `list`             | 등록된 프로필 목록                                 |
| `remove <alias>`   | 프로필 제거 (런처 정리; CODEX_HOME은 확인 후 삭제) |
| `doctor`           | codex 설치 / PATH / 프로필 상태 점검               |
| `help` / `version` | 도움말 / 버전                                      |

## 요구 사항 / 범위

- Node.js **18+**
- **macOS / Linux** (Windows/PowerShell은 v1 범위 외)
- 셸: **zsh / bash / fish**
- `codex` CLI 설치 필요
- custom provider는 OpenAI Responses 호환 base URL을 기본 전제로 한다.

## 산출물 위치

- 프로필 루트: `~/.codex-switch/`
- 중앙 레지스트리: `~/.codex-switch/profiles.json` (0600, 비밀 미저장)
- 프로필별 `CODEX_HOME`: `~/.codex-switch/<alias>/`
- 프로필 설정: `~/.codex-switch/<alias>/config.toml` (0600)
- provider secret: `~/.codex-switch/<alias>/.env` (0600, custom auth일 때만)
- 내부 런처: `~/.codex-switch/<alias>/launcher` (0700)
- 외부 런처: alias(셸 rc 마커 블록) / 스크립트(`~/.local/bin/<alias>`)
