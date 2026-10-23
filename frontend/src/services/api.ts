import type { User, SystemMetrics, CreateUserData, UserRole } from '../types';

const TOKEN_KEY = 'sentinel_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearStoredToken();
    window.dispatchEvent(new Event('sentinel:unauthorized'));
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'İşlem sırasında bir hata oluştu');
  }

  return data as T;
}

export const api = {
  async login(username: string, password: string): Promise<{ token: string; user: User }> {
    const res = await request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setStoredToken(res.token);
    return res;
  },

  async logout(): Promise<void> {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } finally {
      clearStoredToken();
    }
  },

  async getMe(): Promise<User> {
    return request<User>('/api/auth/me');
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return request<{ message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
  },

  async getMetricsSummary(): Promise<SystemMetrics> {
    return request<SystemMetrics>('/api/metrics/summary');
  },

  async killProcess(pid: number): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/processes/${pid}/kill`, {
      method: 'POST',
    });
  },

  async restartContainer(id: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/docker/containers/${id}/restart`, {
      method: 'POST',
    });
  },

  async stopContainer(id: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/docker/containers/${id}/stop`, {
      method: 'POST',
    });
  },

  async startContainer(id: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/docker/containers/${id}/start`, {
      method: 'POST',
    });
  },

  async getUsers(): Promise<User[]> {
    return request<User[]>('/api/users');
  },

  async createUser(data: CreateUserData): Promise<User> {
    return request<User>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteUser(id: number): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/users/${id}`, {
      method: 'DELETE',
    });
  },

  async updateUserRole(id: number, role: UserRole): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/users/${id}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  },
};


