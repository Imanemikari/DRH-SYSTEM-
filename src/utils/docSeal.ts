// Document authenticity seal: signed QR code printed at the bottom-right of every
// printed / exported document. Payload = document fingerprint (SHA-256) + HMAC-SHA256
// signature, so a forged copy cannot produce a matching QR.
import qrcode from 'qrcode-generator';

const SEAL_SECRET = 'DRH-2026-DOC-SEAL-v1';

const K256 = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function sha256Bytes(msg: number[]): number[] {
  const R = (v: number, n: number) => (v >>> n) | (v << (32 - n));
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const bytes = msg.slice();
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0x00);
  const hi = Math.floor(bitLen / 4294967296), lo = bitLen >>> 0;
  bytes.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255,
    (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
  const w: number[] = new Array(64);
  for (let j = 0; j < bytes.length; j += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = ((bytes[j + i * 4] << 24) | (bytes[j + i * 4 + 1] << 16) | (bytes[j + i * 4 + 2] << 8) | bytes[j + i * 4 + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = (R(w[i - 15], 7) ^ R(w[i - 15], 18) ^ (w[i - 15] >>> 3)) >>> 0;
      const s1 = (R(w[i - 2], 17) ^ R(w[i - 2], 19) ^ (w[i - 2] >>> 10)) >>> 0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = (R(e, 6) ^ R(e, 11) ^ R(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const t1 = (h + S1 + ch + K256[i] + w[i]) >>> 0;
      const S0 = (R(a, 2) ^ R(a, 13) ^ R(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }
  const out: number[] = [];
  [h0, h1, h2, h3, h4, h5, h6, h7].forEach((x) => {
    out.push((x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255);
  });
  return out;
}

const utf8 = (s: string): number[] => Array.from(new TextEncoder().encode(s));
const toHex = (b: number[]): string => b.map((x) => x.toString(16).padStart(2, '0')).join('');

export function sha256HexStr(s: string): string {
  return toHex(sha256Bytes(utf8(s)));
}

function hmacSha256Hex(keyStr: string, msgStr: string): string {
  let kb = utf8(keyStr);
  if (kb.length > 64) kb = sha256Bytes(kb);
  while (kb.length < 64) kb.push(0);
  const mb = utf8(msgStr);
  const inner = sha256Bytes(kb.map((b) => b ^ 0x36).concat(mb));
  return toHex(sha256Bytes(kb.map((b) => b ^ 0x5c).concat(inner)));
}

function b64urlFromHex(hex: string): string {
  const pairs = hex.match(/../g) || [];
  let bin = '';
  for (const p of pairs) bin += String.fromCharCode(parseInt(p, 16));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface SealInput {
  title: string;
  rows: string[][];
  dateISO?: string;
}

export interface DocSeal {
  qr: string;
  code: string;
  payload: string;
}

export function makeSeal(input: SealInput): DocSeal {
  const dateISO = input.dateISO || new Date().toISOString().slice(0, 10);
  const rows = (input.rows || []).slice(0, 500).map((r) =>
    (r || []).slice(0, 16).map((c) => String(c ?? '').slice(0, 120))
  );
  const canon = [input.title, dateISO, String(rows.length), JSON.stringify(rows)].join('|');
  const h = sha256HexStr(canon);
  const sig = hmacSha256Hex(SEAL_SECRET, h + '|' + input.title + '|' + dateISO);
  const core = { v: 1, t: input.title.slice(0, 48), d: dateISO, n: rows.length, h: h.slice(0, 32), s: sig.slice(0, 32) };
  const payload = 'DRH1.' + b64urlFromHex(toHex(utf8(JSON.stringify(core))));
  const qrObj = qrcode(0, 'M');
  qrObj.addData(payload);
  qrObj.make();
  const qr = qrObj.createDataURL(4, 6);
  const code = 'DRH-' + h.slice(0, 4).toUpperCase() + '-' + h.slice(4, 8).toUpperCase() + '-' + sig.slice(0, 4).toUpperCase();
  return { qr, code, payload };
}

// Bottom-right seal block for printed pages (text-align:right => right side in any dir).
export function sealFooterHtml(seal: DocSeal, label?: string): string {
  const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<div style="margin-top:16px;text-align:right">`
    + `<div style="display:inline-block;text-align:center;border:1px solid #999;padding:6px 8px;background:#ffffff">`
    + `<img src="${seal.qr}" style="width:92px;height:92px;display:block;margin:0 auto" />`
    + `<div style="font-size:8px;font-family:monospace;color:#111111;margin-top:4px;letter-spacing:1px">${esc(seal.code)}</div>`
    + `<div style="font-size:8px;color:#555555;margin-top:2px">${esc(label || 'Cachet electronique - DRH System')}</div>`
    + `</div></div>`;
}
