"""
Priority Fee & Compute Unit Service

Calculates optimal priority fees and compute units for Solana transactions.

Features:
- Dynamic priority fee calculation based on network conditions
- Compute unit optimization
- Fee estimation for different priority levels
"""

import asyncio
import logging
import time
from typing import Dict, Optional, List
from dataclasses import dataclass
from enum import Enum

import aiohttp
from solana.rpc.async_api import AsyncClient
from solana.rpc.commitment import Confirmed

logger = logging.getLogger(__name__)


class PriorityLevel(str, Enum):
    """Transaction priority levels"""
    LOW = "low"  # 0.00001 SOL
    MEDIUM = "medium"  # 0.0001 SOL
    HIGH = "high"  # 0.001 SOL
    VERY_HIGH = "very_high"  # 0.01 SOL


@dataclass
class FeeEstimate:
    """Priority fee estimate"""
    priority_fee_lamports: int
    compute_units: int
    total_fee_lamports: int
    total_fee_sol: float
    level: PriorityLevel
    estimated_confirmation_time_ms: int


class PriorityFeeService:
    """
    Calculates optimal priority fees for Solana transactions.
    
    Features:
    - Dynamic fee calculation based on recent block fees
    - Compute unit estimation
    - Priority level selection
    """
    
    # Base fees (in lamports)
    BASE_FEE_LAMPORTS = 5000  # Base transaction fee
    
    # Priority fee ranges (in lamports)
    PRIORITY_FEE_RANGES = {
        PriorityLevel.LOW: (10_000, 50_000),  # 0.00001 - 0.00005 SOL
        PriorityLevel.MEDIUM: (50_000, 100_000),  # 0.00005 - 0.0001 SOL
        PriorityLevel.HIGH: (100_000, 1_000_000),  # 0.0001 - 0.001 SOL
        PriorityLevel.VERY_HIGH: (1_000_000, 10_000_000),  # 0.001 - 0.01 SOL
    }
    
    # Default compute units for swap transactions
    DEFAULT_COMPUTE_UNITS = 200_000
    MAX_COMPUTE_UNITS = 1_400_000
    
    def __init__(self, rpc_url: str):
        self.rpc_url = rpc_url
        self.client: Optional[AsyncClient] = None
        self.recent_fees: List[int] = []  # Track recent priority fees
        self._session: Optional[aiohttp.ClientSession] = None
    
    async def start(self):
        """Start the service"""
        self.client = AsyncClient(self.rpc_url, commitment=Confirmed)
        self._session = aiohttp.ClientSession()
        logger.info("PriorityFeeService started")
    
    async def stop(self):
        """Stop the service"""
        if self.client:
            await self.client.close()
        if self._session:
            await self._session.close()
        logger.info("PriorityFeeService stopped")
    
    async def get_fee_estimate(
        self,
        priority_level: PriorityLevel = PriorityLevel.MEDIUM,
        compute_units: Optional[int] = None
    ) -> FeeEstimate:
        """
        Get fee estimate for a transaction.
        
        Args:
            priority_level: Desired priority level
            compute_units: Estimated compute units (uses default if not provided)
        
        Returns:
            FeeEstimate with all fee information
        """
        if compute_units is None:
            compute_units = self.DEFAULT_COMPUTE_UNITS
        
        # Get recent priority fees to determine optimal fee
        recent_fee = await self._get_recent_priority_fee()
        
        # Calculate priority fee based on level and recent fees
        priority_fee = self._calculate_priority_fee(priority_level, recent_fee)
        
        # Total fee = base fee + (priority fee * compute units / 1M)
        # Priority fee is per compute unit, so multiply by compute units
        priority_fee_total = int((priority_fee * compute_units) / 1_000_000)
        total_fee = self.BASE_FEE_LAMPORTS + priority_fee_total
        
        # Estimate confirmation time based on priority level
        confirmation_time = self._estimate_confirmation_time(priority_level)
        
        return FeeEstimate(
            priority_fee_lamports=priority_fee,
            compute_units=compute_units,
            total_fee_lamports=total_fee,
            total_fee_sol=total_fee / 1e9,
            level=priority_level,
            estimated_confirmation_time_ms=confirmation_time
        )
    
    async def get_optimal_fee(self, max_wait_time_ms: int = 1000) -> FeeEstimate:
        """
        Get optimal fee estimate for a given max wait time.
        
        Automatically selects priority level based on desired confirmation time.
        """
        if max_wait_time_ms < 500:
            level = PriorityLevel.VERY_HIGH
        elif max_wait_time_ms < 1000:
            level = PriorityLevel.HIGH
        elif max_wait_time_ms < 2000:
            level = PriorityLevel.MEDIUM
        else:
            level = PriorityLevel.LOW
        
        return await self.get_fee_estimate(level)
    
    async def _get_recent_priority_fee(self) -> int:
        """Get recent priority fee from network"""
        if not self.client:
            # Fallback to default
            return self.PRIORITY_FEE_RANGES[PriorityLevel.MEDIUM][0]
        
        try:
            # Get recent block with priority fees
            # This is a simplified version - in production, you'd analyze recent blocks
            # For now, return a reasonable default
            return self.PRIORITY_FEE_RANGES[PriorityLevel.MEDIUM][0]
        except Exception as e:
            logger.debug(f"Failed to get recent priority fee: {e}")
            return self.PRIORITY_FEE_RANGES[PriorityLevel.MEDIUM][0]
    
    def _calculate_priority_fee(self, level: PriorityLevel, recent_fee: int) -> int:
        """Calculate priority fee based on level and recent network fees"""
        min_fee, max_fee = self.PRIORITY_FEE_RANGES[level]
        
        # Use recent fee if within range, otherwise use range midpoint
        if min_fee <= recent_fee <= max_fee:
            return recent_fee
        else:
            return (min_fee + max_fee) // 2
    
    def _estimate_confirmation_time(self, level: PriorityLevel) -> int:
        """Estimate confirmation time in milliseconds"""
        times = {
            PriorityLevel.LOW: 2000,
            PriorityLevel.MEDIUM: 1000,
            PriorityLevel.HIGH: 500,
            PriorityLevel.VERY_HIGH: 200,
        }
        return times.get(level, 1000)
    
    async def estimate_compute_units(self, transaction_type: str = "swap") -> int:
        """Estimate compute units for a transaction type"""
        estimates = {
            "swap": 200_000,
            "swap_jupiter": 200_000,
            "swap_raydium": 150_000,
            "swap_pump_fun": 100_000,
            "transfer": 5_000,
        }
        return estimates.get(transaction_type, self.DEFAULT_COMPUTE_UNITS)


# Singleton instance
_priority_fee_service: Optional[PriorityFeeService] = None


async def get_priority_fee_service() -> PriorityFeeService:
    """Get or create the priority fee service singleton"""
    global _priority_fee_service
    
    if _priority_fee_service is None:
        from config import settings
        rpc_url = getattr(settings, 'solana_rpc_url', 'https://api.mainnet-beta.solana.com')
        _priority_fee_service = PriorityFeeService(rpc_url)
        await _priority_fee_service.start()
    
    return _priority_fee_service
