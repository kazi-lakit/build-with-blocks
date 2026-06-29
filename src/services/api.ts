const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://dev-api.blocksdevelopers.com';
const TENANT_ID = import.meta.env.VITE_TENANT_ID || '';

type Service = 'iam' | 'data';

function buildUrl(service: Service, endpoint: string): string {
  const path = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE}/${service}/v4/${path}`;
}

function defaultHeaders(): Record<string, string> {
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'x-blocks-key': TENANT_ID,
  };
}

async function request(
  service: Service,
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = buildUrl(service, endpoint);
  return fetch(url, {
    credentials: 'include',
    ...options,
    headers: {
      ...defaultHeaders(),
      ...options.headers,
    },
  });
}

function makeServiceClient(service: Service) {
  return {
    get(endpoint: string, options?: RequestInit) {
      return request(service, endpoint, { method: 'GET', ...options });
    },
    post<T>(endpoint: string, body: T, options?: RequestInit) {
      return request(service, endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
        ...options,
      });
    },
    put<T>(endpoint: string, body: T, options?: RequestInit) {
      return request(service, endpoint, {
        method: 'PUT',
        body: JSON.stringify(body),
        ...options,
      });
    },
    patch<T>(endpoint: string, body: T, options?: RequestInit) {
      return request(service, endpoint, {
        method: 'PATCH',
        body: JSON.stringify(body),
        ...options,
      });
    },
    delete(endpoint: string, options?: RequestInit) {
      return request(service, endpoint, { method: 'DELETE', ...options });
    },
  };
}

export const iamApi = makeServiceClient('iam');
export const dataApi = makeServiceClient('data');
