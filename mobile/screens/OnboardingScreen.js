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

import { saveOnboarding } from '../src/auth';

const accent = '#0D9488';

export default function OnboardingScreen({ accessToken, onComplete }) {
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
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError('');
    if (!homeAddress.trim() || !officeAddress.trim()) {
      setError('Add your home and office locations.');
      return;
    }

    setLoading(true);
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
      onComplete();
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
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.logo}>Welcome to CoRide</Text>
          <Text style={styles.subtitle}>Tell us about your commute and car</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Home</Text>
          <TextInput
            style={styles.input}
            value={homeAddress}
            onChangeText={setHomeAddress}
            placeholder="Street, city (where you usually leave from)"
            placeholderTextColor="#94A3B8"
            editable={!loading}
          />

          <Text style={[styles.section, styles.sectionSpaced]}>Office</Text>
          <TextInput
            style={styles.input}
            value={officeAddress}
            onChangeText={setOfficeAddress}
            placeholder="Work address"
            placeholderTextColor="#94A3B8"
            editable={!loading}
          />

          <Text style={[styles.section, styles.sectionSpaced]}>Commute route</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={commuteRoute}
            onChangeText={setCommuteRoute}
            placeholder="How you usually get to work (roads, transit, etc.)"
            placeholderTextColor="#94A3B8"
            multiline
            textAlignVertical="top"
            editable={!loading}
          />

          <Text style={[styles.section, styles.sectionSpaced]}>Hobbies</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={hobbies}
            onChangeText={setHobbies}
            placeholder="Interests to share with carpool matches"
            placeholderTextColor="#94A3B8"
            multiline
            textAlignVertical="top"
            editable={!loading}
          />

          <Text style={[styles.section, styles.sectionSpaced]}>Work schedule</Text>
          <TextInput
            style={styles.input}
            value={workDays}
            onChangeText={setWorkDays}
            placeholder="e.g. Mon–Fri"
            placeholderTextColor="#94A3B8"
            editable={!loading}
          />
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.inputHalf]}
              value={workStart}
              onChangeText={setWorkStart}
              placeholder="Start (e.g. 9:00)"
              placeholderTextColor="#94A3B8"
              editable={!loading}
            />
            <TextInput
              style={[styles.input, styles.inputHalf]}
              value={workEnd}
              onChangeText={setWorkEnd}
              placeholder="End (e.g. 17:00)"
              placeholderTextColor="#94A3B8"
              editable={!loading}
            />
          </View>

          <Text style={[styles.section, styles.sectionSpaced]}>Your car</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.inputHalf]}
              value={carMake}
              onChangeText={setCarMake}
              placeholder="Make"
              placeholderTextColor="#94A3B8"
              editable={!loading}
            />
            <TextInput
              style={[styles.input, styles.inputHalf]}
              value={carModel}
              onChangeText={setCarModel}
              placeholder="Model"
              placeholderTextColor="#94A3B8"
              editable={!loading}
            />
          </View>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.inputHalf]}
              value={carYear}
              onChangeText={setCarYear}
              placeholder="Year"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              editable={!loading}
            />
            <TextInput
              style={[styles.input, styles.inputHalf]}
              value={carColor}
              onChangeText={setCarColor}
              placeholder="Color"
              placeholderTextColor="#94A3B8"
              editable={!loading}
            />
          </View>

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
              <Text style={styles.buttonLabel}>Save and continue</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  header: { marginBottom: 20 },
  logo: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  subtitle: { marginTop: 8, fontSize: 15, color: '#64748B' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  section: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 8 },
  sectionSpaced: { marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
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
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { color: '#B91C1C', fontSize: 14 },
  button: {
    marginTop: 22,
    backgroundColor: accent,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  buttonPressed: { backgroundColor: '#0F766E' },
  buttonDisabled: { opacity: 0.7 },
  buttonLabel: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
