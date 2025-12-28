/**
 * CryptoNavTabs - Navigation tabs bar for crypto pages
 * 
 * Displays tabs: Coins | Surge | DEX Screener | Pump Live
 * Highlights the active tab based on current route
 */

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

interface Tab {
    label: string;
    path: string;
    hasDropdown?: boolean;
}

const TABS: Tab[] = [
    { label: 'Tokens', path: '/crypto/tokens' },
    { label: 'Surge', path: '/crypto/surge' },
    { label: 'DEX Screener', path: '/crypto/solnavigator' },
    { label: 'Explore', path: '/crypto/explore' },
];

export default function CryptoNavTabs() {
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path: string) => {
        return location.pathname === path || location.pathname.startsWith(path + '/');
    };

    return (
        <div className="flex items-center gap-1 px-4 py-2 border-b border-neutral-800 bg-[#0a0a0a]">
            {TABS.map((tab) => (
                <button
                    key={tab.path}
                    onClick={() => navigate(tab.path)}
                    className={cn(
                        "px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1",
                        isActive(tab.path)
                            ? "text-emerald-400 border-b-2 border-emerald-500"
                            : "text-neutral-500 hover:text-gray-300"
                    )}
                >
                    {tab.label}
                    {tab.hasDropdown && (
                        <ChevronDown className="w-3 h-3" />
                    )}
                </button>
            ))}
        </div>
    );
}
