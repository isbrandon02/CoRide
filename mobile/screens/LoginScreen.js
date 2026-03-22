import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppPressable from '../components/AppPressable';
import { loginWithPassword } from '../src/auth';

/** Aligned with MainApp.js `C` — keep in sync for one visual language */
const C = {
  bg: '#0a0a0f',
  panel: '#111118',
  card: '#18181f',
  line: 'rgba(255,255,255,0.08)',
  text: '#f0f0f5',
  muted: 'rgba(240,240,245,0.62)',
  faint: 'rgba(240,240,245,0.34)',
  brand: '#00c896',
  brandSoft: 'rgba(0,200,150,0.12)',
};

export default function LoginScreen({ onLoginSuccess, onGoToRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(null);

  async function handleSubmit() {
    setError('');
    const trimmed = email.trim();
    if (!trimmed || !password) {
      setError('Enter email and password.');
      return;
    }

    setLoading(true);
    try {
      const token = await loginWithPassword(trimmed, password);
      await onLoginSuccess(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.top}>
          <View style={styles.markBadge}>
            <Ionicons name="people" size={24} color={C.brand} />
          </View>
          <Text style={styles.brandWord}>CoRide</Text>
          <Text style={styles.heroLine}>{'Good to see you'}</Text>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.sub}>Use your work email and password.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionEyebrow}>Account</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[
              styles.input,
              focused === 'email' && styles.inputFocused,
            ]}
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            placeholderTextColor={C.faint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            editable={!loading}
            returnKeyType="next"
            onFocus={() => setFocused('email')}
            onBlur={() => setFocused(null)}
          />

          <Text style={[styles.label, styles.labelSpaced]}>Password</Text>
          <TextInput
            style={[
              styles.input,
              focused === 'password' && styles.inputFocused,
            ]}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={C.faint}
            secureTextEntry
            textContentType="password"
            editable={!loading}
            onSubmitEditing={handleSubmit}
            returnKeyType="go"
            onFocus={() => setFocused('password')}
            onBlur={() => setFocused(null)}
          />

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color="#ff8a80" style={styles.errorIcon} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <AppPressable
            variant="primary"
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonLabel}>Sign in</Text>
            )}
          </AppPressable>
        </View>

        <AppPressable
          variant="link"
          style={styles.footerLink}
          onPress={onGoToRegister}
          disabled={loading}
        >
          <Text style={styles.footerMuted}>New here? </Text>
          <Text style={styles.footerAccent}>Create an account</Text>
        </AppPressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: 28,
    paddingTop: 8,
  },
  top: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  markBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: C.brandSoft,
    borderWidth: 1,
    borderColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  brandWord: {
    color: C.brand,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8,
  },
  heroLine: {
    color: C.muted,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  title: {
    color: C.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  sub: {
    color: C.muted,
    fontSize: 13,
    marginTop: 8,
    lineHeight: 19,
    maxWidth: 320,
  },
  card: {
    marginHorizontal: 16,
    marginTop: 22,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 20,
  },
  sectionEyebrow: {
    color: C.faint,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  label: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  labelSpaced: {
    marginTop: 4,
  },
  input: {
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 15,
    color: C.text,
  },
  inputFocused: {
    borderColor: C.brand,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  errorBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,80,80,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,80,80,0.45)',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  errorIcon: {
    marginTop: 1,
  },
  errorText: {
    flex: 1,
    color: '#ff8a80',
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    marginTop: 20,
    backgroundColor: C.brand,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    alignSelf: 'stretch',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  footerLink: {
    marginTop: 26,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  footerMuted: {
    fontSize: 14,
    color: C.muted,
  },
  footerAccent: {
    fontSize: 14,
    fontWeight: '700',
    color: C.brand,
  },
});
