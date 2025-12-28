import { supabase } from '@/lib/supabase';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  operator: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  threshold: number;
  isActive: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  notificationChannels: ('email' | 'push' | 'in_app')[];
  cooldownMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  ruleId: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved';
  triggeredAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  currentValue: number;
  thresholdValue: number;
  metadata?: any;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  inApp: boolean;
  emailFrequency: 'immediate' | 'hourly' | 'daily';
  quietHours: {
    enabled: boolean;
    start: string; // HH:MM format
    end: string; // HH:MM format
    timezone: string;
  };
}

const DEFAULT_ALERT_RULES: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'High Drawdown Alert',
    description: 'Alert when portfolio drawdown exceeds 15%',
    metric: 'max_drawdown',
    operator: 'greater_than',
    threshold: 15,
    isActive: true,
    severity: 'high',
    notificationChannels: ['email', 'push', 'in_app'],
    cooldownMinutes: 60
  },
  {
    name: 'Leverage Warning',
    description: 'Warning when leverage exceeds 2.0x',
    metric: 'leverage',
    operator: 'greater_than',
    threshold: 2.0,
    isActive: true,
    severity: 'medium',
    notificationChannels: ['push', 'in_app'],
    cooldownMinutes: 30
  },
  {
    name: 'Win Rate Drop',
    description: 'Alert when win rate drops below 40%',
    metric: 'win_rate',
    operator: 'less_than',
    threshold: 40,
    isActive: true,
    severity: 'medium',
    notificationChannels: ['email', 'in_app'],
    cooldownMinutes: 120
  },
  {
    name: 'High Volatility',
    description: 'Alert when portfolio volatility exceeds 25%',
    metric: 'volatility',
    operator: 'greater_than',
    threshold: 25,
    isActive: true,
    severity: 'high',
    notificationChannels: ['email', 'push', 'in_app'],
    cooldownMinutes: 60
  },
  {
    name: 'Concentration Risk',
    description: 'Alert when concentration risk exceeds 50%',
    metric: 'concentration_risk',
    operator: 'greater_than',
    threshold: 50,
    isActive: true,
    severity: 'medium',
    notificationChannels: ['in_app'],
    cooldownMinutes: 240
  },
  {
    name: 'Daily Loss Limit',
    description: 'Alert when daily loss exceeds $5,000',
    metric: 'daily_pnl',
    operator: 'less_than',
    threshold: -5000,
    isActive: true,
    severity: 'critical',
    notificationChannels: ['email', 'push', 'in_app'],
    cooldownMinutes: 15
  }
];

class AlertingService {
  private async getUserId(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');
    return user.id;
  }

  async getAlertRules(): Promise<AlertRule[]> {
    try {
      const userId = await this.getUserId();
      
      const { data, error } = await supabase
        .from('alert_rules')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // If no rules exist, create default ones
      if (!data || data.length === 0) {
        await this.createDefaultRules();
        return this.getAlertRules();
      }

      return data;
    } catch (error) {
      console.error('Error fetching alert rules:', error);
      return [];
    }
  }

