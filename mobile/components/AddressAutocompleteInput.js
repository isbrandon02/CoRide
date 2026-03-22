import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  createPlacesSessionToken,
  fetchAddressSuggestions,
  hasGoogleMapsKey,
} from '../src/googleMaps';

export default function AddressAutocompleteInput({
  value,
  onChangeText,
  placeholder,
  mode = 'address',
  editable = true,
  inputStyle,
  dropdownStyle,
  textColor = '#0F172A',
  mutedColor = '#64748B',
  borderColor = '#E2E8F0',
  surfaceColor = '#F8FAFC',
  onSelection,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState('');
  const sessionTokenRef = useRef(createPlacesSessionToken());
  const enabled = hasGoogleMapsKey();

  useEffect(() => {
    if (!enabled || !focused || !editable) {
      setSuggestions([]);
      setLoading(false);
      setError('');
      return;
    }

    const query = String(value ?? '').trim();
    if (query.length < 3) {
      setSuggestions([]);
      setLoading(false);
      setError('');
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError('');
    const timer = setTimeout(() => {
      fetchAddressSuggestions(query, {
        signal: controller.signal,
        sessionToken: sessionTokenRef.current,
        mode,
      })
        .then((items) => {
          setSuggestions(items);
        })
        .catch((err) => {
          if (!controller.signal.aborted) {
            setSuggestions([]);
            setError(err instanceof Error ? err.message : 'Could not load address suggestions.');
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [editable, enabled, focused, mode, value]);

  function handleSelect(item) {
    onChangeText(item.fullText);
    onSelection?.(item);
    setSuggestions([]);
    setError('');
    setFocused(false);
    sessionTokenRef.current = createPlacesSessionToken();
  }

  return (
    <View style={styles.wrap}>
      <View>
        <TextInput
          style={[
            styles.input,
            {
              color: textColor,
              borderColor,
              backgroundColor: surfaceColor,
            },
            inputStyle,
          ]}
          value={value}
          onChangeText={(next) => {
            onChangeText(next);
            setFocused(true);
          }}
          placeholder={placeholder}
          placeholderTextColor={mutedColor}
          editable={editable}
          onFocus={() => {
            setFocused(true);
            if (!sessionTokenRef.current) {
              sessionTokenRef.current = createPlacesSessionToken();
            }
          }}
          onBlur={() => {
            setTimeout(() => {
              setFocused(false);
            }, 150);
          }}
          autoCorrect={false}
          autoCapitalize="words"
        />
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="small" color={mutedColor} />
          </View>
        ) : null}
      </View>

      {enabled && focused && suggestions.length > 0 ? (
        <View
          style={[
            styles.dropdown,
            {
              borderColor,
              backgroundColor: surfaceColor,
            },
            dropdownStyle,
          ]}
        >
          {suggestions.map((item) => (
            <Pressable key={`${item.placeId}-${item.fullText}`} style={styles.option} onPress={() => handleSelect(item)}>
              <Text style={[styles.mainText, { color: textColor }]}>
                {item.mainText || item.fullText}
              </Text>
              {item.secondaryText ? (
                <Text style={[styles.secondaryText, { color: mutedColor }]}>{item.secondaryText}</Text>
              ) : null}
            </Pressable>
          ))}
          <Text style={[styles.poweredBy, { color: mutedColor }]}>Powered by Google</Text>
        </View>
      ) : null}

      {enabled && focused && !loading && !suggestions.length && String(value ?? '').trim().length >= 3 && error ? (
        <Text style={[styles.feedback, { color: '#dc2626' }]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    paddingRight: 42,
  },
  loader: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  dropdown: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.35)',
  },
  mainText: {
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryText: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },
  poweredBy: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  feedback: {
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
  },
});
