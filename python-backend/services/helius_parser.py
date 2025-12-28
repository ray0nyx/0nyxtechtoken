"""
Helius Transaction Parser

Parses Helius enhanced transaction data to detect:
- Swap events (Jupiter, Raydium, Pump.fun)
- Pump.fun -> Raydium migrations
- Large whale transactions
- Rug pull patterns

Reference: https://docs.helius.dev/solana-apis/enhanced-transactions-api
"""

import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict
from enum import Enum
from datetime import datetime

logger = logging.getLogger(__name__)


# ============ Program Addresses ============

class ProgramAddress:
    """Known Solana program addresses"""
    # DEX Programs
    JUPITER_V6 = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"
    JUPITER_DCA = "DCA265Vj8a9CEuX1eb1LWRnDT7uK6q1xMipnNyatn23M"
    RAYDIUM_AMM_V4 = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
    RAYDIUM_CLMM = "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK"
    PUMP_FUN = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
    ORCA_WHIRLPOOL = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"
    
    # Token Programs
    TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
    TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
    
    # System
    SYSTEM_PROGRAM = "11111111111111111111111111111111"


# SOL mint address
SOL_MINT = "So11111111111111111111111111111111111111112"


class SwapSource(str, Enum):
    """Swap source identifiers"""
    JUPITER = "jupiter"
    RAYDIUM = "raydium"
    PUMP_FUN = "pump_fun"
    ORCA = "orca"
    UNKNOWN = "unknown"


class TransactionType(str, Enum):
    """Transaction type categories"""
    SWAP = "swap"
    TRANSFER = "transfer"
    MINT = "mint"
    BURN = "burn"
    LIQUIDITY_ADD = "liquidity_add"
    LIQUIDITY_REMOVE = "liquidity_remove"
    MIGRATION = "migration"
    UNKNOWN = "unknown"


# ============ Data Models ============

@dataclass
class ParsedSwap:
    """Parsed swap event"""
    signature: str
    timestamp: int  # Unix timestamp in seconds
    source: SwapSource
    side: str  # 'buy' or 'sell' (relative to the meme coin)
    
    # Input
    input_mint: str
    input_amount: float
    input_decimals: int
    
    # Output
    output_mint: str
    output_amount: float
    output_decimals: int
    
    # Derived
    price_in_sol: float
    price_in_usd: float  # If available
    
    # Trader info
    trader: str
    fee_amount: float
    fee_payer: str
    
    def to_dict(self) -> dict:
        result = asdict(self)
        result['source'] = self.source.value
        return result


@dataclass
class MigrationEvent:
    """Pump.fun to Raydium migration event"""
    signature: str
    timestamp: int
    token_address: str
    token_symbol: str
    
    # Bonding curve completion
    final_bonding_curve_price: float
    total_supply: int
    
    # Raydium pool creation
    raydium_pool_address: str
    initial_liquidity_sol: float
    initial_liquidity_token: float
    
    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class WhaleAlert:
    """Large transaction alert"""
    signature: str
    timestamp: int
    token_address: str
    trader: str
    side: str
    amount_usd: float
    amount_token: float
    percentage_of_supply: float
    
    def to_dict(self) -> dict:
        return asdict(self)


# ============ Helius Parser Class ============

