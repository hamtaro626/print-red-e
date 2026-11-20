# print-Red-E — v0.5

## 2026-11-20 — v0.5: a tab icon

- Added `favicon.ico` (16/32/48 px from the logo) and linked it first.
  Safari showed a plain letter in the tab instead of the logo; the .ico is
  the format every browser looks for, Safari included. The PNG icon stays
  for browsers that prefer it, and the home-screen icon is unchanged.
- The service worker caches the new file (cache renamed to `v2`).

## 2026-11-20 — v0.4: metal prints, puzzles, magnets, mouse pads, ornaments, coasters, phone cases

Sizes from Shutterfly product pages Alec looked at, plus labelled estimates
for the small items Shutterfly doesn't give a size for.

| Product | Sizes | Basis |
|---|---|---|
| Metal print | 8×10, 10×14, 12×12, 16×16, 16×20, 20×30, 24×36, 30×40 | Shutterfly "Photo Gallery Metal Print" page |
| Puzzle | 10×14, 16×20, 20×30 | Shutterfly "Photo Hero Gallery Puzzle" page. Piece count doesn't affect the print |
| Mouse pad | 7.75″ × 9.25″, landscape only | Shutterfly "Gallery of Six Mouse Pad" page (sold as "8×9") |
| Tote bag | 15×18, one photo across the whole face | Shutterfly "Upload Your Own Design" cotton tote page ("Measures 15″ x 18″", "For 1 photo") |
| Metal ornament | square 3.125″, round 3.25″, bracket 3×4 (landscape), gift tag 3×5 (portrait) | Shutterfly "Falling Snowflakes" metal ornament page. Round is rated by the circle's bounding square |
| Magnet | 3×3, 3×5, 4×5.5 | Shutterfly "Upload Your Own Design" magnet page (landscape and portrait versions exist) |
| Phone case | ~3″ × 6″, portrait only | **Estimate, on purpose.** Cases come in a size per phone model; one rough iPhone-back size is enough for a verdict |
| Coaster | 4×4 | Shutterfly "Upload Your Own Design Coasters" page |

Estimated sizes say "(estimated size)" in the picker and in each verdict.
Thresholds: metal prints, puzzles, magnets, ornaments, phone cases and coasters use
the paper tier (300/150): smooth surfaces looked at up close. Mouse pads use
the fabric tier (200/100), since the top is printed fabric. The picker's
groups follow Shutterfly's menu loosely: Prints & wall art, Drinkware & home,
Blankets & pillows, Gifts & keepsakes, Accessories & tech. Only the phone
case is still an estimate.

**Hosting:** GitHub Pages at `hamtaro626.github.io/print-red-e`, published on
push to `main`. Chosen over Cloudflare Pages because nothing in the repo is
private (photos never leave the device), and push-to-publish is the simplest
routine. The repo is public, which GitHub Pages requires on the free plan.

## 2026-11-19 — v0.3: pick what you're printing, see which photos work

