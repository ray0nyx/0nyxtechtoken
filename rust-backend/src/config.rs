use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub rpc: RpcConfig,
    pub redis: RedisConfig,
    pub turnkey: TurnkeyConfig,
    pub server: ServerConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcConfig {
    pub primary: String,
    pub private: Option<String>,
    pub fallbacks: Vec<String>,
    pub pool_size: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedisConfig {
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurnkeyConfig {
    pub api_key: Option<String>,
    pub api_secret: Option<String>,
    pub organization_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

impl Config {
    pub async fn load() -> anyhow::Result<Self> {
        dotenv::dotenv().ok();

        let rpc = RpcConfig {
            primary: env::var("QUICKNODE_RPC_URL")
                .or_else(|_| env::var("ALCHEMY_RPC_URL"))
                .unwrap_or_else(|_| "https://api.mainnet-beta.solana.com".to_string()),
            private: env::var("PRIVATE_RPC_URL").ok(),
            fallbacks: vec![
                "https://api.mainnet-beta.solana.com".to_string(),
                "https://rpc.ankr.com/solana".to_string(),
            ],
            pool_size: env::var("RPC_POOL_SIZE")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(10),
        };

        let redis = RedisConfig {
            url: env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string()),
        };

        let turnkey = TurnkeyConfig {
            api_key: env::var("TURNKEY_API_KEY").ok(),
            api_secret: env::var("TURNKEY_API_SECRET").ok(),
            organization_id: env::var("TURNKEY_ORGANIZATION_ID").ok(),
        };

        let server = ServerConfig {
            host: env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            port: env::var("PORT")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(8002),
        };

        Ok(Config {
            rpc,
            redis,
            turnkey,
            server,
        })
    }
}
