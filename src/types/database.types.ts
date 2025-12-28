export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      analytics: {
        Row: {
          id: string
          user_id: string
          total_trades: Json
          win_rate: Json
          total_pnl: Json
          average_pnl: Json
          total_wins: Json
          total_losses: Json
          largest_win: Json
          largest_loss: Json
          daily_pnl: Json
          weekly_pnl: Json
          monthly_pnl: Json
          cumulative_pnl: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          total_trades?: Json
          win_rate?: Json
          total_pnl?: Json
          average_pnl?: Json
          total_wins?: Json
          total_losses?: Json
          largest_win?: Json
          largest_loss?: Json
          daily_pnl?: Json
          weekly_pnl?: Json
          monthly_pnl?: Json
          cumulative_pnl?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          total_trades?: Json
          win_rate?: Json
          total_pnl?: Json
          average_pnl?: Json
          total_wins?: Json
          total_losses?: Json
          largest_win?: Json
          largest_loss?: Json
          daily_pnl?: Json
          weekly_pnl?: Json
          monthly_pnl?: Json
          cumulative_pnl?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      broker_connections: {
        Row: {
          id: string
          user_id: string
          broker: string
          api_key: string | null
          secret_key: string | null
          account_id: string | null
          username: string | null
          password: string | null
          sandbox: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          broker: string
          api_key?: string | null
          secret_key?: string | null
          account_id?: string | null
          username?: string | null
          password?: string | null
          sandbox?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          broker?: string
          api_key?: string | null
          secret_key?: string | null
          account_id?: string | null
          username?: string | null
          password?: string | null
          sandbox?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      journal_notes: {
        Row: {
          id: string
          user_id: string
          date: string
          note: string
          note_content?: string
          pnl?: number
          emotion?: string
          tags?: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          note?: string
          note_content?: string
          pnl?: number
          emotion?: string
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          note?: string
          note_content?: string
          pnl?: number
          emotion?: string
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      trades: {
        Row: {
          id: string
          created_at: string
          user_id: string
          account_id: string
          symbol: string
          side: string
          quantity: number
          entry_price: number
          exit_price: number
          pnl: number
          duration: string | null
          strategy: string | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          account_id: string
          symbol: string
          side: string
          quantity: number
          entry_price: number
          exit_price: number
          pnl: number
          duration?: string | null
          strategy?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          account_id?: string
          symbol?: string
          side?: string
          quantity?: number
          entry_price?: number
          exit_price?: number
          pnl?: number
          duration?: string | null
          strategy?: string | null
          notes?: string | null
          updated_at?: string
        }
      }
      performance_table: {
        Row: {
          id: string
          user_id: string
          date: string
          "Strategy Performance": Json
          "Win Rate": Json
          "Trade Duration vs P&L": Json
          "Performance by Duration": Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          "Strategy Performance": Json
          "Win Rate": Json
          "Trade Duration vs P&L": Json
          "Performance by Duration": Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          "Strategy Performance"?: Json
          "Win Rate"?: Json
          "Trade Duration vs P&L"?: Json
          "Performance by Duration"?: Json
          created_at?: string
          updated_at?: string
        }
      }
      dashboard_templates: {
        Row: {
          id: string
          user_id: string
          name: string
          config: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          config: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          config?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      bar_replay_templates: {
        Row: {
          id: string
          user_id: string
          name: string
          settings: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          settings: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          settings?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bar_replay_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      user_subscriptions: {
        Row: {
          id: string
          user_id: string
          status: 'active' | 'inactive'
          connected_accounts: number
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          status: 'active' | 'inactive'
          connected_accounts?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          status?: 'active' | 'inactive'
          connected_accounts?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      daily_trade_summary: {
        Row: {
          id: string
          user_id: string
          trade_date: string
          total_trades: number
          daily_gross_pnl: number
          daily_net_pnl: number
          avg_trade_pnl: number
          worst_trade: number
          best_trade: number
          winning_trades: number
          losing_trades: number
          avg_duration: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          trade_date: string
          total_trades: number
          daily_gross_pnl: number
          daily_net_pnl: number
          avg_trade_pnl: number
          worst_trade: number
          best_trade: number
          winning_trades: number
          losing_trades: number
          avg_duration: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          trade_date?: string
          total_trades?: number
          daily_gross_pnl?: number
          daily_net_pnl?: number
          avg_trade_pnl?: number
          worst_trade?: number
          best_trade?: number
          winning_trades?: number
          losing_trades?: number
          avg_duration?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_trade_summary_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      trades_staging: {
        Row: {
          id: string
          user_id: string
          account_id: string | null
          symbol: string
          position: string
          entry_date: string | null
          exit_date: string | null
          entry_price: number
          exit_price: number
          quantity: number
          pnl: number
          strategy: string | null
          broker: string
          notes: string | null
          tags: Json | null
          fees: number | null
          buyFillId: string | null
          sellFillId: string | null
          buyPrice: number | null
          sellPrice: number | null
          boughtTimestamp: string | null
          soldTimestamp: string | null
          duration: number | null
          priceFormat: string | null
          priceFormatType: string | null
          tickSize: number | null
          qty: number | null
          date: string | null
          import_status: string | null
          analytics: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          account_id?: string | null
          symbol: string
          position: string
          entry_date?: string | null
          exit_date?: string | null
          entry_price: number
          exit_price: number
          quantity: number
          pnl: number
          strategy?: string | null
          broker: string
          notes?: string | null
          tags?: Json | null
          fees?: number | null
          buyFillId?: string | null
          sellFillId?: string | null
          buyPrice?: number | null
          sellPrice?: number | null
          boughtTimestamp?: string | null
          soldTimestamp?: string | null
          duration?: number | null
          priceFormat?: string | null
          priceFormatType?: string | null
          tickSize?: number | null
          qty?: number | null
          date?: string | null
          import_status?: string | null
          analytics?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          account_id?: string | null
          symbol?: string
          position?: string
          entry_date?: string | null
          exit_date?: string | null
          entry_price?: number
          exit_price?: number
          quantity?: number
          pnl?: number
          strategy?: string | null
          broker?: string
          notes?: string | null
          tags?: Json | null
          fees?: number | null
          buyFillId?: string | null
          sellFillId?: string | null
          buyPrice?: number | null
          sellPrice?: number | null
          boughtTimestamp?: string | null
          soldTimestamp?: string | null
          duration?: number | null
          priceFormat?: string | null
          priceFormatType?: string | null
          tickSize?: number | null
          qty?: number | null
          date?: string | null
          import_status?: string | null
          analytics?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_staging_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      process_tradovate_csv_batch: {
        Args: {
          user_id: string
          json_data: string
          account_id: string
        }
        Returns: {
          id: string
          success: boolean
          error: string | null
        }
      }
      get_performance_for_user: {
        Args: {
          p_user_id: string
        }
        Returns: {
          strategy_performance: { value: number }
          win_rate: { value: number }
          trade_duration_vs_pnl: { value: number }
          performance_by_duration: { value: number }
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
} 