"""
Trading Service with Fee Calculation
Executes trades through Jupiter/Raydium with lower fees than Axiom Pro
"""

import os
import logging
from typing import Optional, Dict, Any
from decimal import Decimal
from datetime import datetime
import aiohttp
from .models.fee_models import calculate_trading_fee, get_fee_structure
from .billing_service import BillingService

logger = logging.getLogger(__name__)

JUPITER_API_URL = "https://quote-api.jup.ag/v6"
JUPITER_SWAP_API_URL = "https://quote-api.jup.ag/v6/swap"

billing_service = BillingService()


class TradingService:
    """Trading execution service with fee calculation"""
    
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def execute_market_order(
        self,
        user_id: str,
        api_key_id: Optional[str],
        pair_symbol: str,
        side: str,  # 'buy' or 'sell'
        amount: Decimal,
        slippage_tolerance: Decimal = Decimal("0.01"),
        wallet_address: Optional[str] = None,
        user_tier: str = "pro"
    ) -> Dict[str, Any]:
        """
        Execute a market order with fee calculation
        Returns order details including fees
        """
        # Calculate trading fee
        try:
            fee_percentage = get_fee_structure(user_tier).trading_fees.get('market')
            if not fee_percentage:
                raise ValueError(f"Trading not available for tier: {user_tier}")
            
            fee_amount = calculate_trading_fee(amount, 'market', user_tier)
            
            # For now, return order details (actual execution would go through Jupiter)
            # In production, this would:
            # 1. Get quote from Jupiter
            # 2. Apply fee
            # 3. Execute swap transaction
            # 4. Return transaction hash
            
            order_id = f"order_{datetime.now().timestamp()}"
            
            # Record fee
            await billing_service.record_trading_fee(
                user_id=user_id,
                api_key_id=api_key_id,
                order_id=order_id,
                pair_symbol=pair_symbol,
                order_type='market',
                order_amount=amount,
                fee_amount=fee_amount,
                fee_percentage=fee_percentage,
                user_tier=user_tier,
            )
            
            return {
                'order_id': order_id,
                'status': 'pending',  # Would be 'executed' after actual swap
                'pair_symbol': pair_symbol,
                'order_type': 'market',
                'side': side,
                'amount': float(amount),
                'fee_amount': float(fee_amount),
                'fee_percentage': float(fee_percentage),
                'fee_percentage_display': f"{float(fee_percentage) * 100:.2f}%",
                'created_at': datetime.now().isoformat(),
            }
        except Exception as e:
            logger.error(f"Error executing market order: {e}")
            raise
    
    async def create_limit_order(
        self,
        user_id: str,
        api_key_id: Optional[str],
        pair_symbol: str,
        side: str,
        amount: Decimal,
        price: Decimal,
        user_tier: str = "pro"
    ) -> Dict[str, Any]:
        """Create a limit order"""
        fee_percentage = get_fee_structure(user_tier).trading_fees.get('limit')
        if not fee_percentage:
            raise ValueError(f"Trading not available for tier: {user_tier}")
        
        fee_amount = calculate_trading_fee(amount, 'limit', user_tier)
        
        order_id = f"order_{datetime.now().timestamp()}"
        
        return {
            'order_id': order_id,
            'status': 'pending',
            'pair_symbol': pair_symbol,
            'order_type': 'limit',
            'side': side,
            'amount': float(amount),
            'price': float(price),
            'fee_amount': float(fee_amount),
            'fee_percentage': float(fee_percentage),
            'created_at': datetime.now().isoformat(),
        }
    
    async def get_jupiter_quote(
        self,
        input_mint: str,
        output_mint: str,
        amount: int,  # Amount in smallest unit (lamports for SOL)
        slippage_bps: int = 50  # 0.5% default slippage
    ) -> Optional[Dict[str, Any]]:
        """Get quote from Jupiter API"""
        if not self.session:
            return None
        
        try:
            url = f"{JUPITER_API_URL}/quote"
            params = {
                'inputMint': input_mint,
                'outputMint': output_mint,
                'amount': amount,
                'slippageBps': slippage_bps,
            }
            
            async with self.session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    return await response.json()
        except Exception as e:
            logger.error(f"Error getting Jupiter quote: {e}")
        
        return None
