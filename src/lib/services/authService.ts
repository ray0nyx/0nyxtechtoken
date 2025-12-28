import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { PublicKey } from '@solana/web3.js';
import { AuthResponse, SignInData, SignUpData } from '@/types/auth';

class AuthService {
  private user: User | null = null;

  async signUp(data: SignUpData): Promise<AuthResponse> {
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          name: data.name
        }
      }
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!authData.user) {
      throw new Error('Failed to create user');
    }

    this.user = authData.user;
    return {
      user: {
        id: authData.user.id,
        email: authData.user.email!,
        name: authData.user.user_metadata.name,
        createdAt: new Date(authData.user.created_at),
        subscription: {
          type: 'none',
          expiresAt: null
        }
      },
      token: authData.session?.access_token || ''
    };
  }

  async signIn(data: SignInData): Promise<AuthResponse> {
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!authData.user) {
      throw new Error('Failed to sign in');
    }

    this.user = authData.user;
    return {
      user: {
        id: authData.user.id,
        email: authData.user.email!,
        name: authData.user.user_metadata.name,
        createdAt: new Date(authData.user.created_at),
        subscription: {
          type: 'none',
          expiresAt: null
        }
      },
      token: authData.session?.access_token || ''
    };
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
      return result;
    } catch (error) {
      console.error('Solana sign-in error:', error);
      throw error;
    }
  }

  async signOut() {
    // Clear SIWS auth if exists
    const { getSIWSToken, clearSIWSAuth } = await import('@/lib/solana/siws');
    const siwsToken = getSIWSToken();
    if (siwsToken) {
      clearSIWSAuth();
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
    this.user = null;
  }

  async getCurrentUser() {
    if (this.user) {
      return this.user;
    }

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      throw new Error(error.message);
    }

    this.user = user;
    return user;
  }

  isAuthenticated() {
    return !!this.user;
  }

  async updateUser({ email, password, data }: { email?: string; password?: string; data?: Record<string, any> }) {
    const { data: userData, error } = await supabase.auth.updateUser({
      email,
      password,
      data
    });

    if (error) {
      throw new Error(error.message);
    }

    if (userData.user) {
      this.user = userData.user;
    }

    return { data: userData, error: null };
  }
}

export const authService = new AuthService(); 