/**
 * Wallet Connect Button
 * 
 * A button component that shows wallet connection status and allows
 * connecting/disconnecting Turnkey wallets.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Wallet, Copy, ExternalLink, LogOut, Loader2, Plus } from 'lucide-react';
import { useTurnkeyWallet } from '@/lib/wallet-abstraction/TurnkeyWalletContext';
import { toast } from 'sonner';

interface WalletConnectButtonProps {
    onCreateWallet?: () => void;
    className?: string;
}

export function WalletConnectButton({ onCreateWallet, className }: WalletConnectButtonProps) {
    const {
        connected,
        connecting,
        loading,
        address,
        connect,
        disconnect,
        isConfigured,
    } = useTurnkeyWallet();

    const shortenAddress = (addr: string) => {
        return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
    };

    const copyAddress = async () => {
        if (address) {
            await navigator.clipboard.writeText(address);
            toast.success('Address copied to clipboard');
        }
    };

    const openExplorer = () => {
        if (address) {
            window.open(`https://solscan.io/account/${address}`, '_blank');
        }
    };

    // Loading state
    if (loading) {
        return (
            <Button disabled className={className} variant="outline">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading Wallet...
            </Button>
        );
    }

    // Connecting state
    if (connecting) {
        return (
            <Button disabled className={className} variant="outline">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Connecting...
            </Button>
        );
    }

    // Connected state - show dropdown with options
    if (connected && address) {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className={className}>
                        <Wallet className="h-4 w-4 mr-2 text-green-500" />
                        {shortenAddress(address)}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={copyAddress}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Address
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={openExplorer}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View on Solscan
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={disconnect} className="text-red-500">
                        <LogOut className="h-4 w-4 mr-2" />
                        Disconnect
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

    // Not connected - show connect/create button
    if (!isConfigured) {
        return (
            <Button
                variant="outline"
                className={className}
                disabled
                title="Turnkey not configured"
            >
                <Wallet className="h-4 w-4 mr-2" />
                Wallet Unavailable
            </Button>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className={className}>
                    <Wallet className="h-4 w-4 mr-2" />
                    Connect Wallet
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={connect}>
                    <Wallet className="h-4 w-4 mr-2" />
                    Load Existing Wallet
                </DropdownMenuItem>
                {onCreateWallet && (
                    <DropdownMenuItem onClick={onCreateWallet}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create New Wallet
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default WalletConnectButton;
