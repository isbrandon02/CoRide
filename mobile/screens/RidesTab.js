import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AppPressable from '../components/AppPressable';
import { GOOGLE_MAPS_API_KEY } from '../src/config';
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

function shortAddress(address) {
  if (!address) return '';
  const line = String(address).split(',')[0].trim();
  return line.length > 34 ? `${line.slice(0, 31)}...` : line;
}

function buildStaticMapUrl({ apiKey, origin, destination, polyline }) {
  if (!apiKey || !origin || !destination) return null;
  const params = new URLSearchParams({
    size: '1200x320',
    scale: '2',
    maptype: 'roadmap',
    key: apiKey,
  });
  params.append('markers', `size:mid|color:0x00c896|label:S|${origin}`);
  params.append('markers', `size:mid|color:0x4ea8f5|label:E|${destination}`);
  params.append('style', 'feature:poi|visibility:off');
  params.append('style', 'feature:transit|visibility:off');
  if (polyline) {
    params.append('path', `weight:5|color:0x00c896cc|enc:${polyline}`);
  } else {
    params.append('visible', origin);
    params.append('visible', destination);
  }
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

async function fetchRoutePolyline({ origin, destination, apiKey, signal }) {
  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.polyline.encodedPolyline',
    },
    body: JSON.stringify({
      origin: { address: origin },
      destination: { address: destination },
      travelMode: 'DRIVE',
    }),
    signal,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || 'Could not load route');
  }

  return data?.routes?.[0]?.polyline?.encodedPolyline || '';
}

function RoutePreview({ ride }) {
  const origin = String(ride.route_origin ?? '').trim();
  const destination = String(ride.route_destination ?? '').trim();
  const hasMapSetup = Boolean(GOOGLE_MAPS_API_KEY);
  const hasRouteAddresses = Boolean(origin && destination);
  const [polyline, setPolyline] = useState('');
  const [loadingRoute, setLoadingRoute] = useState(false);

  useEffect(() => {
    if (!hasMapSetup || !hasRouteAddresses) {
      setPolyline('');
      setLoadingRoute(false);
      return;
    }

    const controller = new AbortController();
    setLoadingRoute(true);

    fetchRoutePolyline({
      origin,
      destination,
      apiKey: GOOGLE_MAPS_API_KEY,
      signal: controller.signal,
    })
      .then((encodedPolyline) => {
        setPolyline(encodedPolyline);
      })
      .catch(() => {
        setPolyline('');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingRoute(false);
        }
      });

    return () => controller.abort();
  }, [origin, destination, hasMapSetup, hasRouteAddresses]);

  const imageUrl = useMemo(
    () =>
      buildStaticMapUrl({
        apiKey: GOOGLE_MAPS_API_KEY,
        origin,
        destination,
        polyline,
      }),
    [origin, destination, polyline],
  );

  return (
    <View style={styles.mapBox}>
      {imageUrl ? (
        <>
          <Image source={{ uri: imageUrl }} style={styles.mapImg} resizeMode="cover" />
          <View style={styles.mapShade} />
          {loadingRoute ? (
            <View style={styles.mapLoader}>
              <ActivityIndicator color={C.brand} size="small" />
            </View>
          ) : null}
          <View style={styles.mapMeta}>
            <View style={styles.mapPill}>
              <Text style={styles.mapPillLabel}>Start</Text>
              <Text style={styles.mapPillText}>{shortAddress(origin)}</Text>
            </View>
            <View style={styles.mapPill}>
              <Text style={styles.mapPillLabel}>Destination</Text>
              <Text style={styles.mapPillText}>{shortAddress(destination)}</Text>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.mapFallback}>
          <Text style={styles.mapCap}>Route preview</Text>
          <Text style={styles.mapFallbackTitle}>
            {!hasMapSetup ? 'Add a Google Maps API key' : 'Route preview unavailable'}
          </Text>
          <Text style={styles.mapFallbackSub}>
            {!hasMapSetup
              ? 'Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to render the static map.'
              : 'This ride is missing a start or destination address.'}
          </Text>
        </View>
      )}
      {imageUrl ? <Text style={styles.mapCapOverlay}>Route preview</Text> : null}
    </View>
  );
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
];

