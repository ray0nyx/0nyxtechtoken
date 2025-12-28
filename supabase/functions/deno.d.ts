/// <reference lib="deno.ns" />
/// <reference lib="deno.window" />
/// <reference lib="dom" />

declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export interface ServeInit {
    port?: number;
    hostname?: string;
    handler: (request: Request) => Response | Promise<Response>;
  }
  export function serve(handler: (request: Request) => Response | Promise<Response>, init?: ServeInit): void;
}

declare module "https://esm.sh/stripe@12.0.0?target=deno&types=stripe" {
  import Stripe from "stripe";
  export default Stripe;
}

declare module "https://esm.sh/@supabase/supabase-js@2.38.4" {
  export * from "@supabase/supabase-js";
}

declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    toObject(): { [key: string]: string };
  }

  export const env: Env;
} 