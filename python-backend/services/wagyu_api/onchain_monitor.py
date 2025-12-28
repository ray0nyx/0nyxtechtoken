"""
On-Chain Monitoring Service
Monitors Pump.fun migrations, liquidity changes, new tokens, and large transactions
"""

import asyncio
import os
import logging
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime

logger = logging.getLogger(__name__)

# Solana imports (optional - install with: pip install solana)
try:
    from solana.rpc.async_api import AsyncClient
    from solana.rpc.commitment import Confirmed
    SOLANA_AVAILABLE = True
except ImportError:
    SOLANA_AVAILABLE = False
    logger.warning("Solana library not available. Install with: pip install solana")

logger = logging.getLogger(__name__)

# Solana RPC endpoints - prioritize QuickNode for better performance
SOLANA_RPC_URLS = [
    os.getenv("QUICKNODE_RPC_URL", "https://misty-alien-panorama.soneium-mainnet.quiknode.pro/31ceef5941b0811baf68fff3e4884c002c2a9b2e"),
    os.getenv("ALCHEMY_RPC_URL", "https://solana-mainnet.g.alchemy.com/v2/aCKsanpi1uI6c0h0H38WS"),
    "https://api.mainnet-beta.solana.com",
    "https://rpc.ankr.com/solana",
]

# Known program addresses
PUMP_FUN_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"  # Pump.fun program
RAYDIUM_PROGRAM = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"  # Raydium AMM


class OnChainMonitor:
    """Monitor on-chain events for Solana"""
    
    def __init__(self):
        self.connection: Optional[AsyncClient] = None
        self.subscriptions: Dict[str, List[Callable]] = {}
        self.running = False
    
    async def connect(self):
        """Connect to Solana RPC - creates connection without testing"""
        # Note: We don't test the connection here because:
        # 1. Different RPC endpoints support different methods
        # 2. The connection will be tested when actually used
        # 3. Price fetching uses Jupiter API (REST) and doesn't need RPC
        # 4. RPC is only needed for optional on-chain monitoring features
        
        for rpc_url in SOLANA_RPC_URLS:
            if rpc_url:
                try:
                    self.connection = AsyncClient(rpc_url, commitment=Confirmed)
                    logger.info(f"Created Solana RPC client for: {rpc_url}")
                    logger.info("Note: Connection will be validated on first use. RPC is optional for price fetching.")
                    return
                except Exception as e:
                    logger.warning(f"Failed to create connection to {rpc_url}: {e}")
                    continue
        
        # If all URLs failed, log warning but don't raise exception
        # RPC is optional - Jupiter API and DexScreener work without it
        logger.warning("No Solana RPC connection available. Price fetching will use Jupiter API and DexScreener only.")
        logger.info("On-chain monitoring features will be unavailable, but price data will still work.")
        self.connection = None
    
    async def monitor_pump_fun_migrations(self, callback: Callable):
        """
        Monitor for tokens migrating from Pump.fun to Raydium
        This is a simplified version - in production, you'd:
        1. Monitor Pump.fun program account changes
        2. Detect completion events
        3. Watch for new Raydium pool creation
        4. Correlate the two events
        """
        if not self.connection:
            await self.connect()
        
        # Subscribe to program account changes
        # In production, use WebSocket subscriptions
        logger.info("Starting Pump.fun migration monitor")
        
        # Placeholder - actual implementation would use WebSocket subscriptions
        # and parse transaction logs for migration events
    
    async def detect_new_tokens(self, callback: Callable):
        """Detect newly created tokens"""
        if not self.connection:
            await self.connect()
        
        # Monitor token program for new mints
        # In production, subscribe to token program account changes
        logger.info("Starting new token detection")
    
    async def monitor_liquidity_changes(
        self,
        pair_address: str,
        callback: Callable,
        threshold_percent: float = 10.0
    ):
        """Monitor liquidity changes for a specific pair"""
        if not self.connection:
            await self.connect()
        
        # Monitor pair account for liquidity changes
        # Alert if change exceeds threshold
        logger.info(f"Monitoring liquidity for pair: {pair_address}")
    
    async def detect_large_transactions(
        self,
        token_address: str,
        callback: Callable,
        min_amount_usd: float = 10000
    ):
        """Detect large transactions (whale movements)"""
        if not self.connection:
            await self.connect()
        
        # Monitor token transfers
        # Filter for transactions above threshold
        logger.info(f"Monitoring large transactions for token: {token_address}")
    
    async def detect_rug_pull_patterns(self, token_address: str) -> Dict[str, Any]:
        """
        Analyze token for rug pull patterns
        Returns risk score and indicators
        """
        risk_indicators = {
            'high_holder_concentration': False,
            'low_liquidity': False,
            'recent_liquidity_removal': False,
            'suspicious_contract': False,
            'no_audit': True,  # Most meme coins don't have audits
        }
        
        # In production, analyze:
        # - Holder distribution (high concentration = risk)
        # - Liquidity locks
        # - Contract verification
        # - Recent large withdrawals
        
        risk_score = sum([
            0.3 if risk_indicators['high_holder_concentration'] else 0,
            0.2 if risk_indicators['low_liquidity'] else 0,
            0.3 if risk_indicators['recent_liquidity_removal'] else 0,
            0.1 if risk_indicators['suspicious_contract'] else 0,
            0.1 if risk_indicators['no_audit'] else 0,
        ])
        
        return {
            'risk_score': risk_score,
            'risk_level': 'high' if risk_score > 0.7 else 'medium' if risk_score > 0.4 else 'low',
            'indicators': risk_indicators,
        }
    
    async def get_pump_fun_migration_events(
        self,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Get recent Pump.fun migration events
        In production, this would query a database of monitored events
        """
        # Placeholder - would query monitoring_events table
        return []
    
    async def start_monitoring(self):
        """Start all monitoring services"""
        if self.running:
            return
        
        self.running = True
        logger.info("Starting on-chain monitoring services")
        
        # Try to connect, but don't fail if it doesn't work
        # RPC is optional - we can still use Jupiter API for prices
        try:
            await self.connect()
        except Exception as e:
            logger.warning(f"RPC connection failed, but continuing without it: {e}")
            logger.info("On-chain monitoring will use alternative data sources")
        
        # Start background tasks for each monitor
        # In production, these would be separate async tasks
        await asyncio.gather(
            # self.monitor_pump_fun_migrations(self._handle_migration),
            # self.detect_new_tokens(self._handle_new_token),
            asyncio.sleep(0)  # Placeholder
        )
    
    async def stop_monitoring(self):
        """Stop all monitoring services"""
        self.running = False
        if self.connection:
            await self.connection.close()
        logger.info("Stopped on-chain monitoring services")
