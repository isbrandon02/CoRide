import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AuthLogo from '../components/AuthLogo';
import AppPressable from '../components/AppPressable';
import { loginWithPassword } from '../src/auth';
import { authColors, authProd, space } from '../src/authUi';

export default function LoginScreen({ onLoginSuccess, onGoToRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(null);

  const showInputError = Boolean(error);

  function clearError() {
    setError('');
  }

  async function handleSubmit() {
    clearError();
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
      style={authProd.safe}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={authProd.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <AuthLogo size="hero" />

        <Text style={authProd.title}>Sign in</Text>
        <Text style={authProd.subtitle}>Use your work email and password to continue.</Text>

        <View style={authProd.fieldGap}>
          <Text style={authProd.label}>Email</Text>
          <TextInput
            style={[
              authProd.input,
              focused === 'email' && authProd.inputFocused,
              showInputError && authProd.inputError,
            ]}
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              clearError();
            }}
            placeholder="name@company.com"
            placeholderTextColor={authColors.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            autoComplete="email"
            editable={!loading}
            returnKeyType="next"
            onFocus={() => setFocused('email')}
            onBlur={() => setFocused(null)}
          />
        </View>

        <View style={authProd.fieldGap}>
          <Text style={authProd.label}>Password</Text>
          <View
            style={[
              authProd.passwordRow,
              focused === 'password' && authProd.passwordRowFocused,
              showInputError && authProd.passwordRowError,
            ]}
          >
            <TextInput
              style={authProd.passwordInput}
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                clearError();
              }}
              placeholder="Enter your password"
              placeholderTextColor={authColors.placeholder}
              secureTextEntry={!showPassword}
              textContentType="password"
              autoComplete="password"
              editable={!loading}
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
            />
            <AppPressable
              variant="link"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              style={authProd.eyeHit}
              onPress={() => setShowPassword((v) => !v)}
              disabled={loading}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={authColors.textSecondary}
              />
            </AppPressable>
          </View>
        </View>

        <View style={authProd.errorSlot}>
          {error ? <Text style={authProd.errorText}>{error}</Text> : null}
        </View>

        <AppPressable
          variant="none"
          style={[authProd.primaryBtn, loading && authProd.primaryBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          hitSlop={{ top: space.xs, bottom: space.xs, left: space.sm, right: space.sm }}
        >
          {loading ? (
            <ActivityIndicator color={authColors.onPrimary} />
          ) : (
            <Text style={authProd.primaryBtnLabel}>Sign in</Text>
          )}
        </AppPressable>

        <View style={authProd.linkFooter}>
          <AppPressable
            variant="link"
            style={authProd.linkPress}
            onPress={() =>
              Alert.alert('Reset password', 'If you forgot your password, contact your administrator or use your organization’s reset flow.')
            }
            disabled={loading}
          >
            <Text style={authProd.linkSecondary}>Forgot password?</Text>
          </AppPressable>
          <AppPressable variant="link" style={authProd.linkPress} onPress={onGoToRegister} disabled={loading}>
            <Text style={authProd.linkAccent}>Create account</Text>
          </AppPressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
