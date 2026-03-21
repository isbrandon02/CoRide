import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import LoginScreen from './screens/LoginScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import RegisterScreen from './screens/RegisterScreen';
import { clearStoredToken, getProfile, getStoredToken, setStoredToken } from './src/auth';
import { shouldShowOnboarding } from './src/onboarding';

export default function App() {
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);
  const [authScreen, setAuthScreen] = useState('login');
  /** null = still checking, true = show onboarding form, false = done */
  const [needsOnboarding, setNeedsOnboarding] = useState(null);

  useEffect(() => {
    (async () => {
      const t = await getStoredToken();
      setToken(t);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!token) {
      setNeedsOnboarding(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const profile = await getProfile(token);
        if (!cancelled) {
          setNeedsOnboarding(shouldShowOnboarding(profile));
        }
      } catch {
        if (!cancelled) {
          setNeedsOnboarding(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleLoginSuccess = useCallback(async (accessToken) => {
    setNeedsOnboarding(null);
    await setStoredToken(accessToken);
    setToken(accessToken);
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    setNeedsOnboarding(false);
  }, []);

  const handleLogout = useCallback(async () => {
    await clearStoredToken();
    setToken(null);
    setAuthScreen('login');
    setNeedsOnboarding(null);
  }, []);

  if (!ready) {
    return (
      <SafeAreaProvider>
        <View style={styles.boot}>
          <ActivityIndicator size="large" color="#0D9488" />
        </View>
      </SafeAreaProvider>
    );
  }

  const showBootAfterLogin = token && needsOnboarding === null;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        {showBootAfterLogin ? (
          <View style={styles.boot}>
            <ActivityIndicator size="large" color="#0D9488" />
          </View>
        ) : token && needsOnboarding ? (
          <OnboardingScreen accessToken={token} onComplete={handleOnboardingComplete} />
        ) : token ? (
          <SignedInView onLogout={handleLogout} />
        ) : authScreen === 'register' ? (
          <RegisterScreen onGoToLogin={() => setAuthScreen('login')} />
        ) : (
          <LoginScreen
            onLoginSuccess={handleLoginSuccess}
            onGoToRegister={() => setAuthScreen('register')}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function SignedInView({ onLogout }) {
  return (
    <View style={styles.signedIn}>
      <Text style={styles.signedInTitle}>You're signed in</Text>
      <Text style={styles.signedInBody}>
        Your profile, commute, and vehicle are saved. Use Sign out to clear your session on this device.
      </Text>
      <Pressable
        style={({ pressed }) => [styles.outlineBtn, pressed && styles.outlineBtnPressed]}
        onPress={onLogout}
      >
        <Text style={styles.outlineBtnLabel}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  signedIn: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  signedInTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  signedInBody: {
    fontSize: 16,
    color: '#64748B',
    lineHeight: 22,
    marginBottom: 28,
  },
  outlineBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#0D9488',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  outlineBtnPressed: {
    opacity: 0.85,
  },
  outlineBtnLabel: {
    color: '#0D9488',
    fontSize: 16,
    fontWeight: '600',
  },
});