- **"What are you printing?"** A picker with photo prints, canvas, mugs,
  fleece and woven blankets, pillows and tote bags, every size Shutterfly
  sells them in. Each photo gets a verdict for that item ("Good · 50×60
  fleece blanket · 120 pixels per inch"), and the batch gets a tally ("1 good
  · 1 too small"). Chips show the product's other sizes, so a "too small"
  50×60 that would be sharp as a 30×40 is visible at a glance. The choice is
  remembered on the device.
- **Two thresholds instead of one.** Paper and mugs: 300 sharp / 150 good.
  Fabric and canvas: 200 / 100, because the weave or texture softens fine
  detail and they're seen from further away. Print shops quote 150–200 PPI
  for fabric and 150 for canvas gallery wraps; 200/100 splits around that.
  These are judgement calls, not Shutterfly rules. Its own warning has the
  final say.
- **Orientation matters for some products.** A mug only wraps sideways and a
  tote stands upright, so a portrait photo on a mug is cropped harder than a
  landscape one. Prints, canvas, blankets and pillows come both ways.

**Where the sizes come from.** Shutterfly doesn't publish one complete list,
so these are gathered from its pages (November 2026):

| Product | Sizes | Source |
|---|---|---|
| Photo prints | 4×6 … 24×36 | Standard sizes; 4×6 minimum from [Shutterfly print quality](https://www.shutterfly.com/ideas/what-to-know-about-shutterflys-photo-print-quality/) |
| Canvas | 13 sizes, 8×10 to 36×36 | [Shutterfly canvas FAQ](https://www.shutterfly.com/ideas/shutterfly-canvas-prints-guide-common-faqs/) |
| Fleece blanket | 30×40, 50×60, 60×80 | [Shutterfly blanket size guide](https://www.shutterfly.com/ideas/photo-blanket-size-guide/) |
| Woven blanket | 54×70, 60×80 | [Shutterfly woven blankets](https://www.shutterfly.com/t/photo-blankets/?product-type=woven-photo-blanket) |
| Pillow | 12×16, 16×16, 18×18, 20×20 | [Shutterfly Photo Gallery Pillow](https://www.shutterfly.com/p/personalized-gifts/pillows/photo-gallery-pillow) |
| Cotton tote | 15×18 | [Shutterfly cotton totes](https://www.shutterfly.com/t/tote-bags/?product-type=cotton-tote-bag) |
| Mug, 11 / 15 oz | 8.5×3.2, 8.6×4.0 in wrap | **Approximate.** Shutterfly gives only the mug's size (11 oz: 3.75″ tall, 3″ across); the wrap area is Nations Photo Lab's published spec, via [this guide](https://getshazory.com/blogs/shazory-journal/how-to-pick-photo-for-custom-mug) |

Each size is the whole face of the item. The real printable area is a
little smaller (seams, bleed, the mug handle), which only makes the ratings
slightly cautious.

## 2026-11-19 — v0.2: renamed, iPhone-ready, and says what each photo can print

- **Renamed** from PrintReady to print-Red-E, with Alec's logo.
- **Print sizes per photo.** Each row now says what the photo is good for
  ("Sharp up to 8×10 · good up to 16×20") and rates eight standard sizes from
  4×6 to 24×36. The rating comes from pixels, not the DPI label. See below.
- **iPhone.** Installs to the home screen (manifest, icons, service worker).
  A **Save to Photos** button opens the share sheet where the browser
  supports sharing files, so a batch goes straight into Photos for the
  Shutterfly app. Big batches no longer hold every photo in memory at once:
  thumbnails are 160px copies and the zip is assembled from pieces.

**Why print sizes ignore DPI.** The original idea was "300 DPI and high-res
means poster, 72 DPI means maybe a 4×6." Working it through, the DPI number
turns out not to matter: a lab spreads the photo's pixels across the paper
you order, so the same 4000-pixel photo prints identically whether its label
says 72 or 300. Shutterfly judges resolution from pixels against the size you
pick; its own 4×6 recommendation (1200×1800) is exactly 300 pixels per inch
of paper. So the rating is pixels ÷ inches of paper:

| Rating | Pixels per inch of paper | Meaning |
|---|---|---|
| Sharp | 300+ | Crisp even held in your hand |
| Good | 150–299 | Fine from a step back; posters and wall prints live here |
| Too small | under 150 | Soft; where most labs' low-resolution warnings start |

Sizes assume the lab crops to fill the paper (its usual default), so the
tighter of the two directions decides. A square photo on a 4×6 loses a third
of its width to the crop.

## 2026-11-19 — v0.1: pick photos, get them back at 300 DPI

## 2026-11-19 — v0.1: pick photos, get them back at 300 DPI

First version. Pick or drop a batch of JPEGs and PNGs, each one is relabelled
300 DPI in the browser, download them one at a time or all as a zip.

## The job

A print shop, photo book site, or publisher asks for "300 DPI files." Your
photos say 72 (or nothing at all), so the upload gets flagged even though the
pixels are fine. Fix the label on a whole batch at once, without opening each
one in an editor.

## Decisions

- **Relabel, never resample.** DPI is a number in the file's header that tells
  a printer how many pixels to put in each inch. It is not part of the picture.
  So print-Red-E edits only those header bytes and copies the picture data
  through untouched. No re-encoding means no quality loss, and the tests check
  the image data is byte-identical before and after.
- **Show the print size, because that's the honest part.** Setting 300 DPI on
  a 600-pixel-wide photo makes it a 2-inch print. Each row shows pixels and the
  size it prints at 300 DPI, and says so when that's smaller than a 4×6. The
  app does not pretend to add detail that isn't there.
- **Set every place a JPEG stores DPI.** JFIF, EXIF, and Photoshop's block can
  each hold a value, and apps disagree on which to trust. Measured: macOS
  Preview reads EXIF over JFIF, so a file with JFIF 300 / EXIF 72 shows as 72.
  Same for PNG: macOS writes an `eXIf` block into PNGs (screenshots included)
  and trusts it over the standard `pHYs` field. All of them get set.
- **Everything happens in the browser.** No upload, no server. The photos
  never leave the device, which also means no hosting costs and no privacy
  policy to write. EXIF (including GPS) is left exactly as it was — this tool
  changes DPI only.
- **Zip without compression.** JPEGs and PNGs are already compressed, so
  deflating them again saves next to nothing and would mean shipping a
  compression library. The zip writer is ~50 lines in `dpi.js`.
- **Names are kept.** `IMG_0412.jpg` comes back as `IMG_0412.jpg`. Two files
  with the same name become `name.jpg` and `name (2).jpg` in the zip, so one
  doesn't silently overwrite the other on unzip.

## Explicitly not doing

- **No resizing to a print size** ("make this an 8×10 at 300 DPI"). That's the
  other meaning of "convert to 300 DPI" and the natural v0.2 if it's what's
  actually needed — but it changes pixels, needs a crop decision for every
  photo whose shape doesn't match the paper, and can only upscale by inventing
  detail. Worth doing only once a real print order asks for it.
- **No saved history.** Converted photos live until you clear the page or
  close it. Re-downloading works any time before that. Keeping batches
  across visits (on the device) is the obvious next step if closing the app
  between converting and uploading turns out to be common.
- **No collage maths.** Ratings assume one photo fills the item. Shutterfly's
  "Gallery of Six" style designs give each photo a fraction of the space;
  the page says to check those against a smaller size. Worth doing properly
  only if collages turn out to be the common case.
- **No scraping Shutterfly for a full catalogue.** Its terms most likely
  forbid automated crawling (the usual clause; the live terms page is the
  authority), the pages are built by JavaScript, and sizes change rarely.
  Sizes get added by hand from product pages instead.
- **Not every Shutterfly product.** Glass prints, framed prints,
  apparel, calendars and photo books aren't in the picker. Adding one is a
  single line in `prints.js` once its size is known; replacing an estimate
  with a real size is the same.
- **No per-lab rules.** Two threshold tiers. Labs differ a little; these are
  the common ground.
- **No DPI other than 300.** One constant (`TARGET_DPI` in `app.js`). Add a
  picker the first time someone needs 240 or 600.
- **No HEIC, TIFF, or WebP.** HEIC is what iPhones store, but iOS Safari
  hands web pages a JPEG copy when you pick from Photos, so it should rarely
  come up. A HEIC that does arrive is skipped with advice to export as JPEG.
- **No zip over 4 GB.** The simple zip format caps there. Hundreds of normal
  photos fit well under it.

## Logo and icons

`assets/logo-source.png` (2000×2000, opaque, background `#EDECEA`) is the
source. `logo.png` (600), `icon-512.png`, `icon-192.png` and
`apple-touch-icon.png` (180) are uncropped downscales: `sips -Z <size>`.
`favicon.ico` (the browser-tab icon) holds 16, 32 and 48 px downscales of
the same source, packed as PNGs inside the .ico; metadata chunks are dropped.
All icons are fully opaque, so iOS has nothing to fill with black. The
page colours are taken from the logo: paper `#EDECEA`, ink `#222222`, red
`#FF3131` (highlight only; too faint on the paper for text).

## Tests

`test/verify.sh` runs 123 checks in three stages:

1. **73 checks in Node** (`test/dpi.test.js`). 51 byte-level checks on six
   header layouts seen in the wild macOS's own `sips` is the judge for DPI and pixel size, not our
   own reader. Also: image data byte-identical, input untouched, running twice
   changes nothing, PNG checksums valid, and the zip extracts byte-for-byte
   with `ditto` (what Finder uses). 13 on the print-size rules, including
   Shutterfly's 4×6 minimum landing exactly on "sharp", fabric vs paper
   thresholds, mug/phone-case/mouse-pad orientation, the tote's 15×18
   photo area, and which sizes are marked as estimates. 2 on the service
   worker's file list.
2. **44 page checks** in headless Chrome: the tab and home-screen icons
   load, picks files through the real input,
   drops one on the drop zone, checks rows, verdicts and the batch tally,
   switching the item to a pillow (verdicts, chips and key all update, choice
   remembered), thumbnails,
   single download, Save to Photos (against a stand-in share sheet, including
   cancel and failure), Download all, and Clear.
3. **6 checks on the zip the page actually produced**, extracted with `ditto`
   and read with `sips`.
