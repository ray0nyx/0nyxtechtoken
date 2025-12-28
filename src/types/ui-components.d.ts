import * as React from 'react';

// Button component
declare module '@/components/ui/button' {
  export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    asChild?: boolean;
    children?: React.ReactNode;
    type?: 'button' | 'submit' | 'reset';
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    disabled?: boolean;
    className?: string;
  }
  
  export const Button: React.FC<ButtonProps>;
}

// Input component
declare module '@/components/ui/input' {
  export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    id?: string;
    name?: string;
    type?: string;
    accept?: string;
    ref?: React.RefObject<HTMLInputElement>;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    disabled?: boolean;
    className?: string;
    placeholder?: string;
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    autoComplete?: string;
  }
  
  export const Input: React.FC<InputProps>;
}

// Link component
declare module 'react-router-dom' {
  export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    to: string;
    replace?: boolean;
    state?: any;
    children?: React.ReactNode;
    className?: string;
  }
  
  export const Link: React.FC<LinkProps>;
}

// Label component
declare module '@/components/ui/label' {
  export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
    children?: React.ReactNode;
    htmlFor?: string;
  }
  
  export const Label: React.FC<LabelProps>;
}

// Select component
declare module '@/components/ui/select' {
  export interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children?: React.ReactNode;
    id?: string;
    className?: string;
  }
  
  export interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
    value: string;
    children?: React.ReactNode;
    key?: string;
    disabled?: boolean;
  }
  
  export const SelectTrigger: React.FC<SelectTriggerProps>;
  export const SelectItem: React.FC<SelectItemProps>;
}

// Tabs component
declare module '@/components/ui/tabs' {
  export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
    value: string;
    children?: React.ReactNode;
  }
  
  export const TabsContent: React.FC<TabsContentProps>;
}

// Switch component
declare module '@/components/ui/switch' {
  export interface SwitchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }
  
  export const Switch: React.FC<SwitchProps>;
}

// Badge component
declare module '@/components/ui/badge' {
  export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
    children?: React.ReactNode;
  }
  
  export const Badge: React.FC<BadgeProps>;
}

// AlertDialog component
declare module '@/components/ui/alert-dialog' {
  export interface AlertDialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    asChild?: boolean;
    children?: React.ReactNode;
  }
  
  export interface AlertDialogActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children?: React.ReactNode;
    onClick?: () => void;
    className?: string;
    disabled?: boolean;
  }
  
  export interface AlertDialogCancelProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children?: React.ReactNode;
    onClick?: () => void;
  }
  
  export const AlertDialogTrigger: React.FC<AlertDialogTriggerProps>;
  export const AlertDialogAction: React.FC<AlertDialogActionProps>;
  export const AlertDialogCancel: React.FC<AlertDialogCancelProps>;
}

// Progress component
declare module '@/components/ui/progress' {
  export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
    value?: number;
    max?: number;
    className?: string;
  }
  
  export const Progress: React.FC<ProgressProps>;
}

// Toast component
declare module '@/components/ui/use-toast' {
  export interface Toast {
    id?: string;
    title?: React.ReactNode;
    description?: React.ReactNode;
    action?: React.ReactNode;
    variant?: 'default' | 'destructive' | 'success';
    duration?: number;
    options?: any;
  }
  
  export const useToast: () => {
    toast: (props: Toast) => void;
    dismiss: (toastId?: string) => void;
  };
}

// UI Component Types
interface ButtonProps {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: "button" | "submit" | "reset";
  children?: React.ReactNode;
  asChild?: boolean;
  key?: string | number;
}

interface InputProps {
  className?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  min?: string;
  max?: string;
  step?: string;
  autoComplete?: string;
  minLength?: number;
  maxLength?: number;
  key?: string | number;
  autoFocus?: boolean;
}

interface TextareaProps {
  className?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  rows?: number;
}

interface SelectTriggerProps {
  className?: string;
  id?: string;
  children?: React.ReactNode;
}

interface SelectItemProps {
  value: string;
  children?: React.ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children?: React.ReactNode;
}

interface TabsListProps {
  className?: string;
  children?: React.ReactNode;
}

interface TabsTriggerProps {
  value: string;
  className?: string;
  children?: React.ReactNode;
}

interface AlertDialogTriggerProps {
  asChild?: boolean;
  children?: React.ReactNode;
}

interface AlertDialogActionProps {
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

interface AlertDialogCancelProps {
  onClick?: () => void;
  children?: React.ReactNode;
}

interface TooltipTriggerProps {
  asChild?: boolean;
  children?: React.ReactNode;
}

interface BadgeProps {
  variant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
  children?: React.ReactNode;
  key?: string | number;
}

interface Toast {
  id?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  variant?: 'default' | 'destructive' | 'success';
  duration?: number;
  options?: any;
}

interface TiptapEditorProps {
  content?: string;
  onChange?: (value: string) => void;
  onImageUpload?: () => Promise<string>;
  placeholder?: string;
  className?: string;
  editorClassName?: string;
  autofocus?: boolean;
  key?: number;
}

// Supabase Client Extensions
interface SupabaseClient {
  auth: {
    getUser(): Promise<{ data: { user: User }; error: Error }>;
    getSession(): Promise<{ data: { session: Session }; error: Error }>;
    signInWithPassword(credentials: { email: string; password: string }): Promise<any>;
    signInWithOAuth(options: { provider: string; options?: any }): Promise<any>;
    signUp(credentials: { email: string; password: string; options?: any }): Promise<any>;
    onAuthStateChange(callback: (event: string, session: Session | null) => void): { data: { subscription: any } };
    signOut(): Promise<{ error: Error | null }>;
    resetPasswordForEmail(email: string, options?: any): Promise<{ error: Error | null }>;
    updateUser(attributes: any): Promise<{ error: Error | null }>;
    resend(options: any): Promise<{ error: Error | null }>;
  };
  storage: {
    from(bucket: string): {
      upload(path: string, file: File, options?: any): Promise<{ data: any; error: Error | null }>;
      getPublicUrl(path: string): { data: { publicUrl: string } };
    };
  };
  functions: {
    invoke(name: string, options?: any): Promise<{ data: any; error: Error | null }>;
  };
  rpc(procedure: string, params?: any): Promise<{ data: any; error: Error | null }>;
}

// Card components
declare module '@/components/ui/card' {
  export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children?: React.ReactNode;
    className?: string;
  }
  
  export const Card: React.FC<CardProps>;
  export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>>;
  export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>>;
  export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>>;
  export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>>;
  export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>>;
} 