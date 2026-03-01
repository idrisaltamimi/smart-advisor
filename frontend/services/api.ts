import Constants from 'expo-constants';

const API_PORT = 8000;

function getDebuggerHost(): string | null {
  const sources = [
    Constants.expoGoConfig?.debuggerHost,        // SDK 50+ (most reliable in SDK 54)
    Constants.expoConfig?.hostUri,               // SDK 50+ alternative
    Constants.manifest2?.extra?.expoGo?.debuggerHost, // SDK 46-49 EAS manifest
    Constants.manifest?.debuggerHost,            // SDK <46 legacy
  ];

  for (const host of sources) {
    if (host) {
      return host;
    }
  }
  return null;
}

export function getApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  if (__DEV__) {
    const debuggerHost = getDebuggerHost();
    if (debuggerHost) {
      const ip = debuggerHost.split(':')[0];
      const url = `http://${ip}:${API_PORT}`;
      console.log('[API] Auto-detected URL:', url);
      return url;
    }
    console.warn('[API] Could not detect IP, falling back to localhost');
  }

  return `http://localhost:${API_PORT}`;
}

export const API_BASE_URL = getApiUrl();

async function request<T>(path: string, options?: RequestInit, token?: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    ...options
  })

  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = await res.json()
      if (body.detail) detail = body.detail
    } catch {}
    throw new Error(detail)
  }

  return res.json() as Promise<T>
}

export interface User {
  id: string
  email: string
  full_name: string
  major_id: string | null
}

export interface Major {
  id: string
  name: string
  total_credits_required: number
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export function apiRegister(
  full_name: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ full_name, email, password })
  })
}

export function apiLogin(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  })
}

export function apiGetMajors(): Promise<Major[]> {
  return request<Major[]>("/majors")
}

export function apiSetMajor(major_id: string, token: string): Promise<User> {
  return request<User>("/users/me/major", { method: "POST", body: JSON.stringify({ major_id }) }, token)
}
