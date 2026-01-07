# OSS Manager CLI

**`oss-cli`** is a high-performance command-line tool designed to provide a Unix-like command experience for S3 storage management. It offers high flexibility, with perfect support for resumable transfers, recursive operations, and multi-account management.

## 📦 Installation Guide

### Windows
Download the latest `.exe` installer from the [Releases](https://github.com/u-00a0/oss-manager/releases) page.

### Linux (Debian/Ubuntu)
Download the `.deb` package and install it:

```bash
sudo dpkg -i oss-manager-cli_x.x.x_amd64.deb
```

### Install from Source
```bash
cargo install --path oss-cli
```

## 🎮 Command Reference

### Account Configuration Management

*   **List Profiles**: `oss-cli profile list`
*   **Interactively Add Profile**: `oss-cli profile add`
*   **Remove Profile**: `oss-cli profile remove <name>`

### Storage Operation Commands

Wildcard syntax: `oss-cli <command> <source> <destination> [options]`

*   **List Buckets**: `oss-cli ls`
*   **List Objects**: `oss-cli ls s3://bucket-name/prefix/`
*   **Copy (Upload/Download)**:
    *   Upload: `oss-cli cp ./local-file.zip s3://my-bucket/backups/`
    *   Download: `oss-cli cp s3://my-bucket/data.csv ./downloads/`
*   **Move/Rename**: `oss-cli mv <src> <dest>`
*   **Delete Object**: `oss-cli rm s3://bucket/key`

### Global Options

*   `--recursive` / `-r`: Recursively process folders and their contents (applies to `cp`, `mv`, `rm`).
*   `--profile` / `-p`: Specify the account name to use for the operation (overrides default).

## 🤖 Automation Support

The CLI follows standard POSIX specifications, outputting results that are clear and easy to process with tools like `grep` or `awk`.

### Exit Codes
*   `0`: Operation completed successfully.
*   `Non-0`: An error occurred (e.g., invalid credentials, network interruption, or path does not exist).
