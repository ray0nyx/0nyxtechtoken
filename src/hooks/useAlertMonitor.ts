import { useEffect, useRef, useCallback } from 'react';
import { sendDiscordAlert, hasDiscordWebhook } from '@/lib/discord-webhook-service';
import { useToast } from '@/components/ui/use-toast';

interface TokenAlert {
    id: string;
    type: 'above' | 'below' | 'migration';
    value: number;
    tokenMint: string;
    tokenSymbol: string;
    createdAt: string;
    triggered?: boolean;
}

interface UseAlertMonitorOptions {
    tokenMint: string;
    tokenSymbol: string;
    currentMarketCap: number;
    isMigrating?: boolean;
}

/**
 * Hook to monitor token alerts and send Discord notifications when triggered.
 */
export function useAlertMonitor({
    tokenMint,
    tokenSymbol,
    currentMarketCap,
    isMigrating = false,
}: UseAlertMonitorOptions) {
    const { toast } = useToast();
    const lastCheckedRef = useRef<number>(0);
    const triggeredAlertsRef = useRef<Set<string>>(new Set());

    const checkAlerts = useCallback(async () => {
        // Throttle checks to every 5 seconds
        const now = Date.now();
        if (now - lastCheckedRef.current < 5000) return;
        lastCheckedRef.current = now;

        // Get alerts from localStorage
        const alertsJson = localStorage.getItem('tokenAlerts');
        if (!alertsJson) return;

        let alerts: TokenAlert[] = [];
        try {
            alerts = JSON.parse(alertsJson);
        } catch {
            return;
        }

        // Filter alerts for this token that haven't been triggered
        const relevantAlerts = alerts.filter(
            (a) => a.tokenMint === tokenMint && !triggeredAlertsRef.current.has(a.id)
        );

        for (const alert of relevantAlerts) {
            let shouldTrigger = false;
            let message = '';

            switch (alert.type) {
                case 'above':
                    if (currentMarketCap >= alert.value) {
                        shouldTrigger = true;
                        message = `${tokenSymbol} market cap is now above $${formatValue(alert.value)}`;
                    }
                    break;
                case 'below':
                    if (currentMarketCap <= alert.value && currentMarketCap > 0) {
                        shouldTrigger = true;
                        message = `${tokenSymbol} market cap has dropped below $${formatValue(alert.value)}`;
                    }
                    break;
                case 'migration':
                    if (isMigrating) {
                        shouldTrigger = true;
                        message = `${tokenSymbol} is migrating!`;
                    }
                    break;
            }

            if (shouldTrigger) {
                // Mark as triggered
                triggeredAlertsRef.current.add(alert.id);

                // Update localStorage to mark as triggered
                const updatedAlerts = alerts.map((a) =>
                    a.id === alert.id ? { ...a, triggered: true } : a
                );
                localStorage.setItem('tokenAlerts', JSON.stringify(updatedAlerts));

                // Show toast notification
                toast({
                    title: '🔔 Alert Triggered!',
                    description: message,
                });

                // Send Discord notification if configured
                if (hasDiscordWebhook()) {
                    await sendDiscordAlert({
                        tokenSymbol,
                        alertType: alert.type,
                        targetValue: alert.value,
                        currentValue: currentMarketCap,
                        message,
                    });
                }
            }
        }
    }, [tokenMint, tokenSymbol, currentMarketCap, isMigrating, toast]);

    useEffect(() => {
        if (currentMarketCap > 0 || isMigrating) {
            checkAlerts();
        }
    }, [currentMarketCap, isMigrating, checkAlerts]);

    return {
        checkAlerts,
    };
}

function formatValue(val: number): string {
    if (val >= 1000000000) return `${(val / 1000000000).toFixed(2)}B`;
    if (val >= 1000000) return `${(val / 1000000).toFixed(2)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(2)}K`;
    return val.toFixed(2);
}
