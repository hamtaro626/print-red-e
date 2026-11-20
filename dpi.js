/* Lossless DPI rewriting for JPEG and PNG, plus a minimal zip writer.

   DPI is a label stored in the file's header, not a property of the pixels.
   So this never decodes or re-encodes an image: it edits the few header bytes
   that say "N dots per inch" and copies everything else through untouched.
   The photo comes out bit-for-bit the same picture, just labelled 300.

   A JPEG can carry its DPI in up to three places, and different apps trust
   different ones, so all three are set when present:
     - JFIF (APP0)       read by most browsers and older software
     - EXIF (APP1)       read by Preview, Lightroom, most phones
     - Photoshop (APP13) read by Photoshop, which prefers it over the others
   A PNG has the pHYs chunk, and sometimes its own EXIF block (eXIf), which
   macOS writes into screenshots and trusts over pHYs. Both are set.

   Plain script (no modules) so index.html can load it with a <script> tag and
   the Node tests can load the same file. */

const DPI = (() => {
  const ascii = (b, at, n) => String.fromCharCode(...b.subarray(at, at + n));

  function kind(b) {
    if (b[0] === 0xFF && b[1] === 0xD8) return 'jpeg';
    if (ascii(b, 1, 3) === 'PNG' && b[0] === 0x89) return 'png';
    return null;
  }

  /* Returns new bytes with the DPI set. Throws on anything that isn't a JPEG
     or PNG, or is too damaged to walk safely. */
  function setDpi(bytes, dpi) {
    const b = new Uint8Array(bytes).slice();             // edit a copy, never the original
    const k = kind(b);
    if (k === 'jpeg') return setJpeg(b, dpi);
    if (k === 'png') return setPng(b, dpi);
    throw new Error('Not a JPEG or PNG');
  }

  /* The DPI most apps would report, or null if the file doesn't say. For a
     JPEG, EXIF wins over JFIF because that's what Preview and Lightroom do. */
  function readDpi(bytes) {
    const b = new Uint8Array(bytes);
    const k = kind(b);
    if (k === 'png') {
      let phys = null, exif = null;
      walkPng(b, (type, at, len) => {
        if (type === 'pHYs' && b[at + 8] === 1) phys = Math.round(be32(b, at) * 0.0254);
        if (type === 'eXIf') exif = exifTags(b, at, at + len).dpi;
      });
      return exif ?? phys;
    }
    if (k !== 'jpeg') return null;
    let jfif = null, exif = null;
    walkJpeg(b, (marker, at, len) => {
      if (marker === 0xE0 && ascii(b, at, 5) === 'JFIF\0' && b[at + 7] === 1) jfif = be16(b, at + 8);
      if (marker === 0xE1 && ascii(b, at, 6) === 'Exif\0\0') exif = exifTags(b, at + 6, at + len).dpi;
    });
    return exif ?? jfif;
  }

  // ---- JPEG ---------------------------------------------------------------

  /* Calls fn(marker, dataStart, dataLength) for each header segment, stopping
     at the start of the image data. Nothing after that is ever touched. */
  function walkJpeg(b, fn) {
    let i = 2;
    while (i + 4 <= b.length) {
      if (b[i] !== 0xFF) throw new Error('Damaged JPEG header');
      const marker = b[i + 1];
      if (marker === 0xFF) { i++; continue; }            // padding byte
      if (marker === 0xDA || marker === 0xD9) return;    // image data starts
      if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) { i += 2; continue; }
      const len = be16(b, i + 2);
      if (len < 2 || i + 2 + len > b.length) throw new Error('Damaged JPEG header');
      fn(marker, i + 4, len - 2);
      i += 2 + len;
    }
  }

  function setJpeg(b, dpi) {
    let hasJfif = false;
    walkJpeg(b, (marker, at, len) => {
      if (marker === 0xE0 && ascii(b, at, 5) === 'JFIF\0' && len >= 12) {
        b[at + 7] = 1;                                   // units: dots per inch
        put16(b, at + 8, dpi);
        put16(b, at + 10, dpi);
        hasJfif = true;
      } else if (marker === 0xE1 && ascii(b, at, 6) === 'Exif\0\0') {
        exifTags(b, at + 6, at + len, dpi);
      } else if (marker === 0xED && ascii(b, at, 14) === 'Photoshop 3.0\0') {
        setPhotoshop(b, at + 14, at + len, dpi);
      }
    });
    if (hasJfif) return b;

    // Many phone JPEGs have EXIF but no JFIF block. Add one right after the
    // start marker, which is where the JFIF spec says it lives.
    const app0 = new Uint8Array([
      0xFF, 0xE0, 0, 16, 0x4A, 0x46, 0x49, 0x46, 0, 1, 1, 1,
      dpi >> 8, dpi & 255, dpi >> 8, dpi & 255, 0, 0,
    ]);
    const out = new Uint8Array(b.length + app0.length);
    out.set(b.subarray(0, 2));
    out.set(app0, 2);
    out.set(b.subarray(2), 2 + app0.length);
    return out;
  }

  /* EXIF is a small TIFF file inside the JPEG. Its first directory (IFD0)
     holds XResolution, YResolution and ResolutionUnit. With dpi given, those
     are overwritten in place; either way the current value is returned.
     A file whose EXIF has no resolution tags is left alone -- adding tags
     means rebuilding the directory, and apps then fall back to JFIF anyway. */
  function exifTags(b, tiff, end, dpi) {
    const le = b[tiff] === 0x49;                         // "II" little-endian, "MM" big
    const r16 = o => le ? b[o] | b[o + 1] << 8 : be16(b, o);
    const r32 = o => le ? (b[o] | b[o + 1] << 8 | b[o + 2] << 16 | b[o + 3] << 24) >>> 0 : be32(b, o);
    const w16 = (o, v) => { if (le) { b[o] = v & 255; b[o + 1] = v >> 8; } else put16(b, o, v); };
    const w32 = (o, v) => { for (let k = 0; k < 4; k++) b[o + (le ? k : 3 - k)] = (v >>> (8 * k)) & 255; };

    let x = null, unit = 2;
    if (tiff + 8 > end) return { dpi: null };
    const ifd = tiff + r32(tiff + 4);
    if (ifd + 2 > end) return { dpi: null };
    const count = r16(ifd);
    for (let k = 0; k < count; k++) {
      const e = ifd + 2 + k * 12;
      if (e + 12 > end) break;
      const tag = r16(e), type = r16(e + 2);
      if ((tag === 0x011A || tag === 0x011B) && type === 5) {   // RATIONAL
        const at = tiff + r32(e + 8);
        if (at + 8 > end) continue;
        if (dpi) { w32(at, dpi); w32(at + 4, 1); }
        if (tag === 0x011A && r32(at + 4)) x = r32(at) / r32(at + 4);
      } else if (tag === 0x0128 && type === 3) {                 // SHORT
        if (dpi) w16(e + 8, 2);                                  // 2 = inches
        unit = r16(e + 8);
      }
    }
    if (x === null) return { dpi: null };
    return { dpi: Math.round(unit === 3 ? x * 2.54 : x) };       // 3 = centimetres
  }

  /* Photoshop's own block is a list of "8BIM" resources; 0x03ED is its
     resolution record, stored as 16.16 fixed-point pixels per inch. */
  function setPhotoshop(b, i, end, dpi) {
    while (i + 12 <= end && ascii(b, i, 4) === '8BIM') {
      const id = be16(b, i + 4);
      let p = i + 6;
      p += (1 + b[p] + 1) & ~1;                          // Pascal name, padded to even
      const size = be32(b, p);
      const data = p + 4;
      if (id === 0x03ED && size >= 16 && data + 16 <= end) {
        put16(b, data, dpi); put16(b, data + 2, 0); put16(b, data + 4, 1);
        put16(b, data + 8, dpi); put16(b, data + 10, 0); put16(b, data + 12, 1);
      }
      i = data + size + (size & 1);
    }
  }

  // ---- PNG ----------------------------------------------------------------

  function walkPng(b, fn) {
    let i = 8;
    while (i + 12 <= b.length) {
      const len = be32(b, i), type = ascii(b, i + 4, 4);
      if (i + 12 + len > b.length) throw new Error('Damaged PNG');
      fn(type, i + 8, len, i);
      i += 12 + len;
      if (type === 'IEND') return;
    }
  }

  /* Drops any existing pHYs chunk and writes a fresh one after IHDR. PNG
     stores pixels per metre, so 300 DPI is 11811. An eXIf chunk is patched
     in place, then its checksum redone so the file still validates. */
  function setPng(b, dpi) {
    const ppm = Math.round(dpi / 0.0254);
    const phys = new Uint8Array(21);
    put32(phys, 0, 9);
    phys.set([0x70, 0x48, 0x59, 0x73], 4);               // "pHYs"
    put32(phys, 8, ppm);
    put32(phys, 12, ppm);
    phys[16] = 1;                                        // unit: metre
    put32(phys, 17, crc32(phys.subarray(4, 17)));

    const parts = [b.subarray(0, 8)];
    walkPng(b, (type, at, len, start) => {
      if (type === 'eXIf') {
        exifTags(b, at, at + len, dpi);
        put32(b, at + len, crc32(b.subarray(start + 4, at + len)));
      }
      if (type !== 'pHYs') parts.push(b.subarray(start, start + 12 + len));
      if (type === 'IHDR') parts.push(phys);
    });
    return concat(parts);
  }

  // ---- zip ----------------------------------------------------------------

  /* A zip with no compression ("stored"). JPEGs and PNGs are already
     compressed, so deflating them again saves almost nothing and would mean
     shipping a compression library. Stored zips open everywhere.

     Takes [{name, data, size, crc}] and returns the zip as a list of pieces
     rather than one array. The browser wraps the pieces in a Blob, so a batch
     of 200 phone photos is never copied into one giant block of memory --
     which is what would crash Safari on an iPhone. `data` can be a Blob. */
  function zipParts(entries) {
    const enc = new TextEncoder();
    const now = new Date();
    const time = now.getHours() << 11 | now.getMinutes() << 5 | now.getSeconds() >> 1;
    const date = (now.getFullYear() - 1980) << 9 | (now.getMonth() + 1) << 5 | now.getDate();

    const local = [], central = [];
    let offset = 0;
    for (const { name, data, size, crc } of entries) {
      const n = enc.encode(name);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true);
      h.setUint16(4, 20, true);
      h.setUint16(6, 0x0800, true);                      // names are UTF-8
      h.setUint16(10, time, true);
      h.setUint16(12, date, true);
      h.setUint32(14, crc, true);
      h.setUint32(18, size, true);
      h.setUint32(22, size, true);
      h.setUint16(26, n.length, true);
      local.push(new Uint8Array(h.buffer), n, data);

      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true);
      c.setUint16(4, 20, true);
      c.setUint16(6, 20, true);
      c.setUint16(8, 0x0800, true);
      c.setUint16(12, time, true);
      c.setUint16(14, date, true);
      c.setUint32(16, crc, true);
      c.setUint32(20, size, true);
      c.setUint32(24, size, true);
      c.setUint16(28, n.length, true);
      c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), n);
      offset += 30 + n.length + size;
    }
    const cd = concat(central);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, entries.length, true);
    end.setUint16(10, entries.length, true);
    end.setUint32(12, cd.length, true);
    end.setUint32(16, offset, true);
    return [...local, cd, new Uint8Array(end.buffer)];
  }

  // ---- bytes --------------------------------------------------------------

  const be16 = (b, o) => b[o] << 8 | b[o + 1];
  const be32 = (b, o) => (b[o] << 24 | b[o + 1] << 16 | b[o + 2] << 8 | b[o + 3]) >>> 0;
  const put16 = (b, o, v) => { b[o] = v >> 8 & 255; b[o + 1] = v & 255; };
  const put32 = (b, o, v) => { b[o] = v >>> 24; b[o + 1] = v >> 16 & 255; b[o + 2] = v >> 8 & 255; b[o + 3] = v & 255; };

  function concat(parts) {
    const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
    let at = 0;
    for (const p of parts) { out.set(p, at); at += p.length; }
    return out;
  }

  const table = Array.from({ length: 256 }, (_, n) => {
    for (let k = 0; k < 8; k++) n = n & 1 ? 0xEDB88320 ^ n >>> 1 : n >>> 1;
    return n >>> 0;
  });
  function crc32(b) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < b.length; i++) c = table[(c ^ b[i]) & 255] ^ c >>> 8;
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  return { kind, setDpi, readDpi, zipParts, crc32 };
})();

if (typeof module !== 'undefined') module.exports = DPI;