export default function RidesTab({
  accessToken,
  bottomPadding,
  onPressFind,
  refreshKey = 0,
  onRidesMutated,
  /** Other party's user id (string) to pin to top of Upcoming and highlight (e.g. from home Ride requested). */
  focusOtherUserId = null,
}) {
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

  useEffect(() => {
    if (focusOtherUserId) setSub('up');
  }, [focusOtherUserId]);

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

  const orderedUpcoming = useMemo(() => {
    if (!focusOtherUserId) return upcoming;
    const idx = upcoming.findIndex((r) => String(r.other_user?.id) === focusOtherUserId);
    if (idx <= 0) return upcoming;
    const next = [...upcoming];
    const [hit] = next.splice(idx, 1);
    return [hit, ...next];
  }, [upcoming, focusOtherUserId]);

  const orderedDriving = useMemo(() => {
    if (!focusOtherUserId) return driving;
    const idx = driving.findIndex((r) => String(r.other_user?.id) === focusOtherUserId);
    if (idx <= 0) return driving;
    const next = [...driving];
    const [hit] = next.splice(idx, 1);
    return [hit, ...next];
  }, [driving, focusOtherUserId]);

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

  function promptCancelRequest(rideId) {
    Alert.alert('Cancel this request?', 'You can send a new request later from Find.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel request',
        style: 'destructive',
        onPress: () => respondToRequest(rideId, 'cancelled'),
      },
    ]);
  }

  return (
    <ScrollView
      style={styles.flex}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: bottomPadding }}
    >
      <View style={styles.head}>
        <View>
          <Text style={styles.title}>Activity</Text>
          <Text style={styles.sub}>Approve incoming asks · Your rides</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        {SUB_KEYS.map((t) => {
          const on = sub === t.key;
          return (
            <AppPressable key={t.key} variant="tab" style={styles.tabCell} onPress={() => setSub(t.key)}>
              <Text style={[styles.tabTxt, on && { color: C.brand }]}>{t.label}</Text>
              {on ? <View style={styles.tabUnd} /> : null}
            </AppPressable>
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
          ) : driving.length === 0 && orderedUpcoming.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Nothing upcoming</Text>
              <Text style={styles.emptySub}>
                When coworkers request a ride with you, it appears up top here. Your own requests show below that.
              </Text>
              <AppPressable variant="primary" style={styles.primary} onPress={onPressFind}>
                <Text style={styles.primaryTxt}>Find a ride</Text>
              </AppPressable>
            </View>
          ) : (
            <>
              {driving.length > 0 ? (
                <>
                  <View style={styles.sectionHeadRow}>
                    <Text style={styles.sectionEyebrow}>Needs your response</Text>
                    {driving.length > 1 ? (
                      <View style={styles.sectionCountPill}>
                        <Text style={styles.sectionCountTxt}>{driving.length}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.sectionHint}>
                    They chose you on Find — accept or decline so they know what to expect.
                  </Text>
                  {orderedDriving.map((ride) => {
                    const other = ride.other_user;
                    const ini = initialsFromName(other.name);
                    const busy = actingId === ride.id;
                    const isFocused =
                      !!focusOtherUserId && String(other?.id) === String(focusOtherUserId);
                    return (
                      <View
                        key={`in-${ride.id}`}
                        style={[
                          styles.rcard,
                          styles.incomingCard,
                          isFocused && styles.rcardFocused,
                        ]}
                        accessibilityState={isFocused ? { selected: true } : undefined}
                      >
                        <View style={styles.rcHead}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.rcTimeSm}>{other.name}</Text>
                            <Text style={styles.rcDate}>{formatRideWhen(ride.created_at)}</Text>
                          </View>
                          <Badge label="Wants a ride" tone="amber" />
                        </View>
                        <Text style={[styles.rcDate, { marginTop: 2 }]}>{other.email}</Text>
                        <View style={styles.drvRow}>
                          <Avatar initials={ini} color={C.sky} size={40} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.drvName}>Requester</Text>
                            <Text style={styles.drvVeh} numberOfLines={2}>
                              {ride.note ? ride.note : 'No note'}
                            </Text>
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
                  })}
                </>
              ) : null}

              {driving.length > 0 && orderedUpcoming.length > 0 ? (
                <View style={styles.sectionSpacer}>
                  <View style={styles.sectionRule} />
                  <Text style={styles.sectionEyebrowSecondary}>Your upcoming</Text>
                </View>
              ) : null}

              {orderedUpcoming.map((ride) => {
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
              const isFocused =
                !!focusOtherUserId && String(other?.id) === String(focusOtherUserId);
              return (
                <View
                  key={ride.id}
                  style={[styles.rcard, isFocused && styles.rcardFocused]}
                  accessibilityState={isFocused ? { selected: true } : undefined}
                >
                  <View style={styles.rcHead}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.rcTimeSm}>{headline}</Text>
                      <Text style={styles.rcDate}>{formatRideWhen(ride.created_at)}</Text>
                    </View>
                    <Badge label={statusLabel} tone={tone} />
                  </View>
                  <RoutePreview ride={ride} />
                  <View style={styles.drvRow}>
                    <Avatar initials={ini} color={C.brand} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.drvName}>{other.name}</Text>
                      <Text style={styles.drvVeh}>{other.email}</Text>
                    </View>
                  </View>
                  {ride.note ? <Text style={styles.riderHint}>{ride.note}</Text> : null}
                  {ride.status === 'pending' && ride.role === 'requester' ? (
                    <Pressable
                      style={[styles.cancelReqRow, actingId === ride.id && { opacity: 0.55 }]}
                      onPress={() => promptCancelRequest(ride.id)}
                      disabled={actingId === ride.id}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel this ride request"
                    >
                      <Text style={styles.cancelReqTxt}>Cancel request</Text>
                    </Pressable>
                  ) : null}
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
            })}
            </>
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
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 2,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: C.faint,
    textTransform: 'uppercase',
  },
  sectionEyebrowSecondary: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: C.faint,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  sectionCountPill: {
    backgroundColor: 'rgba(245,166,35,0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  sectionCountTxt: { fontSize: 11, fontWeight: '800', color: C.amber },
  sectionHint: {
    marginHorizontal: 20,
    marginBottom: 14,
    fontSize: 13,
    color: C.muted,
    lineHeight: 19,
  },
  sectionSpacer: { marginHorizontal: 20, marginTop: 10, marginBottom: 6 },
  sectionRule: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginBottom: 12 },
  incomingCard: {
    borderLeftWidth: 3,
    borderLeftColor: C.amber,
  },
  rcard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 22,
    padding: 18,
  },
  rcardFocused: {
    borderWidth: 2,
    borderColor: C.brand,
    backgroundColor: 'rgba(0,200,150,0.07)',
  },
  rcHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rcTime: { fontSize: 30, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  rcTimeSm: { fontSize: 22, fontWeight: '800', color: C.text },
  rcDate: { fontSize: 13, color: C.muted, marginTop: 4 },
  badge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  badgeTxt: { fontSize: 11, fontWeight: '800' },
  mapBox: {
    height: 148,
    borderRadius: 13,
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
  },
  mapImg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  mapShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17,17,24,0.16)',
  },
  mapLoader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapMeta: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: 8,
    padding: 12,
  },
  mapPill: {
    alignSelf: 'flex-start',
    maxWidth: '85%',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(17,17,24,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  mapPillLabel: {
    fontSize: 10,
    color: C.faint,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  mapPillText: { fontSize: 12, color: C.text, fontWeight: '600', marginTop: 2 },
  mapCap: { fontSize: 11, color: C.faint, fontWeight: '600' },
  mapCapOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    fontSize: 11,
    color: C.faint,
    fontWeight: '700',
    backgroundColor: 'rgba(17,17,24,0.82)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  mapFallback: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 12,
  },
  mapFallbackTitle: { fontSize: 14, color: C.text, fontWeight: '700', marginTop: 8 },
  mapFallbackSub: { fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 18 },
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
  cancelReqRow: {
    marginTop: 14,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,80,80,0.45)',
    backgroundColor: 'rgba(255,80,80,0.08)',
  },
  cancelReqTxt: { fontSize: 13, fontWeight: '700', color: '#ff8a80' },
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
