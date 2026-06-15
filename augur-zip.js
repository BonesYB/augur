/* Augur .augur (zip) read/write — dependency-free.
   Reads STORED + DEFLATE entries (DEFLATE via the platform DecompressionStream).
   Writes STORED entries (no compression dependency; markdown is small).
   Works in Node 18+ and the browser. */

const _CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
  return t;
})();
function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = _CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

async function inflateRaw(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(bytes); writer.close();
  const reader = ds.readable.getReader();
  const chunks = []; let total = 0;
  for (;;) { const { value, done } = await reader.read(); if (done) break; chunks.push(value); total += value.length; }
  const out = new Uint8Array(total); let o = 0;
  for (const ch of chunks) { out.set(ch, o); o += ch.length; }
  return out;
}

// ab: ArrayBuffer → [{ name, bytes:Uint8Array }]
async function unzip(ab) {
  const dv = new DataView(ab), u8 = new Uint8Array(ab);
  let eocd = -1;
  for (let i = ab.byteLength - 22; i >= 0; i--) { if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error('Not a .augur/zip (no end-of-central-directory record)');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = [];
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Corrupt central directory');
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const fnLen = dv.getUint16(p + 28, true);
    const exLen = dv.getUint16(p + 30, true);
    const cmLen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + fnLen));
    const lfnLen = dv.getUint16(lho + 26, true);
    const lexLen = dv.getUint16(lho + 28, true);
    const start = lho + 30 + lfnLen + lexLen;
    const comp = u8.subarray(start, start + compSize);
    let bytes;
    if (method === 0) bytes = comp.slice();
    else if (method === 8) bytes = await inflateRaw(comp);
    else throw new Error('Unsupported zip compression method ' + method);
    if (!name.endsWith('/')) out.push({ name, bytes });   // skip directory entries
    p += 46 + fnLen + exLen + cmLen;
  }
  return out;
}

// files: [{ name, data:string|Uint8Array }] → Blob (a valid zip / .augur)
async function zip(files) {
  const enc = new TextEncoder();
  const parts = [], centrals = [];
  let offset = 0;
  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const lh = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);                       // method 0 = STORED
    lv.setUint16(10, 0, true); lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true); lv.setUint16(28, 0, true);
    lh.set(nameBytes, 30);
    parts.push(lh, data);

    const ch = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true); cv.setUint16(10, 0, true); cv.setUint16(12, 0, true); cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true); cv.setUint16(32, 0, true); cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true); cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    ch.set(nameBytes, 46);
    centrals.push(ch);
    offset += lh.length + data.length;
  }
  let cdSize = 0; for (const c of centrals) cdSize += c.length;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true);
  return new Blob([...parts, ...centrals, eocd], { type: 'application/zip' });
}

if (typeof module !== 'undefined' && module.exports) module.exports = { unzip, zip, crc32 };
