import fs from 'node:fs';import path from 'node:path';import zlib from 'node:zlib';
export function loadRegistry(root){const b64=fs.readFileSync(path.join(root,'contracts','capabilities.json.gz.b64'),'utf8').replace(/\s/g,'');const raw=zlib.gunzipSync(Buffer.from(b64,'base64')).toString('utf8');return JSON.parse(raw)}
