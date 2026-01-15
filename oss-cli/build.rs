fn main() {
    if cfg!(target_os = "windows") {
        let mut res = winres::WindowsResource::new();

        // Metadata
        res.set("ProductName", "OSS Manager CLI");
        res.set(
            "FileDescription",
            "A powerful file management tool for S3 compatible Object Storage Services.",
        );
        res.set(
            "LegalCopyright",
            "© 2026 OSS Manager Contributors. Some rights reserved.",
        );
        res.set("CompanyName", "u202f");
        res.set("InternalName", "oss-cli.exe");
        res.set("OriginalFilename", "oss-cli.exe");

        // Version info (synced from Cargo.toml)
        let version = env!("CARGO_PKG_VERSION");
        res.set("ProductVersion", version);
        res.set("FileVersion", version);

        // Icon (optional - if you have an icon file in oss-cli directory)
        // res.set_icon("icon.ico");

        res.compile().unwrap();
    }
}
