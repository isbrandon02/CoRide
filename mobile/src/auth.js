import * as SecureStore from 'expo-secure-store';

import { API_BASE_URL } from './config';

function networkErrorMessage() {
  return (
    `Cannot reach the API at ${API_BASE_URL}.\n\n` +
    '• Start the backend (uvicorn on port 8000).\n' +
    '• On a physical phone, create mobile/.env with EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_IP:8000 (same Wi‑Fi), then restart Expo.\n' +
    '• Android emulator uses 10.0.2.2 by default; iOS Simulator uses 127.0.0.1.'
  );
}

async function apiFetch(url, options) {
  try {
    return await fetch(url, options);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    if (
      m.includes('Network request failed') ||
      m.includes('Failed to fetch') ||
      m.includes('Aborted')
    ) {
      throw new Error(networkErrorMessage());
    }
    throw e;
  }
}

const TOKEN_KEY = 'access_token';

export async function getStoredToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setStoredToken(token) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearStoredToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

function parseErrorDetail(data, fallback = 'Request failed') {
  const d = data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) {
    return d.map((e) => e.msg ?? JSON.stringify(e)).join(', ');
  }
  if (d && typeof d === 'object') return JSON.stringify(d);
  return fallback;
}

/**
 * @returns {Promise<{ message: string, email: string }>}
 */
export async function registerAccount(email, password) {
  const res = await apiFetch(`${API_BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(parseErrorDetail(data, 'Could not create account'));
  }

  return data;
}

/**
 * OAuth2 password flow: username = email, password = password.
 */
export async function loginWithPassword(email, password) {
  const body = new URLSearchParams({
    username: email.trim().toLowerCase(),
    password,
  });

  const res = await apiFetch(`${API_BASE_URL}/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(parseErrorDetail(data, 'Sign in failed'));
  }

  if (!data.access_token) {
    throw new Error('Invalid response from server');
  }

  return data.access_token;
}
