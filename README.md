# print-Red-E

Pick a batch of photos and what you're printing (a 4×6, a canvas, a metal
print, a mug, a blanket, a puzzle, a magnet, an ornament...). See which photos have enough pixels for it, and get them back
labelled 300 DPI. Pixels untouched, nothing uploaded.

Static files: HTML, CSS, three scripts, a service worker. No build step, no dependencies, no
server side. See [SPEC.md](SPEC.md) for what it does and what it deliberately
doesn't.

## Run it locally

```sh
cd ~/Documents/Projects/print-red-e
python3 -m http.server 8000
```

Then open <http://localhost:8000>. To try it on a phone on the same Wi-Fi,
use the Mac's address (`ipconfig getifaddr en0`) instead of `localhost`.
Over plain HTTP the phone can convert and download, but installing to the
home screen and offline use need HTTPS, so those only work once deployed.

## On an iPhone

1. Open <https://hamtaro626.github.io/print-red-e/> in Safari, tap Share → **Add to Home Screen**.
2. **Choose photos** → pick from your library. Safari hands the page JPEG
   copies of iPhone (HEIC) photos.
3. **Save to Photos** opens the share sheet; choose *Save N Images*. Or
   **Download all** to get a zip in the Files app.

## Check a result yourself

Open a downloaded photo in Preview, then **Tools → Show Inspector** (⌘I).
Image DPI should read 300. Or in Terminal:

```sh
sips -g dpiWidth -g dpiHeight ~/Downloads/your-photo.jpg
```

## Tests

```sh
test/verify.sh
```

122 checks: 73 in Node (DPI bytes, zip, print-size rules, service worker
list), 43 driving the real page in headless Chrome, and 6 on the zip that page
downloads. Needs Node and Google
Chrome; everything else (`sips`, `ditto`, `python3`) ships with macOS.

## Deploy

Hosted on GitHub Pages from the `main` branch, repo root. Pushing to `main`
publishes it; the site updates a minute or so later.

## Files

| File | What it does |
|---|---|
| `index.html`, `style.css` | The page |
| `app.js` | Picking, dropping, the list, downloads, sharing |
| `dpi.js` | Rewrites DPI in JPEG/PNG headers; builds the zip |
| `prints.js` | Shutterfly products and sizes, and which ones a photo's pixels can handle |
| `sw.js`, `manifest.webmanifest`, `*.png` | Home-screen install and offline |
| `assets/logo-source.png` | Full-size logo; icons are made from it (see SPEC) |
| `test/` | Never deployed; see Tests |
