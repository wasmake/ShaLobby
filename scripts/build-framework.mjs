import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { exit, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspace = resolve(projectRoot, '../shamoo/ShamooTS');
const stampPath = resolve(projectRoot, 'node_modules/.cache/shalobby-framework');
const requiredOutputs = [
  'packages/cli/dist/shamooc.js',
  'packages/config/dist/index.d.ts',
  'packages/paper-raw/dist/index.d.ts',
];

function git(...arguments_) {
  return execFileSync('git', arguments_, { cwd: workspace, encoding: 'buffer' });
}

function paths(output) {
  return output
    .toString('utf8')
    .split('\0')
    .filter((path) => path.length > 0);
}

function fingerprint() {
  const hash = createHash('sha256');
  hash.update(git('rev-parse', 'HEAD'));
  const changed = new Set([
    ...paths(git('diff', '--name-only', '-z', 'HEAD')),
    ...paths(git('ls-files', '--others', '--exclude-standard', '-z')),
  ]);
  for (const path of [...changed].sort()) {
    const file = resolve(workspace, path);
    hash.update(path);
    if (!existsSync(file)) {
      hash.update('deleted');
      continue;
    }
    const metadata = statSync(file);
    hash.update(`${metadata.size}:${metadata.mtimeMs}`);
  }
  return hash.digest('hex');
}

if (!existsSync(workspace)) {
  throw new Error(`Linked ShamooTS workspace does not exist: ${workspace}`);
}

const before = fingerprint();
const cached = existsSync(stampPath) ? readFileSync(stampPath, 'utf8').trim() : undefined;
if (cached === before && requiredOutputs.every((path) => existsSync(resolve(workspace, path)))) {
  stdout.write('Linked ShamooTS build is current.\n');
  exit(0);
}

const build = spawnSync(
  'pnpm',
  [
    '--dir',
    workspace,
    '--filter',
    '@shamoo/cli...',
    '--filter',
    '@shamoo/config',
    '--filter',
    '@shamoo/paper-raw',
    'build',
  ],
  { stdio: 'inherit' },
);
if (build.error !== undefined) throw build.error;
if (build.status !== 0) exit(build.status ?? 1);

mkdirSync(dirname(stampPath), { recursive: true });
writeFileSync(stampPath, `${fingerprint()}\n`, 'utf8');
