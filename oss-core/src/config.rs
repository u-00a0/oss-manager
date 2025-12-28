use crate::S3Provider;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Profile {
    pub provider: S3Provider,
    pub access_key: String,
    pub secret_key: String,
    pub region: String,
    pub endpoint: Option<String>,
    pub default_bucket: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct ConfigManager {
    pub profiles: HashMap<String, Profile>,
}

impl ConfigManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn load_from_file<P: AsRef<Path>>(path: P) -> Result<Self> {
        if !path.as_ref().exists() {
            return Ok(Self::default());
        }
        let content = fs::read_to_string(path).context("Failed to read config file")?;
        let config = serde_json::from_str(&content).context("Failed to parse config JSON")?;
        Ok(config)
    }

    pub fn save_to_file<P: AsRef<Path>>(&self, path: P) -> Result<()> {
        let content = serde_json::to_string_pretty(self).context("Failed to serialize config")?;
        if let Some(parent) = path.as_ref().parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(path, content).context("Failed to write config file")?;
        Ok(())
    }

    pub fn get_profile(&self, name: &str) -> Option<&Profile> {
        self.profiles.get(name)
    }

    pub fn add_profile(&mut self, name: String, profile: Profile) {
        self.profiles.insert(name, profile);
    }
}
