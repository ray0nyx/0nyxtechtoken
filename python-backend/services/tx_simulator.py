"""
Transaction Simulator

Pre-execution simulation of Solana transactions to predict failures.

Features:
- Transaction simulation before execution
- Failure prediction
- Gas/compute unit estimation
- Slippage validation
"""

import asyncio
import logging
from typing import Dict, Optional, List
from dataclasses import dataclass
from enum import Enum

from solana.rpc.async_api import AsyncClient
from solana.rpc.commitment import Confirmed
from solana.rpc.types import TxOpts
import base64

logger = logging.getLogger(__name__)


class SimulationResult(str, Enum):
    """Simulation result status"""
    SUCCESS = "success"
    FAILURE = "failure"
    INSUFFICIENT_FUNDS = "insufficient_funds"
    SLIPPAGE_EXCEEDED = "slippage_exceeded"
    INVALID_TOKEN = "invalid_token"
    UNKNOWN_ERROR = "unknown_error"


@dataclass
class SimulationReport:
    """Transaction simulation report"""
    result: SimulationResult
    error: Optional[str] = None
    estimated_compute_units: Optional[int] = None
    estimated_fee_lamports: Optional[int] = None
    logs: List[str] = None
    will_succeed: bool = False


class TransactionSimulator:
    """
    Simulates Solana transactions before execution.
    
    Features:
    - Pre-execution simulation
    - Failure prediction
    - Compute unit estimation
    - Log analysis
    """
    
    def __init__(self, rpc_url: str):
        self.rpc_url = rpc_url
        self.client: Optional[AsyncClient] = None
    
    async def start(self):
        """Start the simulator"""
        self.client = AsyncClient(self.rpc_url, commitment=Confirmed)
        logger.info("TransactionSimulator started")
    
    async def stop(self):
        """Stop the simulator"""
        if self.client:
            await self.client.close()
        logger.info("TransactionSimulator stopped")
    
    async def simulate_transaction(
        self,
        transaction_base64: str,
        commitment: str = "confirmed"
    ) -> SimulationReport:
        """
        Simulate a transaction before execution.
        
        Args:
            transaction_base64: Base64-encoded transaction
            commitment: Commitment level for simulation
        
        Returns:
            SimulationReport with results
        """
        if not self.client:
            return SimulationReport(
                result=SimulationResult.UNKNOWN_ERROR,
                error="RPC client not initialized",
                will_succeed=False
            )
        
        try:
            # Decode transaction
            tx_bytes = base64.b64decode(transaction_base64)
            
            # Simulate transaction
            opts = TxOpts(
                skip_preflight=True,  # Skip preflight to get accurate simulation
                max_retries=0
            )
            
            result = await self.client.simulate_transaction(
                tx_bytes,
                commitment=commitment,
                sig_verify=False  # Don't verify signatures in simulation
            )
            
            if result.value.err:
                # Transaction would fail
                error_str = str(result.value.err)
                
                # Classify error
                if "insufficient" in error_str.lower() or "funds" in error_str.lower():
                    sim_result = SimulationResult.INSUFFICIENT_FUNDS
                elif "slippage" in error_str.lower():
                    sim_result = SimulationResult.SLIPPAGE_EXCEEDED
                elif "invalid" in error_str.lower() or "mint" in error_str.lower():
                    sim_result = SimulationResult.INVALID_TOKEN
                else:
                    sim_result = SimulationResult.FAILURE
                
                return SimulationReport(
                    result=sim_result,
                    error=error_str,
                    estimated_compute_units=result.value.units_consumed,
                    logs=result.value.logs or [],
                    will_succeed=False
                )
            else:
                # Transaction would succeed
                return SimulationReport(
                    result=SimulationResult.SUCCESS,
                    estimated_compute_units=result.value.units_consumed,
                    logs=result.value.logs or [],
                    will_succeed=True
                )
        
        except Exception as e:
            logger.error(f"Simulation error: {e}")
            return SimulationReport(
                result=SimulationResult.UNKNOWN_ERROR,
                error=str(e),
                will_succeed=False
            )
    
    async def estimate_compute_units(self, transaction_base64: str) -> Optional[int]:
        """Estimate compute units for a transaction"""
        report = await self.simulate_transaction(transaction_base64)
        return report.estimated_compute_units
    
    def analyze_logs(self, logs: List[str]) -> Dict[str, any]:
        """Analyze transaction logs for errors and warnings"""
        errors = []
        warnings = []
        
        for log in logs:
            if "error" in log.lower():
                errors.append(log)
            elif "warning" in log.lower() or "slippage" in log.lower():
                warnings.append(log)
        
        return {
            "errors": errors,
            "warnings": warnings,
            "has_errors": len(errors) > 0,
            "has_warnings": len(warnings) > 0
        }


# Singleton instance
_tx_simulator: Optional[TransactionSimulator] = None


async def get_tx_simulator() -> TransactionSimulator:
    """Get or create the transaction simulator singleton"""
    global _tx_simulator
    
    if _tx_simulator is None:
        from config import settings
        rpc_url = getattr(settings, 'solana_rpc_url', 'https://api.mainnet-beta.solana.com')
        _tx_simulator = TransactionSimulator(rpc_url)
        await _tx_simulator.start()
    
    return _tx_simulator
