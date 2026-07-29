import { cp, mkdir, rm } from 'node:fs/promises';
import { URL } from 'node:url';

await rm(new URL('../dist/data/', import.meta.url), { force: true, recursive: true });
await mkdir(new URL('../dist/data/', import.meta.url), { recursive: true });
await cp(new URL('../defaults/', import.meta.url), new URL('../dist/data/', import.meta.url), {
  recursive: true,
});
