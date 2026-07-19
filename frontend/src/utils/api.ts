const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  code?: string;
  message?: string;
}

export const api = {
  get: async <T = any>(endpoint: string): Promise<T> => {
    const token = localStorage.getItem('mediclinic_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw {
        status: response.status,
        error: errorData.error || 'Une erreur est survenue',
        code: errorData.code,
        message: errorData.message
      };
    }

    return response.json();
  },

  post: async <T = any>(endpoint: string, body: any): Promise<T> => {
    const token = localStorage.getItem('mediclinic_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw {
        status: response.status,
        error: errorData.error || 'Une erreur est survenue',
        code: errorData.code,
        message: errorData.message
      };
    }

    return response.json();
  },

  put: async <T = any>(endpoint: string, body: any): Promise<T> => {
    const token = localStorage.getItem('mediclinic_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw {
        status: response.status,
        error: errorData.error || 'Une erreur est survenue',
        code: errorData.code,
        message: errorData.message
      };
    }

    return response.json();
  },

  delete: async <T = any>(endpoint: string): Promise<T> => {
    const token = localStorage.getItem('mediclinic_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw {
        status: response.status,
        error: errorData.error || 'Une erreur est survenue',
        code: errorData.code,
        message: errorData.message
      };
    }

    return response.json();
  }
};
