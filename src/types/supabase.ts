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
      trades: {
        Row: {
          id: string
          user_id: string
          symbol: string
          entry_date: string
          exit_date: string
          entry_price: number
          exit_price: number
          quantity: number
          pnl: number
          direction: string
          strategy: string | null
          notes: string | null
          tags: string[] | null
          created_at: string
          updated_at: string
          account_id: string | null
          platform: string | null
        }
        Insert: {
          id?: string
          user_id: string
          symbol: string
          entry_date: string
          exit_date: string
          entry_price: number
          exit_price: number
          quantity: number
          pnl: number
          direction: string
          strategy?: string | null
          notes?: string | null
          tags?: string[] | null
          created_at?: string
          updated_at?: string
          account_id?: string | null
          platform?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          symbol?: string
          entry_date?: string
          exit_date?: string
          entry_price?: number
          exit_price?: number
          quantity?: number
          pnl?: number
          direction?: string
          strategy?: string | null
          notes?: string | null
          tags?: string[] | null
          created_at?: string
          updated_at?: string
          account_id?: string | null
          platform?: string | null
        }
      }
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_subscriptions: {
        Row: {
          id: string
          user_id: string
          subscription_id: string | null
          status: string
          created_at: string
          updated_at: string
          trial_ends_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          subscription_id?: string | null
          status?: string
          created_at?: string
          updated_at?: string
          trial_ends_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          subscription_id?: string | null
          status?: string
          created_at?: string
          updated_at?: string
          trial_ends_at?: string | null
        }
      }
      accounts: {
        Row: {
          id: string
          user_id: string
          name: string
          platform: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          platform: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          platform?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
