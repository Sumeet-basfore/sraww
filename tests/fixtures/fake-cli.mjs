// Test double for the `claude` and `codex` CLIs. Behaviour comes from the name of the
// entry script (tests/fixtures/bin/<cli>-<behaviour>), so each fixture is its own command.
import { readFileSync, writeFileSync } from 'node:fs';
import readline from 'node:readline';
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

const REVIEW_REPLY = {
  summary: 'Review summary',
  findings: [
    {
      severity: 'high',
      title: 'Unsupported claim',
      evidence: ['ghost'],
      suggestion: 'Split ghost by feature.',
    },
    {
      severity: 'medium',
      title: 'Split source',
      evidence: ['src', 'ghost'],
      suggestion: 'Split src by feature.',
    },
  ],
};

const NAMING_REPLY = {
  components: [
    { id: 'src', label: 'Source code', description: 'Application code.' },
    { id: 'ext:express', label: 'Should be ignored', description: 'x' },
    { id: 'not-a-folder', label: 'Ghost', description: 'x' },
  ],
};

const entryName = path.basename(process.argv[1]);
const firstDash = entryName.indexOf('-');
const cli = entryName.slice(0, firstDash);
const behaviour = entryName.slice(firstDash + 1);
const args = process.argv.slice(2);

// Sign-in and the app server keep stdin open, so they are handled before any stdin is read.
if (cli === 'claude' && args[0] === 'auth' && args[1] === 'login') {
  runClaudeLogin();
} else if (cli === 'codex' && args[0] === 'app-server') {
  runAppServer();
} else {
  readFileSync(0, 'utf8'); // consume the prompt from stdin, as the real CLIs do
  if (cli === 'claude') runClaude();
  else if (cli === 'codex') runCodex();
  else process.exitCode = 3;
}

function claudeEnvelope(structured) {
  return JSON.stringify({
    type: 'result',
    subtype: 'success',
    is_error: false,
    result: '',
    structured_output: structured,
  });
}

function recordArgs(file) {
  writeFileSync(file, JSON.stringify(args));
}

function runClaude() {
  if (args[0] === 'auth') {
    const loggedIn = behaviour !== 'logged-out';
    process.stdout.write(
      JSON.stringify({
        loggedIn,
        authMethod: 'claude.ai',
        email: loggedIn ? 'person@example.test' : undefined,
        orgName: loggedIn ? 'Example Org' : undefined,
      }),
    );
    return;
  }
  switch (behaviour) {
    case 'ok':
      process.stdout.write(claudeEnvelope(GRAPH));
      return;
    case 'args':
      recordArgs('args.json');
      process.stdout.write(claudeEnvelope(GRAPH));
      return;
    case 'naming':
      process.stdout.write(claudeEnvelope(NAMING_REPLY));
      return;
    case 'review':
      process.stdout.write(claudeEnvelope(REVIEW_REPLY));
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

/** Mirrors the real CLI: prints a link, then waits for a code on stdin. */
function runClaudeLogin() {
  process.stdout.write(
    'Opening browser to sign in…\n' +
      "If the browser didn't open, visit: https://claude.example.test/oauth/authorize?state=abc\n" +
      'Paste code here if prompted > ',
  );
  if (behaviour === 'login-slow') {
    setInterval(() => undefined, 1000);
    return;
  }
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', (line) => {
    if (line.trim() === 'test-code#state') {
      process.stdout.write('Login successful.\n');
      process.exit(0);
    }
    process.stderr.write('Invalid code. Please try again.\n');
    process.exit(1);
  });
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
    case 'args':
      recordArgs('args.json');
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

/**
 * A JSON-RPC responder for `codex app-server`. The behaviour decides the account: signed in
 * (default), signed out, or signed in with a sign-in that completes on its own.
 */
function runAppServer() {
  const signedOut = behaviour === 'app-signed-out';
  const autoComplete = behaviour === 'app-autocomplete';
  const write = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
  const rl = readline.createInterface({ input: process.stdin });

  rl.on('line', (line) => {
    const message = JSON.parse(line);
    if (message.id === undefined) return; // notifications such as "initialized"
    const reply = (result) => write({ jsonrpc: '2.0', id: message.id, result });
    switch (message.method) {
      case 'initialize':
        reply({
          userAgent: 'fake-codex',
          codexHome: '/tmp',
          platformFamily: 'unix',
          platformOs: 'linux',
        });
        return;
      case 'account/read':
        reply({
          account: signedOut
            ? null
            : {
                type: 'chatgpt',
                email: 'person@example.test',
                planType: 'plus',
                workspaceName: null,
              },
          requiresOpenaiAuth: true,
        });
        return;
      case 'config/read':
        reply({
          config: { model: 'gpt-test-1', model_reasoning_effort: 'high' },
          layers: null,
          origins: {},
        });
        return;
      case 'model/list':
        reply({
          data: [
            {
              model: 'gpt-test-1',
              displayName: 'Test One',
              hidden: false,
              supportedReasoningEfforts: [{ reasoningEffort: 'low' }, { reasoningEffort: 'high' }],
              defaultReasoningEffort: 'low',
            },
            {
              model: 'gpt-hidden',
              displayName: 'Hidden',
              hidden: true,
              supportedReasoningEfforts: [{ reasoningEffort: 'low' }],
              defaultReasoningEffort: 'low',
            },
          ],
          nextCursor: null,
        });
        return;
      case 'account/login/start':
        reply({
          type: 'chatgptDeviceCode',
          loginId: 'login-1',
          verificationUrl: 'https://auth.example.test/device',
          userCode: 'ABCD-1234',
        });
        if (autoComplete) {
          setTimeout(() => {
            write({
              jsonrpc: '2.0',
              method: 'account/login/completed',
              params: { loginId: 'login-1', success: true, error: null },
            });
          }, 50);
        }
        return;
      case 'account/login/cancel':
        reply({ status: 'canceled' });
        return;
      default:
        write({
          jsonrpc: '2.0',
          id: message.id,
          error: { code: -32601, message: 'unknown method' },
        });
    }
  });
}
