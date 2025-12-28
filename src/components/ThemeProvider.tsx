import { createContext, useContext, useEffect, useState } from "react";
import { Theme, getSystemTheme } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};

// Export the context so it can be imported elsewhere
export const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Check auth state on mount and set up listener
  useEffect(() => {
    // Get initial auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      setUserId(session?.user?.id || null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session);
      setUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch user preference when authenticated
  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    const fetchUserTheme = async () => {
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('dark_mode')
          .eq('user_id', userId)
          .single();

        if (error) {
          console.warn("Error fetching user theme:", error);
          return;
        }

        if (data) {
          // Apply the theme from database
          const themeValue = data.dark_mode ? 'dark' : 'light';
          localStorage.setItem(storageKey, themeValue);
          setTheme(themeValue);
        }
      } catch (error) {
        console.error("Failed to fetch user theme preference:", error);
      }
    };

    fetchUserTheme();
  }, [isAuthenticated, userId, storageKey]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = getSystemTheme();
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);

      // Also save to database if authenticated
      if (isAuthenticated && userId) {
        const isDarkMode = theme === 'dark';
        supabase
          .from('user_settings')
          .upsert(
            {
              user_id: userId,
              dark_mode: isDarkMode,
              updated_at: new Date().toISOString()
            },
            {
              onConflict: 'user_id',
              ignoreDuplicates: false
            }
          )
          .then(({ error }) => {
            if (error) {
              console.error("Error saving theme preference:", error);
            }
          });
      }
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
}; 