/* Augur — Tauri bridge.
   When the app runs inside the Tauri shell (window.__TAURI__ present), this routes the
   toolbar's Open/Save buttons to native OS dialogs + real filesystem writes, reusing the
   app's existing globals (unzip, zip, buildExportFiles, loadVaultRecs, VAULT, slug, …).
   In a plain browser it does nothing, so the standalone prototype keeps its web behavior. */
(function () {
  const T = window.__TAURI__;
  if (!T || !T.dialog || !T.fs) return;

  const { open, save } = T.dialog;
  const fs = T.fs;
  const pathApi = T.path;
  const td = new TextDecoder();
  const note = (m) => { const el = document.getElementById('saveNote'); if (el) el.textContent = m; };
  const hasVault = () => (typeof VAULT !== 'undefined' && VAULT);

  const NATIVE = {
    btnOpenAugur: nativeOpenAugur,
    btnLoadVault: nativeOpenFolder,
    btnExport: nativeSaveAugur,
    btnSaveFolder: nativeSaveFolder,
  };

  // Capture phase + stopImmediatePropagation so the app's own (web) click handlers don't also fire.
  document.addEventListener('click', (e) => {
    const b = e.target.closest('#btnOpenAugur,#btnLoadVault,#btnExport,#btnSaveFolder');
    if (!b) return;
    const fn = NATIVE[b.id];
    if (!fn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    Promise.resolve().then(fn).catch((err) => { console.error(err); alert((err && err.message) || String(err)); });
  }, true);

  async function nativeOpenAugur() {
    const path = await open({ multiple: false, filters: [{ name: 'Augur vault', extensions: ['augur', 'zip'] }] });
    if (!path) return;
    const bytes = await fs.readFile(path); // Uint8Array
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const entries = await unzip(ab);
    const recs = entries.map((en) => {
      const isText = /\.(md|json)$/i.test(en.name);
      return { path: en.name, name: en.name.split('/').pop(), text: isText ? td.decode(en.bytes) : '', bytes: isText ? null : en.bytes, isText };
    });
    loadVaultRecs(recs);
  }

  async function nativeOpenFolder() {
    const dir = await open({ directory: true, multiple: false });
    if (!dir) return;
    const recs = [];
    await walk(dir, '');
    if (recs.length) loadVaultRecs(recs);
    async function walk(abs, rel) {
      const entries = await fs.readDir(abs);
      for (const en of entries) {
        const childAbs = await pathApi.join(abs, en.name);
        const childRel = rel ? rel + '/' + en.name : en.name;
        if (en.isDirectory) { await walk(childAbs, childRel); continue; }
        const isText = /\.(md|json)$/i.test(en.name);
        if (isText) recs.push({ path: childRel, name: en.name, text: await fs.readTextFile(childAbs), bytes: null, isText: true });
        else recs.push({ path: childRel, name: en.name, text: '', bytes: await fs.readFile(childAbs), isText: false });
      }
    }
  }

  async function nativeSaveAugur() {
    if (!hasVault()) { alert('Load a vault first.'); return; }
    const files = buildExportFiles();
    const blob = await zip(files.map((f) => ({ name: f.path, data: f.isText ? f.text : f.bytes })));
    const ab = await blob.arrayBuffer();
    const title = (VAULT.manifest && VAULT.manifest.title) || 'vault';
    const path = await save({ defaultPath: slug(title) + '.augur', filters: [{ name: 'Augur vault', extensions: ['augur'] }] });
    if (!path) return;
    await fs.writeFile(path, new Uint8Array(ab));
    redriveFromVault(); commit();
    note('saved ✓');
  }

  async function nativeSaveFolder() {
    if (!hasVault()) { alert('Load a vault first.'); return; }
    const dir = await open({ directory: true, multiple: false });
    if (!dir) return;
    const files = buildExportFiles();
    for (const f of files) {
      const full = await pathApi.join(dir, ...f.path.split('/'));
      const cut = Math.max(full.lastIndexOf('/'), full.lastIndexOf('\\'));
      const parent = cut > 0 ? full.slice(0, cut) : dir;
      try { await fs.mkdir(parent, { recursive: true }); } catch (_) {}
      if (f.isText) await fs.writeTextFile(full, f.text);
      else await fs.writeFile(full, f.bytes);
    }
    redriveFromVault(); commit();
    note('saved to folder ✓');
  }

  console.log('[Augur] Tauri bridge active — native Open/Save enabled.');
})();
