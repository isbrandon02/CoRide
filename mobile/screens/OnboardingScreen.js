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

import AddressAutocompleteInput from '../components/AddressAutocompleteInput';
import AppPressable from '../components/AppPressable';
import { hasGoogleMapsKey, normalizeAddressWithGoogle } from '../src/googleMaps';
import { saveOnboarding } from '../src/auth';
import { colors, radius, space, type as T } from '../src/theme';

const accent = colors.brand;

export default function OnboardingScreen({ accessToken, onComplete, onSignOut }) {
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
      const [normalizedHome, normalizedOffice] = await Promise.all([
        normalizeAddressWithGoogle(homeAddress),
        normalizeAddressWithGoogle(officeAddress),
      ]);
      const yearNum = carYear.trim() ? parseInt(carYear.trim(), 10) : null;
      await saveOnboarding(accessToken, {
        home_address: normalizedHome.formattedAddress,
        office_address: normalizedOffice.formattedAddress,
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
      setHomeAddress(normalizedHome.formattedAddress);
      setOfficeAddress(normalizedOffice.formattedAddress);
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
          <AddressAutocompleteInput
            value={homeAddress}
            onChangeText={setHomeAddress}
            placeholder="Start typing your home address"
            mode="address"
            editable={!loading}
            inputStyle={styles.input}
          />

          <Text style={[styles.section, styles.sectionSpaced]}>Office</Text>
          <AddressAutocompleteInput
            value={officeAddress}
            onChangeText={setOfficeAddress}
            placeholder="Start typing your office address or office name"
            mode="place"
            editable={!loading}
            inputStyle={styles.input}
          />
          {hasGoogleMapsKey() ? (
            <Text style={styles.helperText}>
              Home stays address-based. Office can match an address, building, or place name. We still verify the final result when you save.
            </Text>
          ) : null}

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

          <AppPressable
            variant="primary"
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonLabel}>Save and continue</Text>
            )}
          </AppPressable>

          {typeof onSignOut === 'function' ? (
            <AppPressable
              variant="ghost"
              style={styles.signOut}
              onPress={onSignOut}
              disabled={loading}
            >
              <Text style={styles.signOutLabel}>Sign out</Text>
            </AppPressable>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  /* Light sheet so copy stays readable when App auth shell uses dark (signed-out) background */
  flex: { flex: 1, backgroundColor: colors.canvasLight },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  header: { marginBottom: 20 },
  logo: {
    fontSize: T.title,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  subtitle: { marginTop: space.sm, fontSize: T.bodyLg, color: '#64748B', lineHeight: 22 },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    padding: space.xl,
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
  helperText: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    color: '#64748B',
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
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonLabel: { color: '#fff', fontSize: 16, fontWeight: '600' },
  signOut: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
  signOutLabel: { fontSize: 15, fontWeight: '600', color: '#64748B' },
});
