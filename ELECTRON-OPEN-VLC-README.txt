Open in VLC / Copy URL changes

What changed:
- Browser / GitHub Pages version shows a "Copy URL" button in Rename/Edit Channel.
- Electron version shows an "Open in VLC" button in the same place.
- Electron uses electron/preload.cjs + electron/main.cjs to safely launch VLC.

Important:
- I did not change package.json because this GitHub project uses package-lock.json + npm ci for GitHub Pages.
  Changing package.json without updating package-lock.json would break your GitHub deploy.

If you build Electron from this GitHub project, you need Electron installed in your local build folder:
  npm install --save-dev electron electron-builder

For Electron builds, build the web app with base ./ instead of /m3ueditor/:
  npm run build -- --base=./

Then launch with Electron using electron/main.cjs as the main file.
If you use the earlier electron-ready project, copy these files into it:
  src/App.tsx
  src/global.d.ts
  electron/main.cjs
  electron/preload.cjs
