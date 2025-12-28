/**
 * Global type declarations for the project
 */

// Vite environment variables
interface ImportMeta {
  env: {
    VITE_SUPABASE_URL: string;
    VITE_SUPABASE_ANON_KEY: string;
    [key: string]: string;
  };
}

// React namespace extensions
declare namespace React {
  interface ChangeEvent<T = Element> {
    target: T;
    currentTarget: T;
  }
  
  interface FormEvent<T = Element> {
    preventDefault(): void;
    target: T;
    currentTarget: T;
  }
  
  interface DragEvent<T = Element> {
    preventDefault(): void;
    dataTransfer: DataTransfer;
    target: T;
    currentTarget: T;
  }

  interface HTMLAttributes<T = Element> {
    key?: string | number;
    className?: string;
    id?: string;
    style?: any;
    variant?: string;
    value?: string | number | readonly string[];
    onClick?: (event: any) => void;
    onChange?: (event: any) => void;
    onBlur?: (event: any) => void;
    onFocus?: (event: any) => void;
    disabled?: boolean;
    placeholder?: string;
    type?: string;
    name?: string;
    required?: boolean;
    checked?: boolean;
    defaultValue?: string | number | readonly string[];
    defaultChecked?: boolean;
    autoFocus?: boolean;
    [key: string]: any;
  }

  // Add specific attributes for div elements
  interface HTMLDivElement {
    key?: string | number;
  }

  // Add specific interface for Card component
  interface CardProps extends HTMLAttributes<HTMLDivElement> {
    key?: string | number;
  }

  type ReactNode = any;
  type ReactElement = any;
  type ReactFragment = any;
  type ReactPortal = any;
}

// JSX namespace to ensure key property is handled correctly
declare namespace JSX {
  interface IntrinsicAttributes {
    key?: string | number;
  }
  
  interface ElementAttributesProperty {
    props: {};
  }
  
  interface ElementChildrenAttribute {
    children: {};
  }
  
  interface IntrinsicElements {
    div: React.HTMLAttributes<HTMLDivElement> & { key?: string | number };
    span: React.HTMLAttributes<HTMLSpanElement> & { key?: string | number };
    // Add other elements as needed
  }
} 