/* Checks dpi.js against real files, using macOS's own image tool (sips) and
   unzip as independent judges. Our own readDpi agreeing with our own setDpi
   would prove nothing; sips agreeing proves Preview and friends will too.

   Fixtures cover the header layouts seen in the wild:
     png-plain      no pHYs chunk at all
     png-72         pHYs plus an eXIf block saying 72 (what macOS writes)
     jpg-jfif       JFIF with no units + EXIF without resolution (sips)
     jpg-exif-le    EXIF resolution only, little-endian, no JFIF (phone-style)
     jpg-exif-cm    EXIF resolution in centimetres
     jpg-photoshop  EXIF + Photoshop resolution block, no JFIF

   Usage: node test/dpi.test.js     Exit 0 if every check passes. */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const DPI = require('../dpi.js');

const results = [];
const check = (name, cond, why = '') => results.push([cond ? 'PASS' : 'FAIL', name, cond ? '' : why]);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'print-red-e-'));
const sips = (file, ...keys) => {
  const out = execFileSync('sips', [...keys.flatMap(k => ['-g', k]), file], { encoding: 'utf8' });
  return Object.fromEntries(keys.map(k => [k, Number(out.match(new RegExp(`${k}: ([\\d.]+)`))[1])]));
};

// ---- build fixtures ---------------------------------------------------------

const basePng = path.join(tmp, 'base.png');
const baseJpg = path.join(tmp, 'base.jpg');
execFileSync('python3', [path.join(__dirname, 'make-fixtures.py'), basePng]);
execFileSync('sips', ['-s', 'format', 'jpeg', basePng, '--out', baseJpg], { stdio: 'ignore' });
const png72 = path.join(tmp, 'png72.png');
fs.copyFileSync(basePng, png72);
execFileSync('sips', ['-s', 'dpiWidth', '72', '-s', 'dpiHeight', '72', png72], { stdio: 'ignore' });

const jpg = fs.readFileSync(baseJpg);
const segLen = at => jpg.readUInt16BE(at + 2) + 2;
// sips writes SOI, APP0 (JFIF), APP1 (EXIF), then the rest. Slice those apart.
const afterApp0 = 2 + segLen(2);
const rest = jpg.subarray(afterApp0 + segLen(afterApp0));

// An EXIF block whose first directory holds XResolution, YResolution and
// ResolutionUnit, in either byte order.
function exifApp1(value, unit, le) {
  const t = Buffer.alloc(66);
  const u16 = (v, o) => le ? t.writeUInt16LE(v, o) : t.writeUInt16BE(v, o);
  const u32 = (v, o) => le ? t.writeUInt32LE(v, o) : t.writeUInt32BE(v, o);
  t.write(le ? 'II' : 'MM', 0); u16(42, 2); u32(8, 4); u16(3, 8);
  const entry = (i, tag, type, v) => {
    const o = 10 + i * 12;
    u16(tag, o); u16(type, o + 2); u32(1, o + 4);
    type === 3 ? u16(v, o + 8) : u32(v, o + 8);
  };
  entry(0, 0x011A, 5, 50); entry(1, 0x011B, 5, 58); entry(2, 0x0128, 3, unit);
  u32(value * 100, 50); u32(100, 54); u32(value * 100, 58); u32(100, 62);
  return Buffer.concat([Buffer.from([0xFF, 0xE1, 0, 74]), Buffer.from('Exif\0\0', 'latin1'), t]);
}

function photoshopApp13(dpi) {
  const d = Buffer.alloc(16);
  d.writeUInt16BE(dpi, 0); d.writeUInt16BE(1, 4); d.writeUInt16BE(1, 6);
  d.writeUInt16BE(dpi, 8); d.writeUInt16BE(1, 12); d.writeUInt16BE(1, 14);
  const body = Buffer.concat([Buffer.from('Photoshop 3.0\0', 'latin1'), Buffer.from('8BIM'),
    Buffer.from([0x03, 0xED, 0, 0, 0, 0, 0, 16]), d]);
  const head = Buffer.from([0xFF, 0xED, 0, 0]);
  head.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([head, body]);
}

