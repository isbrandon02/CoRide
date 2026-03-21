import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import AppPressable from '../components/AppPressable';
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
const DAY_OPTIONS = ['Sat', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sun'];
const GENDER_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to Identify'];
const STATUS_OPTIONS = ['Rider', 'Driver', 'Flexible commuter', 'Carpool host'];
const TIME_OPTIONS = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`);

function parseWorkDays(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function profileInitials(email) {
  const local = (email ?? 'You').split('@')[0];
  return (
    local
      .split(/[._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'YO'
  );
}

function displayNameFromProfile(profile, email) {
  const rawName =
    profile?.name ??
    profile?.full_name ??
    profile?.display_name ??
    (email ?? '').split('@')[0];

  return String(rawName || '')
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function displayAgeFromProfile(profile) {
  const age = profile?.age;
  return age != null && age !== '' ? String(age) : '';
}

function displayGenderFromProfile(profile) {
  return String(profile?.gender ?? profile?.pronouns ?? '').trim();
}

function displayStatusFromProfile(profile) {
  return String(profile?.status ?? '').trim();
}

function SummaryPill({ label: pillLabel, value, accentTone = false }) {
  return (
    <View style={[styles.summaryPill, accentTone && styles.summaryPillAccent]}>
      <Text style={[styles.summaryPillLabel, accentTone && styles.summaryPillLabelAccent]}>{pillLabel}</Text>
      <Text style={styles.summaryPillValue}>{value || 'Not added yet'}</Text>
    </View>
  );
}

function EditablePill({ label: pillLabel, children, accentTone = false }) {
  return (
    <View style={[styles.summaryPill, accentTone && styles.summaryPillAccent]}>
      <Text style={[styles.summaryPillLabel, accentTone && styles.summaryPillLabelAccent]}>{pillLabel}</Text>
      {children}
    </View>
  );
}

function StaticValue({ value, multiline = false }) {
  return (
    <View style={[styles.staticField, multiline && styles.staticFieldMultiline]}>
      <Text style={[styles.staticValue, !value && styles.staticValueMuted]}>{value || 'Not added yet'}</Text>
    </View>
  );
}

export default function ProfileSettingsScreen({
  accessToken,
  accountEmail,
  onLogout,
  scrollBottomPadding = 100,
}) {
  const scrollRef = useRef(null);
  const [retryCount, setRetryCount] = useState(0);
  const [profileName, setProfileName] = useState('');
  const [profileAge, setProfileAge] = useState('');
  const [profileGender, setProfileGender] = useState('');
  const [profileStatus, setProfileStatus] = useState('');
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
  const [editMode, setEditMode] = useState(false);
  const [savedProfile, setSavedProfile] = useState(null);
  const [openTimePicker, setOpenTimePicker] = useState(null);
  const [openGenderPicker, setOpenGenderPicker] = useState(false);
  const [openStatusPicker, setOpenStatusPicker] = useState(false);

  function applyProfileState(profile) {
    setProfileName(displayNameFromProfile(profile, accountEmail));
    setProfileAge(displayAgeFromProfile(profile));
    setProfileGender(displayGenderFromProfile(profile));
    setProfileStatus(displayStatusFromProfile(profile));
    setHomeAddress(String(profile.home_address ?? ''));
    setOfficeAddress(String(profile.office_address ?? ''));
    setCommuteRoute(String(profile.commute_route ?? ''));
    setHobbies(String(profile.hobbies ?? ''));
    const ws = profile.work_schedule || {};
    setWorkDays(String(ws.days ?? ''));
    setWorkStart(String(ws.start_time ?? ''));
    setWorkEnd(String(ws.end_time ?? ''));
    const vehicle = profile.vehicle || {};
    setCarMake(String(vehicle.make ?? ''));
    setCarModel(String(vehicle.model ?? ''));
    setCarYear(vehicle.year != null && vehicle.year !== '' ? String(vehicle.year) : '');
    setCarColor(String(vehicle.color ?? ''));
  }

  function buildProfilePayload() {
    const yearNum = carYear.trim() ? parseInt(carYear.trim(), 10) : null;
    return {
      name: profileName.trim(),
      age: profileAge.trim(),
      gender: profileGender.trim(),
      status: profileStatus.trim(),
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
    };
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError('');
      setLoadingProfile(true);
      try {
        const profile = await getProfile(accessToken);
        if (cancelled) return;
        applyProfileState(profile);
        setSavedProfile(profile);
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
      const payload = buildProfilePayload();
      await saveOnboarding(accessToken, {
        home_address: payload.home_address,
        office_address: payload.office_address,
        hobbies: payload.hobbies,
        commute_route: payload.commute_route,
        work_schedule: payload.work_schedule,
        vehicle: payload.vehicle,
      });
      setSavedProfile((prev) => ({ ...(prev ?? {}), ...payload }));
      setEditMode(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    if (savedProfile) {
      applyProfileState(savedProfile);
    }
    setError('');
    setEditMode(false);
  }

  function handleStartEdit({ scrollToTop = false } = {}) {
    if (scrollToTop) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
    setError('');
    setEditMode(true);
  }

  function toggleWorkDay(day) {
    const selectedDays = parseWorkDays(workDays);
    const nextDays = selectedDays.includes(day)
      ? selectedDays.filter((item) => item !== day)
      : [...selectedDays, day];
    const orderedDays = DAY_OPTIONS.filter((option) => nextDays.includes(option));
    setWorkDays(orderedDays.join(', '));
  }

  function handleProfileAgeChange(value) {
    setProfileAge(String(value ?? '').replace(/\D+/g, ''));
  }

  function renderInput({ value, onChangeText, placeholder, multiline = false, keyboardType }) {
    if (!editMode) {
      return <StaticValue value={value} multiline={multiline} />;
    }
    return (
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={muted}
        editable={!saving}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'auto'}
        keyboardType={keyboardType}
      />
    );
  }

  if (loadingProfile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={accent} />
        <Text style={styles.loadingHint}>Loading your profile...</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadErrorText}>{loadError}</Text>
        <Pressable
          style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
          onPress={() => setRetryCount((count) => count + 1)}
        >
          <Text style={styles.signOutLabel}>Try again</Text>
        </AppPressable>
        <AppPressable variant="link" style={styles.signOutBtnBare} onPress={onLogout}>
          <Text style={styles.signOutOnlyLabel}>Sign out</Text>
        </AppPressable>
      </View>
    );
  }

  const displayName = profileName.trim() || 'Not added yet';
  const displayAge = profileAge.trim();
  const displayGender = profileGender.trim();
  const displayStatus = profileStatus.trim();

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, { paddingBottom: scrollBottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeText}>{profileInitials(accountEmail)}</Text>
            </View>
            <View style={styles.heroTextWrap}>
              <Text style={styles.title}>Profile</Text>
              {accountEmail ? <Text style={styles.emailLine}>{accountEmail}</Text> : null}
              <Text style={styles.subtitle}>
                {editMode ? 'Update your details, then save when everything looks right.' : 'Your personal snapshot for future carpool matches.'}
              </Text>
            </View>
          </View>
          <View style={styles.summaryRow}>
            {editMode ? (
              <EditablePill label="Name" accentTone>
                <TextInput
                  style={styles.summaryInput}
                  value={profileName}
                  onChangeText={setProfileName}
                  placeholder="Your name"
                  placeholderTextColor={muted}
                  editable={!saving}
                />
              </EditablePill>
            ) : (
              <SummaryPill label="Name" value={displayName} accentTone />
            )}
            {editMode ? (
              <EditablePill label="Age">
                <TextInput
                  style={styles.summaryInput}
                  value={profileAge}
                  onChangeText={handleProfileAgeChange}
                  placeholder="Age"
                  placeholderTextColor={muted}
                  editable={!saving}
                  keyboardType="number-pad"
                />
              </EditablePill>
            ) : (
              <SummaryPill label="Age" value={displayAge} />
            )}
          </View>
          <View style={styles.summaryRow}>
            {editMode ? (
              <EditablePill label="Gender">
                <Pressable style={styles.summarySelectField} onPress={() => setOpenGenderPicker(true)}>
                  <Text style={[styles.summarySelectText, !profileGender && styles.selectFieldTextMuted]}>
                    {profileGender || 'Select gender'}
                  </Text>
                </Pressable>
              </EditablePill>
            ) : (
              <SummaryPill label="Gender" value={displayGender} />
            )}
            {editMode ? (
              <EditablePill label="Status">
                <Pressable style={styles.summarySelectField} onPress={() => setOpenStatusPicker(true)}>
                  <Text style={[styles.summarySelectText, !profileStatus && styles.selectFieldTextMuted]}>
                    {profileStatus || 'Select status'}
                  </Text>
                </Pressable>
              </EditablePill>
            ) : (
              <SummaryPill label="Status" value={displayStatus} />
            )}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionEyebrow}>Commute base</Text>
          <Text style={styles.sectionTitle}>Where your rides begin and end</Text>
          <Text style={styles.sectionNote}>These are the anchors we use to personalize your route matching.</Text>
          <Text style={styles.section}>Home</Text>
          {renderInput({
            value: homeAddress,
            onChangeText: setHomeAddress,
            placeholder: 'Street, city (where you usually leave from)',
          })}
          <Text style={[styles.section, styles.sectionSpaced]}>Office</Text>
          {renderInput({
            value: officeAddress,
            onChangeText: setOfficeAddress,
            placeholder: 'Work address',
          })}
          <Text style={[styles.section, styles.sectionSpaced]}>Commute route</Text>
          {renderInput({
            value: commuteRoute,
            onChangeText: setCommuteRoute,
            placeholder: 'How you usually get to work (roads, transit, etc.)',
            multiline: true,
          })}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionEyebrow}>Personality</Text>
          <Text style={styles.sectionTitle}>Help future riders know you</Text>
          <Text style={styles.sectionNote}>A little personality makes match cards feel more human.</Text>
          <Text style={styles.section}>Hobbies</Text>
          {renderInput({
            value: hobbies,
            onChangeText: setHobbies,
            placeholder: 'Interests to share with carpool matches',
            multiline: true,
          })}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionEyebrow}>Work rhythm</Text>
          <Text style={styles.sectionTitle}>When you are usually on the road</Text>
          <Text style={styles.sectionNote}>Set your weekday pattern and usual office hours.</Text>
          <Text style={styles.section}>Work days</Text>
          {editMode ? (
            <View style={styles.dayGrid}>
              {DAY_OPTIONS.map((day) => {
                const isSelected = parseWorkDays(workDays).includes(day);
                return (
                  <Pressable
                    key={day}
                    style={[styles.dayBox, isSelected && styles.dayBoxSelected]}
                    onPress={() => toggleWorkDay(day)}
                  >
                    <Text style={[styles.dayBoxText, isSelected && styles.dayBoxTextSelected]}>{day}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <StaticValue value={workDays} />
          )}
          <View style={styles.row}>
            <View style={styles.inputHalf}>
              <Text style={[styles.section, styles.sectionCompact]}>Start</Text>
              {editMode ? (
                <Pressable style={styles.selectField} onPress={() => setOpenTimePicker('start')}>
                  <Text style={[styles.selectFieldText, !workStart && styles.selectFieldTextMuted]}>
                    {workStart || 'Select start time'}
                  </Text>
                </Pressable>
              ) : (
                <StaticValue value={workStart} />
              )}
            </View>
            <View style={styles.inputHalf}>
              <Text style={[styles.section, styles.sectionCompact]}>End</Text>
              {editMode ? (
                <Pressable style={styles.selectField} onPress={() => setOpenTimePicker('end')}>
                  <Text style={[styles.selectFieldText, !workEnd && styles.selectFieldTextMuted]}>
                    {workEnd || 'Select end time'}
                  </Text>
                </Pressable>
              ) : (
                <StaticValue value={workEnd} />
              )}
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionEyebrow}>Driver profile</Text>
          <Text style={styles.sectionTitle}>Vehicle details riders will recognize</Text>
          <Text style={styles.sectionNote}>Only fill this out if you want to be matchable as a driver.</Text>
          <Text style={styles.section}>Your car</Text>
          <View style={styles.row}>
            <View style={styles.inputHalf}>
              <Text style={[styles.section, styles.sectionCompact]}>Make</Text>
              {renderInput({
                value: carMake,
                onChangeText: setCarMake,
                placeholder: 'Make',
              })}
            </View>
            <View style={styles.inputHalf}>
              <Text style={[styles.section, styles.sectionCompact]}>Model</Text>
              {renderInput({
                value: carModel,
                onChangeText: setCarModel,
                placeholder: 'Model',
              })}
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.inputHalf}>
              <Text style={[styles.section, styles.sectionCompact]}>Year</Text>
              {renderInput({
                value: carYear,
                onChangeText: setCarYear,
                placeholder: 'Year',
                keyboardType: 'number-pad',
              })}
            </View>
            <View style={styles.inputHalf}>
              <Text style={[styles.section, styles.sectionCompact]}>Color</Text>
              {renderInput({
                value: carColor,
                onChangeText: setCarColor,
                placeholder: 'Color',
              })}
            </View>
          </View>
        </View>

        <View style={styles.footerCard}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {editMode ? (
            <View style={styles.actionRow}>
              <Pressable
                style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                onPress={handleCancelEdit}
                disabled={saving}
              >
                <Text style={styles.secondaryBtnLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.saveBtn, styles.saveBtnHalf, pressed && styles.pressed, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.saveBtnLabel}>Save changes</Text>}
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
              onPress={() => handleStartEdit({ scrollToTop: true })}
            >
              <Text style={styles.saveBtnLabel}>Edit profile</Text>
            </Pressable>
          )}

          <Pressable style={({ pressed }) => [styles.signOutBtn, pressed && styles.pressed]} onPress={onLogout}>
            <Text style={styles.signOutOnlyLabel}>Sign out</Text>
          </AppPressable>
        </View>
      </ScrollView>
      <Pressable
        style={({ pressed }) => [
          styles.floatingActionButton,
          styles.heroActionButton,
          editMode ? styles.heroSaveButton : styles.heroEditButton,
          pressed && styles.pressed,
          saving && styles.heroButtonDisabled,
        ]}
        onPress={editMode ? handleSave : () => handleStartEdit()}
        disabled={saving}
      >
        {editMode ? (
          saving ? <ActivityIndicator size="small" color="#0F172A" /> : <Text style={styles.heroSaveButtonLabel}>Save</Text>
        ) : (
          <Text style={styles.heroEditButtonLabel}>Edit</Text>
        )}
      </Pressable>
      <Modal visible={!!openTimePicker} transparent animationType="fade" onRequestClose={() => setOpenTimePicker(null)}>
        <View style={styles.pickerBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpenTimePicker(null)} />
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>{openTimePicker === 'start' ? 'Select start time' : 'Select end time'}</Text>
            <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
              {TIME_OPTIONS.map((time) => (
                <Pressable
                  key={time}
                  style={styles.pickerOption}
                  onPress={() => {
                    if (openTimePicker === 'start') {
                      setWorkStart(time);
                    } else {
                      setWorkEnd(time);
                    }
                    setOpenTimePicker(null);
                  }}
                >
                  <Text style={styles.pickerOptionText}>{time}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={openGenderPicker} transparent animationType="fade" onRequestClose={() => setOpenGenderPicker(false)}>
        <View style={styles.pickerBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpenGenderPicker(false)} />
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Select gender</Text>
            <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
              {GENDER_OPTIONS.map((option) => (
                <Pressable
                  key={option}
                  style={styles.pickerOption}
                  onPress={() => {
                    setProfileGender(option);
                    setOpenGenderPicker(false);
                  }}
                >
                  <Text style={styles.pickerOptionText}>{option}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={openStatusPicker} transparent animationType="fade" onRequestClose={() => setOpenStatusPicker(false)}>
        <View style={styles.pickerBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpenStatusPicker(false)} />
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Select status</Text>
            <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
              {STATUS_OPTIONS.map((option) => (
                <Pressable
                  key={option}
                  style={styles.pickerOption}
                  onPress={() => {
                    setProfileStatus(option);
                    setOpenStatusPicker(false);
                  }}
                >
                  <Text style={styles.pickerOptionText}>{option}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    paddingTop: 10,
  },
  heroCard: {
    backgroundColor: '#121214',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: border,
    marginBottom: 16,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBadge: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: accentDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarBadgeText: {
    color: '#F5F5F7',
    fontSize: 22,
    fontWeight: '700',
  },
  heroTextWrap: {
    flex: 1,
  },
  floatingActionButton: {
    position: 'absolute',
    top: 14,
    right: 20,
    zIndex: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  heroActionButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  heroEditButton: {
    borderColor: 'rgba(45, 212, 191, 0.35)',
    backgroundColor: 'rgba(45, 212, 191, 0.12)',
  },
  heroEditButtonLabel: {
    color: accent,
    fontSize: 13,
    fontWeight: '700',
  },
  heroSaveButton: {
    backgroundColor: accent,
    borderColor: accent,
    minWidth: 68,
    alignItems: 'center',
  },
  heroSaveButtonLabel: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
  },
  heroButtonDisabled: {
    opacity: 0.7,
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
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  summaryPill: {
    flex: 1,
    backgroundColor: bg,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: border,
  },
  summaryPillAccent: {
    backgroundColor: 'rgba(45, 212, 191, 0.1)',
    borderColor: 'rgba(45, 212, 191, 0.35)',
  },
  summaryPillLabel: {
    color: label,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  summaryPillLabelAccent: {
    color: accent,
  },
  summaryPillValue: {
    color: text,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
  },
  summaryInput: {
    color: text,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
    paddingVertical: 0,
    minHeight: 20,
  },
  summarySelectField: {
    marginTop: 6,
  },
  summarySelectText: {
    color: text,
    fontSize: 14,
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: border,
    marginBottom: 14,
  },
  footerCard: {
    backgroundColor: surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: border,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: accent,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: text,
    marginBottom: 6,
  },
  sectionNote: {
    fontSize: 14,
    color: muted,
    lineHeight: 20,
    marginBottom: 16,
  },
  section: {
    fontSize: 13,
    fontWeight: '600',
    color: label,
    marginBottom: 8,
  },
  sectionSpaced: {
    marginTop: 14,
  },
  sectionCompact: {
    marginTop: 0,
  },
  input: {
    borderWidth: 1,
    borderColor: '#343438',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
    color: text,
    backgroundColor: '#101012',
  },
  inputMultiline: {
    minHeight: 96,
    paddingTop: Platform.OS === 'ios' ? 12 : 10,
  },
  staticField: {
    borderWidth: 1,
    borderColor: border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#101012',
  },
  staticFieldMultiline: {
    minHeight: 96,
  },
  staticValue: {
    color: text,
    fontSize: 16,
    lineHeight: 22,
  },
  staticValueMuted: {
    color: muted,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  inputHalf: {
    flex: 1,
  },
  selectField: {
    borderWidth: 1,
    borderColor: '#343438',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#101012',
  },
  selectFieldText: {
    color: text,
    fontSize: 16,
  },
  selectFieldTextMuted: {
    color: muted,
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
  },
  dayBox: {
    minWidth: 64,
    borderWidth: 1,
    borderColor: '#343438',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#101012',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBoxSelected: {
    backgroundColor: 'rgba(45, 212, 191, 0.14)',
    borderColor: accent,
  },
  dayBoxText: {
    color: label,
    fontSize: 15,
    fontWeight: '600',
  },
  dayBoxTextSelected: {
    color: text,
  },
  errorBox: {
    marginTop: 4,
    marginBottom: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: errBg,
    borderWidth: 1,
    borderColor: errBorder,
  },
  errorText: {
    color: errText,
    fontSize: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  saveBtn: {
    marginTop: 8,
    backgroundColor: accent,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  saveBtnHalf: {
    flex: 1,
    marginTop: 0,
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnLabel: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: border,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: bg,
  },
  secondaryBtnLabel: {
    color: text,
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
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  pickerCard: {
    maxHeight: '70%',
    backgroundColor: surface,
    borderWidth: 1,
    borderColor: border,
    borderRadius: 20,
    padding: 20,
  },
  pickerTitle: {
    color: text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 14,
  },
  pickerList: {
    maxHeight: 320,
  },
  pickerOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: border,
  },
  pickerOptionText: {
    color: text,
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});
