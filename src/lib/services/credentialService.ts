import { createClient } from '@/lib/supabase/client';

export interface ExchangeCredentials {
  apiKey: string;
  secret: string;
  passphrase?: string;
  sandbox?: boolean;
  additionalParams?: Record<string, any>;
}

export interface EncryptedCredentials {
  encrypted: string;
  iv: string;
  salt: string;
}

export class CredentialService {
  private static instance: CredentialService;
  private supabase = createClient();

  static getInstance(): CredentialService {
    if (!CredentialService.instance) {
      CredentialService.instance = new CredentialService();
    }
    return CredentialService.instance;
  }

  /**
   * Generate a random encryption key derived from user ID
   */
  private async getEncryptionKey(): Promise<CryptoKey> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Use user ID as base for key derivation
    const userKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(user.id),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // Derive encryption key
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new TextEncoder().encode('wagyu-exchange-credentials'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      userKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    return key;
  }

  /**
   * Encrypt credentials using AES-GCM
   */
  async encryptCredentials(credentials: ExchangeCredentials): Promise<EncryptedCredentials> {
    try {
      const key = await this.getEncryptionKey();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const salt = crypto.getRandomValues(new Uint8Array(16));
      
      const plaintext = JSON.stringify(credentials);
      const encodedPlaintext = new TextEncoder().encode(plaintext);
      
      const encrypted = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        encodedPlaintext
      );

      return {
        encrypted: this.arrayBufferToBase64(encrypted),
        iv: this.arrayBufferToBase64(iv),
        salt: this.arrayBufferToBase64(salt)
      };
    } catch (error) {
      console.error('Error encrypting credentials:', error);
      throw new Error('Failed to encrypt credentials');
    }
  }

  /**
   * Decrypt credentials using AES-GCM
   */
  async decryptCredentials(encryptedData: EncryptedCredentials): Promise<ExchangeCredentials> {
    try {
      const key = await this.getEncryptionKey();
      const iv = this.base64ToArrayBuffer(encryptedData.iv);
      
      const encrypted = this.base64ToArrayBuffer(encryptedData.encrypted);
      
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        encrypted
      );

      const plaintext = new TextDecoder().decode(decrypted);
      return JSON.parse(plaintext);
    } catch (error) {
      console.error('Error decrypting credentials:', error);
      throw new Error('Failed to decrypt credentials');
    }
  }

  /**
   * Store encrypted credentials in database
   */
  async storeCredentials(
    exchangeName: string, 
    credentials: ExchangeCredentials,
    connectionType: 'api_key' | 'oauth2' = 'api_key'
  ): Promise<string> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const encrypted = await this.encryptCredentials(credentials);
      
      const { data, error } = await this.supabase
        .from('user_exchange_connections')
        .insert({
          user_id: user.id,
          exchange_name: exchangeName,
          connection_type: connectionType,
          credentials_encrypted: encrypted,
          is_active: true,
          sync_status: 'disconnected'
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data.id;
    } catch (error) {
      console.error('Error storing credentials:', error);
      throw new Error('Failed to store credentials');
    }
  }

  /**
   * Retrieve and decrypt credentials from database
   */
  async getCredentials(connectionId: string): Promise<ExchangeCredentials> {
    try {
      const { data, error } = await this.supabase
        .from('user_exchange_connections')
        .select('credentials_encrypted')
        .eq('id', connectionId)
        .single();

      if (error) {
        throw error;
      }

      return await this.decryptCredentials(data.credentials_encrypted);
    } catch (error) {
      console.error('Error retrieving credentials:', error);
      throw new Error('Failed to retrieve credentials');
    }
  }

  /**
   * Update connection status
   */
  async updateConnectionStatus(
    connectionId: string, 
    status: 'connected' | 'disconnected' | 'error' | 'syncing',
    errorMessage?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        sync_status: status,
        updated_at: new Date().toISOString()
      };

      if (errorMessage) {
        updateData.error_message = errorMessage;
      }

      if (status === 'connected') {
        updateData.last_sync_at = new Date().toISOString();
      }

      const { error } = await this.supabase
        .from('user_exchange_connections')
        .update(updateData)
        .eq('id', connectionId);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error updating connection status:', error);
      throw new Error('Failed to update connection status');
    }
  }

  /**
   * Get all user connections
   */
  async getUserConnections(): Promise<any[]> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await this.supabase
        .from('user_exchange_connections')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error getting user connections:', error);
      throw new Error('Failed to get user connections');
    }
  }

  /**
   * Delete connection
   */
  async deleteConnection(connectionId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_exchange_connections')
        .delete()
        .eq('id', connectionId);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error deleting connection:', error);
      throw new Error('Failed to delete connection');
    }
  }

  // Utility methods
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

export const credentialService = CredentialService.getInstance();
