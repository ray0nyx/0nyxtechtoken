export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: Date;
  role?: 'user' | 'admin';
  subscription?: {
    type: 'free' | 'pro' | 'enterprise';
    expiresAt: Date;
  };
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface SignUpData {
  email: string;
  password: string;
  name?: string;
}

export interface SignInData {
  email: string;
  password: string;
} 