import { useState } from 'react';
import {
  ActivityIndicator,
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
import { registerAccount } from '../src/auth';
import { authColors, authProd, space } from '../src/authUi';

export default function RegisterScreen({ onGoToLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [focused, setFocused] = useState(null);
  /** Which fields to outline in error red after validation */
  const [errFields, setErrFields] = useState({ email: false, password: false, confirm: false });

  function clearErrors() {
    setError('');
    setErrFields({ email: false, password: false, confirm: false });
  }

  async function handleSubmit() {
    clearErrors();
    const trimmed = email.trim();
    if (!trimmed || !password || !confirm) {
      setError('Fill in all fields.');
      setErrFields({
        email: !trimmed,
        password: !password,
        confirm: !confirm,
      });
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      setErrFields({ email: false, password: true, confirm: false });
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      setErrFields({ email: false, password: true, confirm: true });
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
      <View style={authProd.safe}>
        <ScrollView contentContainerStyle={authProd.scrollContent} showsVerticalScrollIndicator={false}>
          <AuthLogo size="compact" />
          <Text style={authProd.title}>{"You're all set"}</Text>
          <Text style={authProd.subtitle}>Sign in with the password you chose to open the app.</Text>

          <View style={authProd.card}>
            <Text style={authProd.successEyebrow}>Signed up as</Text>
            <Text style={authProd.successEmail}>{registeredEmail}</Text>
            <AppPressable variant="none" style={authProd.primaryBtn} onPress={onGoToLogin}>
              <Text style={authProd.primaryBtnLabel}>Back to sign in</Text>
            </AppPressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  const emailErr = errFields.email && Boolean(error);
  const pwErr = errFields.password && Boolean(error);
  const confirmErr = errFields.confirm && Boolean(error);

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

        <Text style={authProd.title}>Create account</Text>
        <Text style={authProd.subtitle}>We’ll match you with coworkers on your route after you sign up.</Text>

        <View style={authProd.fieldGap}>
          <Text style={authProd.label}>Email</Text>
          <TextInput
            style={[
              authProd.input,
              focused === 'email' && authProd.inputFocused,
              emailErr && authProd.inputError,
            ]}
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              clearErrors();
            }}
            placeholder="name@company.com"
            placeholderTextColor={authColors.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
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
              pwErr && authProd.passwordRowError,
            ]}
          >
            <TextInput
              style={authProd.passwordInput}
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                clearErrors();
              }}
              placeholder="At least 8 characters"
              placeholderTextColor={authColors.placeholder}
              secureTextEntry={!showPassword}
              textContentType="newPassword"
              autoComplete="new-password"
              passwordRules="minlength: 8;"
              editable={!loading}
              returnKeyType="next"
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

        <View style={authProd.fieldGap}>
          <Text style={authProd.label}>Confirm password</Text>
          <View
            style={[
              authProd.passwordRow,
              focused === 'confirm' && authProd.passwordRowFocused,
              confirmErr && authProd.passwordRowError,
            ]}
          >
            <TextInput
              style={authProd.passwordInput}
              value={confirm}
              onChangeText={(t) => {
                setConfirm(t);
                clearErrors();
              }}
              placeholder="Repeat password"
              placeholderTextColor={authColors.placeholder}
              secureTextEntry={!showConfirm}
              textContentType="newPassword"
              autoComplete="new-password"
              passwordRules="minlength: 8;"
              editable={!loading}
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
              onFocus={() => setFocused('confirm')}
              onBlur={() => setFocused(null)}
            />
            <AppPressable
              variant="link"
              accessibilityLabel={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
              style={authProd.eyeHit}
              onPress={() => setShowConfirm((v) => !v)}
              disabled={loading}
            >
              <Ionicons
                name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
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
            <Text style={authProd.primaryBtnLabel}>Create account</Text>
          )}
        </AppPressable>

        <View style={authProd.linkCenterRow}>
          <AppPressable variant="link" style={authProd.linkPress} onPress={onGoToLogin} disabled={loading}>
            <Text style={authProd.linkSecondary}>
              Already have an account? <Text style={authProd.linkAccent}>Sign in</Text>
            </Text>
          </AppPressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
