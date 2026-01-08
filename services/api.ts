import { LoginRequest, LoginResponse, RegisterAdminRequest } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Log API URL in development
if (import.meta.env.DEV) {
  console.log('API URL:', API_URL);
}

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${API_URL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (response.status === 401) {
        // Unauthorized - clear token and redirect to login
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        window.location.href = '/';
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return response.json();
    } catch (error: any) {
      // Handle network errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.error('Network error:', error);
        console.error('API URL:', API_URL);
        console.error('Full URL:', url);
        throw new Error(`Не удалось подключиться к серверу. Проверьте, что бэкенд запущен и доступен по адресу: ${API_URL}`);
      }
      throw error;
    }
  }

  // Auth endpoints
  async registerAdmin(data: RegisterAdminRequest): Promise<LoginResponse> {
    return this.request<LoginResponse>('/auth/register-admin', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: LoginRequest): Promise<LoginResponse> {
    return this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Users endpoints
  async getUsers() {
    return this.request('/users');
  }

  async createUser(data: { email: string; password: string; name: string; role: string }) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(id: string, data: Partial<{ email: string; name: string; role: string }>) {
    return this.request(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(id: string) {
    return this.request(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  // Permissions endpoints
  async getPermissions() {
    return this.request('/permissions');
  }

  async updatePermission(data: { role: string; permission: string; allowed: boolean }) {
    return this.request('/permissions', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Projects endpoints
  async getProjects() {
    return this.request('/projects');
  }

  async getProject(id: string) {
    return this.request(`/projects/${id}`);
  }

  async createProject(data: { name: string }) {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(id: string, data: any) {
    return this.request(`/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // AI endpoints
  async getAILimit() {
    return this.request('/ai/limit');
  }

  async analyzePlan(data: any) {
    return this.request('/ai/analyze-plan', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async generateRoom(data: any) {
    return this.request('/ai/generate-room', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async generateIsometric(data: any) {
    return this.request('/ai/generate-isometric', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Price items endpoints
  async getPriceItems() {
    return this.request('/prices');
  }

  async createPriceItem(data: { name: string; unit: string; price: number; category: string; subcategory?: string; type: 'work' | 'rough' | 'finish' }) {
    return this.request('/prices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePriceItem(id: string, data: Partial<{ name: string; unit: string; price: number; category: string; subcategory?: string; type: 'work' | 'rough' | 'finish' }>) {
    return this.request(`/prices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deletePriceItem(id: string) {
    return this.request(`/prices/${id}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient();

