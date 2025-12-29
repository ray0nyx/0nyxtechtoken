import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { FormField, FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form";
import RateLimitedButton from '@/components/auth/RateLimitedButton';
import { handleAuthError } from '@/utils/authErrorHandler';
import { getCurrentUser } from '@/lib/auth-utils';

interface UserProfile {
  email: string;
  username?: string;
  avatar_url?: string;
}

interface SupportFormData {
  subject: string;
  message: string;
}

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const { theme, setTheme } = useTheme();
  const supabase = createClient();
  const [settings, setSettings] = useState({
    darkMode: theme === "dark",
    notifications: true,
    emailAlerts: false,
  });
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resetPasswordSent, setResetPasswordSent] = useState(false);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [cancelSubscriptionLoading, setCancelSubscriptionLoading] = useState(false);
  const [supportFormOpen, setSupportFormOpen] = useState(false);
  const [supportFormData, setSupportFormData] = useState<SupportFormData>({ subject: '', message: '' });
  const [sendingSupportRequest, setSendingSupportRequest] = useState(false);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('profile');
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isWalletUser, setIsWalletUser] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);

  useEffect(() => {
    fetchUserProfile();
    fetchUserSettings();
  }, []);

  // Update settings.darkMode when theme changes
  useEffect(() => {
    setSettings(prev => ({
      ...prev,
      darkMode: theme === "dark"
    }));
  }, [theme]);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);

      // Add timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        setLoading(false);
        toast({
          title: "Timeout",
          description: "Loading took too long. Please try again.",
          variant: "destructive",
        });
      }, 10000); // 10 second timeout

      // Support both Supabase and SIWS wallet auth
      const authUser = await getCurrentUser();

      if (!authUser) {
        clearTimeout(timeoutId);
        console.log('Settings: No authenticated user found');
        setLoading(false);
        return;
      }

      setCurrentUserId(authUser.id);
      setIsWalletUser(authUser.isWalletUser);

      // For SIWS wallet users, fetch profile from API
      if (authUser.isWalletUser) {
        try {
          const { getProfileViaAPI } = await import('@/lib/wallet-api');
          const result = await getProfileViaAPI(authUser.id);

          if (result.profile && result.profile.username) {
            setProfile({
              email: authUser.walletAddress ? `${authUser.walletAddress.substring(0, 8)}...@wallet` : '',
              username: result.profile.username,
              avatar_url: result.profile.avatar_url || '',
            });
          } else {
            // No saved profile, use wallet address as default
            setProfile({
              email: authUser.walletAddress ? `${authUser.walletAddress.substring(0, 8)}...@wallet` : '',
              username: '',
              avatar_url: '',
            });
          }
        } catch (e) {
          console.warn('Error fetching SIWS profile:', e);
          setProfile({
            email: authUser.walletAddress ? `${authUser.walletAddress.substring(0, 8)}...@wallet` : '',
            username: '',
            avatar_url: '',
          });
        }
        clearTimeout(timeoutId);
        setLoading(false);
        return;
      }

      // Get user profile data for regular users
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.warn("Error fetching profile, but continuing:", error);
        }

        setProfile({
          email: authUser.email || '',
          username: data?.username || '',
          avatar_url: data?.avatar_url || '',
        });
      } catch (profileError) {
        console.warn("Error with profiles table, using basic user info:", profileError);
        setProfile({
          email: authUser.email || '',
          username: '',
          avatar_url: '',
        });
      }

      clearTimeout(timeoutId);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      // Don't show toast for SIWS users - just silently continue
    } finally {
      setLoading(false);
    }
  };

  const fetchUserSettings = async () => {
    try {
      // Support both Supabase and SIWS wallet auth
      const authUser = await getCurrentUser();

      if (!authUser) {
        console.log('Settings: No authenticated user for settings');
        return;
      }

      // SIWS wallet users - just use defaults, no DB settings
      if (authUser.isWalletUser) {
        return;
      }

      // Get user settings from the database
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', authUser.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.warn("Error fetching settings:", error);
        return;
      }

      if (data) {
        // Apply saved settings
        setSettings({
          darkMode: data.dark_mode || theme === "dark",
          notifications: data.notifications !== undefined ? data.notifications : true,
          emailAlerts: data.email_alerts !== undefined ? data.email_alerts : false,
        });

        // Apply theme immediately if it differs from current
        if (data.dark_mode && theme !== 'dark') {
          setTheme('dark');
        } else if (!data.dark_mode && theme !== 'light') {
          setTheme('light');
        }
      }
    } catch (error) {
      console.error("Error fetching user settings:", error);
    }
  };

  const saveProfile = async () => {
    try {
      setSaving(true);

      // Support both Supabase and SIWS wallet auth
      const authUser = await getCurrentUser();

      if (!authUser || !profile) {
        console.log('Settings: No authenticated user for saving profile');
        toast({
          title: "Info",
          description: "Profile changes saved locally",
        });
        setSaving(false);
        return;
      }

      // SIWS wallet users - save profile via API
      if (authUser.isWalletUser) {
        try {
          const { saveProfileViaAPI } = await import('@/lib/wallet-api');
          const result = await saveProfileViaAPI(
            authUser.id,
            profile.username,
            profile.avatar_url
          );

          if (result.error) {
            throw new Error(result.error);
          }

          toast({
            title: "Success",
            description: "Profile updated successfully",
          });
        } catch (e: any) {
          console.error('Error saving SIWS profile:', e);
          toast({
            title: "Error",
            description: e.message || "Failed to save profile",
            variant: "destructive",
          });
        }
        setSaving(false);
        return;
      }

      // For regular users, get the Supabase user for auth updates
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: "Info",
          description: "Profile changes saved locally",
        });
        setSaving(false);
        return;
      }

      // Update email if it has changed
      if (profile.email && profile.email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: profile.email
        });

        if (emailError) {
          console.error("Error updating email:", emailError);
          throw emailError;
        }

        toast({
          title: "Email Verification Required",
          description: "Verification emails have been sent to both your current and new email address. Please click the confirmation links in both emails to complete the change. Your email will update once verified.",
          duration: 10000, // Show for 10 seconds since this is important
        });

        // Revert the displayed email to the current one until verified
        setProfile(prev => prev ? { ...prev, email: user.email || '' } : null);

        // Don't continue with other updates if email change is pending
        setSaving(false);
        return;
      }

      // Update user metadata in the auth.users table
      const { error: updateError } = await supabase.auth.updateUser({
        data: { username: profile.username }
      });

      if (updateError) {
        console.error("Error updating user metadata:", updateError);
        throw updateError;
      }

      try {
        // Update profile in the profiles table
        const { error } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            username: profile.username,
            avatar_url: profile.avatar_url,
            updated_at: new Date().toISOString(),
          });

        if (error) {
          console.warn("Error updating profile:", error);
          // Continue anyway since we've updated the user metadata
        }
      } catch (profileError) {
        console.warn("Error with profiles table, but user metadata is updated:", profileError);
      }

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });

    } catch (error: any) {
      console.error("Error saving profile:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfile(prev => prev ? { ...prev, [name]: value } : null);
  };

  const handleSettingChange = (setting: keyof typeof settings) => {
    if (setting === 'darkMode') {
      const newDarkModeSetting = !settings.darkMode;
      setSettings(prev => ({ ...prev, darkMode: newDarkModeSetting }));
      setTheme(newDarkModeSetting ? 'dark' : 'light');
    } else {
      setSettings(prev => ({ ...prev, [setting]: !prev[setting] }));
    }
  };

  const handleResetPassword = async () => {
    try {
      setResetPasswordLoading(true);

      if (!profile?.email) {
        throw new Error("Email not found");
      }

      // Use production domain for password reset redirects
      const redirectUrl = 'https://wagyutech.app/reset-password';
      console.log('🔍 Password Reset Debug Info:');
      console.log('Email:', profile.email);
      console.log('Redirect URL:', redirectUrl);
      console.log('Window origin:', window.location.origin);

      const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        // Use the error handling utility
        const errorResult = handleAuthError(error);

        if (errorResult.shouldShowToast) {
          toast({
            title: errorResult.toastTitle,
            description: errorResult.toastDescription,
            variant: errorResult.toastVariant,
          });
        }

        if (errorResult.shouldReturn) {
          return;
        }

        throw error;
      }

      setResetPasswordSent(true);
      toast({
        title: "Success",
        description: "Password reset email sent! Check your inbox and follow the link to reset your password.",
      });

    } catch (error: any) {
      console.error("Error sending password reset:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send password reset email",
        variant: "destructive",
      });
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      setCancelSubscriptionLoading(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("User not found");
      }

      // Call server function to cancel subscription
      const { error } = await supabase.functions.invoke('cancel-subscription', {
        body: {
          userId: user.id
        }
      });

      if (error) throw error;

      toast({
        title: "Subscription Cancelled",
        description: "Your subscription has been cancelled successfully.",
      });

    } catch (error) {
      console.error("Error cancelling subscription:", error);
      toast({
        title: "Error",
        description: "Failed to cancel subscription. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setCancelSubscriptionLoading(false);
    }
  };

  const handleSupportFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSupportFormData(prev => ({ ...prev, [name]: value }));
  };

  const submitSupportRequest = async () => {
    try {
      setSendingSupportRequest(true);

      if (!supportFormData.subject || !supportFormData.message) {
        toast({
          title: "Error",
          description: "Please fill in all fields",
          variant: "destructive",
        });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("User not found");
      }

      // Send email via Supabase function or other service
      // Here we're sending it through a Supabase Edge Function, but you could use any email service
      const { error } = await supabase.functions.invoke('send-support-email', {
        body: {
          from: profile?.email || user.email,
          fromName: profile?.username || 'User',
          subject: supportFormData.subject,
          message: supportFormData.message,
          to: 'rayhan@arafatcapital.com'
        }
      });

      if (error) throw error;

      toast({
        title: "Support Request Sent",
        description: "We've received your request and will get back to you soon.",
      });

      // Reset form and close dialog
      setSupportFormData({ subject: '', message: '' });
      setSupportFormOpen(false);

    } catch (error) {
      console.error("Error sending support request:", error);
      toast({
        title: "Error",
        description: "Failed to send support request. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setSendingSupportRequest(false);
    }
  };

  const saveUserSettings = async () => {
    try {
      setSavingPreferences(true);

      // Support both Supabase and SIWS wallet auth
      const authUser = await getCurrentUser();

      if (!authUser) {
        console.log('Settings: No authenticated user for saving');
        toast({
          title: "Info",
          description: "Preferences saved locally",
        });
        return;
      }

      // SIWS wallet users - just show success (settings saved locally in state)
      if (authUser.isWalletUser) {
        toast({
          title: "Success",
          description: "Preferences saved",
        });
        return;
      }

      // Save settings to the database for regular users
      const { error } = await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: authUser.id,
            dark_mode: settings.darkMode,
            notifications: settings.notifications,
            email_alerts: settings.emailAlerts,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id',
            ignoreDuplicates: false
          }
        );

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Preferences saved successfully",
      });

    } catch (error) {
      console.error("Error saving preferences:", error);
      toast({
        title: "Error",
        description: "Failed to save preferences",
        variant: "destructive",
      });
    } finally {
      setSavingPreferences(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setDeleteAccountLoading(true);

      const authUser = await getCurrentUser();

      if (!authUser) {
        toast({
          title: "Error",
          description: "No authenticated user found",
          variant: "destructive",
        });
        return;
      }

      // Delete all user data from database via API
      const { deleteAccountViaAPI } = await import('@/lib/wallet-api');
      const result = await deleteAccountViaAPI(authUser.id);

      if (result.error) {
        console.error('Failed to delete account data:', result.error);
        // Continue with logout anyway
      }

      // For SIWS wallet users - clear local storage and redirect
      if (authUser.isWalletUser) {
        localStorage.removeItem('siws_token');
        localStorage.removeItem('siws_public_key');
        toast({
          title: "Account Deleted",
          description: "Your account and all associated data have been deleted.",
        });
        window.location.href = '/';
        return;
      }

      // For regular users - sign out
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      toast({
        title: "Account Deleted",
        description: "Your account and all associated data have been deleted.",
      });

      window.location.href = '/';

    } catch (error: any) {
      console.error("Error deleting account:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete account",
        variant: "destructive",
      });
    } finally {
      setDeleteAccountLoading(false);
      setDeleteAccountOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-none py-6 md:py-8 px-2">
        <LoadingSpinner
          message="Loading your settings..."
          subMessage="Please wait while we fetch your account information"
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-none py-6 md:py-8 px-2">
      <div className="w-full">
        <div className="border-b border-slate-700/50 mb-6">
          <div className="grid w-full grid-cols-3 mb-8">
            <button
              className={`py-3 px-4 font-medium transition-all duration-300 ${activeTab === 'profile'
                ? 'border-b-2 border-blue-500 text-blue-400'
                : theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                }`}
              onClick={() => setActiveTab('profile')}
            >
              Profile
            </button>
            <button
              className={`py-3 px-4 font-medium transition-all duration-300 ${activeTab === 'account'
                ? 'border-b-2 border-purple-500 text-purple-400'
                : theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                }`}
              onClick={() => setActiveTab('account')}
            >
              Account
            </button>
            <button
              className={`py-3 px-4 font-medium transition-all duration-300 ${activeTab === 'preferences'
                ? 'border-b-2 border-gray-400 text-gray-300'
                : theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                }`}
              onClick={() => setActiveTab('preferences')}
            >
              Preferences
            </button>
          </div>
        </div>

        {activeTab === 'profile' && (
          <Card
            className="border-slate-700/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:shadow-blue-500/10 overflow-hidden"
            style={{
              backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)', // dark: slate-900/50, light: gray-100
              backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
            }}
          >
            <CardHeader className="bg-blue-500/10">
              <CardTitle
                className="flex items-center gap-2"
                style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
              >
                <div className="p-1.5 rounded-lg bg-blue-500/20">
                  <svg className="h-4 w-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                Profile Information
              </CardTitle>
              <CardDescription
                style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
              >
                Update your profile information here. This information may be visible to other users.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 sm:px-4 py-4 space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="username"
                  style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
                >
                  Username
                </Label>
                <Input
                  id="username"
                  name="username"
                  value={profile?.username || ''}
                  onChange={handleProfileChange}
                  placeholder="Choose your username"
                  className="border-slate-700/50 focus:border-blue-500/50 focus:ring-blue-500/20"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                    color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)',
                  }}
                />
                <p
                  className="text-sm"
                  style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                >
                  This username will be displayed on the leaderboard and in your public profile.
                </p>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
                >
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={profile?.email || ''}
                  onChange={handleProfileChange}
                  placeholder="your.email@example.com"
                  className="border-slate-700/50 focus:border-blue-500/50 focus:ring-blue-500/20"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                    color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)',
                  }}
                />
                <p
                  className="text-sm"
                  style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                >
                  Changing your email requires verification from both your current and new email addresses.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Support</Label>
                <div>
                  <Button onClick={() => setSupportFormOpen(true)} variant="outline">
                    Contact Support
                  </Button>
                  <p className="text-sm text-muted-foreground mt-2">
                    Need help? Contact our support team with any questions or issues.
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="px-2 sm:px-4 py-4">
              <Button
                onClick={saveProfile}
                disabled={saving}
                className="bg-gradient-to-r from-slate-300 via-slate-100 to-slate-300 hover:from-slate-200 hover:via-white hover:to-slate-200 text-slate-900 font-bold shadow-lg shadow-slate-400/20 border-t border-white/50 transition-all duration-500"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </CardFooter>
          </Card>
        )}

        {activeTab === 'account' && (
          <Card
            style={{
              backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)', // dark: slate-900/50, light: gray-100
              backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
            }}
          >
            <CardHeader>
              <CardTitle
                style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
              >
                Account Settings
              </CardTitle>
              <CardDescription
                style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
              >
                Manage your account settings and preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 sm:px-4 py-4 space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
                >
                  Password
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="password"
                    type="password"
                    value="••••••••"
                    disabled
                    className="bg-muted"
                  />
                  <Button variant="outline" onClick={() => setResetPasswordOpen(true)}>Change Password</Button>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h3 className="text-lg font-medium mb-2">Danger Zone</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Once you delete your account, there is no going back. Please be certain.
                </p>
                <Button
                  variant="destructive"
                  disabled={deleteAccountLoading}
                  onClick={() => {
                    if (window.confirm("Are you absolutely sure you want to delete your account? This action cannot be undone.")) {
                      handleDeleteAccount();
                    }
                  }}
                >
                  {deleteAccountLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Account'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'preferences' && (
          <Card
            style={{
              backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)', // dark: slate-900/50, light: gray-100
              backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
            }}
          >
            <CardHeader>
              <CardTitle
                style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
              >
                Preferences
              </CardTitle>
              <CardDescription
                style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
              >
                Customize your application experience.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 sm:px-4 py-4 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Push Notifications</h3>
                  <p className="text-sm text-muted-foreground">
                    Receive push notifications for important updates.
                  </p>
                </div>
                <Switch
                  checked={settings.notifications}
                  onCheckedChange={() => handleSettingChange('notifications')}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3
                    className="font-medium"
                    style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
                  >
                    Email Alerts
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
                  >
                    Receive email alerts for important updates.
                  </p>
                </div>
                <Switch
                  checked={settings.emailAlerts}
                  onCheckedChange={() => handleSettingChange('emailAlerts')}
                />
              </div>
            </CardContent>
            <CardFooter className="px-2 sm:px-4 py-4">
              <Button
                onClick={saveUserSettings}
                disabled={savingPreferences}
                className="bg-gradient-to-r from-slate-300 via-slate-100 to-slate-300 hover:from-slate-200 hover:via-white hover:to-slate-200 text-slate-900 font-bold shadow-lg shadow-slate-400/20 border-t border-white/50 transition-all duration-500"
              >
                {savingPreferences ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Preferences'
                )}
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>

      {/* Password Reset Dialog */}
      {resetPasswordOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg w-full max-w-md">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Reset Password</h2>
              <p className="text-muted-foreground">
                {resetPasswordSent
                  ? "Password reset email sent. Check your inbox for instructions to reset your password."
                  : "We'll send a password reset link to your email address."}
              </p>
            </div>

            {!resetPasswordSent && (
              <div className="py-4">
                <p className="text-sm mb-4">
                  A password reset link will be sent to: <strong>{profile?.email}</strong>
                </p>
                <p className="text-sm text-muted-foreground">
                  Click the link in the email to set a new password for your account.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setResetPasswordOpen(false)}>
                {resetPasswordSent ? 'Close' : 'Cancel'}
              </Button>
              {!resetPasswordSent && (
                <RateLimitedButton
                  onClick={handleResetPassword}
                  loading={resetPasswordLoading}
                  cooldownSeconds={30}
                  className="bg-gradient-to-r from-slate-300 via-slate-100 to-slate-300 hover:from-slate-200 hover:via-white hover:to-slate-200 text-slate-900 font-bold shadow-lg shadow-slate-400/20 border-t border-white/50 transition-all duration-500"
                >
                  Send Reset Link
                </RateLimitedButton>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Support Form Dialog */}
      {supportFormOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg w-full max-w-md">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Contact Support</h2>
              <p className="text-muted-foreground">
                Please fill out the form below and we'll get back to you as soon as possible.
              </p>
            </div>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label
                  htmlFor="subject"
                  style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
                >
                  Subject
                </Label>
                <Input
                  id="subject"
                  name="subject"
                  value={supportFormData.subject}
                  onChange={handleSupportFormChange}
                  placeholder="Brief description of your issue"
                  className="border-slate-700/50 focus:border-blue-500/50 focus:ring-blue-500/20"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                    color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)',
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="message"
                  style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
                >
                  Message
                </Label>
                <textarea
                  id="message"
                  name="message"
                  value={supportFormData.message}
                  onChange={handleSupportFormChange}
                  placeholder="Please describe your issue in detail..."
                  className="flex min-h-[120px] w-full rounded-md border border-slate-700/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                    color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)',
                  }}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setSupportFormOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={submitSupportRequest}
                disabled={sendingSupportRequest}
                className="bg-gradient-to-r from-slate-300 via-slate-100 to-slate-300 hover:from-slate-200 hover:via-white hover:to-slate-200 text-slate-900 font-bold shadow-lg shadow-slate-400/20 border-t border-white/50 transition-all duration-500"
              >
                {sendingSupportRequest ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