class HeliusParser:
    """
    Parses Helius enhanced transaction format.
    
    Helius enhanced transactions include:
    - Parsed instructions
    - Token transfer details
    - Account changes
    - DEX-specific metadata
    """
    
    def __init__(self):
        self.sol_price_usd = 150.0  # Default, should be updated from price feed
    
    def set_sol_price(self, price: float):
        """Update SOL price for USD calculations"""
        self.sol_price_usd = price
    
    # ============ Main Parsing Methods ============
    
    def parse_transaction(self, tx: dict) -> Optional[Dict[str, Any]]:
        """
        Parse a Helius enhanced transaction.
        
        Returns a dict with:
        - type: TransactionType
        - data: Parsed event data (ParsedSwap, MigrationEvent, etc.)
        """
        if not tx:
            return None
        
        # Check for swap first (most common)
        swap = self.parse_swap(tx)
        if swap:
            return {"type": TransactionType.SWAP, "data": swap}
        
        # Check for migration
        migration = self.detect_migration(tx)
        if migration:
            return {"type": TransactionType.MIGRATION, "data": migration}
        
        # Check for liquidity events
        liquidity = self.parse_liquidity_event(tx)
        if liquidity:
            return liquidity
        
        return None
    
    def parse_swap(self, tx: dict) -> Optional[ParsedSwap]:
        """
        Parse swap details from a Helius enhanced transaction.
        """
        # Get basic transaction info
        signature = tx.get("signature", "")
        timestamp = tx.get("timestamp", 0)
        fee_payer = tx.get("feePayer", "")
        fee = tx.get("fee", 0)
        
        # Check for Helius swap parsing
        if "events" in tx and "swap" in tx.get("events", {}):
            return self._parse_helius_swap_event(tx)
        
        # Fallback: Parse from instructions
        instructions = tx.get("instructions", [])
        
        for ix in instructions:
            program_id = ix.get("programId", "")
            
            # Jupiter swap
            if self._is_jupiter_program(program_id):
                return self._parse_jupiter_swap(tx, ix)
            
            # Raydium swap
            elif program_id == ProgramAddress.RAYDIUM_AMM_V4:
                return self._parse_raydium_swap(tx, ix)
            
            # Pump.fun swap
            elif program_id == ProgramAddress.PUMP_FUN:
                return self._parse_pump_fun_swap(tx, ix)
        
        # Check inner instructions
        for ix in tx.get("innerInstructions", []):
            for inner_ix in ix.get("instructions", []):
                program_id = inner_ix.get("programId", "")
                
                if self._is_jupiter_program(program_id):
                    return self._parse_jupiter_swap(tx, inner_ix)
        
        return None
    
    def detect_migration(self, tx: dict) -> Optional[MigrationEvent]:
        """
        Detect a Pump.fun -> Raydium migration event.
        
        Migration indicators:
        1. Pump.fun bonding curve completion
        2. Raydium pool creation in same transaction
        3. Large liquidity addition
        """
        instructions = tx.get("instructions", [])
        inner_instructions = tx.get("innerInstructions", [])
        
        has_pump_fun_complete = False
        has_raydium_pool_create = False
        token_address = None
        
        # Check main instructions
        for ix in instructions:
            program_id = ix.get("programId", "")
            
            if program_id == ProgramAddress.PUMP_FUN:
                # Check for completion instruction
                # This would require parsing the instruction data
                # Simplified: check if large SOL transfer to Raydium
                has_pump_fun_complete = True
            
            if program_id == ProgramAddress.RAYDIUM_AMM_V4:
                # Check for pool initialization
                has_raydium_pool_create = True
        
        # Check inner instructions for token transfers
        for ix_group in inner_instructions:
            for ix in ix_group.get("instructions", []):
                if ix.get("programId") == ProgramAddress.TOKEN_PROGRAM:
                    # Look for the token being transferred
                    pass
        
        if has_pump_fun_complete and has_raydium_pool_create:
            return MigrationEvent(
                signature=tx.get("signature", ""),
                timestamp=tx.get("timestamp", 0),
                token_address=token_address or "",
                token_symbol="",
                final_bonding_curve_price=0,
                total_supply=0,
                raydium_pool_address="",
                initial_liquidity_sol=0,
                initial_liquidity_token=0,
            )
        
        return None
    
    def parse_liquidity_event(self, tx: dict) -> Optional[Dict[str, Any]]:
        """Parse liquidity add/remove events"""
        instructions = tx.get("instructions", [])
        
        for ix in instructions:
            program_id = ix.get("programId", "")
            
            if program_id == ProgramAddress.RAYDIUM_AMM_V4:
                # Check instruction type for add/remove liquidity
                # This requires parsing the instruction data
                pass
        
        return None
    
    def check_whale_transaction(
        self,
        swap: ParsedSwap,
        total_supply: int,
        threshold_usd: float = 10000
    ) -> Optional[WhaleAlert]:
        """
        Check if a swap qualifies as a whale transaction.
        """
        amount_usd = swap.price_in_usd * swap.output_amount
        
        if amount_usd < threshold_usd:
            return None
        
        percentage = (swap.output_amount / total_supply) * 100 if total_supply > 0 else 0
        
        return WhaleAlert(
            signature=swap.signature,
            timestamp=swap.timestamp,
            token_address=swap.output_mint,
            trader=swap.trader,
            side=swap.side,
            amount_usd=amount_usd,
            amount_token=swap.output_amount,
            percentage_of_supply=percentage,
        )
    
    # ============ Private Parsing Methods ============
    
    def _parse_helius_swap_event(self, tx: dict) -> Optional[ParsedSwap]:
        """Parse from Helius's pre-parsed swap event"""
        swap_event = tx.get("events", {}).get("swap")
        
        if not swap_event:
            return None
        
        native_input = swap_event.get("nativeInput")
        native_output = swap_event.get("nativeOutput")
        token_inputs = swap_event.get("tokenInputs", [])
        token_outputs = swap_event.get("tokenOutputs", [])
        
        # Determine input/output
        input_mint = SOL_MINT if native_input else (token_inputs[0].get("mint") if token_inputs else "")
        output_mint = SOL_MINT if native_output else (token_outputs[0].get("mint") if token_outputs else "")
        
        input_amount = (
            native_input.get("amount", 0) / 1e9 if native_input
            else token_inputs[0].get("rawTokenAmount", {}).get("tokenAmount", 0) if token_inputs
            else 0
        )
        
        output_amount = (
            native_output.get("amount", 0) / 1e9 if native_output
            else token_outputs[0].get("rawTokenAmount", {}).get("tokenAmount", 0) if token_outputs
            else 0
        )
        
        # Determine side (buy = SOL -> Token, sell = Token -> SOL)
        side = "buy" if input_mint == SOL_MINT else "sell"
        
        # Calculate price
        if side == "buy" and output_amount > 0:
            price_in_sol = input_amount / output_amount
        elif side == "sell" and input_amount > 0:
            price_in_sol = output_amount / input_amount
        else:
            price_in_sol = 0
        
        return ParsedSwap(
            signature=tx.get("signature", ""),
            timestamp=tx.get("timestamp", 0),
            source=self._detect_swap_source(tx),
            side=side,
            input_mint=input_mint,
            input_amount=input_amount,
            input_decimals=9 if input_mint == SOL_MINT else 6,
            output_mint=output_mint,
            output_amount=output_amount,
            output_decimals=9 if output_mint == SOL_MINT else 6,
            price_in_sol=price_in_sol,
            price_in_usd=price_in_sol * self.sol_price_usd,
            trader=tx.get("feePayer", ""),
            fee_amount=tx.get("fee", 0) / 1e9,
            fee_payer=tx.get("feePayer", ""),
        )
    
    def _parse_jupiter_swap(self, tx: dict, ix: dict) -> Optional[ParsedSwap]:
        """Parse Jupiter swap instruction"""
        # Jupiter swaps can be complex with multiple routes
        # We extract from token transfers in inner instructions
        
        token_transfers = self._extract_token_transfers(tx)
        
        if len(token_transfers) < 2:
            return None
        
        # First transfer is usually input, last is output
        input_transfer = token_transfers[0]
        output_transfer = token_transfers[-1]
        
        input_mint = input_transfer.get("mint", "")
        output_mint = output_transfer.get("mint", "")
        input_amount = input_transfer.get("tokenAmount", 0)
        output_amount = output_transfer.get("tokenAmount", 0)
        
        side = "buy" if input_mint == SOL_MINT else "sell"
        
        if side == "buy" and output_amount > 0:
            price_in_sol = input_amount / output_amount
        elif side == "sell" and input_amount > 0:
            price_in_sol = output_amount / input_amount
        else:
            price_in_sol = 0
        
        return ParsedSwap(
            signature=tx.get("signature", ""),
            timestamp=tx.get("timestamp", 0),
            source=SwapSource.JUPITER,
            side=side,
            input_mint=input_mint,
            input_amount=input_amount,
            input_decimals=input_transfer.get("decimals", 9),
            output_mint=output_mint,
            output_amount=output_amount,
            output_decimals=output_transfer.get("decimals", 9),
            price_in_sol=price_in_sol,
            price_in_usd=price_in_sol * self.sol_price_usd,
            trader=tx.get("feePayer", ""),
            fee_amount=tx.get("fee", 0) / 1e9,
            fee_payer=tx.get("feePayer", ""),
        )
    
    def _parse_raydium_swap(self, tx: dict, ix: dict) -> Optional[ParsedSwap]:
        """Parse Raydium AMM swap instruction"""
        token_transfers = self._extract_token_transfers(tx)
        
        if len(token_transfers) < 2:
            return None
        
        # Similar logic to Jupiter
        input_transfer = token_transfers[0]
        output_transfer = token_transfers[-1]
        
        input_mint = input_transfer.get("mint", "")
        output_mint = output_transfer.get("mint", "")
        input_amount = input_transfer.get("tokenAmount", 0)
        output_amount = output_transfer.get("tokenAmount", 0)
        
        side = "buy" if input_mint == SOL_MINT else "sell"
        
        if side == "buy" and output_amount > 0:
            price_in_sol = input_amount / output_amount
        elif side == "sell" and input_amount > 0:
            price_in_sol = output_amount / input_amount
        else:
            price_in_sol = 0
        
        return ParsedSwap(
            signature=tx.get("signature", ""),
            timestamp=tx.get("timestamp", 0),
            source=SwapSource.RAYDIUM,
            side=side,
            input_mint=input_mint,
            input_amount=input_amount,
            input_decimals=input_transfer.get("decimals", 9),
            output_mint=output_mint,
            output_amount=output_amount,
            output_decimals=output_transfer.get("decimals", 9),
            price_in_sol=price_in_sol,
            price_in_usd=price_in_sol * self.sol_price_usd,
            trader=tx.get("feePayer", ""),
            fee_amount=tx.get("fee", 0) / 1e9,
            fee_payer=tx.get("feePayer", ""),
        )
    
    def _parse_pump_fun_swap(self, tx: dict, ix: dict) -> Optional[ParsedSwap]:
        """Parse Pump.fun bonding curve swap"""
        token_transfers = self._extract_token_transfers(tx)
        
        if len(token_transfers) < 2:
            return None
        
        input_transfer = token_transfers[0]
        output_transfer = token_transfers[-1]
        
        input_mint = input_transfer.get("mint", "")
        output_mint = output_transfer.get("mint", "")
        input_amount = input_transfer.get("tokenAmount", 0)
        output_amount = output_transfer.get("tokenAmount", 0)
        
        side = "buy" if input_mint == SOL_MINT else "sell"
        
        if side == "buy" and output_amount > 0:
            price_in_sol = input_amount / output_amount
        elif side == "sell" and input_amount > 0:
            price_in_sol = output_amount / input_amount
        else:
            price_in_sol = 0
        
        return ParsedSwap(
            signature=tx.get("signature", ""),
            timestamp=tx.get("timestamp", 0),
            source=SwapSource.PUMP_FUN,
            side=side,
            input_mint=input_mint,
            input_amount=input_amount,
            input_decimals=input_transfer.get("decimals", 9),
            output_mint=output_mint,
            output_amount=output_amount,
            output_decimals=output_transfer.get("decimals", 9),
            price_in_sol=price_in_sol,
            price_in_usd=price_in_sol * self.sol_price_usd,
            trader=tx.get("feePayer", ""),
            fee_amount=tx.get("fee", 0) / 1e9,
            fee_payer=tx.get("feePayer", ""),
        )
    
    # ============ Helper Methods ============
    
    def _is_jupiter_program(self, program_id: str) -> bool:
        """Check if program is Jupiter"""
        return program_id in [
            ProgramAddress.JUPITER_V6,
            ProgramAddress.JUPITER_DCA,
        ] or "Jupiter" in program_id
    
    def _detect_swap_source(self, tx: dict) -> SwapSource:
        """Detect the swap source from transaction"""
        instructions = tx.get("instructions", [])
        
        for ix in instructions:
            program_id = ix.get("programId", "")
            
            if self._is_jupiter_program(program_id):
                return SwapSource.JUPITER
            elif program_id == ProgramAddress.RAYDIUM_AMM_V4:
                return SwapSource.RAYDIUM
            elif program_id == ProgramAddress.PUMP_FUN:
                return SwapSource.PUMP_FUN
            elif program_id == ProgramAddress.ORCA_WHIRLPOOL:
                return SwapSource.ORCA
        
        return SwapSource.UNKNOWN
    
    def _extract_token_transfers(self, tx: dict) -> List[dict]:
        """Extract token transfers from transaction"""
        transfers = []
        
        # Check tokenTransfers from Helius
        if "tokenTransfers" in tx:
            for transfer in tx["tokenTransfers"]:
                transfers.append({
                    "mint": transfer.get("mint", ""),
                    "tokenAmount": transfer.get("tokenAmount", 0),
                    "decimals": transfer.get("decimals", 9),
                    "fromUserAccount": transfer.get("fromUserAccount", ""),
                    "toUserAccount": transfer.get("toUserAccount", ""),
                })
        
        # Also check nativeTransfers
        if "nativeTransfers" in tx:
            for transfer in tx["nativeTransfers"]:
                transfers.append({
                    "mint": SOL_MINT,
                    "tokenAmount": transfer.get("amount", 0) / 1e9,
                    "decimals": 9,
                    "fromUserAccount": transfer.get("fromUserAccount", ""),
                    "toUserAccount": transfer.get("toUserAccount", ""),
                })
        
        return transfers


# ============ Singleton Instance ============

_parser_instance: Optional[HeliusParser] = None


def get_helius_parser() -> HeliusParser:
    """Get or create the Helius parser singleton"""
    global _parser_instance
    
    if _parser_instance is None:
        _parser_instance = HeliusParser()
    
    return _parser_instance





