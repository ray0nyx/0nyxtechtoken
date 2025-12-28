import { Trade } from '@/types/trade';
import Papa from 'papaparse';
import { supabase } from '@/lib/supabase';

export interface CSVMapping {
  date: string;
  symbol: string;
  type: string;
  side: string;
  quantity: string;
  entry_date: string;
  exit_date: string;
  entry_price: string;
  exit_price: string;
  price: string;
  fees?: string;
  pnl?: string;
  strategy?: string;
  notes?: string;
  tags?: string;
  broker?: string;
  commission?: string;
}

export class CSVImportService {
  private mapping: CSVMapping;
  private userId: string | null = null;

  constructor(mapping: CSVMapping) {
    this.mapping = mapping;
    // Initialize user ID
    supabase.auth.getUser().then(({ data: { user } }) => {
      this.userId = user?.id ?? null;
    });
  }

  async importFile(file: File): Promise<Trade[]> {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const trades = this.processParsedData(results.data);
            resolve(trades);
          } catch (error) {
            reject(error);
          }
        },
        error: (error) => {
          reject(error);
        },
      });
    });
  }

  private processParsedData(data: any[]): Trade[] {
    return data.map((row) => this.mapRowToTrade(row));
  }

  private mapRowToTrade(row: any): Trade {
    const trade: Trade = {
      id: crypto.randomUUID(),
      user_id: this.userId!,
      symbol: row[this.mapping.symbol],
      position: row[this.mapping.side].toLowerCase(),
      date: new Date(row[this.mapping.date]),
      entry_date: new Date(row[this.mapping.entry_date] || row[this.mapping.date]),
      exit_date: new Date(row[this.mapping.exit_date] || row[this.mapping.date]),
      entry_price: parseFloat(row[this.mapping.price] || row[this.mapping.entry_price] || '0'),
      exit_price: parseFloat(row[this.mapping.price] || row[this.mapping.exit_price] || '0'),
      quantity: parseInt(row[this.mapping.quantity]),
      pnl: this.mapping.pnl ? parseFloat(row[this.mapping.pnl]) : 0,
      strategy: row[this.mapping.strategy] || 'Unknown',
      broker: row[this.mapping.broker] || 'Unknown',
      notes: row[this.mapping.notes] || '',
      tags: row[this.mapping.tags] ? row[this.mapping.tags].split(',').map(tag => tag.trim()) : []
    };

    // Add optional fields if they exist in the mapping
    if (this.mapping.fees) {
      trade.fees = parseFloat(row[this.mapping.fees]);
    }

    if (this.mapping.commission) {
      trade.commission = parseFloat(row[this.mapping.commission]);
    }

    return trade;
  }

  private normalizeTradeType(type: string): 'buy' | 'sell' {
    const normalized = type.toLowerCase().trim();
    if (normalized.includes('buy') || normalized.includes('b')) {
      return 'buy';
    }
    if (normalized.includes('sell') || normalized.includes('s')) {
      return 'sell';
    }
    throw new Error(`Invalid trade type: ${type}`);
  }

  private normalizeTradeSide(side: string): 'long' | 'short' {
    const normalized = side.toLowerCase().trim();
    if (normalized.includes('long') || normalized.includes('l')) {
      return 'long';
    }
    if (normalized.includes('short') || normalized.includes('s')) {
      return 'short';
    }
    throw new Error(`Invalid trade side: ${side}`);
  }
} 