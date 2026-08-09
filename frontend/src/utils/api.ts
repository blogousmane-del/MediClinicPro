const API_URL = import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000/api'
    : '/api');

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  code?: string;
  message?: string;
}

export interface ApiError {
  status: number;
  error: string;
  code?: string;
  message?: string;
}

// Codes que le serveur renvoie quand l'accès dépend de l'état de la clinique et
// non de la requête elle-même : abonnement expiré, verrouillé, compte suspendu.
// Ils signalent que l'état chargé au montage n'est plus le bon.
const SUBSCRIPTION_CODES = ['SUBSCRIPTION_LOCKED', 'SUBSCRIPTION_EXPIRED', 'ACCOUNT_SUSPENDED'];

type SubscriptionErrorHandler = (error: ApiError) => void;

let onSubscriptionError: SubscriptionErrorHandler | null = null;

/**
 * Branché une fois par AuthContext. Sans ce rappel, un abonnement expirant en
 * cours de session ne se voyait qu'au rechargement : l'utilisateur restait sur
 * une interface ouverte dont chaque action échouait.
 */
export const setSubscriptionErrorHandler = (handler: SubscriptionErrorHandler | null) => {
  onSubscriptionError = handler;
};

const buildHeaders = (): HeadersInit => {
  const token = localStorage.getItem('mediclinic_token');
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const request = async <T = any>(method: string, endpoint: string, body?: any): Promise<T> => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: buildHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const apiError: ApiError = {
      status: response.status,
      error: errorData.error || 'Une erreur est survenue',
      code: errorData.code,
      message: errorData.message
    };

    if (apiError.status === 403 && apiError.code && SUBSCRIPTION_CODES.includes(apiError.code)) {
      onSubscriptionError?.(apiError);
    }

    throw apiError;
  }

  return response.json();
};

export const api = {
  get: <T = any>(endpoint: string): Promise<T> => request<T>('GET', endpoint),
  post: <T = any>(endpoint: string, body: any): Promise<T> => request<T>('POST', endpoint, body),
  put: <T = any>(endpoint: string, body: any): Promise<T> => request<T>('PUT', endpoint, body),
  delete: <T = any>(endpoint: string): Promise<T> => request<T>('DELETE', endpoint)
};
