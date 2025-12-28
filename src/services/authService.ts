import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { PublicKey } from '@solana/web3.js';
import { getSIWSToken, clearSIWSAuth } from '@/lib/solana/siws';

class AuthService {
  private user: User | null = null;
  private siwsUser: any = null;

  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    this.user = data.user;
    return data;
  }

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    this.user = data.user;
    return data;
  }

  async signInWithGoogle(): Promise<void> {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/app/analytics`
      }
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  async signInWithSolana(
    publicKey: PublicKey,
    signMessage: (message: Uint8Array) => Promise<Uint8Array>
  ): Promise<{ token: string; user: any }> {
    try {
      const { signInWithSolana: siwsSignIn } = await import('@/lib/solana/siws');
      const result = await siwsSignIn(publicKey, signMessage);
      this.siwsUser = result.user;
      return result;
    } catch (error) {
      console.error('Solana sign-in error:', error);
      throw error;
    }
  }

  async signOut() {
    // Clear SIWS auth if exists
    const siwsToken = getSIWSToken();
    if (siwsToken) {
      clearSIWSAuth();
      this.siwsUser = null;
    }

    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
    this.user = null;
  }

  async getCurrentUser() {
    // Check for SIWS authentication first
    const siwsToken = getSIWSToken();
    if (siwsToken && this.siwsUser) {
      return this.siwsUser;
    }

    // Fall back to Supabase auth
    if (this.user) {
      return this.user;
    }

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      throw error;
    }

    this.user = user;
    return user;
  }

  isAuthenticated() {
    const siwsToken = getSIWSToken();
    return !!(this.user || (siwsToken && this.siwsUser));
  }

  getAuthMethod(): 'supabase' | 'siws' | null {
    const siwsToken = getSIWSToken();
    if (siwsToken && this.siwsUser) {
      return 'siws';
    }
    if (this.user) {
      return 'supabase';
    }
    return null;
  }
}

export const authService = new AuthService(); 