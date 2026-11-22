// Test double for the `claude` and `codex` CLIs. Behaviour comes from the name of the
// entry script (tests/fixtures/bin/<cli>-<behaviour>), so each fixture is its own command.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const GRAPH = {
  nodes: [
    { id: 'api', label: 'API' },
    { id: 'db', label: 'Database', shape: 'ellipse' },
  ],
  edges: [{ from: 'api', to: 'db', label: 'reads' }],
};

const CHAT_REPLY = {
  reply: 'Added a cache.',
  ops: [
    { type: 'addNodes', nodes: [{ id: 'cache', label: 'Cache' }] },
    { type: 'addEdges', edges: [{ from: 'api', to: 'cache' }] },
    { type: 'deleteElements', ids: ['ghost'] },
  ],
};

const entryName = path.basename(process.argv[1]);
const firstDash = entryName.indexOf('-');
const cli = entryName.slice(0, firstDash);
const behaviour = entryName.slice(firstDash + 1);
const args = process.argv.slice(2);
readFileSync(0, 'utf8'); // consume the prompt from stdin, as the real CLIs do

function claudeEnvelope(structured) {
  return JSON.stringify({
    type: 'result',
    subtype: 'success',
    is_error: false,
    result: '',
    structured_output: structured,
  });
}

function runClaude() {
  if (args[0] === 'auth') {
    const loggedIn = behaviour !== 'logged-out';
    process.stdout.write(JSON.stringify({ loggedIn, authMethod: 'claude.ai' }));
    return;
  }
  switch (behaviour) {
    case 'ok':
      process.stdout.write(claudeEnvelope(GRAPH));
      return;
    case 'chat':
      process.stdout.write(claudeEnvelope(CHAT_REPLY));
      return;
    case 'invalid':
      process.stdout.write(claudeEnvelope({ nodes: 'not a list' }));
      return;
    case 'error':
      process.stdout.write(
        JSON.stringify({
          type: 'result',
          subtype: 'error_during_execution',
          is_error: true,
          result: 'Usage limit reached.',
        }),
      );
      process.exitCode = 1;
      return;
    case 'huge':
      process.stdout.write('x'.repeat(3 * 1024 * 1024));
      return;
    case 'slow':
      setInterval(() => undefined, 1000);
      return;
    default:
      process.exitCode = 2;
  }
}

function runCodex() {
  if (args[0] === 'login') {
    if (behaviour === 'logged-out') {
      process.stderr.write('Not logged in\n');
      process.exitCode = 1;
    } else {
      process.stdout.write('Logged in using ChatGPT\n');
    }
    return;
  }
  const outIndex = args.indexOf('-o');
  const outFile = outIndex >= 0 ? args[outIndex + 1] : undefined;
  switch (behaviour) {
    case 'ok':
      process.stdout.write('codex log line\n');
      writeFileSync(outFile, JSON.stringify(GRAPH));
      return;
    case 'invalid':
      writeFileSync(outFile, JSON.stringify({ nodes: 3 }));
      return;
    case 'error':
      process.stderr.write('boom\n');
      process.exitCode = 1;
      return;
    case 'slow':
      setInterval(() => undefined, 1000);
      return;
    default:
      process.exitCode = 2;
  }
}

if (cli === 'claude') runClaude();
else if (cli === 'codex') runCodex();
else process.exitCode = 3;
