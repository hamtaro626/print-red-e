/* print-Red-E UI: pick or drop photos, set each to 300 DPI in the browser,
   show what print sizes each can handle, then download them one at a time,
   all as a zip, or (on an iPhone) straight into Photos via the share sheet.
   The byte work lives in dpi.js, the print-size rules in prints.js. */

const TARGET_DPI = 300;
const THUMB = 160;                                       // px, long side; 56px shown at up to 3x

const $ = id => document.getElementById(id);
const pick = $('pick'), drop = $('drop'), list = $('list');
const results = $('results'), summary = $('summary'), notice = $('notice');
const downloadAll = $('download-all'), share = $('share'), clear = $('clear');
const target = $('target'), tally = $('tally'), key = $('key');

/* "What are you printing?" -- one option per product size, grouped the way
   Shutterfly's menu groups them. The choice is remembered on this device. */
const STORE = 'print-red-e/target';
for (const group of new Set(PRINTS.PRODUCTS.map(p => p.group))) {
  const og = document.createElement('optgroup');
  og.label = group;
  for (const p of PRINTS.PRODUCTS.filter(p => p.group === group)) {
    for (const s of p.sizes) og.append(new Option(`${s.label} ${p.name}${p.approx ? ' (estimated size)' : ''}`, `${p.id}:${s.label}`));
  }
  target.append(og);
}
try {
  const saved = localStorage.getItem(STORE);
  if ([...target.options].some(o => o.value === saved)) target.value = saved;
} catch {}
target.addEventListener('change', () => {
  try { localStorage.setItem(STORE, target.value); } catch {}
  render();
});
const chosen = () => {
  if (target.selectedIndex < 0) target.selectedIndex = 0;   // never render with no choice
  const [id, label] = target.value.split(':');
  return { p: PRINTS.product(id), label };
};

let items = [];

/* Photos are handled one at a time and only small things are kept: the
   converted file as a Blob (which Safari can keep on disk rather than in
   memory) and a 160px thumbnail. Holding 100 full-size decoded iPhone photos
   at once would be several gigabytes, which is how a mobile tab crashes. */
async function add(files) {
  for (const file of files) {
    const item = { name: file.name };
    items.push(item);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      item.before = DPI.readDpi(bytes);
      const out = DPI.setDpi(bytes, TARGET_DPI);
      item.type = DPI.kind(out) === 'png' ? 'image/png' : 'image/jpeg';
      item.size = out.length;
      item.crc = DPI.crc32(out);
      item.blob = new Blob([out], { type: item.type });
      item.url = URL.createObjectURL(item.blob);
      Object.assign(item, await thumbnail(item.url));
    } catch (e) {
      item.error = /\.(heic|heif)$/i.test(file.name)
        ? 'HEIC photos aren’t supported yet. Export or share it as a JPEG first.'
        : e.message === 'Not a JPEG or PNG' ? 'Not a JPEG or PNG, so it was skipped.'
        : 'This file looks damaged, so it was skipped.';
    }
    render();                                            // rows appear as they finish
  }
}

/* Decodes the photo once to get its displayed size (which already accounts
   for a phone photo stored sideways and rotated by its EXIF orientation) and
   to draw a small thumbnail, then lets the full-size decode go. */
function thumbnail(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth, h = img.naturalHeight;
      const scale = Math.min(1, THUMB / Math.max(w, h));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * scale));
      c.height = Math.max(1, Math.round(h * scale));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => resolve({ w, h, thumb: b ? URL.createObjectURL(b) : null }), 'image/jpeg', 0.8);
    };
    img.onerror = () => resolve({});
    img.src = url;
  });
}

const inches = px => (px / TARGET_DPI).toFixed(2).replace(/\.?0+$/, '');
const ready = () => items.filter(i => !i.error && i.blob);
const files = () => {
  const good = ready();
  const names = uniqueNames(good.map(i => i.name));
  return good.map((item, k) => ({ item, name: names[k] }));
};

function render() {
  const good = ready();
  results.hidden = items.length === 0;
  downloadAll.disabled = good.length === 0;
  share.hidden = !canShareFiles();
  share.disabled = good.length === 0;
  const skipped = items.filter(i => i.error).length;
  summary.textContent = `${good.length} photo${good.length === 1 ? '' : 's'} ready at ${TARGET_DPI} DPI`
    + (skipped ? ` · ${skipped} skipped` : '');

  // The batch at a glance: how many photos work for the chosen item.
  const { p, label } = chosen();
  const counts = { sharp: 0, good: 0, low: 0 };
  good.filter(i => i.w).forEach(i => counts[PRINTS.fit(i.w, i.h, p.id).find(f => f.label === label).rating]++);
  tally.textContent = `${label} ${p.name}: ` + Object.entries(counts).filter(([, n]) => n)
    .map(([r, n]) => `${n} ${PRINTS.LABELS[r].toLowerCase()}`).join(' \u00b7 ');
  tally.hidden = !good.some(i => i.w);

  const t = PRINTS.TIERS[p.tier];
  key.innerHTML = `<span class="chip sharp">Sharp</span> ${t.sharp}+ pixels per inch
    <span class="chip good">Good</span> ${t.good}+
    <span class="chip low">Too small</span> soft; Shutterfly may warn`
    + (p.tier === 'fabric' ? '<br>Fabric and canvas hide fine detail, so they need fewer pixels than paper.' : '');

  list.replaceChildren(...items.filter(i => i.error || i.blob).map(row));
}