const SOI = Buffer.from([0xFF, 0xD8]);
const fixtures = {
  'png-plain': { bytes: fs.readFileSync(basePng), before: null },
  'png-72': { bytes: fs.readFileSync(png72), before: 72 },
  'jpg-jfif': { bytes: jpg, before: null },
  'jpg-exif-le': { bytes: Buffer.concat([SOI, exifApp1(72, 2, true), rest]), before: 72 },
  'jpg-exif-cm': { bytes: Buffer.concat([SOI, exifApp1(28.35, 3, false), rest]), before: 72 },
  'jpg-photoshop': { bytes: Buffer.concat([SOI, exifApp1(72, 2, false), photoshopApp13(72), rest]), before: 72 },
};

// The picture itself: every IDAT chunk for a PNG, everything from the start-
// of-scan marker for a JPEG. These must come through byte-identical.
function imageData(b) {
  if (DPI.kind(b) === 'png') {
    const parts = [];
    for (let i = 8; i < b.length;) {
      const len = b.readUInt32BE(i);
      if (b.toString('latin1', i + 4, i + 8) === 'IDAT') parts.push(b.subarray(i, i + 12 + len));
      i += 12 + len;
    }
    return Buffer.concat(parts);
  }
  return b.subarray(b.indexOf(Buffer.from([0xFF, 0xDA])));
}

// ---- DPI --------------------------------------------------------------------

for (const [name, { bytes, before }] of Object.entries(fixtures)) {
  const input = Buffer.from(bytes);
  const out = Buffer.from(DPI.setDpi(input, 300));
  const file = path.join(tmp, `${name}.${name.slice(0, 3)}`);
  fs.writeFileSync(file, out);

  check(`${name}: readDpi before is ${before}`, DPI.readDpi(bytes) === before, `got ${DPI.readDpi(bytes)}`);
  const s = sips(file, 'dpiWidth', 'dpiHeight', 'pixelWidth', 'pixelHeight');
  check(`${name}: sips reads 300 x 300 DPI`, s.dpiWidth === 300 && s.dpiHeight === 300, JSON.stringify(s));
  check(`${name}: still 600 x 400 px`, s.pixelWidth === 600 && s.pixelHeight === 400, JSON.stringify(s));
  check(`${name}: image data byte-identical`, imageData(out).equals(imageData(bytes)) && imageData(out).length > 1000);
  check(`${name}: readDpi after is 300`, DPI.readDpi(out) === 300, `got ${DPI.readDpi(out)}`);
  check(`${name}: input left untouched`, input.equals(bytes));
  check(`${name}: running twice changes nothing`, Buffer.from(DPI.setDpi(out, 300)).equals(out));
}

const plainOut = Buffer.from(DPI.setDpi(fixtures['png-72'].bytes, 300));
check('png: exactly one pHYs chunk after replacing', plainOut.toString('latin1').split('pHYs').length === 2);
// Every PNG chunk carries a checksum; one wrong and strict readers reject
// the file. The eXIf edit has to recompute it, so check them all.
const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xEDB88320 ^ n >>> 1 : n >>> 1;
  return n >>> 0;
});
const crc = buf => { let c = ~0; for (const x of buf) c = crcTable[(c ^ x) & 255] ^ c >>> 8; return ~c >>> 0; };
const badChunks = buf => {
  const bad = [];
  for (let i = 8; i < buf.length;) {
    const len = buf.readUInt32BE(i);
    if (crc(buf.subarray(i + 4, i + 8 + len)) !== buf.readUInt32BE(i + 8 + len)) bad.push(buf.toString('latin1', i + 4, i + 8));
    i += 12 + len;
  }
  return bad;
};
check('png: every chunk checksum valid after editing eXIf', badChunks(plainOut).length === 0, badChunks(plainOut).join(','));
const exifOnly = Buffer.from(DPI.setDpi(fixtures['jpg-exif-le'].bytes, 300));
check('jpg without JFIF: one is added right after the start marker',
  exifOnly.toString('latin1', 6, 11) === 'JFIF\0' && exifOnly.length === fixtures['jpg-exif-le'].bytes.length + 18);
