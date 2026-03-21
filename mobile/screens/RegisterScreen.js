import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { registerAccount } from '../src/auth';

const accent = '#0D9488';

export default function RegisterScreen({ onGoToLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  async function handleSubmit() {
    setError('');
    const trimmed = email.trim();
    if (!trimmed || !password || !confirm) {
      setError('Fill in all fields.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await registerAccount(trimmed, password);
      setRegisteredEmail(res.email ?? trimmed);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <View style={styles.flex}>
        <View style={styles.inner}>
          <View style={styles.header}>
            <Text style={styles.logo}>CoRide</Text>
            <Text style={styles.subtitle}>You're all set</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.successBox}>
              <Text style={styles.successTitle}>Account created</Text>
              <Text style={styles.successBody}>
                Signed up as{' '}
                <Text style={styles.successEmail}>{registeredEmail}</Text>. Sign in with your
                password to continue.
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              onPress={onGoToLogin}
            >
              <Text style={styles.buttonLabel}>Back to sign in</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          <View style={styles.header}>
            <Text style={styles.logo}>CoRide</Text>
            <Text style={styles.subtitle}>Create your account</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!loading}
              returnKeyType="next"
            />

            <Text style={[styles.label, styles.labelSpaced]}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              placeholderTextColor="#94A3B8"
              secureTextEntry
              textContentType="newPassword"
              editable={!loading}
              returnKeyType="next"
            />

            <Text style={[styles.label, styles.labelSpaced]}>Confirm password</Text>
            <TextInput
              style={styles.input}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Repeat password"
              placeholderTextColor="#94A3B8"
              secureTextEntry
              textContentType="newPassword"
              editable={!loading}
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
            />

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonLabel}>Create account</Text>
              )}
            </Pressable>
          </View>

          <Pressable style={styles.footerLink} onPress={onGoToLogin} disabled={loading}>
            <Text style={styles.footerMuted}>Already have an account? </Text>
            <Text style={styles.footerAccent}>Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 24,
  },
  inner: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  header: {
    marginBottom: 28,
  },
  logo: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: '#0F172A',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: '#64748B',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  labelSpaced: {
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 16,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  errorBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
    lineHeight: 20,
  },
  successBox: {
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
  },
  successBody: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
  },
  successEmail: {
    fontWeight: '600',
    color: '#0F172A',
  },
  button: {
    marginTop: 20,
    backgroundColor: accent,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonPressed: {
    backgroundColor: '#0F766E',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footerLink: {
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  footerMuted: {
    fontSize: 14,
    color: '#64748B',
  },
  footerAccent: {
    fontSize: 14,
    fontWeight: '600',
    color: accent,
  },
});
