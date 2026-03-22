import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppPressable from '../components/AppPressable';
import { getImpact, getLeaderboard } from '../src/auth';

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
  amber: '#f5a623',
  sky: '#4ea8f5',
};

const METRICS = [
  { key: 'score', label: 'Score' },
  { key: 'total_co2_kg', label: 'CO2 Saved' },
  { key: 'total_saved', label: 'Money Saved' },
];
const DEFAULT_WEEKLY_CO2_GOAL_KG = 6;

function initialsFromName(name, email) {
  const raw = String(name || email || '?').trim();
  if (!raw) return '?';
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return raw.slice(0, 2).toUpperCase();
}

function formatMetricValue(metric, row) {
  if (metric === 'score') return `${Math.round(Number(row.score ?? 0))}`;
  if (metric === 'total_co2_kg') return `${Number(row.total_co2_kg ?? 0).toFixed(1)} kg`;
  if (metric === 'total_saved') return `$${Number(row.total_saved ?? 0).toFixed(2)}`;
  return '';
}

function metricCaption(metric) {
  if (metric === 'score') return 'Impact score';
  if (metric === 'total_co2_kg') return 'CO2 saved';
  if (metric === 'total_saved') return 'Money saved';
  return '';
}

export default function GoalsScreen({ accessToken, bottomPadding = 0 }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [metric, setMetric] = useState('score');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [weeklyCo2Saved, setWeeklyCo2Saved] = useState(0);
  const [weeklyRides, setWeeklyRides] = useState(0);
  const [weeklyGoalKg, setWeeklyGoalKg] = useState(DEFAULT_WEEKLY_CO2_GOAL_KG);
  const [goalDraft, setGoalDraft] = useState(String(DEFAULT_WEEKLY_CO2_GOAL_KG));
  const [goalEditorOpen, setGoalEditorOpen] = useState(false);

  useEffect(() => {
    let live = true;
    if (!accessToken) {
      setLeaderboard([]);
      setLoading(false);
      return () => {
        live = false;
      };
    }

    setLoading(true);
    setError('');

    getLeaderboard(accessToken)
      .then((data) => {
        if (!live) return;
        setLeaderboard(Array.isArray(data.users) ? data.users : []);
      })
      .catch((e) => {
        if (!live) return;
        setError(e instanceof Error ? e.message : 'Could not load leaderboard');
        setLeaderboard([]);
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
    };
  }, [accessToken]);

  useEffect(() => {
    let live = true;
    if (!accessToken) {
      setWeeklyCo2Saved(0);
      setWeeklyRides(0);
      return () => {
        live = false;
      };
    }

    getImpact(accessToken)
      .then((data) => {
        if (!live) return;
        const rides = Array.isArray(data.weekly)
          ? data.weekly.reduce((sum, row) => sum + Number(row?.rides ?? 0), 0)
          : 0;
        setWeeklyCo2Saved(Number(data.current_week_co2_kg ?? 0));
        setWeeklyRides(rides);
      })
      .catch(() => {
        if (!live) return;
        setWeeklyCo2Saved(0);
        setWeeklyRides(0);
      });

    return () => {
      live = false;
    };
  }, [accessToken]);

  const selectedMetric = METRICS.find((item) => item.key === metric) ?? METRICS[0];
  const rawProgress = Math.max(0, weeklyCo2Saved / weeklyGoalKg);
  const progress = Math.min(rawProgress, 1);
  const co2Remaining = Math.max(weeklyGoalKg - weeklyCo2Saved, 0);

  const sortedLeaderboard = useMemo(() => {
    const list = [...leaderboard];
    list.sort((a, b) => {
      const av = Number(a?.[metric] ?? 0);
      const bv = Number(b?.[metric] ?? 0);
      if (bv !== av) return bv - av;
      return Number(a.rank ?? 0) - Number(b.rank ?? 0);
    });
    return list.map((item, index) => ({ ...item, displayRank: index + 1 }));
  }, [leaderboard, metric]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.root}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(bottomPadding, 20) + 20 }]}
        >
          <Text style={styles.eyebrow}>Sustainability goals</Text>
          <Text style={styles.title}>Work leaderboard</Text>
          <Text style={styles.sub}>
            Compare how coworkers are stacking up on shared commuting impact.
          </Text>

          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <View>
                <Text style={styles.progressEyebrow}>This Week's CO2 Goal</Text>
                <Text style={styles.progressTitle}>
                  {weeklyCo2Saved.toFixed(1)} kg of {weeklyGoalKg.toFixed(1)} kg saved
                </Text>
              </View>
              <AppPressable
                variant="ghost"
                style={styles.goalEditButton}
                onPress={() => {
                  setGoalDraft(String(weeklyGoalKg));
                  setGoalEditorOpen(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Edit weekly goal"
              >
                <Text style={styles.goalEditButtonText}>Edit</Text>
                <Ionicons name="create-outline" size={15} color={C.text} />
              </AppPressable>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
              <Text style={styles.progressBarText}>{Math.round(rawProgress * 100)}%</Text>
            </View>
            <Text style={styles.progressSub}>
              {co2Remaining > 0
                ? `${co2Remaining.toFixed(1)} kg to go this week`
                : 'Goal reached for this week'}
            </Text>
            <Text style={styles.progressMeta}>
              {weeklyRides} shared ride{weeklyRides === 1 ? '' : 's'} contributing so far
            </Text>
          </View>

          <View style={styles.leaderboardCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Leaderboard</Text>
              <AppPressable
                variant="ghost"
                style={styles.dropdownButton}
                onPress={() => setPickerOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Choose leaderboard metric"
              >
                <Text style={styles.dropdownButtonText}>{selectedMetric.label}</Text>
                <Ionicons name="chevron-down" size={15} color={C.text} />
              </AppPressable>
            </View>

            {loading ? (
              <View style={styles.cardState}>
                <ActivityIndicator size="large" color={C.brand} />
                <Text style={styles.stateText}>Loading leaderboard…</Text>
              </View>
            ) : error ? (
              <View style={styles.cardState}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : sortedLeaderboard.length === 0 ? (
              <View style={styles.cardState}>
                <Text style={styles.stateTitle}>No leaderboard data yet</Text>
                <Text style={styles.stateText}>
                  Complete onboarding and finish some rides to start the standings.
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.leaderboardList}
                contentContainerStyle={styles.leaderboardListContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {sortedLeaderboard.map((person, index) => (
                  <View
                    key={person.id}
                    style={[
                      styles.row,
                      index === sortedLeaderboard.length - 1 && styles.lastRow,
                      person.is_current_user && styles.currentUserRow,
                    ]}
                  >
                    <Text style={styles.rank}>#{person.displayRank}</Text>
                    <View style={styles.rowAvatar}>
                      <Text style={styles.rowAvatarText}>{initialsFromName(person.name, person.email)}</Text>
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.rowName}>
                        {person.name}
                        {person.is_current_user ? ' (You)' : ''}
                      </Text>
                      <Text style={styles.rowSub}>
                        {person.rides_shared} ride{person.rides_shared === 1 ? '' : 's'}
                      </Text>
                    </View>
                    <View style={styles.rowMetric}>
                      <Text style={styles.rowMetricValue}>{formatMetricValue(metric, person)}</Text>
                      <Text style={styles.rowMetricLabel}>{metricCaption(metric)}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </ScrollView>

        <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
          <View style={styles.modalRoot}>
            <AppPressable variant="none" style={styles.modalBackdrop} onPress={() => setPickerOpen(false)} />
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Leaderboard metric</Text>
              {METRICS.map((item) => {
                const active = item.key === metric;
                return (
                  <AppPressable
                    key={item.key}
                    variant="ghost"
                    style={[styles.modalOption, active && styles.modalOptionActive]}
                    onPress={() => {
                      setMetric(item.key);
                      setPickerOpen(false);
                    }}
                  >
                    <Text style={[styles.modalOptionText, active && styles.modalOptionTextActive]}>
                      {item.label}
                    </Text>
                    {active ? <Ionicons name="checkmark" size={18} color={C.brand} /> : null}
                  </AppPressable>
                );
              })}
            </View>
          </View>
        </Modal>

        <Modal
          visible={goalEditorOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setGoalEditorOpen(false)}
        >
          <View style={styles.modalRoot}>
            <AppPressable variant="none" style={styles.modalBackdrop} onPress={() => setGoalEditorOpen(false)} />
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Weekly CO2 Goal</Text>
              <Text style={styles.modalBody}>
                Enter the number of kilograms of CO2 you want to save each week.
              </Text>
              <TextInput
                value={goalDraft}
                onChangeText={(text) => setGoalDraft(text.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="6"
                placeholderTextColor={C.faint}
                style={styles.goalInput}
              />
              <View style={styles.modalActions}>
                <AppPressable
                  variant="ghost"
                  style={styles.modalButton}
                  onPress={() => setGoalEditorOpen(false)}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </AppPressable>
                <AppPressable
                  variant="ghost"
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={() => {
                    const nextGoal = Number.parseFloat(goalDraft);
                    if (Number.isFinite(nextGoal) && nextGoal > 0) {
                      setWeeklyGoalKg(nextGoal);
                    }
                    setGoalEditorOpen(false);
                  }}
                >
                  <Text style={[styles.modalButtonText, styles.modalButtonPrimaryText]}>Save</Text>
                </AppPressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  root: { flex: 1, backgroundColor: C.bg },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12 },
  eyebrow: {
    color: C.brand,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: { color: C.text, fontSize: 30, fontWeight: '800', marginTop: 8 },
  sub: { color: C.muted, fontSize: 14, lineHeight: 21, marginTop: 8 },
  progressCard: {
    marginTop: 18,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 22,
    padding: 18,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  goalEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  goalEditButtonText: {
    color: C.text,
    fontSize: 13,
    fontWeight: '700',
  },
  progressEyebrow: {
    color: C.brand,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  progressTitle: {
    color: C.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 6,
    lineHeight: 28,
  },
  progressTrack: {
    height: 20,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,200,150,0.18)',
    justifyContent: 'center',
  },
  progressFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    backgroundColor: C.brand,
  },
  progressBarText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    zIndex: 1,
  },
  progressSub: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
  },
  progressMeta: {
    color: C.muted,
    fontSize: 13,
    marginTop: 6,
  },
  leaderboardCard: {
    marginTop: 18,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 22,
    padding: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  cardTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: '800',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  dropdownButtonText: { color: C.text, fontSize: 13, fontWeight: '700' },
  leaderboardList: {
    maxHeight: 390,
  },
  leaderboardListContent: {
    paddingBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 2,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  currentUserRow: {
    backgroundColor: 'rgba(0,200,150,0.06)',
    borderRadius: 16,
  },
  rank: { color: C.brand, fontSize: 14, fontWeight: '800', width: 30 },
  rowAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(78,168,245,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowAvatarText: { color: C.sky, fontSize: 13, fontWeight: '800' },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { color: C.text, fontSize: 15, fontWeight: '700' },
  rowSub: { color: C.muted, fontSize: 12, marginTop: 4 },
  rowMetric: { alignItems: 'flex-end' },
  rowMetricValue: { color: C.text, fontSize: 15, fontWeight: '800' },
  rowMetricLabel: { color: C.faint, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: 4 },
  cardState: {
    paddingHorizontal: 18,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
  },
  stateTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
  stateText: { color: C.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10 },
  errorText: { color: '#ff9b9b', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  modalRoot: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalCard: {
    backgroundColor: C.panel,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    padding: 18,
  },
  modalTitle: { color: C.text, fontSize: 18, fontWeight: '800', marginBottom: 10 },
  modalBody: { color: C.muted, fontSize: 14, lineHeight: 21, marginBottom: 14 },
  goalInput: {
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalButton: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalButtonPrimary: {
    backgroundColor: C.brandSoft,
    borderColor: 'rgba(0,200,150,0.28)',
  },
  modalButtonText: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
  },
  modalButtonPrimaryText: {
    color: C.brand,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  modalOptionActive: {
    backgroundColor: 'rgba(0,200,150,0.04)',
  },
  modalOptionText: { color: C.text, fontSize: 15, fontWeight: '600' },
  modalOptionTextActive: { color: C.brand },
});
