/**
 * Prints the CHANGELOG section of one version as release notes.
 *
 * Reads `CHANGELOG.md`, finds the `## [<version>]` heading (with or without
 * its date suffix) and prints the text up to the next version heading, so a
 * release can carry its own notes without a second document.
 *
 * Usage: `node scripts/release-notes.mjs <version>`.
 *
 * @param {string} version The version whose section is printed, for example
 *   `0.1.0`.
 */

import { readFile } from 'node:fs/promises';

const version = process.argv[2];
if (!version) {
  console.error('usage: node scripts/release-notes.mjs <version>');
  process.exit(1);
}

const changelog = await readFile('CHANGELOG.md', 'utf8');
const lines = changelog.split('\n');
const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
if (start === -1) {
  console.error(`CHANGELOG.md has no section for ${version}`);
  process.exit(1);
}
const end = lines.findIndex((line, index) => index > start && line.startsWith('## ['));
const notes = lines.slice(start + 1, end === -1 ? undefined : end).join('\n');
console.log(notes.trim());
