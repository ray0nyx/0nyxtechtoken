import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

// Create a singleton instance
let supabaseInstance: SupabaseClient | null = null;

export const createClient = (): SupabaseClient => {
  // Return existing instance if already created
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables:', {
      url: !!supabaseUrl,
      key: !!supabaseKey
    });
    throw new Error('Missing Supabase environment variables. Please check your .env file.');
  }

  try {
    // Create a custom fetch with retry logic and better error handling
    const customFetch = async (url: RequestInfo | URL, options?: RequestInit): Promise<Response> => {
      const maxRetries = 3;
      let lastError: Error | null = null;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
          
          const response = await fetch(url, {
            ...options,
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          // Note: We let the response through even if it's 400/404
          // The calling code (service methods) will handle these errors gracefully
          // Browser console will still show network errors, but functionality won't break
          return response;
        } catch (error: any) {
          lastError = error;
          
          // Check if it's a connection error
          if (error.name === 'AbortError' || 
              error.message?.includes('CONNECTION_REFUSED') ||
              error.message?.includes('Failed to fetch') ||
              error.message?.includes('NetworkError') ||
              error.message?.includes('network')) {
            
            if (attempt < maxRetries - 1) {
              // Exponential backoff: wait 1s, 2s, 4s
              const delay = Math.pow(2, attempt) * 1000;
              console.warn(`Connection error (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
          }
          
          // For other errors or final attempt, throw
          throw error;
        }
      }
      
      throw lastError || new Error('Connection failed after retries');
    };
    
    // Create the client with enhanced session persistence and custom fetch
    supabaseInstance = createSupabaseClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'supabase.auth.token',
        storage: {
          getItem: (key) => {
            try {
              const storedSession = localStorage.getItem(key);
              if (!storedSession) return null;
              return storedSession;
            } catch (error) {
              console.error('Error retrieving auth session:', error);
              return null;
            }
          },
          setItem: (key, value) => {
            try {
              localStorage.setItem(key, value);
            } catch (error) {
              console.error('Error storing auth session:', error);
            }
          },
          removeItem: (key) => {
            try {
              localStorage.removeItem(key);
            } catch (error) {
              console.error('Error removing auth session:', error);
            }
          }
        }
      },
      global: {
        fetch: customFetch
      }
    });

    // Log only once
    console.log('Supabase client initialized with URL:', supabaseUrl);
    
    // Check connection health on startup (non-blocking)
    supabaseInstance.auth.getSession().then(({ data, error }) => {
      if (error) {
        // Check if it's a connection error
        if (error.message?.includes('CONNECTION_REFUSED') || 
            error.message?.includes('Failed to fetch') ||
            error.message?.includes('ECONNREFUSED')) {
          console.error('⚠️ Database connection error:', error.message);
          console.error('Please check:');
          console.error('1. Your internet connection');
          console.error('2. Supabase project status (may be paused on free tier)');
          console.error('3. VITE_SUPABASE_URL in .env file');
        } else {
          console.error('Error getting session:', error);
        }
      } else if (!data.session) {
        console.warn('No active session found');
      } else {
        console.log('Session loaded successfully');
      }
    }).catch((err) => {
      if (err.message?.includes('CONNECTION_REFUSED') || 
          err.message?.includes('Failed to fetch')) {
        console.error('⚠️ Cannot connect to Supabase database:', err.message);
      } else {
        console.error('Unexpected error checking session:', err);
      }
    });
    
    return supabaseInstance;
  } catch (error) {
    console.error('Error initializing Supabase client:', error);
    throw new Error('Failed to initialize Supabase client. Please check your configuration.');
  }
}; 