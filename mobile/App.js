import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import HomeScreen from './screens/HomeScreen';
import LoginScreen from './screens/LoginScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import RegisterScreen from './screens/RegisterScreen';
import { clearStoredToken, getMe, getProfile, getStoredToken, setStoredToken } from './src/auth';
import { shouldShowOnboarding } from './src/onboarding';

export default function App() {
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);
  const [authScreen, setAuthScreen] = useState('login');
  /** null = still checking, true = show onboarding form, false = done */
  const [needsOnboarding, setNeedsOnboarding] = useState(null);
  const [accountEmail, setAccountEmail] = useState(null);

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

  useEffect(() => {
    if (!token || needsOnboarding !== false) {
      setAccountEmail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const me = await getMe(token);
        if (!cancelled) {
          setAccountEmail(me.email ?? null);
        }
      } catch {
        if (!cancelled) {
          setAccountEmail(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, needsOnboarding]);

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
  const signedIn = Boolean(token && needsOnboarding === false);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.root, signedIn && styles.rootDark]} edges={['top', 'bottom']}>
        <StatusBar style={signedIn ? 'light' : 'dark'} />
        {showBootAfterLogin ? (
          <View style={styles.boot}>
            <ActivityIndicator size="large" color="#0D9488" />
          </View>
        ) : token && needsOnboarding ? (
          <OnboardingScreen accessToken={token} onComplete={handleOnboardingComplete} />
        ) : token ? (
          <HomeScreen
            accessToken={token}
            accountEmail={accountEmail}
            userName={displayNameFromEmail(accountEmail)}
            onLogout={handleLogout}
          />
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

function displayNameFromEmail(email) {
  if (!email) {
    return 'Jamie Santos';
  }
  const local = email.split('@')[0] ?? '';
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length === 0) {
    return 'there';
  }
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  rootDark: {
    backgroundColor: '#0B0B0C',
  },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
});
