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

/**
 * @returns {Promise<{ id: number, email: string, onboarding_completed: boolean }>}
 */
export async function getMe(accessToken) {
  const res = await apiFetch(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorDetail(data, 'Could not load account'));
  }
  return data;
}

/**
 * Ranked coworker matches (60% route overlap + 40% time proximity on server).
 * @returns {Promise<{ matches: Array<object>, weights: object }>}
 */
export async function getMatches(accessToken) {
  const res = await apiFetch(`${API_BASE_URL}/matches`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorDetail(data, 'Could not load matches'));
  }
  return data;
}

/**
 * @returns {Promise<object>} GET /profile — home, office, hobbies, route, vehicle, onboarding_completed
 */
export async function getProfile(accessToken) {
  const res = await apiFetch(`${API_BASE_URL}/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorDetail(data, 'Could not load profile'));
  }
  return data;
}

/**
 * @param {object} payload - home_address, office_address, hobbies, commute_route, work_schedule, vehicle
 */
export async function saveOnboarding(accessToken, payload) {
  const res = await apiFetch(`${API_BASE_URL}/profile`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorDetail(data, 'Could not save'));
  }
  return data;
}

/**
 * @returns {Promise<{ rides: Array<{ id: number, status: string, role: string, other_user: { id: number, email: string, name: string }, note: string, created_at: string, route_origin?: string, route_destination?: string }> }>}
 */
export async function getRides(accessToken) {
  const res = await apiFetch(`${API_BASE_URL}/rides`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorDetail(data, 'Could not load rides'));
  }
  return data;
}

/**
 * @param {{ driver_id: number, note?: string }} body
 */
export async function createRideRequest(accessToken, body) {
  const res = await apiFetch(`${API_BASE_URL}/rides`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      driver_id: body.driver_id,
      note: (body.note ?? '').trim(),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorDetail(data, 'Could not send ride request'));
  }
  return data;
}

/**
 * @param {'accepted' | 'declined' | 'cancelled' | 'completed'} status
 */
/**
 * @returns {Promise<{ total_saved: number, total_co2_kg: number, rides_shared: number, weekly: Array<{ d: string, v: number }> }>}
 */
export async function getImpact(accessToken) {
  const res = await apiFetch(`${API_BASE_URL}/impact`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorDetail(data, 'Could not load impact'));
  }
  return data;
}

export async function patchRideStatus(accessToken, rideId, status) {
  const res = await apiFetch(`${API_BASE_URL}/rides/${rideId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorDetail(data, 'Could not update ride'));
  }
  return data;
}

/**
 * @returns {Promise<{ conversations: Array<{ id: number, title: string, preview: string, time: string }> }>}
 */
export async function getChatConversations(accessToken) {
  const res = await apiFetch(`${API_BASE_URL}/chats`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorDetail(data, 'Could not load conversations'));
  }
  return data;
}

/**
 * @returns {Promise<{ users: Array<{ id: number, email: string, name: string, avatar_url?: string | null }> }>}
 */
export async function getChatCandidates(accessToken) {
  const res = await apiFetch(`${API_BASE_URL}/chats/candidates`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorDetail(data, 'Could not load chat candidates'));
  }
  return data;
}

/**
 * @returns {Promise<{ conversation_id: number, title: string }>}
 */
export async function openOrGetDm(accessToken, otherUserId) {
  const res = await apiFetch(`${API_BASE_URL}/chats/dm`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ other_user_id: otherUserId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorDetail(data, 'Could not open chat'));
  }
  return data;
}

/**
 * @returns {Promise<{ conversation_id: number, title: string }>}
 */
export async function createGroupChat(accessToken, body) {
  const res = await apiFetch(`${API_BASE_URL}/chats/group`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_ids: Array.isArray(body.user_ids) ? body.user_ids : [],
      title: (body.title ?? '').trim(),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorDetail(data, 'Could not create group chat'));
  }
  return data;
}

/**
 * @returns {Promise<{ messages: Array<{ id: number, sender_id: number, body: string, created_at: string, is_me: boolean, sender_name?: string }> }>}
 */
export async function getChatMessages(accessToken, conversationId) {
  const res = await apiFetch(`${API_BASE_URL}/chats/${conversationId}/messages`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorDetail(data, 'Could not load messages'));
  }
  return data;
}

/**
 * @returns {Promise<{ id: number, sender_id: number, body: string, created_at: string, is_me: boolean, sender_name?: string }>}
 */
export async function sendChatMessage(accessToken, conversationId, body) {
  const res = await apiFetch(`${API_BASE_URL}/chats/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorDetail(data, 'Could not send message'));
  }
  return data;
}

/**
 * @returns {Promise<{ id: number, title: string }>}
 */
export async function renameChatConversation(accessToken, conversationId, title) {
  const res = await apiFetch(`${API_BASE_URL}/chats/${conversationId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: (title ?? '').trim() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorDetail(data, 'Could not rename conversation'));
  }
  return data;
}
