import { GOOGLE_MAPS_API_KEY } from './config';

function extractGoogleError(data, fallback) {
  const message =
    data?.error?.message ||
    data?.error?.details?.[0]?.message ||
    data?.message;
  return typeof message === 'string' && message.trim() ? message.trim() : fallback;
}

export function hasGoogleMapsKey() {
  return Boolean(GOOGLE_MAPS_API_KEY);
}

export function createPlacesSessionToken() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function fetchAddressSuggestions(
  input,
  { signal, regionCode = 'us', sessionToken, mode = 'address' } = {},
) {
  const raw = String(input ?? '').trim();
  if (!raw || raw.length < 3 || !GOOGLE_MAPS_API_KEY) {
    return [];
  }

  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask':
        'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text',
    },
    body: JSON.stringify({
      input: raw,
      ...(mode === 'address' ? { includedPrimaryTypes: ['street_address'] } : {}),
      includedRegionCodes: [regionCode],
      sessionToken,
    }),
    signal,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      extractGoogleError(
        data,
        'Google could not load address suggestions. Make sure Places API (New) is enabled.',
      ),
    );
  }

  return (data?.suggestions ?? [])
    .map((item) => item?.placePrediction)
    .filter(Boolean)
    .map((prediction) => ({
      placeId: String(prediction.placeId ?? '').trim(),
      fullText: String(prediction.text?.text ?? '').trim(),
      mainText: String(prediction.structuredFormat?.mainText?.text ?? '').trim(),
      secondaryText: String(prediction.structuredFormat?.secondaryText?.text ?? '').trim(),
    }))
    .filter((item) => item.fullText);
}

export async function normalizeAddressWithGoogle(address, { signal, regionCode = 'US' } = {}) {
  const raw = String(address ?? '').trim();
  if (!raw) {
    throw new Error('Enter an address first.');
  }
  if (!GOOGLE_MAPS_API_KEY) {
    return { formattedAddress: raw, placeId: '' };
  }

  const endpoint = `https://geocode.googleapis.com/v4beta/geocode/address/${encodeURIComponent(raw)}?regionCode=${encodeURIComponent(regionCode)}`;
  const res = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
    },
    signal,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      extractGoogleError(
        data,
        'Google could not verify this address. Check your key and make sure Geocoding API is enabled.',
      ),
    );
  }

  const first = data?.results?.[0];
  const formattedAddress = String(first?.formattedAddress ?? '').trim();
  if (!formattedAddress) {
    throw new Error('Google Maps could not recognize that address. Try a more complete street address.');
  }

  return {
    formattedAddress,
    placeId: String(first?.placeId ?? '').trim(),
  };
}
