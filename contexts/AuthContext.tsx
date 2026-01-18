import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, LoginRequest, RegisterAdminRequest, LoginResponse, Permission } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (data: LoginRequest) => Promise<void>;
  registerAdmin: (data: RegisterAdminRequest) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default permissions for each role (should match backend)
const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    'edit_prices',
    'view_all_projects',
    'create_projects',
    'create_users',
    'use_ai_generation',
    'view_estimates',
    'edit_estimates',
    'manage_settings',
    'manage_permissions',
    // Warehouse permissions
    'view_warehouse',
    'create_purchase_requests',
    'approve_purchase_requests',
    'manage_warehouse',
    'manage_tools',
  ],
  manager: [
    'view_all_projects',
    'create_projects',
    'view_estimates',
    'edit_estimates',
    'use_ai_generation',
    // Warehouse permissions
    'view_warehouse',
    'create_purchase_requests',
    'approve_purchase_requests',
    'manage_warehouse',
    'manage_tools',
    // Sales permissions
    'view_sales',
    'create_deals',
    'edit_deals',
    'view_all_deals',
  ],
  measurer: [
    'create_projects',
    'view_estimates',
    'use_ai_generation',
    // Sales permissions
    'view_sales',
    'edit_deals',
  ],
  foreman: [
    'view_estimates',
    'edit_estimates',
    // Warehouse permissions
    'view_warehouse',
    'create_purchase_requests',
  ],
  master: [
    'view_estimates',
    // Warehouse permissions
    'view_warehouse',
    'create_purchase_requests',
  ],
  client: [],
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load user and token from localStorage on mount
    const savedToken = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('user');

    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        // Устанавливаем состояние синхронно
        setToken(savedToken);
        setUser(parsedUser);
        // Устанавливаем isLoading в false только после установки user и token
        // Используем setTimeout(0) чтобы гарантировать, что state обновится
        setTimeout(() => {
          setIsLoading(false);
        }, 0);
      } catch (error) {
        console.error('Failed to parse saved user:', error);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (data: LoginRequest) => {
    const response: LoginResponse = await api.login(data);
    setToken(response.token);
    setUser(response.user);
    localStorage.setItem('auth_token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));
  };

  const registerAdmin = async (data: RegisterAdminRequest) => {
    const response: LoginResponse = await api.registerAdmin(data);
    setToken(response.token);
    setUser(response.user);
    localStorage.setItem('auth_token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  };

  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false;
    
    // For now, use default permissions
    // TODO: Load custom permissions from API
    const rolePermissions = DEFAULT_ROLE_PERMISSIONS[user.role] || [];
    return rolePermissions.includes(permission);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        registerAdmin,
        logout,
        hasPermission,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const usePermission = (permission: Permission): boolean => {
  const { hasPermission } = useAuth();
  return hasPermission(permission);
};

