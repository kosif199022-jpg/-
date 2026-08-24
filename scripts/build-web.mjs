import { cp, mkdir, rm } from 'node:fs/promises';
const src = new URL('../apps/web/public/', import.meta.url);
const dist = new URL('../apps/web/dist/', import.meta.url);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(src, dist, { recursive: true });
console.log('ALTAREEQ_WEB_BUILD_OK');
