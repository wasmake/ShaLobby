import { execFile } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { promisify } from 'node:util';

const executeFile = promisify(execFile);
const project = fileURLToPath(new URL('../', import.meta.url));
const configuration = JSON.parse(
  await readFile(new URL('../shamoo.config.json', import.meta.url), 'utf8'),
);
if (typeof configuration.name !== 'string' || !/^[a-z0-9_-]+$/u.test(configuration.name)) {
  throw new TypeError('shamoo.config.json.name must be a lowercase artifact name.');
}

const artifactName = configuration.name.toLowerCase();
if (configuration.outDir !== artifactName) {
  throw new TypeError('shamoo.config.json.outDir must match the lowercase plugin name.');
}

const artifact = join(project, artifactName);
const archive = join(project, `${artifactName}.tar.gz`);
const macOsMetadata = /^(?:\.DS_Store|\._.*|__MACOSX)$/u;

async function removeMacOsMetadata(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (macOsMetadata.test(entry.name)) await rm(path, { force: true, recursive: true });
    else if (entry.isDirectory()) await removeMacOsMetadata(path);
  }
}

async function normalizeTimestamps(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await normalizeTimestamps(path);
    await utimes(path, 0, 0);
  }
  await utimes(directory, 0, 0);
}

await rm(join(project, 'dist'), { force: true, recursive: true });
await rm(join(artifact, 'data'), { force: true, recursive: true });
await mkdir(join(artifact, 'data'), { recursive: true });
await cp(join(project, 'defaults'), join(artifact, 'data'), { recursive: true });
await removeMacOsMetadata(artifact);
await normalizeTimestamps(artifact);
await rm(archive, { force: true });
await executeFile('tar', ['-czf', archive, artifactName], { cwd: project });
