import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getRides, patchRideStatus } from '../src/auth';

const C = {
  panel: '#111118',
  card: '#18181f',
  line: 'rgba(255,255,255,0.08)',
  text: '#f0f0f5',
  muted: 'rgba(240,240,245,0.62)',
  faint: 'rgba(240,240,245,0.34)',
  brand: '#00c896',
  brandSoft: 'rgba(0,200,150,0.12)',
  sky: '#4ea8f5',
  amber: '#f5a623',
};

function initialsFromName(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

function formatRideWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function Badge({ label, tone = 'brand' }) {
  const tones = {
    brand: { bg: C.brandSoft, fg: C.brand },
    amber: { bg: 'rgba(245,166,35,0.12)', fg: C.amber },
    sky: { bg: 'rgba(78,168,245,0.12)', fg: C.sky },
    gray: { bg: 'rgba(255,255,255,0.07)', fg: C.muted },
  };
  const t = tones[tone] ?? tones.brand;
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.badgeTxt, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

function Avatar({ initials, color, size = 40 }) {
  const short = initials.length > 2 ? initials.slice(0, 2) : initials;
  return (
    <View style={[styles.av, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[styles.avTxt, { fontSize: size * 0.32 }]}>{short}</Text>
    </View>
  );
}

const SUB_KEYS = [
  { key: 'up', label: 'Upcoming' },
  { key: 'past', label: 'History' },
  { key: 'drv', label: 'Driving' },
];

export default function RidesTab({ accessToken, bottomPadding, onPressFind, refreshKey = 0, onRidesMutated }) {
  const [sub, setSub] = useState('up');
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actingId, setActingId] = useState(null);

  useEffect(() => {
    if (!accessToken) {
      setRides([]);
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    setError(null);
    getRides(accessToken)
      .then((data) => {
        if (live) setRides(data.rides ?? []);
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [accessToken, refreshKey]);

  const { upcoming, history, driving } = useMemo(() => {
    const list = rides ?? [];
    const historyList = list.filter(
      (r) =>
        r.status === 'declined' || r.status === 'cancelled' || r.status === 'completed',
    );
    const drivingList = list.filter((r) => r.role === 'driver' && r.status === 'pending');
    const upcomingList = list.filter((r) => {
      if (r.status === 'declined' || r.status === 'cancelled' || r.status === 'completed') return false;
      if (r.role === 'driver' && r.status === 'pending') return false;
      return r.status === 'pending' || r.status === 'accepted';
    });
    return { upcoming: upcomingList, history: historyList, driving: drivingList };
  }, [rides]);

  async function respondToRequest(rideId, status) {
    if (!accessToken) return;
    setActingId(rideId);
    try {
      await patchRideStatus(accessToken, rideId, status);
      onRidesMutated?.();
    } catch (e) {
      Alert.alert('Could not update', e instanceof Error ? e.message : String(e));
    } finally {
      setActingId(null);
    }
  }

  return (
    <ScrollView
      style={styles.flex}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: bottomPadding }}
    >
      <View style={styles.head}>
        <View>
          <Text style={styles.title}>My Rides</Text>
          <Text style={styles.sub}>Your requests · rides with you as driver</Text>
        </View>
        <Pressable style={styles.findBtn} onPress={onPressFind}>
          <Text style={styles.findBtnTxt}>+ Find</Text>
        </Pressable>
      </View>

      <View style={styles.tabRow}>
        {SUB_KEYS.map((t) => {
          const on = sub === t.key;
          const label =
            t.key === 'drv' && driving.length > 0 ? `Driving (${driving.length})` : t.label;
          return (
            <Pressable key={t.key} style={styles.tabCell} onPress={() => setSub(t.key)}>
              <Text style={[styles.tabTxt, on && { color: C.brand }]}>{label}</Text>
              {on ? <View style={styles.tabUnd} /> : null}
            </Pressable>
          );
        })}
      </View>

      {sub === 'up' && (
        <>
          {loading ? (
            <ActivityIndicator color={C.brand} style={{ marginTop: 28 }} />
          ) : error ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Could not load rides</Text>
              <Text style={styles.emptySub}>{error}</Text>
            </View>
          ) : upcoming.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No upcoming rides</Text>
              <Text style={styles.emptySub}>Request a ride from Find to see it here.</Text>
              <Pressable style={styles.primary} onPress={onPressFind}>
                <Text style={styles.primaryTxt}>Find a ride</Text>
              </Pressable>
            </View>
          ) : (
            upcoming.map((ride) => {
              const other = ride.other_user;
              const ini = initialsFromName(other.name);
              const statusLabel =
                ride.status === 'accepted'
                  ? 'Confirmed'
                  : ride.status === 'pending'
                    ? 'Pending'
                    : ride.status;
              const tone = ride.status === 'accepted' ? 'brand' : 'sky';
              const headline =
                ride.role === 'requester'
                  ? `You asked ${other.name} for a ride`
                  : `${other.name} asked you for a ride`;
              return (
                <View key={ride.id} style={styles.rcard}>
                  <View style={styles.rcHead}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.rcTimeSm}>{headline}</Text>
                      <Text style={styles.rcDate}>{formatRideWhen(ride.created_at)}</Text>
                    </View>
                    <Badge label={statusLabel} tone={tone} />
                  </View>
                  <View style={styles.mapBox}>
                    <Text style={styles.mapCap}>Route preview</Text>
                  </View>
                  <View style={styles.drvRow}>
                    <Avatar initials={ini} color={C.brand} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.drvName}>{other.name}</Text>
                      <Text style={styles.drvVeh}>{other.email}</Text>
                    </View>
                  </View>
                  {ride.note ? <Text style={styles.riderHint}>{ride.note}</Text> : null}
                  {ride.status === 'accepted' ? (
                    <Pressable
                      style={[styles.completeRow, actingId === ride.id && { opacity: 0.55 }]}
                      onPress={() => respondToRequest(ride.id, 'completed')}
                      disabled={actingId === ride.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: false }}
                      accessibilityLabel="Mark ride complete to add savings and emissions to both your Impact totals"
                    >
                      <View style={styles.completeBox} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.completeLabel}>Mark complete</Text>
                        <Text style={styles.completeSub}>
                          Either of you can confirm. Moves to History and adds the estimated savings and CO₂ to
                          both of your Impact tabs.
                        </Text>
                      </View>
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          )}
        </>
      )}

      {sub === 'past' && (
        <>
          {loading ? (
            <ActivityIndicator color={C.brand} style={{ marginTop: 28 }} />
          ) : history.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No ride history yet</Text>
              <Text style={styles.emptySub}>
                Completed, declined, or cancelled rides show up here.
              </Text>
            </View>
          ) : (
            <View style={styles.histCard}>
              {history.map((ride, idx) => {
                const other = ride.other_user;
                const ini = initialsFromName(other.name);
                const title =
                  ride.role === 'requester'
                    ? `Request to ${other.name}`
                    : `Request from ${other.name}`;
                const impactBit =
                  ride.status === 'completed' && Number(ride.saved_usd) > 0
                    ? ` · $${Number(ride.saved_usd).toFixed(2)} saved · ${Number(ride.co2_kg ?? 0).toFixed(1)}kg CO₂`
                    : '';
                const statusShort =
                  ride.status === 'completed'
                    ? 'Completed'
                    : ride.status === 'declined'
                      ? 'Declined'
                      : ride.status === 'cancelled'
                        ? 'Cancelled'
                        : ride.status;
                const subLine = `${formatRideWhen(ride.created_at)} · ${statusShort}${impactBit}`;
                return (
                  <View
                    key={ride.id}
                    style={[styles.histRow, idx === history.length - 1 && { borderBottomWidth: 0 }]}
                  >
                    <Avatar initials={ini} color={C.sky} size={32} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.histTitle}>{title}</Text>
                      <Text style={styles.histSub}>{subLine}</Text>
                    </View>
                    <Badge label={statusShort} tone={ride.status === 'completed' ? 'brand' : 'gray'} />
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}

      {sub === 'drv' && (
        <>
          <View style={styles.banner}>
            <Text style={styles.bannerTxt}>
              Incoming requests from coworkers who chose you on Find. Accept to confirm the carpool. Either of
              you can mark it complete afterward — that adds savings and emissions to both your Impact totals.
            </Text>
          </View>
          {loading ? (
            <ActivityIndicator color={C.brand} style={{ marginTop: 28 }} />
          ) : driving.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No pending requests</Text>
              <Text style={styles.emptySub}>When someone requests a ride with you, it will show here.</Text>
            </View>
          ) : (
            driving.map((ride) => {
              const other = ride.other_user;
              const ini = initialsFromName(other.name);
              const busy = actingId === ride.id;
              return (
                <View key={ride.id} style={styles.rcard}>
                  <View style={styles.rcHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rcTimeSm}>{other.name}</Text>
                      <Text style={styles.rcDate}>{formatRideWhen(ride.created_at)}</Text>
                    </View>
                    <Badge label="Requested" tone="amber" />
                  </View>
                  <Text style={styles.rcDate}>{other.email}</Text>
                  <View style={styles.pips}>
                    <View style={[styles.pip, { backgroundColor: C.sky }]}>
                      <Text style={styles.pipTxt}>{ini}</Text>
                    </View>
                  </View>
                  <View style={styles.drvActions}>
                    <Pressable
                      style={[styles.acceptBtn, busy && { opacity: 0.5 }]}
                      disabled={busy}
                      onPress={() => respondToRequest(ride.id, 'accepted')}
                    >
                      <Text style={styles.acceptBtnTxt}>Accept</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.declineBtn, busy && { opacity: 0.5 }]}
                      disabled={busy}
                      onPress={() => respondToRequest(ride.id, 'declined')}
                    >
                      <Text style={styles.declineBtnTxt}>Decline</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.panel },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  title: { color: C.text, fontSize: 28, fontWeight: '800' },
  sub: { color: C.muted, fontSize: 13, marginTop: 4 },
  findBtn: { backgroundColor: C.brand, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  findBtnTxt: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  tabCell: { paddingVertical: 10, paddingHorizontal: 12, marginRight: 4 },
  tabTxt: { fontSize: 13, fontWeight: '600', color: C.faint },
  tabUnd: { height: 2, backgroundColor: C.brand, borderRadius: 2, marginTop: 8, marginHorizontal: -4 },
  rcard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 22,
    padding: 18,
  },
  rcHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rcTime: { fontSize: 30, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  rcTimeSm: { fontSize: 22, fontWeight: '800', color: C.text },
  rcDate: { fontSize: 13, color: C.muted, marginTop: 4 },
  badge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  badgeTxt: { fontSize: 11, fontWeight: '800' },
  mapBox: {
    height: 100,
    borderRadius: 13,
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'flex-end',
  },
  mapCap: { padding: 10, fontSize: 11, color: C.faint, fontWeight: '600' },
  drvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 11,
  },
  av: { alignItems: 'center', justifyContent: 'center' },
  avTxt: { color: '#fff', fontWeight: '800' },
  drvName: { fontSize: 14, fontWeight: '600', color: C.text },
  drvVeh: { fontSize: 12, color: C.muted, marginTop: 2 },
  riderHint: { fontSize: 12, color: C.muted, marginTop: 10 },
  impactHint: { fontSize: 12, color: C.brand, marginTop: 8, fontWeight: '600' },
  completeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: 'rgba(0,200,150,0.06)',
  },
  completeBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: C.brand,
    marginTop: 2,
    backgroundColor: 'transparent',
  },
  completeLabel: { fontSize: 14, fontWeight: '700', color: C.text },
  completeSub: { fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 17 },
  earn: { fontSize: 13, color: C.muted, marginTop: 8 },
  earnBold: { color: C.brand, fontWeight: '800' },
  histCard: {
    marginHorizontal: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  histTitle: { fontSize: 14, fontWeight: '600', color: C.text },
  histSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  banner: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: C.brandSoft,
    borderWidth: 1,
    borderColor: C.brand,
  },
  bannerTxt: { fontSize: 13, color: C.brand, lineHeight: 19 },
  drvActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  acceptBtn: {
    flex: 1,
    backgroundColor: C.brand,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  acceptBtnTxt: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  declineBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  declineBtnTxt: { color: C.text, fontSize: 14, fontWeight: '700' },
  pips: { flexDirection: 'row', marginTop: 10 },
  pip: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -6,
    borderWidth: 2,
    borderColor: C.panel,
  },
  pipTxt: { fontSize: 10, fontWeight: '800', color: '#fff' },
  empty: { marginHorizontal: 20, marginTop: 24, padding: 20, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  emptySub: { fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 19 },
  primary: {
    marginTop: 16,
    backgroundColor: C.brand,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryTxt: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'center' },
});
