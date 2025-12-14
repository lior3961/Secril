import { api } from './api';

const LS_ACCESS = 'secril_access_token';
const LS_REFRESH = 'secril_refresh_token';

export function getTokens() {
  return {
    access: localStorage.getItem(LS_ACCESS) || '',
    refresh: localStorage.getItem(LS_REFRESH) || '',
  };
}

export function setTokens({ access, refresh }) {
  if (access) localStorage.setItem(LS_ACCESS, access);
  if (refresh) localStorage.setItem(LS_REFRESH, refresh);
}

export function clearTokens() {
  localStorage.removeItem(LS_ACCESS);
  localStorage.removeItem(LS_REFRESH);
}

export async function signup({ email, password, full_name, date_of_birth, phone }) {
  try {
    console.log('Frontend signup called with:', { email, password: '***', full_name, date_of_birth, phone });
    const response = await api('/api/auth/signup', {
      method: 'POST',
      body: { email, password, full_name, date_of_birth, phone },
    });

    // If auto-login was successful, set tokens
    if (response.session) {
      setTokens({ 
        access: response.session.access_token, 
        refresh: response.session.refresh_token 
      });
    }

    return response;
  } catch (error) {
    // Handle rate limiting errors specifically
    if (error.status === 429) {
      const retryAfter = error.retryAfter || 3600;
      const hours = Math.ceil(retryAfter / 3600);
      throw new Error(`יותר מדי ניסיונות הרשמה. אנא המתן ${hours} שעות`);
    }
    throw error;
  }
}

export async function login({ email, password }) {
  try {
    const { user, session } = await api('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setTokens({ access: session?.access_token, refresh: session?.refresh_token });
    return { user, session };
  } catch (error) {
    // Handle rate limiting errors specifically
    if (error.status === 429) {
      const retryAfter = error.retryAfter || 300;
      const minutes = Math.ceil(retryAfter / 60);
      throw new Error(`יותר מדי ניסיונות התחברות. אנא המתן ${minutes} דקות`);
    }
    throw error;
  }
}

export async function logout() {
  const { access, refresh } = getTokens();
  await api('/api/auth/logout', {
    method: 'POST',
    body: { access_token: access, refresh_token: refresh },
  }).catch(() => {}); // גם אם נכשל, ננקה מקומית
  clearTokens();
}
