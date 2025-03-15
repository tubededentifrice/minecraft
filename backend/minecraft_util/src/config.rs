use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

/// Loads a configuration file from the specified path
pub fn load_config<T: for<'de> Deserialize<'de>>(path: &Path) -> Result<T> {
    let config_str = fs::read_to_string(path)?;
    let config = serde_json::from_str(&config_str)?;
    Ok(config)
}

/// Saves a configuration file to the specified path
pub fn save_config<T: Serialize>(config: &T, path: &Path) -> Result<()> {
    let config_str = serde_json::to_string_pretty(config)?;
    fs::write(path, config_str)?;
    Ok(())
}

/// Creates a default configuration if none exists
pub fn ensure_config<T: Serialize + for<'de> Deserialize<'de> + Default>(path: &Path) -> Result<T> {
    if !path.exists() {
        let default_config = T::default();
        save_config(&default_config, path)?;
        return Ok(default_config);
    }
    
    load_config(path)
}

/// Server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    /// The port to listen on
    pub port: u16,
    /// The maximum number of players
    pub max_players: usize,
    /// The world seed
    pub seed: Option<String>,
    /// The world size (x, y, z)
    pub world_size: (i32, i32, i32),
    /// The simulation distance (chunks)
    pub simulation_distance: u32,
    /// The view distance (chunks)
    pub view_distance: u32,
    /// Whether to enable PvP
    pub pvp_enabled: bool,
    /// Whether to enable authentication
    pub auth_enabled: bool,
    /// The server name
    pub server_name: String,
    /// The server description
    pub server_description: String,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            port: 8080,
            max_players: 50,
            seed: None,
            world_size: (2000, 256, 2000),
            simulation_distance: 10,
            view_distance: 8,
            pvp_enabled: true,
            auth_enabled: true,
            server_name: "Minecraft Clone Server".to_string(),
            server_description: "A Minecraft clone server".to_string(),
        }
    }
} 