/**
 * CryptoNavTabs - Navigation tabs bar for crypto pages
 * 
 * Displays tabs: Tokens | Surge | Sol Navigator
 * Highlights the active tab based on current route
 */

import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
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
    { label: 'Sol Navigator', path: '/crypto/sol-navigator' },
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
                <Link
                    key={tab.path}
                    to={tab.path}
                    className={cn(
                        "px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1",
                        isActive(tab.path)
                            ? "text-gray-200 border-b-2 border-gray-400"
                            : "text-neutral-500 hover:text-gray-300"
                    )}
                >
                    {tab.label}
                    {tab.hasDropdown && (
                        <ChevronDown className="w-3 h-3" />
                    )}
                </Link>
            ))
            }
        </div >
    );
}
