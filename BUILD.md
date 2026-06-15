# Building Augur (Tauri v2, Windows)

The desktop app reuses the existing web prototype as its frontend. Rust hosts the
webview and provides native file dialogs + disk access; you don't have to touch any
Rust to build.

## Layout

```
Augur/                       (this folder — run all commands here)
├─ augur-prototype-1.html    the app (standalone; still opens in a browser)
├─ vault.js, augur-zip.js, vault-adapter.js, vault-serialize.js, vault-edit.js
├─ srd-bestiary.js, AugurLogo.svg, AugurIcon.svg, tutorial.augur
├─ tauri-bridge.js           native Open/Save wiring (only active inside Tauri)
├─ build-frontend.mjs        assembles dist/ from the files above (auto-run by Tauri)
├─ package.json
└─ src-tauri/                the Rust/Tauri shell
   ├─ tauri.conf.json  Cargo.toml  build.rs
   ├─ src/{main.rs, lib.rs}
   ├─ capabilities/default.json
   └─ icons/                generated app icons (incl. icon.ico)
```

`dist/`, `node_modules/`, and `src-tauri/target/` are generated and git-ignored.

## Prerequisites (you said these are installed)

- Rust (stable, via rustup; rustc ≥ 1.77)
- Node.js 20+ and npm
- Windows build tools: **Microsoft C++ Build Tools** and **WebView2** (preinstalled on
  Windows 10/11). MSVC is what compiles the Rust shell.

## Run / build

```powershell
npm install          # fetches the Tauri CLI (first time only)
npm run dev          # live dev window (assembles dist/, opens the app)
npm run build        # production build + installers
```

`npm run build` writes installers to:

```
src-tauri/target/release/bundle/msi/Augur_0.1.0_x64_en-US.msi
src-tauri/target/release/bundle/nsis/Augur_0.1.0_x64-setup.exe
```

(Run from this folder so the `node build-frontend.mjs` pre-step finds the files.)

## How the frontend is wired

`build-frontend.mjs` copies the runtime files into `dist/` and writes `dist/index.html`
from `augur-prototype-1.html`, injecting `<script src="tauri-bridge.js">`. Tauri embeds
`dist/`. Edit the prototype as usual — the next `npm run dev`/`build` re-assembles `dist/`
automatically. The standalone `augur-prototype-1.html` is never modified.

## Native file access

Inside the app, the toolbar buttons behave natively:

- **⤒ .augur** / **⤒ Load Vault** → OS Open dialog (file or folder)
- **⤓ Save .augur** → OS Save dialog, writes the chosen `.augur`
- **💾 Save to folder** → OS folder picker, writes the vault's `.md`/`.json` in place

These use Tauri's `dialog` + `fs` plugins (declared in `src-tauri/capabilities/default.json`).
In a plain browser the same buttons fall back to the web file-input / download behavior.

## Icons

Icons were generated from `AugurIcon.svg` into `src-tauri/icons/`. To regenerate after
changing the art (uses `src-tauri/icon-source.png`, a 1024×1024 master):

```powershell
npm run tauri icon src-tauri/icon-source.png
```

## App identity

- Product name: **Augur**
- Identifier: **com.yellowberri.augur** (change in `src-tauri/tauri.conf.json` if needed)
- Version: **0.1.0** (keep `tauri.conf.json` and `Cargo.toml` in sync)

> Unsigned builds will show a SmartScreen warning on other machines. For distribution,
> see Tauri's Windows code-signing guide.
