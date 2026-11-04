// The studio's bucket (gs://shlomiverse-studio) over its REST API, with this computer's gcloud login - no keys in the
// code, no extra packages (the same way render/drop.mjs talks to the Drop's bucket). Files stream in and out, so a
// take of a few GB never sits in memory; every download is checked against the bucket's md5 before it replaces a file.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { BUCKET } from './layout.mjs';

const O = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o`;
const U = `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o`;
let tok = null;
export const token = () => (tok && tok.until > Date.now() ? Promise.resolve(tok.v) : new Promise((ok, fail) =>
  execFile('cmd', ['/c', 'gcloud', 'auth', 'print-access-token'], { windowsHide: true }, (e, out) => {
    if (e) return fail(new Error('gcloud login needed (gcloud auth login)'));
    tok = { v: out.trim(), until: Date.now() + 5 * 60e3 }; ok(tok.v);
  })));
// (gcloud hands back the token it already has, however little life it has left - kept 40 min, it ran out under us:
// "401 Invalid Credentials" until the 40 min were over, 2026-11-04. So: asked again every 5 min, and a 401 = a fresh
// token and the request once more - unless its body is a stream already sent)
const plainFetch = globalThis.fetch;
const fetch = async (url, o = {}) => {
  const r = await plainFetch(url, o);
  if (r.status !== 401 || !o.headers?.authorization || (o.body && typeof o.body !== 'string')) return r;
  tok = null;
  return plainFetch(url, { ...o, headers: { ...o.headers, authorization: `Bearer ${await token()}` } });
};
const auth = async (h = {}) => ({ authorization: `Bearer ${await token()}`, ...h });
const enc = (name) => encodeURIComponent(name);
async function check(r, what) {
  if (r.ok) return r;
  const t = await r.text().catch(() => '');
  const e = new Error(`${what}: ${r.status} ${t.slice(0, 160)}`); e.status = r.status; throw e;
}

// every object under a prefix: {name: {size, md5, gen, updated, meta}}
export async function list(prefix) {
  const out = {};
  let page = '';
  do {
    const r = await check(await fetch(`${O}?prefix=${enc(prefix)}&maxResults=1000&fields=${enc('items(name,size,md5Hash,crc32c,generation,updated,metadata),nextPageToken')}${page ? '&pageToken=' + enc(page) : ''}`, { headers: await auth() }), 'list');
    const j = await r.json();
    for (const it of j.items || []) out[it.name] = { size: +it.size, md5: it.md5Hash, crc: it.crc32c, gen: it.generation, updated: it.updated, meta: it.metadata || {} };
    page = j.nextPageToken || '';
  } while (page);
  return out;
}
// the "folders" right under a prefix (projects/ -> the project ids)
export async function folders(prefix) {
  const out = [];
  let page = '';
  do {
    const r = await check(await fetch(`${O}?prefix=${enc(prefix)}&delimiter=/&fields=${enc('prefixes,nextPageToken')}${page ? '&pageToken=' + enc(page) : ''}`, { headers: await auth() }), 'list');
    const j = await r.json();
    out.push(...(j.prefixes || []).map((p) => p.slice(prefix.length).replace(/\/$/, '')));
    page = j.nextPageToken || '';
  } while (page);
  return out;
}

export async function getJson(name) {  // {v, gen} or null
  const r = await fetch(`${O}/${enc(name)}?alt=media`, { headers: await auth() });
  if (r.status === 404) return null;
  await check(r, 'get ' + name);
  return { v: await r.json(), gen: r.headers.get('x-goog-generation') };
}
// ifGen: '0' = only if it isn't there yet; a generation = only if nobody changed it since (a lock that can't race)
export async function putJson(name, v, ifGen) {
  const q = ifGen != null ? `&ifGenerationMatch=${ifGen}` : '';
  const r = await fetch(`${U}?uploadType=media&name=${enc(name)}${q}`, { method: 'POST', headers: await auth({ 'content-type': 'application/json' }), body: JSON.stringify(v) });
  if (r.status === 412) return null;  // (someone else got there first)
  await check(r, 'put ' + name);
  return (await r.json()).generation;
}
export async function remove(name) {
  const r = await fetch(`${O}/${enc(name)}`, { method: 'DELETE', headers: await auth() });
  if (r.status !== 404) await check(r, 'delete ' + name);
}

export const md5File = (file) => new Promise((ok, fail) => {
  const h = crypto.createHash('md5');
  fs.createReadStream(file).on('data', (d) => h.update(d)).on('end', () => ok(h.digest('base64'))).on('error', fail);
});
// CRC32C (Castagnoli) - the bucket's other fingerprint, and the only one on a big file gcloud sent in parallel parts
// (a "composite" object has no md5). Slicing-by-8, base64 of the big-endian value, as the bucket gives it
const T = (() => { const t = Array.from({ length: 8 }, () => new Uint32Array(256));
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0x82f63b78 ^ (c >>> 1) : c >>> 1; t[0][n] = c >>> 0; }
  for (let n = 0; n < 256; n++) for (let k = 1; k < 8; k++) t[k][n] = (t[k - 1][n] >>> 8) ^ t[0][t[k - 1][n] & 0xff];
  return t; })();
export const crcFile = (file) => new Promise((ok, fail) => {
  let c = 0xffffffff;
  const [t0, t1, t2, t3, t4, t5, t6, t7] = T;
  fs.createReadStream(file, { highWaterMark: 1 << 20 }).on('data', (b) => {
    let i = 0;
    const n8 = b.length - (b.length % 8);
    for (; i < n8; i += 8) {
      const a = (c ^ (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24))) >>> 0;
      c = t7[a & 0xff] ^ t6[(a >>> 8) & 0xff] ^ t5[(a >>> 16) & 0xff] ^ t4[a >>> 24] ^ t3[b[i + 4]] ^ t2[b[i + 5]] ^ t1[b[i + 6]] ^ t0[b[i + 7]];
    }
    for (; i < b.length; i++) c = t0[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  }).on('end', () => { const v = (c ^ 0xffffffff) >>> 0, o = Buffer.alloc(4); o.writeUInt32BE(v); ok(o.toString('base64')); }).on('error', fail);
});
// is this local file the object r ({md5, crc, size})? md5 when the bucket has one, else CRC32C
export const same = async (file, r) => !!r && fs.statSync(file).size === r.size && (r.md5 ? (await md5File(file)) === r.md5 : (await crcFile(file)) === r.crc);

// a file up (streamed - a resumable session, so any size goes in one PUT); its md5 is checked by the bucket
export async function upload(file, name, md5) {
  const size = fs.statSync(file).size;
  const meta = { name, md5Hash: md5 || await md5File(file), metadata: { mtime: String(Math.round(fs.statSync(file).mtimeMs)) } };
  const s = await check(await fetch(`${U}?uploadType=resumable`, { method: 'POST', headers: await auth({ 'content-type': 'application/json', 'x-upload-content-length': String(size) }), body: JSON.stringify(meta) }), 'start upload');
  const at = s.headers.get('location');
  const body = size ? Readable.toWeb(fs.createReadStream(file)) : '';
  const r = await fetch(at, { method: 'PUT', headers: { 'content-length': String(size) }, body, duplex: 'half' });
  await check(r, 'upload ' + name);
  return r.json();
}
// a file down: into a .part next to it, checked against the md5, then put in place (the old one goes only then)
export async function download(name, file, r) {  // r: the object as list() gives it (its fingerprint)
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const part = file + '.cloud-part';
  const res = await check(await fetch(`${O}/${enc(name)}?alt=media`, { headers: await auth() }), 'download ' + name);
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(part));
  if (r && !(await same(part, r))) { fs.rmSync(part, { force: true }); throw new Error('download damaged: ' + name); }
  fs.renameSync(part, file);
}
