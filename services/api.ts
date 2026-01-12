import { LoginRequest, LoginResponse, RegisterAdminRequest } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Log API URL in development
if (import.meta.env.DEV) {
  console.log('API URL:', API_URL);
}

// Helper function to get full image URL
export const getImageUrl = (imagePath: string | null | undefined): string | undefined => {
  if (!imagePath) return undefined;
  // If it's already a full URL, return as is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://') || imagePath.startsWith('data:')) {
    return imagePath;
  }
  // If it's a server path, prepend API URL
  if (imagePath.startsWith('/uploads/images/')) {
    return `${API_URL}${imagePath}`;
  }
  return imagePath;
};

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
        // Include validation details if available
        if (error.details && Array.isArray(error.details)) {
          const details = error.details.map((d: any) => `${d.path.join('.')}: ${d.message}`).join(', ');
          throw new Error(error.error || 'Validation error' + (details ? `: ${details}` : ''));
        }
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

  async deleteProject(id: string) {
    return this.request(`/projects/${id}`, {
      method: 'DELETE',
    });
  }

  // Upload image file
  async uploadProjectImage(projectId: string, file: File, imageType: 'planPreview' | 'global3dImage' | 'roomImage' | 'propertyPhoto', roomId?: string): Promise<{ url: string }> {
    const token = this.getToken();
    const formData = new FormData();
    formData.append('image', file);
    formData.append('imageType', imageType);
    if (roomId) {
      formData.append('roomId', roomId);
    }

    const response = await fetch(`${API_URL}/projects/${projectId}/upload-image`, {
      method: 'POST',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Upload base64 image (for generated images)
  async uploadBase64Image(projectId: string, imageData: string, imageType: 'planPreview' | 'global3dImage' | 'roomImage' | 'propertyPhoto', roomId?: string): Promise<{ url: string }> {
    return this.request(`/projects/${projectId}/upload-base64-image`, {
      method: 'POST',
      body: JSON.stringify({ imageData, imageType, roomId }),
    });
  }

  // Delete image
  async deleteProjectImage(projectId: string, imageType: 'planPreview' | 'global3dImage' | 'roomImage' | 'propertyPhoto', roomId?: string, photoIndex?: number): Promise<void> {
    return this.request(`/projects/${projectId}/image`, {
      method: 'DELETE',
      body: JSON.stringify({ imageType, roomId, photoIndex }),
    });
  }

  async exportProjectEstimatePDF(projectId: string, options: any): Promise<Blob> {
    const token = this.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${API_URL}/projects/${projectId}/export-pdf`;
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(options),
    });

    if (response.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      window.location.href = '/';
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.blob();
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

  // Superadmin endpoints
  async superadminLogin(username: string, password: string) {
    const response = await fetch(`${API_URL}/superadmin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();
    localStorage.setItem('superadmin_token', data.token);
    return data;
  }

  async superadminChangePassword(currentPassword: string, newPassword: string) {
    return this.superadminRequest('/superadmin/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async getDefaultPrices() {
    return this.superadminRequest('/superadmin/default-prices');
  }

  async createDefaultPrice(data: { name: string; unit: string; price: number; category: string; subcategory?: string; type: 'work' | 'rough' | 'finish'; sort_order?: number; supplier_url?: string; supplier_name?: string; auto_price_update?: boolean }) {
    return this.superadminRequest('/superadmin/default-prices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDefaultPrice(id: string, data: Partial<{ name: string; unit: string; price: number; category: string; subcategory?: string; type: 'work' | 'rough' | 'finish'; sort_order?: number; supplier_url?: string; supplier_name?: string; last_price_update?: string; auto_price_update?: boolean }>) {
    return this.superadminRequest(`/superadmin/default-prices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteDefaultPrice(id: string) {
    return this.superadminRequest(`/superadmin/default-prices/${id}`, {
      method: 'DELETE',
    });
  }

  // Supplier price methods
  async parseSupplierPrice(url: string) {
    // Проверяем, есть ли токен суперадмина
    const superadminToken = localStorage.getItem('superadmin_token');
    if (superadminToken) {
      return this.superadminRequest('/superadmin/suppliers/parse-price', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
    }
    // Используем обычный эндпоинт для пользователей
    return this.request('/suppliers/user/parse-price', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  async bulkSearchPrices(supplierUrls: string[], materialType: 'rough' | 'finish') {
    // Проверяем, есть ли токен суперадмина
    const superadminToken = localStorage.getItem('superadmin_token');
    if (superadminToken) {
      return this.superadminRequest('/superadmin/suppliers/bulk-search', {
        method: 'POST',
        body: JSON.stringify({ supplierUrls, materialType }),
      });
    }
    // Используем обычный эндпоинт для пользователей
    return this.request('/suppliers/user/bulk-search', {
      method: 'POST',
      body: JSON.stringify({ supplierUrls, materialType }),
    });
  }

  async bulkUpdatePrices(updates: Array<{ id: string; price: number; supplierUrl?: string; supplierName?: string }>) {
    // Проверяем, есть ли токен суперадмина
    const superadminToken = localStorage.getItem('superadmin_token');
    if (superadminToken) {
      return this.superadminRequest('/superadmin/suppliers/bulk-update', {
        method: 'POST',
        body: JSON.stringify({ updates }),
      });
    }
    // Используем обычный эндпоинт для пользователей
    return this.request('/suppliers/user/bulk-update', {
      method: 'POST',
      body: JSON.stringify({ updates }),
    });
  }

  async searchMaterialPrice(materialName: string, supplierUrls: string[]) {
    return this.superadminRequest('/superadmin/suppliers/search-material', {
      method: 'POST',
      body: JSON.stringify({ materialName, supplierUrls }),
    });
  }

  private async superadminRequest(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem('superadmin_token');
    if (!token) {
      throw new Error('Not authenticated');
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    };

    const url = `${API_URL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        // Include validation details if available
        if (error.details && Array.isArray(error.details)) {
          const details = error.details.map((d: any) => `${d.path.join('.')}: ${d.message}`).join(', ');
          throw new Error(error.error || 'Validation error' + (details ? `: ${details}` : ''));
        }
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

  // Warehouse - Materials endpoints
  async getMaterials(params?: { category?: string; search?: string }) {
    const query = new URLSearchParams();
    if (params?.category) query.append('category', params.category);
    if (params?.search) query.append('search', params.search);
    return this.request(`/materials${query.toString() ? '?' + query.toString() : ''}`);
  }

  async getMaterial(id: string) {
    return this.request(`/materials/${id}`);
  }

  async createMaterial(data: any) {
    return this.request('/materials', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMaterial(id: string, data: any) {
    return this.request(`/materials/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteMaterial(id: string) {
    return this.request(`/materials/${id}`, {
      method: 'DELETE',
    });
  }

  // Warehouse - Purchase Requests endpoints
  async getPurchaseRequests(params?: { status?: string; projectId?: string; dateFrom?: string; dateTo?: string; createdBy?: string }) {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.projectId) query.append('projectId', params.projectId);
    if (params?.dateFrom) query.append('dateFrom', params.dateFrom);
    if (params?.dateTo) query.append('dateTo', params.dateTo);
    if (params?.createdBy) query.append('createdBy', params.createdBy);
    return this.request(`/purchase-requests${query.toString() ? '?' + query.toString() : ''}`);
  }

  async getPurchaseRequest(id: string) {
    return this.request(`/purchase-requests/${id}`);
  }

  async createPurchaseRequest(data: any) {
    return this.request('/purchase-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePurchaseRequest(id: string, data: any) {
    return this.request(`/purchase-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async approvePurchaseRequest(id: string, data?: { items?: any[] }) {
    return this.request(`/purchase-requests/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }

  async rejectPurchaseRequest(id: string, reason?: string) {
    return this.request(`/purchase-requests/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async movePurchaseRequestToPurchase(id: string, data: any) {
    return this.request(`/purchase-requests/${id}/to-purchase`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPurchaseRequestLog(id: string) {
    return this.request(`/purchase-requests/${id}/log`);
  }

  // Warehouse - Project Materials endpoints
  async getProjectMaterials(projectId: string) {
    return this.request(`/projects/${projectId}/materials`);
  }

  async recordMaterialArrival(projectId: string, data: any) {
    return this.request(`/projects/${projectId}/materials/arrival`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async writeoffMaterial(projectId: string, data: any) {
    return this.request(`/projects/${projectId}/materials/writeoff`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async returnMaterial(projectId: string, data: any) {
    return this.request(`/projects/${projectId}/materials/return`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Warehouse - Central Warehouse endpoints
  async getWarehouseStock(params?: { category?: string; search?: string }) {
    const query = new URLSearchParams();
    if (params?.category) query.append('category', params.category);
    if (params?.search) query.append('search', params.search);
    return this.request(`/warehouse/stock${query.toString() ? '?' + query.toString() : ''}`);
  }

  async getLowStockMaterials() {
    return this.request('/warehouse/stock/low');
  }

  async recordWarehouseArrival(data: any) {
    return this.request('/warehouse/stock/arrival', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async transferMaterialToProject(data: any) {
    return this.request('/warehouse/stock/transfer', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Warehouse - Tools endpoints
  async getTools(params?: { category?: string; status?: string; employeeId?: string; projectId?: string }) {
    const query = new URLSearchParams();
    if (params?.category) query.append('category', params.category);
    if (params?.status) query.append('status', params.status);
    if (params?.employeeId) query.append('employeeId', params.employeeId);
    if (params?.projectId) query.append('projectId', params.projectId);
    return this.request(`/tools${query.toString() ? '?' + query.toString() : ''}`);
  }

  async getTool(id: string) {
    return this.request(`/tools/${id}`);
  }

  async createTool(data: any) {
    return this.request('/tools', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTool(id: string, data: any) {
    return this.request(`/tools/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async issueTool(id: string, data: any) {
    return this.request(`/tools/${id}/issue`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async returnTool(id: string, data: any) {
    return this.request(`/tools/${id}/return`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getToolMovements(id: string) {
    return this.request(`/tools/${id}/movements`);
  }

  // Warehouse - Material Returns endpoints
  async getReturns(params?: { status?: string; projectId?: string }) {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.projectId) query.append('projectId', params.projectId);
    return this.request(`/returns${query.toString() ? '?' + query.toString() : ''}`);
  }

  async getReturn(id: string) {
    return this.request(`/returns/${id}`);
  }

  async createReturn(data: any) {
    return this.request('/returns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateReturn(id: string, data: any) {
    return this.request(`/returns/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Warehouse - Operations endpoints
  async getWarehouseOperations(params?: { operationType?: string; dateFrom?: string; dateTo?: string; projectId?: string; employeeId?: string; materialId?: string; toolId?: string }) {
    const query = new URLSearchParams();
    if (params?.operationType) query.append('operationType', params.operationType);
    if (params?.dateFrom) query.append('dateFrom', params.dateFrom);
    if (params?.dateTo) query.append('dateTo', params.dateTo);
    if (params?.projectId) query.append('projectId', params.projectId);
    if (params?.employeeId) query.append('employeeId', params.employeeId);
    if (params?.materialId) query.append('materialId', params.materialId);
    if (params?.toolId) query.append('toolId', params.toolId);
    return this.request(`/warehouse-operations${query.toString() ? '?' + query.toString() : ''}`);
  }

  // Warehouse - Suppliers endpoints
  async getSuppliers() {
    return this.request('/suppliers/list');
  }

  async getSupplier(id: string) {
    return this.request(`/suppliers/list/${id}`);
  }

  async createSupplier(data: any) {
    return this.request('/suppliers/list', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSupplier(id: string, data: any) {
    return this.request(`/suppliers/list/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient();

