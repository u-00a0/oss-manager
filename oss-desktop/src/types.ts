export type S3Provider = "Aws" | "CloudflareR2" | "Aliyun" | "Tencent" | "Custom";

export interface Profile {
    provider: S3Provider;
    access_key: string;
    secret_key: string;
    region: string;
    endpoint?: string;
    default_bucket?: string;
}

export interface AppConfig {
    profiles: Profiles;
    language: string;
    default_download_dir: string;
}

export interface FileEntry {
    name: string;
    path: string;
    is_dir: boolean;
    size: number;
    last_modified?: number;
}

export type Profiles = Record<string, Profile>;
