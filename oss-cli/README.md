# OSS Manager CLI

**`oss-cli`** is a powerful command-line interface for managing S3-compatible storage. It provides a Unix-like experience for interacting with cloud buckets and supports advanced features like resumable transfers and multi-profile management.

## Installation

### Windows
Download the latest `.exe` installer from the [Releases](https://github.com/u-00a0/oss-manager/releases) page.

### Linux (Debian/Ubuntu)
Download and install the `.deb` package:

```bash
sudo dpkg -i oss-manager-cli_x.x.x_amd64.deb
```

### From Source
```bash
cargo install --path oss-cli
```

## Command Reference

### Profile Management

*   **List Profiles**: `oss-cli profile list`
*   **Add Profile**: `oss-cli profile add` (Interactive)
*   **Delete Profile**: `oss-cli profile remove <name>`

### File Operations

General syntax: `oss-cli <command> <source> <destination> [options]`

*   **List Buckets**: `oss-cli ls`
*   **List Files**: `oss-cli ls s3://<bucket>/<prefix>`
*   **Copy (Upload/Download)**: 
    *   Upload: `oss-cli cp ./local-file s3://bucket/remote-key`
    *   Download: `oss-cli cp s3://bucket/remote-key ./local-dir`
*   **Move**: `oss-cli mv <src> <dest>`
*   **Remove**: `oss-cli rm s3://bucket/key`

### Options

*   `--recursive` / `-r`: Perform operation recursively (for directories).
*   `--profile` / `-p`: Specify the profile to use (overrides default).

## Automation

The CLI is designed to be script-friendly. Output is formatted for readability by default but can be parsed. Exit codes follow standard conventions (0 for success, non-zero for failure).