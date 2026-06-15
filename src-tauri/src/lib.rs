// Augur — Tauri v2 entry point.
// The whole UI is the existing single-file web app; Rust only hosts the webview
// and registers the dialog + filesystem plugins used by tauri-bridge.js.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running Augur");
}
