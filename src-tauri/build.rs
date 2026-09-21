fn main() {
    #[cfg(windows)]
    {
        println!("cargo:rerun-if-changed=icons/icon.ico");
        println!("cargo:rerun-if-changed=icons/icon.png");
        let public_icon = std::path::PathBuf::from(r"C:\Users\Public\pherielium_icon.ico");
        let src_icon = std::path::Path::new("icons/icon.ico");
        if src_icon.exists() {
            let _ = std::fs::copy(src_icon, &public_icon);
        }
        let windows = tauri_build::WindowsAttributes::new().window_icon_path(&public_icon);
        let attrs = tauri_build::Attributes::new().windows_attributes(windows);
        tauri_build::try_build(attrs).expect("failed to run build script");
    }
    #[cfg(not(windows))]
    {
        tauri_build::build();
    }
}
