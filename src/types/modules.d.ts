// Papaparse
declare module 'papaparse' {
  export interface ParseConfig {
    delimiter?: string;
    newline?: string;
    quoteChar?: string;
    escapeChar?: string;
    header?: boolean;
    dynamicTyping?: boolean;
    preview?: number;
    encoding?: string;
    worker?: boolean;
    comments?: boolean | string;
    download?: boolean;
    skipEmptyLines?: boolean | 'greedy';
    fastMode?: boolean;
    withCredentials?: boolean;
    transform?: (value: string, field: string | number) => any;
    delimitersToGuess?: string[];
    complete?: (results: ParseResult<any>, file: File) => void;
    error?: (error: Error, file: File) => void;
  }

  export interface ParseResult<T> {
    data: T[];
    errors: Array<{
      type: string;
      code: string;
      message: string;
      row: number;
    }>;
    meta: {
      delimiter: string;
      linebreak: string;
      aborted: boolean;
      truncated: boolean;
      cursor: number;
    };
  }

  export function parse<T = any>(
    input: string | File | NodeJS.ReadableStream,
    config?: ParseConfig
  ): ParseResult<T>;
}

// Supabase
declare module '@supabase/supabase-js' {
  export interface User {
    id: string;
    app_metadata: {
      provider?: string;
      [key: string]: any;
    };
    user_metadata: {
      [key: string]: any;
    };
    aud: string;
    confirmation_sent_at?: string;
    confirmed_at?: string;
    created_at: string;
    email?: string;
    email_confirmed_at?: string;
    phone?: string;
    phone_confirmed_at?: string;
    last_sign_in_at?: string;
    role?: string;
    updated_at?: string;
  }

  export interface Session {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    expires_at?: number;
    token_type: string;
    user: User;
  }

  export interface SupabaseClient {
    auth: {
      getUser(): Promise<{ data: { user: User | null }, error: Error | null }>;
      getSession(): Promise<{ data: { session: Session | null }, error: Error | null }>;
      signInWithPassword(credentials: { email: string, password: string }): Promise<{ data: { user: User | null, session: Session | null }, error: Error | null }>;
      signInWithOAuth(options: { provider: string, options?: any }): Promise<{ data: any, error: Error | null }>;
      signUp(credentials: { email: string, password: string, options?: any }): Promise<{ data: { user: User | null, session: Session | null }, error: Error | null }>;
      signOut(): Promise<{ error: Error | null }>;
      resetPasswordForEmail(email: string, options?: any): Promise<{ error: Error | null }>;
      updateUser(attributes: any): Promise<{ error: Error | null }>;
      resend(options: any): Promise<{ error: Error | null }>;
      onAuthStateChange(callback: (event: string, session: Session | null) => void): { data: { subscription: any } };
    };
    from(table: string): any;
    rpc(procedure: string, params?: any): Promise<{ data: any, error: Error | null }>;
    functions: {
      invoke(name: string, options?: any): Promise<{ data: any, error: Error | null }>;
    };
    storage: {
      from(bucket: string): {
        upload(path: string, file: File, options?: any): Promise<{ data: any, error: Error | null }>;
        getPublicUrl(path: string): { data: { publicUrl: string } };
      };
    };
  }

  export function createClient(supabaseUrl: string, supabaseKey: string): SupabaseClient;
}

// Stripe
declare module '@stripe/stripe-js' {
  export interface StripeElements {
    // Add as needed
  }

  export const Elements: React.FC<{
    stripe: any;
    options?: any;
    children: React.ReactNode;
  }>;
}

// Vite environment variables
interface ImportMeta {
  env: {
    VITE_SUPABASE_URL: string;
    VITE_SUPABASE_ANON_KEY: string;
    [key: string]: string;
  };
}

// D3 modules
declare module 'd3-scale' {
  export function scaleOrdinal(): any;
  export function scaleLinear(): any;
  export const schemeCategory10: string[];
}

declare module 'd3-shape' {
  export function pie(): any;
  export function arc(): any;
}

// Note: React types are now provided by @types/react
// Do not override React namespace here as it conflicts with the proper types

// Add ImportMeta interface
interface ImportMeta {
  env: {
    VITE_SUPABASE_URL: string;
    VITE_SUPABASE_ANON_KEY: string;
    [key: string]: string;
  };
}

declare module 'lucide-react';
declare module 'html2canvas'; 