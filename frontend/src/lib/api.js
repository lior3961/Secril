const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '';

export async function api(path, { method = 'GET', headers = {}, body, token } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`;
    const error = new Error(msg);
    error.status = res.status;
    error.retryAfter = data?.retryAfter;
    throw error;
  }
  return data;
}
