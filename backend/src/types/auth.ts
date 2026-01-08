export type UserRole = 'admin' | 'manager' | 'measurer' | 'foreman' | 'master' | 'client';

export interface User {
  id: string;
  email: string;
  name: string | null;
  organizationId: string;
  role: UserRole;
  createdAt: Date;
  createdBy: string | null;
}

export interface JWTPayload {
  userId: string;
  email: string;
  organizationId: string;
  role: UserRole;
}

export interface RegisterAdminRequest {
  email: string;
  password: string;
  name: string;
  organizationName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
    organizationId: string;
  };
}

