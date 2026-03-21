import { useEffect, useState } from 'react';
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

import { getProfile, saveOnboarding } from '../src/auth';

const bg = '#0B0B0C';
const surface = '#1C1C1E';
const border = '#2C2C2E';
const muted = '#8E8E93';
const label = '#94A3B8';
const text = '#F5F5F7';
const accent = '#2DD4BF';
const accentDark = '#0D9488';
const errBg = 'rgba(185, 28, 28, 0.15)';
const errBorder = '#7F1D1D';
const errText = '#FCA5A5';

export default function ProfileSettingsScreen({
  accessToken,
  accountEmail,
  onLogout,
  scrollBottomPadding = 100,
}) {
  const [retryCount, setRetryCount] = useState(0);
  const [homeAddress, setHomeAddress] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');
  const [commuteRoute, setCommuteRoute] = useState('');
  const [hobbies, setHobbies] = useState('');
  const [workDays, setWorkDays] = useState('');
  const [workStart, setWorkStart] = useState('');
  const [workEnd, setWorkEnd] = useState('');
  const [carMake, setCarMake] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carYear, setCarYear] = useState('');
  const [carColor, setCarColor] = useState('');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError('');
      setLoadingProfile(true);
      try {
        const p = await getProfile(accessToken);
        if (cancelled) return;
        setHomeAddress(String(p.home_address ?? ''));
        setOfficeAddress(String(p.office_address ?? ''));
        setCommuteRoute(String(p.commute_route ?? ''));
        setHobbies(String(p.hobbies ?? ''));
        const ws = p.work_schedule || {};
        setWorkDays(String(ws.days ?? ''));
        setWorkStart(String(ws.start_time ?? ''));
        setWorkEnd(String(ws.end_time ?? ''));
        const v = p.vehicle || {};
        setCarMake(String(v.make ?? ''));
        setCarModel(String(v.model ?? ''));
        setCarYear(v.year != null && v.year !== '' ? String(v.year) : '');
        setCarColor(String(v.color ?? ''));
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Could not load profile');
        }
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, retryCount]);

  async function handleSave() {
    setError('');
    if (!homeAddress.trim() || !officeAddress.trim()) {
      setError('Add your home and office locations.');
      return;
    }
    setSaving(true);
    try {
      const yearNum = carYear.trim() ? parseInt(carYear.trim(), 10) : null;
      await saveOnboarding(accessToken, {
        home_address: homeAddress.trim(),
        office_address: officeAddress.trim(),
        hobbies: hobbies.trim(),
        commute_route: commuteRoute.trim(),
        work_schedule: {
          days: workDays.trim(),
          start_time: workStart.trim(),
          end_time: workEnd.trim(),
        },
        vehicle: {
          make: carMake.trim(),
          model: carModel.trim(),
          year: Number.isFinite(yearNum) ? yearNum : null,
          color: carColor.trim(),
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  if (loadingProfile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={accent} />
        <Text style={styles.loadingHint}>Loading your profile…</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadErrorText}>{loadError}</Text>
        <Pressable
          style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
          onPress={() => setRetryCount((c) => c + 1)}
        >
          <Text style={styles.signOutLabel}>Try again</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.signOutBtnBare, pressed && styles.pressed]} onPress={onLogout}>
          <Text style={styles.signOutOnlyLabel}>Sign out</Text>
        </Pressable>
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
        contentContainerStyle={[styles.scroll, { paddingBottom: scrollBottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Profile</Text>
        {accountEmail ? (
          <Text style={styles.emailLine}>Signed in as {accountEmail}</Text>
        ) : null}
        <Text style={styles.subtitle}>Home, commute, work schedule, and vehicle</Text>

        <View style={styles.card}>
          <Text style={styles.section}>Home</Text>
          <TextInput
            style={styles.input}
            value={homeAddress}
            onChangeText={setHomeAddress}
            placeholder="Street, city (where you usually leave from)"
            placeholderTextColor={muted}
            editable={!saving}
          />

          <Text style={[styles.section, styles.sectionSpaced]}>Office</Text>
          <TextInput
            style={styles.input}
            value={officeAddress}
            onChangeText={setOfficeAddress}
            placeholder="Work address"
            placeholderTextColor={muted}
            editable={!saving}
          />

          <Text style={[styles.section, styles.sectionSpaced]}>Commute route</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={commuteRoute}
            onChangeText={setCommuteRoute}
            placeholder="How you usually get to work (roads, transit, etc.)"
            placeholderTextColor={muted}
            multiline
            textAlignVertical="top"
            editable={!saving}
          />

          <Text style={[styles.section, styles.sectionSpaced]}>Hobbies</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={hobbies}
            onChangeText={setHobbies}
            placeholder="Interests to share with carpool matches"
            placeholderTextColor={muted}
            multiline
            textAlignVertical="top"
            editable={!saving}
          />

          <Text style={[styles.section, styles.sectionSpaced]}>Work schedule</Text>
          <TextInput
            style={styles.input}
            value={workDays}
            onChangeText={setWorkDays}
            placeholder="e.g. Mon–Fri"
            placeholderTextColor={muted}
            editable={!saving}
          />
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.inputHalf]}
              value={workStart}
              onChangeText={setWorkStart}
              placeholder="Start (e.g. 9:00)"
              placeholderTextColor={muted}
              editable={!saving}
            />
            <TextInput
              style={[styles.input, styles.inputHalf]}
              value={workEnd}
              onChangeText={setWorkEnd}
              placeholder="End (e.g. 17:00)"
              placeholderTextColor={muted}
              editable={!saving}
            />
          </View>

          <Text style={[styles.section, styles.sectionSpaced]}>Your car</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.inputHalf]}
              value={carMake}
              onChangeText={setCarMake}
              placeholder="Make"
              placeholderTextColor={muted}
              editable={!saving}
            />
            <TextInput
              style={[styles.input, styles.inputHalf]}
              value={carModel}
              onChangeText={setCarModel}
              placeholder="Model"
              placeholderTextColor={muted}
              editable={!saving}
            />
          </View>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.inputHalf]}
              value={carYear}
              onChangeText={setCarYear}
              placeholder="Year"
              placeholderTextColor={muted}
              keyboardType="number-pad"
              editable={!saving}
            />
            <TextInput
              style={[styles.input, styles.inputHalf]}
              value={carColor}
              onChangeText={setCarColor}
              placeholder="Color"
              placeholderTextColor={muted}
              editable={!saving}
            />
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.saveBtn,
              pressed && styles.pressed,
              saving && styles.saveBtnDisabled,
            ]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#0F172A" />
            ) : (
              <Text style={styles.saveBtnLabel}>Save changes</Text>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.signOutBtn, pressed && styles.pressed]}
            onPress={onLogout}
          >
            <Text style={styles.signOutOnlyLabel}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: bg,
  },
  loadingHint: {
    marginTop: 12,
    fontSize: 14,
    color: muted,
  },
  loadErrorText: {
    color: errText,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryBtn: {
    borderWidth: 1,
    borderColor: accentDark,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: text,
    letterSpacing: -0.5,
  },
  emailLine: {
    marginTop: 8,
    fontSize: 14,
    color: muted,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    color: label,
    marginBottom: 18,
  },
  card: {
    backgroundColor: surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: border,
  },
  section: {
    fontSize: 13,
    fontWeight: '600',
    color: label,
    marginBottom: 8,
  },
  sectionSpaced: { marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
    color: text,
    backgroundColor: bg,
  },
  inputMultiline: {
    minHeight: 88,
    paddingTop: Platform.OS === 'ios' ? 12 : 10,
  },
  row: { flexDirection: 'row', gap: 10, marginTop: 10 },
  inputHalf: { flex: 1 },
  errorBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: errBg,
    borderWidth: 1,
    borderColor: errBorder,
  },
  errorText: { color: errText, fontSize: 14 },
  saveBtn: {
    marginTop: 22,
    backgroundColor: accent,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnLabel: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutBtnBare: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  signOutBtn: {
    marginTop: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutOnlyLabel: {
    color: accentDark,
    fontSize: 16,
    fontWeight: '600',
  },
  signOutLabel: {
    color: accent,
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: { opacity: 0.85 },
});
