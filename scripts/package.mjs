/**
 * Packages the built client for a release.
 *
 * Zips the contents of `build/` (the built client) at the archive root into
 * `dist/hearthsound-web-<version>.zip` and writes the archive's SHA-256 next
 * to it as `dist/hearthsound-web-<version>.zip.sha256`, so the server can pin
 * and verify the release in `web-client.lock`.
 *
 * Usage: `npm run package` (after `npm run build`).
 */

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/** Where the built client lives after `npm run build`. */
const BUILD_DIR = 'build';
/** Where the release artifacts are written. */
const DIST_DIR = 'dist';

const manifest = JSON.parse(await readFile('package.json', 'utf8'));
const version = manifest.version;
const archiveName = `hearthsound-web-${version}.zip`;
const archivePath = path.join(DIST_DIR, archiveName);
await mkdir(DIST_DIR, { recursive: true });
// The zip is written by the system `zip` so the archive carries normal
// Unix attributes and no extra directory level.
execFileSync('zip', ['-r', '-X', path.resolve(archivePath), '.'], {
  cwd: BUILD_DIR,
  stdio: 'inherit'
});

await writeFile(`${archivePath}.sha256`, `${await sha256(archivePath)}  ${archiveName}\n`);
console.log(`packaged ${archiveName}`);

/**
 * Computes the lowercase hex SHA-256 of a file.
 *
 * @param {string} file The path of the file to hash.
 * @returns {Promise<string>} The hex digest.
 */
async function sha256(file) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    createReadStream(file)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', resolve);
  });
  return hash.digest('hex');
}
