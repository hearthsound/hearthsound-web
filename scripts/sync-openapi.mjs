#!/usr/bin/env node
/**
 * Synchronizes the client's native API types with the OpenAPI document a
 * Hearthsound server publishes.
 *
 * `npm run api:sync -- <path-or-url>` copies the document to
 * `api/openapi.json`, records where it came from in `api/SOURCE.json` (the
 * source commit and the server version) and regenerates the typed schema at
 * `src/lib/api/schema.d.ts`.
 *
 * `npm run api:check` regenerates the schema from the committed document into
 * a temporary file and exits non-zero when it differs from the committed
 * schema, so continuous integration catches a stale document or stale types.
 */
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/** Directory of this script. */
const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));

/** Repository root, one level above the scripts directory. */
const repositoryRoot = path.resolve(scriptsDirectory, '..');

/** Where the server's OpenAPI document is kept. */
const documentPath = path.join(repositoryRoot, 'api', 'openapi.json');

/** Where the provenance of the document is recorded. */
const sourcePath = path.join(repositoryRoot, 'api', 'SOURCE.json');

/** Where the generated TypeScript schema is kept. */
const schemaPath = path.join(repositoryRoot, 'src', 'lib', 'api', 'schema.d.ts');

/** Matches an absolute URL with a scheme, as opposed to a filesystem path. */
const urlPattern = /^[a-z][a-z0-9+.-]*:\/\//i;

/** Matches a commit id accepted by the `--commit` option. */
const commitPattern = /^[0-9a-f]{7,40}$/i;

/**
 * Prints how to use the script and exits with a failure status.
 *
 * @param {string} [message] Problem to print before the usage text.
 * @returns {never} Never returns.
 */
function fail(message) {
  if (message) {
    process.stderr.write(`${message}\n`);
  }
  process.stderr.write(
    'Usage: node scripts/sync-openapi.mjs <path-or-url> [--commit <sha>]\n' +
      '       node scripts/sync-openapi.mjs --check\n'
  );
  process.exit(2);
}

/**
 * Parses the command line arguments.
 *
 * @param {string[]} argv Arguments after the script name.
 * @returns {{ check: boolean, input: string | undefined, commit: string | undefined }} The options.
 */
function parseArguments(argv) {
  let check = false;
  let input;
  let commit;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--check') {
      check = true;
    } else if (argument === '--commit') {
      index += 1;
      commit = argv[index];
      if (!commit) {
        fail('The --commit option needs a commit id.');
      }
      if (!commitPattern.test(commit)) {
        fail(`"${commit}" is not a commit id.`);
      }
    } else if (argument.startsWith('-')) {
      fail(`Unknown option "${argument}".`);
    } else if (input === undefined) {
      input = argument;
    } else {
      fail(`Unexpected argument "${argument}".`);
    }
  }

  return { check, input, commit };
}

/**
 * Loads the OpenAPI document from a local file or an HTTP(S) URL.
 *
 * @param {string} input Path or URL of the document.
 * @returns {Promise<{ text: string, document: unknown, directory?: string }>} The document text and parsed contents.
 */
async function loadDocument(input) {
  if (urlPattern.test(input)) {
    const response = await fetch(input);
    if (!response.ok) {
      throw new Error(`Could not download ${input}: HTTP ${response.status}.`);
    }
    const text = await response.text();
    return { text, document: parseDocument(text, input) };
  }

  const filePath = path.resolve(process.cwd(), input);
  const text = await readFile(filePath, 'utf8');
  return { text, document: parseDocument(text, input), directory: path.dirname(filePath) };
}

/**
 * Parses the document and checks that it carries the version the client
 * records as its source.
 *
 * @param {string} text Document contents.
 * @param {string} input Path or URL the contents came from, used in errors.
 * @returns {unknown} The parsed document.
 */
function parseDocument(text, input) {
  let document;
  try {
    document = JSON.parse(text);
  } catch {
    throw new Error(`${input} is not a JSON document.`);
  }
  const version = document?.info?.version;
  if (typeof version !== 'string' || version === '') {
    throw new Error(`${input} does not declare info.version.`);
  }
  return document;
}

/**
 * Determines the commit the document was published from.
 *
 * @param {{ directory?: string }} source Where the document was loaded from.
 * @param {string | undefined} requested Commit passed with `--commit`.
 * @returns {string} The commit id.
 */
function resolveCommit(source, requested) {
  if (requested) {
    return requested;
  }
  if (source.directory === undefined) {
    throw new Error('The source commit of a downloaded document is unknown; pass --commit <sha>.');
  }

  try {
    return execFileSync('git', ['-C', source.directory, 'rev-parse', 'HEAD'], {
      encoding: 'utf8'
    }).trim();
  } catch {
    throw new Error(
      'The document is not inside a git checkout; pass --commit <sha> to record its source.'
    );
  }
}

/**
 * Runs the openapi-typescript command line for one document.
 *
 * @param {string} input Document to read.
 * @param {string} output File to write the generated schema to.
 * @returns {void}
 */
function generateSchema(input, output) {
  const require = createRequire(import.meta.url);
  const packagePath = require.resolve('openapi-typescript/package.json');
  const cliPath = path.join(path.dirname(packagePath), 'bin', 'cli.js');
  execFileSync(process.execPath, [cliPath, input, '--output', output], {
    stdio: 'inherit',
    cwd: repositoryRoot
  });
}

/**
 * Copies the document, records its source and regenerates the schema.
 *
 * @param {string} input Path or URL of the document.
 * @param {string | undefined} requestedCommit Commit passed with `--commit`.
 * @returns {Promise<void>} Resolves when the files are written.
 */
async function sync(input, requestedCommit) {
  const source = await loadDocument(input);
  const commit = resolveCommit(source, requestedCommit);
  const serverVersion = source.document.info.version;

  await mkdir(path.dirname(documentPath), { recursive: true });
  await mkdir(path.dirname(schemaPath), { recursive: true });
  await writeFile(documentPath, source.text.endsWith('\n') ? source.text : `${source.text}\n`);
  await writeFile(sourcePath, `${JSON.stringify({ commit, serverVersion }, null, 2)}\n`);
  generateSchema(documentPath, schemaPath);
  process.stdout.write(`Synced the API document from ${input} (${commit}, ${serverVersion}).\n`);
}

/**
 * Regenerates the schema into a temporary file and compares it with the
 * committed schema.
 *
 * @returns {Promise<void>} Resolves when the committed schema is current.
 */
async function check() {
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'hearthsound-web-openapi-'));
  const temporarySchema = path.join(temporaryDirectory, 'schema.d.ts');
  try {
    generateSchema(documentPath, temporarySchema);
    const [committed, generated] = await Promise.all([
      readFile(schemaPath, 'utf8'),
      readFile(temporarySchema, 'utf8')
    ]);
    if (committed !== generated) {
      process.stderr.write(
        'src/lib/api/schema.d.ts does not match api/openapi.json.\n' +
          'Run npm run api:sync -- <path-or-url> to update the document and the types.\n'
      );
      process.exitCode = 1;
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function main() {
  const { check: checkOnly, input, commit } = parseArguments(process.argv.slice(2));

  if (checkOnly) {
    if (input !== undefined || commit !== undefined) {
      fail('--check uses the committed document and takes no other arguments.');
    }
    await check();
    return;
  }

  if (input === undefined) {
    fail('Missing the path or URL of the OpenAPI document.');
  }
  await sync(input, commit);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
