/**
 * Discord Webhook Service
 * Sends notifications to Discord when token alerts are triggered.
 */

export interface DiscordAlertPayload {
    tokenSymbol: string;
    alertType: 'above' | 'below' | 'migration';
    targetValue: number;
    currentValue?: number;
    message?: string;
}

/**
 * Sends an alert notification to the user's saved Discord webhook.
 * @param payload The alert details to send
 * @returns Promise<boolean> indicating success
 */
export async function sendDiscordAlert(payload: DiscordAlertPayload): Promise<boolean> {
    const webhookUrl = localStorage.getItem('discordWebhookUrl');

    if (!webhookUrl) {
        console.warn('Discord webhook URL not configured');
        return false;
    }

    const alertTypeLabels: Record<string, { emoji: string; label: string; color: number }> = {
        above: { emoji: '📈', label: 'Price Above Target', color: 0x00ff00 },
        below: { emoji: '📉', label: 'Price Below Target', color: 0xff0000 },
        migration: { emoji: '🚀', label: 'Token Migration', color: 0x9b59b6 },
    };

    const alertInfo = alertTypeLabels[payload.alertType] || alertTypeLabels.above;

    const formatValue = (val: number): string => {
        if (val >= 1000000000) return `$${(val / 1000000000).toFixed(2)}B`;
        if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
        if (val >= 1000) return `$${(val / 1000).toFixed(2)}K`;
        return `$${val.toFixed(2)}`;
    };

    const embed = {
        title: `${alertInfo.emoji} ${payload.tokenSymbol} Alert Triggered!`,
        description: payload.message || `Your ${alertInfo.label.toLowerCase()} alert has been triggered.`,
        color: alertInfo.color,
        fields: [
            {
                name: 'Alert Type',
                value: alertInfo.label,
                inline: true,
            },
            {
                name: 'Target',
                value: formatValue(payload.targetValue),
                inline: true,
            },
            ...(payload.currentValue ? [{
                name: 'Current',
                value: formatValue(payload.currentValue),
                inline: true,
            }] : []),
        ],
        timestamp: new Date().toISOString(),
        footer: {
            text: '0nyxTech Alerts',
        },
    };

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: '0nyxTech',
                embeds: [embed],
            }),
        });

        if (!response.ok) {
            console.error('Discord webhook failed:', response.status, await response.text());
            return false;
        }

        console.log('Discord alert sent successfully for', payload.tokenSymbol);
        return true;
    } catch (error) {
        console.error('Failed to send Discord alert:', error);
        return false;
    }
}

/**
 * Checks if a Discord webhook is configured.
 * @returns boolean
 */
export function hasDiscordWebhook(): boolean {
    const webhookUrl = localStorage.getItem('discordWebhookUrl');
    return !!webhookUrl && webhookUrl.startsWith('https://discord.com/api/webhooks/');
}