const ps = Buffer.from(DPI.setDpi(fixtures['jpg-photoshop'].bytes, 300));
const res = ps.indexOf(Buffer.from([0x03, 0xED])) + 8;
check('photoshop resolution block set to 300', ps.readUInt16BE(res) === 300 && ps.readUInt16BE(res + 8) === 300);

const throwsWith = (bytes, msg) => { try { DPI.setDpi(bytes, 300); return false; } catch (e) { return e.message === msg; } };
check('rejects a text file', throwsWith(Buffer.from('hello, not a photo'), 'Not a JPEG or PNG'));
check('rejects a truncated JPEG header', throwsWith(jpg.subarray(0, 30), 'Damaged JPEG header'));

// ---- zip --------------------------------------------------------------------

const a = fs.readFileSync(path.join(tmp, 'png-plain.png'));
const b = fs.readFileSync(path.join(tmp, 'jpg-jfif.jpg'));
const zipFile = path.join(tmp, 'out.zip');
const entry = (name, data) => ({ name, data, size: data.length, crc: DPI.crc32(data) });
fs.writeFileSync(zipFile, Buffer.concat(DPI.zipParts([entry('plain.png', a), entry('café photo.jpg', b)])));
let tested = '';
try { tested = execFileSync('unzip', ['-t', zipFile], { encoding: 'utf8' }); } catch (e) { tested = e.stdout || ''; }
check('zip: unzip -t finds no errors', /No errors detected/.test(tested), tested.trim());
// ditto is what Finder runs when you double-click a zip. (Apple's bundled
// unzip ignores the UTF-8 name flag and garbles accents, so it can't judge names.)
const unzipped = path.join(tmp, 'unzipped');
execFileSync('ditto', ['-x', '-k', zipFile, unzipped]);
const listed = fs.readdirSync(unzipped).map(n => n.normalize('NFC')).sort();
check('zip: names survive, including accents', listed.join('|') === 'café photo.jpg|plain.png', listed.join('|'));
check('zip: Finder extracts both files byte for byte',
  fs.readFileSync(path.join(unzipped, 'plain.png')).equals(a)
  && fs.readFileSync(path.join(unzipped, 'café photo.jpg'.normalize('NFC'))).equals(b));

// ---- print sizes ------------------------------------------------------------

const PRINTS = require('../prints.js');
const fitAt = (w, h, id, label) => PRINTS.fit(w, h, id).find(f => f.label === label);
const ratings = (w, h, id) => PRINTS.fit(w, h, id).map(f => `${f.label}:${f.rating}`).join(' ');

check('prints: iPhone 12MP (4032x3024) is sharp at 8x10 (378 PPI)',
  fitAt(4032, 3024, 'print', '8\u00d710').ppi === 378 && fitAt(4032, 3024, 'print', '8\u00d710').rating === 'sharp');
check('prints: iPhone 12MP is good, not sharp, at 16x20',
  fitAt(4032, 3024, 'print', '16\u00d720').rating === 'good');
check('prints: portrait and landscape rate the same on paper', ratings(4032, 3024, 'print') === ratings(3024, 4032, 'print'));
check('prints: Shutterfly\'s 4x6 minimum (1800x1200) is exactly sharp at 4x6',
  fitAt(1800, 1200, 'print', '4\u00d76').ppi === 300 && fitAt(1799, 1200, 'print', '4\u00d76').rating === 'good');
check('prints: cropping to fill uses the tighter side (square photo on 4x6)',
  fitAt(1200, 1200, 'print', '4\u00d76').ppi === 200);
check('prints: canvas needs fewer pixels than paper (2000x1600 at 8x10)',
  fitAt(2000, 1600, 'canvas', '8\u00d710').rating === 'sharp' && fitAt(2000, 1600, 'print', '8\u00d710').rating === 'good');
check('prints: 12MP on a 60x80 fleece blanket is too small (50 PPI)',
  fitAt(4032, 3024, 'fleece', '60\u00d780').ppi === 50 && fitAt(4032, 3024, 'fleece', '60\u00d780').rating === 'low');
