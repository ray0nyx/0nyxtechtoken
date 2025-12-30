import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DiscordWebhookModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave?: (webhookUrl: string) => void;
}

export default function DiscordWebhookModal({
    isOpen,
    onClose,
    onSave,
}: DiscordWebhookModalProps) {
    const [webhookUrl, setWebhookUrl] = useState('');

    // Load saved webhook on mount
    useEffect(() => {
        const saved = localStorage.getItem('discordWebhookUrl');
        if (saved) {
            setWebhookUrl(saved);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        // Save to localStorage
        localStorage.setItem('discordWebhookUrl', webhookUrl);
        onSave?.(webhookUrl);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-md mx-4 bg-[#0a0a0a] border border-neutral-800 rounded-xl shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
                    <h2 className="text-lg font-semibold text-white">Discord Integration</h2>
                    <button onClick={onClose} className="p-2 hover:bg-neutral-800 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-neutral-400 hover:text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Description */}
                    <div className="space-y-1">
                        <p className="text-neutral-300">
                            Enter your Discord webhook URL to receive price alerts.
                        </p>
                        <a
                            href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:text-purple-300 text-sm underline"
                        >
                            Learn how to get your webhook URL
                        </a>
                    </div>

                    {/* Webhook URL Input */}
                    <Input
                        type="url"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        className="w-full bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
                        placeholder="https://discord.com/api/webhooks/..."
                    />

                    {/* Save Button */}
                    <Button
                        onClick={handleSave}
                        className="w-full bg-neutral-400 hover:bg-neutral-500 text-black font-semibold py-3"
                    >
                        Save
                    </Button>
                </div>
            </div>
        </div>
    );
}
