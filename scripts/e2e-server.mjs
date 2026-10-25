/**
 * Starts a real Hearthsound server for the end-to-end suite.
 *
 * The suite drives the built client against a server process rather than a
 * mock, so this module is Playwright's global setup and teardown: it creates a
 * temporary data directory, generates the audio the suite plays with ffmpeg,
 * installs the fixture plugins that ship with the core checkout, starts the
 * local service the scrobble fixture posts to, starts `hearthsound serve` over
 * the temporary configuration, and records the addresses and paths the specs
 * need in `tests/e2e/.state.json`. Teardown stops the process, closes the
 * service and removes the directory.
 *
 * The scrobble fixture's server configuration is built here as well: its
 * endpoint is the local service, and its discovery tables name the album
 * catalog fixture's artist and songs, so the specs that read Home and the
 * generated playlists assert on the same names.
 *
 * The core checkout is taken from `HEARTHSOUND_SRC` (default `../hearthsound`),
 * which must hold `target/debug/hearthsound` and the archives `cargo xtask
 * fixtures` builds under `target/fixtures/plugins`. Nothing here reaches the
 * network: the server runs behind a proxy that points at a closed port, so the
 * official plugin index fails fast and the specs assert only on the fixtures.
 */
import { execFileSync, spawn } from 'node:child_process';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/** Repository root, one level above the scripts directory. */
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Where the spec files read the addresses and paths from. */
const statePath = path.join(repositoryRoot, 'tests', 'e2e', '.state.json');

/** The proxy every outbound request of the server is sent to, which is closed. */
const CLOSED_PROXY = 'http://127.0.0.1:9';

/** The fixture plugins the suite installs before the server starts. */
const FIXTURE_IDS = [
  'com.example.hello-catalog',
  'com.example.metadata-fixture',
  'com.example.album-catalog',
  'com.example.acquisition-fixture',
  'com.example.scrobble-fixture',
  'com.example.discography-catalog'
];

/** The artist the album catalog fixture credits, which the discovery tables name. */
const CATALOG_ARTIST = 'Fixture Artist';

/** The songs the album catalog fixture answers with. */
const CATALOG_SONGS = [
  'Fixture Song 1',
  'Fixture Song 2',
  'Fixture Song 3',
  'Fixture Song 4',
  'Fixture Song 5'
];

/** The generated playlist the scrobble fixture reports. */
const GENERATED_PLAYLIST = { reference: 'fixture-weekly', name: 'Fixture Weekly' };

/** The tracks scanned from the music folder, with the sine they are built from. */
const TRACKS = [
  { title: 'Test Song 1', track: 1, frequency: 440 },
  { title: 'Test Song 2', track: 2, frequency: 550 },
  { title: 'Test Song 3', track: 3, frequency: 660 }
];

/** The audio file the simulated download serves, named as its candidate names it. */
const DOWNLOAD_FILE = '01 - Hello Song.flac';

/** How long the download's audio lasts, which the catalog track also claims. */
const DOWNLOAD_SECONDS = 180;

/** The running server process, once it started. */
let server = null;

/** The local service the scrobble fixture posts to, once it started. */
let sink = null;

/** The temporary directory the server and the suite share. */
let directory = null;

/** Everything the process printed, so a startup failure can report it. */
let output = '';

/**
 * Returns the core checkout the server binary and its fixtures are read from.
 *
 * @returns The absolute path of the checkout.
 */
function sourceDirectory() {
  const configured = process.env.HEARTHSOUND_SRC ?? '../hearthsound';
  return path.resolve(process.cwd(), configured);
}

/**
 * Returns the path of the server binary.
 *
 * @param source The core checkout.
 * @returns The binary's path.
 */
function binaryPath(source) {
  return path.join(source, 'target', 'debug', 'hearthsound');
}

/**
 * Installs one fixture plugin into the temporary server's database.
 *
 * @param binary The server binary, whose `plugins install` command installs it.
 * @param configPath The configuration file naming the temporary database.
 * @param archive The archive to install.
 * @returns Nothing.
 */
function installFixture(binary, configPath, archive) {
  execFileSync(binary, ['plugins', 'install', archive, '--config', configPath], {
    stdio: 'pipe'
  });
}

/**
 * Copies every fixture plugin the suite needs into the temporary database.
 *
 * @param source The core checkout holding the archives.
 * @param binary The server binary.
 * @param configPath The configuration file naming the temporary database.
 * @returns Nothing.
 * @throws Error when the checkout holds no archive for a fixture.
 */
