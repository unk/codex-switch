import { runCreate } from './commands/create.js';
import { runDoctor } from './commands/doctor.js';
import { runList } from './commands/list.js';
import { runRemove } from './commands/remove.js';
import { color, error, info } from './util/log.js';

const VERSION = process.env.CODEX_SWITCH_VERSION ?? '0.0.0-dev';

const HELP = `${color.bold('codex-switch')} — set up isolated Codex profiles

${color.bold('USAGE')}
  codex-switch [command]

${color.bold('COMMANDS')}
  create            Create a new profile (interactive). Default when no command given.
  list              List configured profiles.
  remove <alias>    Remove a profile (cleans launchers; CODEX_HOME on confirm).
  doctor            Check codex install, PATH, and profile health.
  help              Show this help.
  version           Show version.

${color.bold('OPTIONS')}
  -h, --help        Show this help.
  -v, --version     Show version.

${color.bold('EXAMPLES')}
  npx @naram/codex-switch         # create a profile interactively
  codex-switch list
  codex-switch remove codex-gpt

Profiles are stored under ${color.dim('~/.codex-switch')}. Secrets live only in
each profile's .env file (chmod 0600) — never in your shell rc.`;

async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;

  switch (cmd) {
    case undefined:
    case 'create':
      return runCreate();
    case 'list':
    case 'ls':
      return runList();
    case 'remove':
    case 'rm':
      return runRemove(rest[0]);
    case 'doctor':
      return runDoctor();
    case 'help':
    case '--help':
    case '-h':
      info(HELP);
      return 0;
    case 'version':
    case '--version':
    case '-v':
      info(VERSION);
      return 0;
    default:
      error(`Unknown command: ${cmd}`);
      info(`Run ${color.cyan('codex-switch help')} for usage.`);
      return 1;
  }
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
