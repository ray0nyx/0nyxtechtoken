// React module augmentation - extends @types/react instead of replacing it
// This file should only ADD types, not redefine existing ones

import 'react';

// Re-export everything from the actual React types
// This ensures Suspense, lazy, and other core React features are available
declare module 'react' {
  // Add any custom type augmentations here if needed
  // The core React types (Suspense, lazy, etc.) come from @types/react
}

// Declare additional modules that may not have types
declare module 'react/jsx-runtime';