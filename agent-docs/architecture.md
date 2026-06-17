# 아키텍처

## 확정된 설계 결정

| 항목                | 결정                                                 |
| ------------------- | ---------------------------------------------------- |
| 구현 스택           | TypeScript (Node.js, ESM)                            |
| 실행 방식           | alias + 래퍼 스크립트 (프로필마다 선택)              |
| 상태 격리           | 프로필마다 `CODEX_HOME` (`~/.codex-switch/<alias>/`) |
| Codex 설정          | 프로필별 `config.toml` (0600)                        |
| 시크릿 보관         | 프로필별 `.env` (0600), 런처에서만 source            |
| 패키지명            | `@naram/codex-switch` (실행 명령은 `codex-switch`)   |
| 프롬프트 라이브러리 | `@clack/prompts`                                     |
| 빌드 도구           | `tsup` (deps 인라인 번들 -> `npx` 단독 실행)         |
| 레지스트리 위치     | `~/.codex-switch/profiles.json`                      |
| Windows 지원        | v1 제외 (macOS/Linux 우선)                           |

## 디렉토리 레이아웃

```text
~/.codex-switch/
├── profiles.json
├── codex-o/
│   ├── config.toml
│   ├── launcher
│   └── ...
└── codex-glm/
    ├── config.toml
    ├── .env
    └── launcher
```

## 소스 구조

```text
src/
├── index.ts
├── commands/{create,list,remove,doctor}.ts
├── core/
│   ├── profile.ts
│   ├── registry.ts
│   ├── settings.ts      # config.toml + .env 생성
│   ├── apply.ts
│   └── paths.ts
├── installers/
│   ├── shell.ts
│   ├── alias.ts
│   └── script.ts        # 내부 launcher + 외부 wrapper script
└── util/{fs,log,validate}.ts
```

## 데이터 모델

```ts
interface Profile {
  alias: string;
  codexHome: string;
  configPath: string;
  launcherPath: string;
  secretEnvPath?: string;
  custom: boolean;
  baseUrl?: string;
  authMethod?: 'envKey' | 'bearerHeader' | 'xApiKeyHeader' | 'none';
  providerId?: string;
  envVar?: string;
  model?: string;
  approvalPolicy?: 'untrusted' | 'on-request' | 'never';
  sandboxMode?: 'read-only' | 'workspace-write' | 'danger-full-access';
  approvalsReviewer?: 'user' | 'auto_review';
  launchers: ('alias' | 'script')[];
  scriptPath?: string;
  shellRc?: string;
  createdAt: string;
}
```

## 시크릿 흐름

1. 토큰/API 키는 `~/.codex-switch/<alias>/.env`에만 저장한다.
2. `config.toml`은 secret 값을 직접 담지 않고 env var 이름만 참조한다.
3. 내부 `launcher`가 `.env`를 source하고 `CODEX_HOME`을 export한 뒤 `codex`를 실행한다.
4. rc alias와 PATH wrapper script는 내부 launcher 경로만 담는다.
5. 중앙 `profiles.json`에는 재구성용 메타만 저장하고 비밀은 저장하지 않는다.
