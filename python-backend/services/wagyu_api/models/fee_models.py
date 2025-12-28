"""
Fee structure models for WagyuTech API
"""

from pydantic import BaseModel
from decimal import Decimal
from typing import Dict


class FeeStructure(BaseModel):
    """Fee structure for a tier"""
    tier: str
    api_calls_per_hour: int
    api_calls_per_minute: int
    trading_fees: Dict[str, Decimal]  # {order_type: fee_percentage}
    features: list[str]


# Fee configurations
FEE_STRUCTURES = {
    'free': FeeStructure(
        tier='free',
        api_calls_per_hour=100,
        api_calls_per_minute=10,
        trading_fees={},  # No trading access
        features=['read_only', 'basic_data']
    ),
    'pro': FeeStructure(
        tier='pro',
        api_calls_per_hour=1000,
        api_calls_per_minute=100,
        trading_fees={
            'market': Decimal('0.005'),  # 0.5%
            'limit': Decimal('0.004'),    # 0.4%
            'stop_loss': Decimal('0.005'), # 0.5%
            'take_profit': Decimal('0.005') # 0.5%
        },
        features=['all_data', 'trading', 'social_monitoring_limited', 'price_alerts']
    ),
    'enterprise': FeeStructure(
        tier='enterprise',
        api_calls_per_hour=10000,
        api_calls_per_minute=1000,
        trading_fees={
            'market': Decimal('0.003'),  # 0.3%
            'limit': Decimal('0.002'),   # 0.2%
            'stop_loss': Decimal('0.003'), # 0.3%
            'take_profit': Decimal('0.003') # 0.3%
        },
        features=['all_data', 'trading', 'social_monitoring', 'onchain_monitoring', 
                 'webhooks', 'priority_support', 'custom_integrations']
    )
}


def get_fee_structure(tier: str) -> FeeStructure:
    """Get fee structure for a tier"""
    return FEE_STRUCTURES.get(tier, FEE_STRUCTURES['free'])


def calculate_trading_fee(order_amount: Decimal, order_type: str, tier: str) -> Decimal:
    """Calculate trading fee for an order"""
    fee_structure = get_fee_structure(tier)
    
    if tier == 'free':
        raise ValueError("Free tier does not have trading access")
    
    fee_rate = fee_structure.trading_fees.get(order_type)
    if not fee_rate:
        raise ValueError(f"Invalid order type: {order_type}")
    
    return order_amount * fee_rate
