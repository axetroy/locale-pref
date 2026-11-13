// Guards the "zero runtime dependencies" constraint from DESIGN.md §1.3.
// Runs in CI after install so a dependency cannot slip into the published
// package unnoticed.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const packageJsonUrl = new URL('../package.json', import.meta.url);
const pkg = JSON.parse(await readFile(fileURLToPath(packageJsonUrl), 'utf8'));

const forbiddenFields = ['dependencies', 'peerDependencies', 'optionalDependencies'];
const offenders = [];

for (const field of forbiddenFields) {
  const value = pkg[field];
  const keys = value && typeof value === 'object' ? Object.keys(value) : [];
  if (keys.length > 0) offenders.push(`${field}: ${keys.join(', ')}`);
}

if (offenders.length > 0) {
  console.error('locale-pref must not declare runtime dependencies, found:');
  for (const offender of offenders) console.error(`  - ${offender}`);
  process.exit(1);
}

console.log('No runtime dependencies declared.');