async function installFixtures(source, binary, configPath) {
  const fixtures = path.join(source, 'target', 'fixtures', 'plugins');
  let entries;
  try {
    entries = await readdir(fixtures);
  } catch {
    throw new Error(
      `${fixtures} holds no fixture plugins; run "cargo xtask fixtures" in the core checkout.`
    );
  }
  const archives = entries.filter((name) => name.endsWith('.hsplugin'));
  for (const id of FIXTURE_IDS) {
    const archive = archives.find((name) => name.startsWith(`${id}-`));
    if (archive === undefined) {
      throw new Error(`${fixtures} holds no archive for ${id}; run "cargo xtask fixtures".`);
    }
    installFixture(binary, configPath, path.join(fixtures, archive));
  }
}

/**
 * Generates one tagged FLAC file.
 *
 * @param file The file to write.
 * @param frequency The sine's frequency in hertz.
 * @param seconds How long the file lasts.
 * @param tags The tags the file carries, as `-metadata` key and value pairs.
 * @returns Nothing.
 */
function generateFlac(file, frequency, seconds, tags) {
  const metadata = Object.entries(tags).flatMap(([key, value]) => ['-metadata', `${key}=${value}`]);
  execFileSync(
    'ffmpeg',
    [
      '-loglevel',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=${frequency}:duration=${seconds}`,
      ...metadata,
      '-c:a',
      'flac',
      file
    ],
    { stdio: 'pipe' }
  );
}

/**
 * Builds the configuration the server runs with.
 *
 * The paths all live under the temporary directory, the server serves this
 * repository's build, and the acquisition polling settings are pinned to the
 * short intervals the fixture backend answers within, so a simulated
 * acquisition takes a second instead of a minute.
 *
 * @param data The data directory, which the library folders must stay outside
 *   of: the server refuses a folder inside its own data directory.
 * @param port The port the server listens on.
 * @returns The configuration file's text.
 */
function configuration(data, port) {
  const storage = path.join(data, 'storage');
  return [
    '[server]',
    'bind = "127.0.0.1"',
    `port = ${port}`,
    '',
    '[paths]',
    `data = ${JSON.stringify(data)}`,
    `storage = ${JSON.stringify(storage)}`,
    '',
    '[database]',
    `path = ${JSON.stringify(path.join(data, 'hearthsound.db'))}`,
    '',
    '[web]',
    `root = ${JSON.stringify(path.join(repositoryRoot, 'build'))}`,
    '',
    '[settings]',
    '"acquisition.poll_interval_ms.interactive" = 50',
    '"acquisition.poll_interval_ms.background" = 50',
    '"acquisition.search_poll_interval_ms" = 50',
    '"acquisition.completion_check_interval_ms" = 50',
    ''
  ].join('\n');
}

/**
 * Finds a free TCP port on the loopback interface.
 *
 * @returns The port.
 */
async function freePort() {
  const probe = createServer();
  probe.unref();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const address = probe.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

/**
 * Starts the local service the scrobble fixture posts its reports to.
 *
 * The fixture only reads the service's answer, so every request is accepted
 * with an empty success body. The service listens on the loopback interface on
 * a free port, and its origin is what the fixture's `endpoint` names.
 *
 * @returns The service's origin.
 */
async function startSink() {
  const port = await freePort();
  const service = createHttpServer((request, response) => {
    request.resume();
    request.on('end', () => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('{}');
    });
  });
  await new Promise((resolve, reject) => {
    service.once('error', reject);
    service.listen(port, '127.0.0.1', resolve);
  });
  sink = service;
  return `http://127.0.0.1:${port}`;
}

/**
 * Builds the scrobble fixture's server configuration.
 *
 * The discovery tables name the album catalog fixture's artist, album and
 * songs, so a recommendation, a generated playlist and the Because You Listen
 * to shelf all resolve through the catalog the suite already installs.
 *
 * @param endpoint The local service's origin.
 * @returns The configuration the spec creates the instance with.
 */
function scrobbleConfiguration(endpoint) {
  const track = (title) => ({ title, artists: [CATALOG_ARTIST] });
  return {
    endpoint,
    linkMethod: 'config',
    similarTracks: CATALOG_SONGS.map(track),
    similarArtists: [{ name: CATALOG_ARTIST }],
    topTracks: CATALOG_SONGS.map(track),
    recommended: CATALOG_SONGS.map(track),
    playlists: [
      {
        reference: GENERATED_PLAYLIST.reference,
        name: GENERATED_PLAYLIST.name,
        tracks: CATALOG_SONGS.slice(0, 3).map(track)
      }
    ]
  };
}

/**
 * Waits for the server to print its one-time setup URL.
 *
 * @param deadline How long to wait, in milliseconds.
 * @returns The URL the setup link carries.
 * @throws Error when the process ends or the URL does not appear in time.
 */
async function waitForSetupUrl(deadline = 30_000) {
  const pattern = /(http\S+\/setup\?token=[a-z2-7]+)/;
  const start = Date.now();
  for (;;) {
    const match = pattern.exec(output);
    if (match !== null) {
      return match[1];
    }
    if (server === null || server.exitCode !== null) {
      throw new Error(`the server stopped before it printed a setup link:\n${output}`);
    }
    if (Date.now() - start > deadline) {
      throw new Error(`the server printed no setup link within ${deadline} ms:\n${output}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/**
 * Waits until the server reports itself ready.
 *
 * @param baseUrl The server's origin.
 * @param deadline How long to wait, in milliseconds.
 * @returns Nothing.
 * @throws Error when the probe keeps failing until the deadline.
 */
async function waitForReady(baseUrl, deadline = 30_000) {
  const start = Date.now();
  for (;;) {
    try {
      const response = await fetch(`${baseUrl}/readyz`);
      if (response.ok) {
        return;
      }
    } catch {
      // The listener is not accepting connections yet.
    }
    if (server !== null && server.exitCode !== null) {
      throw new Error(`the server stopped before it became ready:\n${output}`);
    }
    if (Date.now() - start > deadline) {
      throw new Error(`the server did not become ready within ${deadline} ms:\n${output}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/**
 * Prepares the temporary server and starts it.
 *
 * @returns Nothing.
 * @throws Error when the core checkout or ffmpeg is missing, or the server does
 *   not start.
 */
export async function setup() {
  const source = sourceDirectory();
  const binary = binaryPath(source);
  const port = await freePort();
  directory = await mkdtemp(path.join(tmpdir(), 'hearthsound-e2e-'));

  const dataDir = path.join(directory, 'data');
  const musicDir = path.join(directory, 'music', 'Test Artist', 'Test Album');
  const downloadsDir = path.join(directory, 'downloads');
  const uploadDir = path.join(directory, 'upload');
  await mkdir(dataDir, { recursive: true });
  await mkdir(musicDir, { recursive: true });
  await mkdir(downloadsDir, { recursive: true });
  await mkdir(uploadDir, { recursive: true });

  for (const track of TRACKS) {
    generateFlac(
      path.join(musicDir, `${String(track.track).padStart(2, '0')} - ${track.title}.flac`),
      track.frequency,
      6,
      {
        title: track.title,
        artist: 'Test Artist',
        album: 'Test Album',
        track: track.track
      }
    );
  }
  generateFlac(path.join(downloadsDir, DOWNLOAD_FILE), 440, DOWNLOAD_SECONDS, {
    title: "Someone Else's Song",
    artist: 'Someone Else',
    album: 'Another Album'
  });
  generateFlac(path.join(uploadDir, 'Uploaded Song.flac'), 330, 6, {
    title: 'Uploaded Song',
    artist: 'Upload Artist',
    album: 'Upload Album',
    track: 1
  });

  const configPath = path.join(directory, 'hearthsound.toml');
  await writeFile(configPath, configuration(dataDir, port));
  await installFixtures(source, binary, configPath);

  const sinkUrl = await startSink();

  const baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(binary, ['serve', '--config', configPath], {
    env: { ...process.env, HTTPS_PROXY: CLOSED_PROXY, HTTP_PROXY: CLOSED_PROXY },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  server.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });
  server.on('exit', (code) => {
    output += `\nthe server exited with ${code}\n`;
  });

  const setupUrl = await waitForSetupUrl();
  await waitForReady(baseUrl);

  const state = {
    baseUrl,
    setupUrl,
    tmpDir: directory,
    musicDir,
    downloadsDir,
    sinkUrl,
    scrobbleConfig: scrobbleConfiguration(sinkUrl)
  };
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
  process.stdout.write(`e2e server listening on ${baseUrl} over ${directory}\n`);
}

/**
 * Stops the server and removes everything the run created.
 *
 * @returns Nothing.
 */
export async function teardown() {
  const running = server;
  server = null;
  if (running !== null && running.exitCode === null) {
    running.kill('SIGTERM');
    await Promise.race([
      new Promise((resolve) => running.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 10_000))
    ]);
    if (running.exitCode === null) {
      running.kill('SIGKILL');
    }
  }
  const serving = sink;
  sink = null;
  if (serving !== null) {
    await new Promise((resolve) => serving.close(resolve));
  }
  if (directory !== null) {
    await rm(directory, { recursive: true, force: true });
    directory = null;
  }
  await rm(statePath, { force: true });
}

export default setup;
