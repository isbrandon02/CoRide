import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppPressable from '../components/AppPressable';
import { getLeaderboard } from '../src/auth';

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

  const selectedMetric = METRICS.find((item) => item.key === metric) ?? METRICS[0];

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