check('prints: 48MP on a 60x80 fleece blanket is good (100 PPI)',
  fitAt(8064, 6048, 'fleece', '60\u00d780').rating === 'good');
check('prints: a mug only wraps sideways, so orientation matters',
  fitAt(4032, 3024, 'mug', '11 oz').ppi === 474 && fitAt(3024, 4032, 'mug', '11 oz').ppi === 355);
check('prints: a phone case stands upright, so orientation matters',
  fitAt(3024, 4032, 'phone', 'about 3\u00d76').ppi === 672 && fitAt(4032, 3024, 'phone', 'about 3\u00d76').ppi === 504);
check('prints: a mouse pad is landscape only (9.25 wide x 7.75 tall)',
  fitAt(4032, 3024, 'mousepad', '8\u00d79').ppi === 390 && fitAt(3024, 4032, 'mousepad', '8\u00d79').ppi === 326);
check('prints: the tote photo fills the whole 15x18 face (12MP is sharp at 201 PPI)',
  fitAt(4032, 3024, 'tote', '15\u00d718').ppi === 201 && fitAt(4032, 3024, 'tote', '15\u00d718').rating === 'sharp');
check('prints: metal uses paper thresholds, canvas doesn\'t (12MP at 20x30)',
  fitAt(4032, 3024, 'metal', '20\u00d730').rating === 'low' && fitAt(4032, 3024, 'canvas', '20\u00d730').rating === 'good');
check('prints: puzzles come in Shutterfly\'s three sizes',
  PRINTS.product('puzzle').sizes.map(s => s.label).join(' ') === '10\u00d714 16\u00d720 20\u00d730');
check('prints: estimated sizes are marked as estimates',
  ['phone'].every(id => PRINTS.product(id).approx)
  && ['print', 'canvas', 'metal', 'puzzle', 'mousepad', 'coaster', 'ornament', 'magnet', 'tote']
    .every(id => !PRINTS.product(id).approx));
check('prints: ornament shapes keep their orientation (bracket is landscape)',
  fitAt(4032, 3024, 'ornament', 'bracket').ppi === 1008 && fitAt(3024, 4032, 'ornament', 'bracket').ppi === 756);
check('prints: a phone-sized screenshot (1080x1920) is only good on a 4x5.5 magnet',
  fitAt(1080, 1920, 'magnet', '4\u00d75.5').rating === 'good' && fitAt(1080, 1920, 'magnet', '3\u00d75').rating === 'sharp');
check('prints: unknown product falls back to photo prints', PRINTS.product('nope').id === 'print');
const canvasAreas = PRINTS.product('canvas').sizes.map(s => s.w * s.h);
check('prints: Shutterfly\'s 13 canvas sizes, smallest first',
  canvasAreas.length === 13 && canvasAreas.every((a, i) => !i || a >= canvasAreas[i - 1]));
check('prints: every product size has a unique label',
  PRINTS.PRODUCTS.every(p => new Set(p.sizes.map(s => s.label)).size === p.sizes.length));

// ---- service worker -----------------------------------------------------------

// cache.addAll fails the whole install if one listed file is missing.
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const shell = [...sw.match(/const SHELL = \[([\s\S]*?)\]/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
const missing = shell.filter(f => f !== './' && !fs.existsSync(path.join(__dirname, '..', f)));
check('sw: every cached file exists', missing.length === 0, missing.join(', '));
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const used = [...html.matchAll(/(?:src|href)="([^"#:]+)"/g)].map(m => m[1]);
const uncached = used.filter(f => !shell.includes(f));
check('sw: every file the page loads is cached', uncached.length === 0, uncached.join(', '));

// ---- report -----------------------------------------------------------------

fs.rmSync(tmp, { recursive: true, force: true });
const failed = results.filter(r => r[0] === 'FAIL').length;
for (const [s, n, why] of results) console.log(`${s} ${n}${why ? ' -- ' + why : ''}`);
console.log(`TOTAL ${results.length} FAILED ${failed}`);
process.exit(failed ? 1 : 0);
