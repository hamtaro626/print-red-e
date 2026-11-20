/* What a photo is good for: which products and sizes its pixels can fill.

   This deliberately ignores the DPI label in the file. A print lab spreads
   the photo's pixels across whatever you order, so the only number that
   matters is pixels per inch of the *product*: pixels / inches. A 4000-pixel
   photo labelled 72 DPI prints exactly as well as the same photo labelled 300.

   Two tiers of thresholds, because how close you look decides how much
   detail you can see:
     up close        300 sharp / 150 good. Photo prints and mugs: held in the
                     hand. Shutterfly's 4x6 minimum (1200x1800) is exactly 300.
     fabric & canvas 200 sharp / 100 good. Blankets, pillows, totes, canvas:
                     the weave or texture softens fine detail, and they're
                     seen from further away. Print shops quote 150-200 for
                     fabric and 150 for canvas; this splits around that.
   Below "good" is "too small": it prints, but soft, and the lab may warn.
   These are rules of thumb. Shutterfly's own warning has the final say.

   Product sizes are Shutterfly's (see SPEC.md for sources). Each size is
   the whole face of the product, assuming one photo fills it. In a collage
   each photo covers less, so it needs fewer pixels.

   Plain script, loaded by index.html and by the Node tests. */

const PRINTS = (() => {
  const TIERS = {
    close: { sharp: 300, good: 150 },
    fabric: { sharp: 200, good: 100 },
  };

  const size = (w, h, label = `${w}×${h}`) => ({ w, h, label });
  const sizes = list => list.map(([w, h]) => size(w, h)).sort((a, b) => a.w * a.h - b.w * b.h);

  /* `fixed` means the product has one orientation, so the photo can't be
     turned to suit it: a mug wraps sideways, a tote stands upright. Every
     other product comes in both orientations, so the photo's long side goes
     on the product's long side. */
  const PRODUCTS = [
    { id: 'print', name: 'photo print', group: 'Prints & wall art', tier: 'close',
      sizes: sizes([[4, 6], [5, 7], [8, 10], [11, 14], [12, 18], [16, 20], [20, 30], [24, 36]]) },
    { id: 'canvas', name: 'canvas print', group: 'Prints & wall art', tier: 'fabric',
      sizes: sizes([[8, 10], [10, 14], [10, 20], [10, 24], [12, 12], [12, 36], [16, 16], [16, 20],
        [20, 24], [20, 30], [24, 36], [30, 40], [36, 36]]) },
    // Mug sizes are the full wraparound print area (a single-photo mug).
    { id: 'mug', name: 'photo mug', group: 'Drinkware', tier: 'close', fixed: true,
      sizes: [size(8.5, 3.2, '11 oz'), size(8.6, 4, '15 oz')] },
    { id: 'fleece', name: 'fleece blanket', group: 'Blankets & pillows', tier: 'fabric',
      sizes: sizes([[30, 40], [50, 60], [60, 80]]) },
    { id: 'woven', name: 'woven blanket', group: 'Blankets & pillows', tier: 'fabric',
      sizes: sizes([[54, 70], [60, 80]]) },
    { id: 'pillow', name: 'pillow', group: 'Blankets & pillows', tier: 'fabric',
      sizes: sizes([[12, 16], [16, 16], [18, 18], [20, 20]]) },
    { id: 'tote', name: 'cotton tote bag', group: 'Bags', tier: 'fabric', fixed: true,
      sizes: [size(15, 18)] },
  ];

  const product = id => PRODUCTS.find(p => p.id === id) || PRODUCTS[0];
  const LABELS = { sharp: 'Sharp', good: 'Good', low: 'Too small' };

  /* PPI the photo gets on one product size, assuming the lab crops it to
     fill (the usual default). Cropping to fill means the tighter of the two
     directions decides. */
  function ppiOn(w, h, p, s) {
    if (p.fixed) return Math.floor(Math.min(w / s.w, h / s.h));
    return Math.floor(Math.min(Math.max(w, h) / Math.max(s.w, s.h), Math.min(w, h) / Math.min(s.w, s.h)));
  }

  function rate(ppi, p) {
    const t = TIERS[p.tier];
    return ppi >= t.sharp ? 'sharp' : ppi >= t.good ? 'good' : 'low';
  }

  // Every size of one product, rated for a w x h photo.
  function fit(w, h, id = 'print') {
    const p = product(id);
    return p.sizes.map(s => {
      const ppi = ppiOn(w, h, p, s);
      return { label: s.label, ppi, rating: rate(ppi, p) };
    });
  }

  return { TIERS, PRODUCTS, LABELS, product, fit };
})();

if (typeof module !== 'undefined') module.exports = PRINTS;
