# Any-file

Convert your files right in your browser. No uploads, no servers, no BS.

## Why?

Because your files are yours. We built this so you can convert documents, images, audio, and video without sending anything to a server. Everything happens on your device.

## What it does

- **Documents**: PDF ↔ Images, DOCX → PDF, TXT → PDF
- **Images**: PNG, JPG, WebP, GIF - convert between any of them
- **Audio**: MP3 ↔ WAV, extract audio from videos
- **Video**: Basic format conversions


All processing happens in your browser. Seriously, check the network tab - nothing gets uploaded.

## Tech

Built with Next.js 15, TypeScript, and Tailwind CSS. Uses a bunch of libraries to handle the heavy lifting:

- `pdf-lib` and `pdfjs-dist` for PDFs
- `mammoth` for Word docs
- `jspdf` for generating PDFs
- `@ffmpeg/ffmpeg` for video stuff
- Native browser APIs for everything else


## Running it locally

```shellscript
git clone https://github.com/yourusername/any-file.git
cd any-file
npm install
npm run dev
```

That's it. Open `localhost:3000` and you're good to go.

## How it works

1. You pick a file
2. Browser reads it (File API)
3. Conversion happens locally (WebAssembly + Web Workers)
4. Download your converted file


No step 5. No server. No database. No file storage.

## The FFmpeg thing

Some conversions (mostly video stuff) need FFmpeg.wasm, which requires SharedArrayBuffer. This works fine in production but might need special headers in dev:

```plaintext
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Basic stuff (images, docs, MP3/WAV) works everywhere without any setup.

## Contributing

Found a bug? Want to add a format? PRs welcome. Just keep it client-side - that's the whole point.

## Privacy

- No tracking
- No analytics
- No data collection
- No cookies
- No server uploads
- Open source so you can verify


Your files never leave your device. Period.

## License

MIT - do whatever you want with it.

---

Made for people who care about privacy.
