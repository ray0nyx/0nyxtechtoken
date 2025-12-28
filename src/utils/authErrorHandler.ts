// Utility for handling Supabase auth errors with user-friendly messages

export interface AuthError {
  message: string;
  status?: number;
  name?: string;
}

export interface ErrorHandlingResult {
  shouldShowToast: boolean;
  toastTitle: string;
  toastDescription: string;
  toastVariant: 'default' | 'destructive';
  shouldReturn: boolean;
}

export function handleAuthError(error: AuthError): ErrorHandlingResult {
  const message = error.message.toLowerCase();
  const status = error.status;

  // Rate limiting errors
  if (message.includes('30 seconds') || 
      message.includes('31 seconds') || 
      message.includes('for security purposes') ||
      message.includes('rate limit') ||
      message.includes('too many requests')) {
    return {
      shouldShowToast: true,
      toastTitle: "Rate Limited",
      toastDescription: "Please wait 30 seconds before requesting another password reset email.",
      toastVariant: "destructive",
      shouldReturn: true
    };
  }

  // HTTP 429 status
  if (status === 429) {
    return {
      shouldShowToast: true,
      toastTitle: "Too Many Requests",
      toastDescription: "Please wait a moment before trying again.",
      toastVariant: "destructive",
      shouldReturn: true
    };
  }

  // Network errors
  if (message.includes('network') || 
      message.includes('fetch') || 
      message.includes('connection')) {
    return {
      shouldShowToast: true,
      toastTitle: "Network Error",
      toastDescription: "Please check your internet connection and try again.",
      toastVariant: "destructive",
      shouldReturn: true
    };
  }

  // Invalid email
  if (message.includes('invalid email') || 
      message.includes('email not found')) {
    return {
      shouldShowToast: true,
      toastTitle: "Invalid Email",
      toastDescription: "Please check your email address and try again.",
      toastVariant: "destructive",
      shouldReturn: true
    };
  }

  // User not found
  if (message.includes('user not found') || 
      message.includes('no user found')) {
    return {
      shouldShowToast: true,
      toastTitle: "User Not Found",
      toastDescription: "No account found with this email address.",
      toastVariant: "destructive",
      shouldReturn: true
    };
  }

  // Generic error
  return {
    shouldShowToast: true,
    toastTitle: "Error",
    toastDescription: error.message || "An unexpected error occurred. Please try again.",
    toastVariant: "destructive",
    shouldReturn: false
  };
}

// Helper function to check if an error is a rate limiting error
export function isRateLimitError(error: AuthError): boolean {
  const message = error.message.toLowerCase();
  return message.includes('30 seconds') || 
         message.includes('31 seconds') || 
         message.includes('for security purposes') ||
         message.includes('rate limit') ||
         message.includes('too many requests') ||
         error.status === 429;
}

// Helper function to extract cooldown time from error message
export function extractCooldownTime(error: AuthError): number {
  const message = error.message;
  const match = message.match(/(\d+)\s+seconds?/);
  return match ? parseInt(match[1]) : 30;
}
