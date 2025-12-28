/// <reference lib="deno.ns" />
/// <reference lib="dom" />

declare module "https://deno.land/std@0.177.0/http/server.ts" {
  export interface ServeInit {
    port?: number;
    hostname?: string;
    handler: (request: Request) => Response | Promise<Response>;
    onError?: (error: unknown) => Response | Promise<Response>;
  }

  export function serve(handler: (request: Request) => Response | Promise<Response>, init?: ServeInit): void;
}

declare module "https://deno.land/std@0.177.0/dotenv/mod.ts" {
  export function load(options?: { envPath?: string }): Promise<Record<string, string>>;
}

declare module "https://esm.sh/@supabase/supabase-js@2.38.4?target=deno" {
  export interface SupabaseClientOptions {
    auth?: {
      autoRefreshToken?: boolean;
      persistSession?: boolean;
      detectSessionInUrl?: boolean;
    };
  }

  export interface User {
    id: string;
    app_metadata: { [key: string]: any };
    user_metadata: { [key: string]: any };
    aud: string;
    created_at: string;
  }

  export interface UserResponse {
    data: {
      user: User | null;
    };
    error: Error | null;
  }

  export interface SupabaseClient {
    from: (table: string) => {
      select: (columns?: string) => Promise<{ data: any; error: any }>;
      insert: (data: any) => Promise<{ data: any; error: any }>;
      update: (data: any) => Promise<{ data: any; error: any }>;
      upsert: (data: any) => Promise<{ data: any; error: any }>;
      delete: () => Promise<{ data: any; error: any }>;
      eq: (column: string, value: any) => any;
      order: (column: string, options?: { ascending?: boolean }) => any;
    };
    auth: {
      getUser: () => Promise<UserResponse>;
    };
  }

  export function createClient(
    supabaseUrl: string,
    supabaseKey: string,
    options?: SupabaseClientOptions
  ): SupabaseClient;
}

declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    toObject(): { [key: string]: string };
  }

  export const env: Env;
} 