function row(item) {
  const li = document.createElement('li');
  if (item.error) {
    li.className = 'error';
    li.innerHTML = '<div class="thumb"></div><div class="info"><p class="name"></p><p class="detail"></p></div>';
    li.querySelector('.name').textContent = item.name;
    li.querySelector('.detail').textContent = item.error;
    return li;
  }
  li.innerHTML = `
    <img class="thumb" alt="">
    <div class="info">
      <p class="name"></p>
      <p class="detail size"></p>
      <p class="detail change"></p>
      <p class="verdict"></p>
      <ul class="fit"></ul>
    </div>
    <a class="save" download>Download</a>`;
  if (item.thumb) li.querySelector('.thumb').src = item.thumb;
  li.querySelector('.name').textContent = item.name;
  li.querySelector('.change').textContent =
    `${item.before ? `Was ${item.before} DPI` : 'Had no DPI set'} → now ${TARGET_DPI}`;
  if (item.w) {
    li.querySelector('.size').textContent =
      `${item.w} × ${item.h} px · ${inches(item.w)} × ${inches(item.h)} in at ${TARGET_DPI} DPI`;
    // The verdict for the chosen item, then every size of that product so
    // you can see whether a size up or down would work better.
    const { p, label } = chosen();
    const fits = PRINTS.fit(item.w, item.h, p.id);
    const pick = fits.find(f => f.label === label);
    const verdict = li.querySelector('.verdict');
    verdict.innerHTML = `<span class="chip ${pick.rating}"></span> <span class="what"></span>`;
    verdict.querySelector('.chip').textContent = PRINTS.LABELS[pick.rating];
    verdict.querySelector('.what').textContent =
      `${label} ${p.name}${p.approx ? ' (estimated size)' : ''} \u00b7 ${pick.ppi} pixels per inch`;
    li.querySelector('.fit').replaceChildren(...fits.map(f => {
      const chip = document.createElement('li');
      chip.className = `chip ${f.rating}${f === pick ? ' chosen' : ''}`;
      chip.textContent = f.label;
      chip.title = `${f.ppi} pixels per inch at ${f.label}`;
      return chip;
    }));
  }
  const save = li.querySelector('.save');
  save.href = item.url;
  save.download = item.name;
  return li;
}

// Two photos both called IMG_0001.jpg (say, from two cameras) would overwrite
// each other when unzipped or saved, so later ones become "IMG_0001 (2).jpg".
function uniqueNames(names) {
  const seen = new Set();
  return names.map(name => {
    let candidate = name;
    for (let n = 2; seen.has(candidate.toLowerCase()); n++) {
      const dot = name.lastIndexOf('.');
      candidate = dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`;
    }
    seen.add(candidate.toLowerCase());
    return candidate;
  });
}

downloadAll.addEventListener('click', () => {
  const parts = DPI.zipParts(files().map(({ item, name }) =>
    ({ name, data: item.blob, size: item.size, crc: item.crc })));
  const url = URL.createObjectURL(new Blob(parts, { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `photos-${TARGET_DPI}dpi.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
});

/* On an iPhone the share sheet is the natural way out: "Save N Images" puts
   them straight into Photos, where the Shutterfly app can pick them up. Only
   shown where the browser can share files (iOS/Android Safari and Chrome,
   not most desktops). */
function canShareFiles() {
  try {
    return !!navigator.canShare
      && navigator.canShare({ files: [new File([''], 'x.jpg', { type: 'image/jpeg' })] });
  } catch { return false; }
}

share.addEventListener('click', async () => {
  notice.hidden = true;
  const shared = files().map(({ item, name }) => new File([item.blob], name, { type: item.type }));
  try {
    await navigator.share({ files: shared });
  } catch (e) {
    if (e.name === 'AbortError') return;                 // closed the share sheet
    notice.textContent = 'The share sheet couldn’t take this many photos at once. '
      + 'Try Download all, or clear and share a smaller batch.';
    notice.hidden = false;
  }
});

clear.addEventListener('click', () => {
  items.forEach(i => { i.url && URL.revokeObjectURL(i.url); i.thumb && URL.revokeObjectURL(i.thumb); });
  items = [];
  notice.hidden = true;
  render();
});

pick.addEventListener('change', () => {
  add([...pick.files]);
  pick.value = '';                                       // so picking the same file again still fires
});

// Drag and drop onto the picker. preventDefault on dragover is what tells the
// browser this is a drop target rather than a link to open the file.
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', e => {
  e.preventDefault();
  drop.classList.remove('over');
  add([...e.dataTransfer.files]);
});

// Offline support and install-to-home-screen. Skipped inside the test frame.
if ('serviceWorker' in navigator && window.top === window.self) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