  private async createDefaultRules(): Promise<void> {
    try {
      const userId = await this.getUserId();
      
      const rulesToInsert = DEFAULT_ALERT_RULES.map(rule => ({
        ...rule,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('alert_rules')
        .insert(rulesToInsert);

      if (error) throw error;
    } catch (error) {
      console.error('Error creating default rules:', error);
    }
  }

  async createAlertRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<AlertRule> {
    try {
      const userId = await this.getUserId();
      
      const { data, error } = await supabase
        .from('alert_rules')
        .insert([{
          ...rule,
          user_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating alert rule:', error);
      throw error;
    }
  }

  async updateAlertRule(ruleId: string, updates: Partial<AlertRule>): Promise<void> {
    try {
      const { error } = await supabase
        .from('alert_rules')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', ruleId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating alert rule:', error);
      throw error;
    }
  }

  async deleteAlertRule(ruleId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('alert_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting alert rule:', error);
      throw error;
    }
  }

  async getActiveAlerts(): Promise<Alert[]> {
    try {
      const userId = await this.getUserId();
      
      const { data, error } = await supabase
        .from('alerts')
        .select(`
          *,
          alert_rules!inner(name, description, metric)
        `)
        .eq('user_id', userId)
        .in('status', ['active', 'acknowledged'])
        .order('triggered_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching active alerts:', error);
      return [];
    }
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({
          status: 'acknowledged',
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (error) throw error;
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      throw error;
    }
  }

  async resolveAlert(alertId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (error) throw error;
    } catch (error) {
      console.error('Error resolving alert:', error);
      throw error;
    }
  }

  async checkAlerts(metrics: Record<string, number>): Promise<Alert[]> {
    try {
      const rules = await this.getAlertRules();
      const activeRules = rules.filter(rule => rule.isActive);
      const newAlerts: Alert[] = [];

      for (const rule of activeRules) {
        const currentValue = metrics[rule.metric];
        if (currentValue === undefined) continue;

        const shouldTrigger = this.evaluateRule(currentValue, rule.operator, rule.threshold);
        
        if (shouldTrigger) {
          // Check if there's a recent alert for this rule (cooldown)
          const recentAlert = await this.getRecentAlert(rule.id, rule.cooldownMinutes);
          if (recentAlert) continue;

          const alert = await this.createAlert(rule, currentValue);
          if (alert) {
            newAlerts.push(alert);
            await this.sendNotifications(alert, rule);
          }
        }
      }

      return newAlerts;
    } catch (error) {
      console.error('Error checking alerts:', error);
      return [];
    }
  }

  private evaluateRule(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'greater_than':
        return value > threshold;
      case 'less_than':
        return value < threshold;
      case 'equals':
        return Math.abs(value - threshold) < 0.01;
      case 'not_equals':
        return Math.abs(value - threshold) >= 0.01;
      default:
        return false;
    }
  }

  private async getRecentAlert(ruleId: string, cooldownMinutes: number): Promise<Alert | null> {
    try {
      const cutoffTime = new Date();
      cutoffTime.setMinutes(cutoffTime.getMinutes() - cooldownMinutes);

      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('rule_id', ruleId)
        .gte('triggered_at', cutoffTime.toISOString())
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      console.error('Error checking recent alert:', error);
      return null;
    }
  }

  private async createAlert(rule: AlertRule, currentValue: number): Promise<Alert | null> {
    try {
      const userId = await this.getUserId();
      
      const message = this.generateAlertMessage(rule, currentValue);
      
      const { data, error } = await supabase
        .from('alerts')
        .insert([{
          user_id: userId,
          rule_id: rule.id,
          message,
          severity: rule.severity,
          status: 'active',
          triggered_at: new Date().toISOString(),
          current_value: currentValue,
          threshold_value: rule.threshold,
          metadata: {
            metric: rule.metric,
            operator: rule.operator
          }
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating alert:', error);
      return null;
    }
  }

  private generateAlertMessage(rule: AlertRule, currentValue: number): string {
    const metricName = this.getMetricDisplayName(rule.metric);
    const operatorText = this.getOperatorText(rule.operator);
    
    return `${metricName} ${operatorText} ${rule.threshold} (Current: ${currentValue.toFixed(2)})`;
  }

  private getMetricDisplayName(metric: string): string {
    const names: Record<string, string> = {
      'max_drawdown': 'Maximum Drawdown',
      'leverage': 'Leverage',
      'win_rate': 'Win Rate',
      'volatility': 'Volatility',
      'concentration_risk': 'Concentration Risk',
      'daily_pnl': 'Daily P&L'
    };
    return names[metric] || metric;
  }

  private getOperatorText(operator: string): string {
    const operators: Record<string, string> = {
      'greater_than': 'exceeds',
      'less_than': 'falls below',
      'equals': 'equals',
      'not_equals': 'does not equal'
    };
    return operators[operator] || operator;
  }

  private async sendNotifications(alert: Alert, rule: AlertRule): Promise<void> {
    try {
      // Send in-app notification
      if (rule.notificationChannels.includes('in_app')) {
        await this.sendInAppNotification(alert);
      }

      // Send push notification
      if (rule.notificationChannels.includes('push')) {
        await this.sendPushNotification(alert);
      }

      // Send email notification
      if (rule.notificationChannels.includes('email')) {
        await this.sendEmailNotification(alert);
      }
    } catch (error) {
      console.error('Error sending notifications:', error);
    }
  }

  private async sendInAppNotification(alert: Alert): Promise<void> {
    // In-app notifications are handled by the frontend
    // This could trigger a real-time update via Supabase subscriptions
    console.log('In-app notification:', alert.message);
  }

  private async sendPushNotification(alert: Alert): Promise<void> {
    // Implement push notification logic here
    // This would integrate with a service like Firebase Cloud Messaging
    console.log('Push notification:', alert.message);
  }

  private async sendEmailNotification(alert: Alert): Promise<void> {
    // Implement email notification logic here
    // This would integrate with an email service like SendGrid or AWS SES
    console.log('Email notification:', alert.message);
  }

  async getNotificationSettings(): Promise<NotificationSettings> {
    try {
      const userId = await this.getUserId();
      
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return data || {
        email: true,
        push: true,
        inApp: true,
        emailFrequency: 'immediate',
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '08:00',
          timezone: 'UTC'
        }
      };
    } catch (error) {
      console.error('Error fetching notification settings:', error);
      return {
        email: true,
        push: true,
        inApp: true,
        emailFrequency: 'immediate',
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '08:00',
          timezone: 'UTC'
        }
      };
    }
  }

  async updateNotificationSettings(settings: NotificationSettings): Promise<void> {
    try {
      const userId = await this.getUserId();
      
      const { error } = await supabase
        .from('notification_settings')
        .upsert({
          user_id: userId,
          ...settings,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error updating notification settings:', error);
      throw error;
    }
  }
}

export const alertingService = new AlertingService();
