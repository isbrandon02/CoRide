import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import AppPressable from '../components/AppPressable';
import {
  createRideRequest,
  getImpact,
  getMatches,
  getRides,
  openOrGetDm,
  patchRideStatus,
} from '../src/auth';
import { ChatList, ChatThread } from './ChatTab';
import ProfileSettingsScreen from './ProfileSettingsScreen';
import RidesTab from './RidesTab';

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
  sky: '#4ea8f5',
  amber: '#f5a623',
};

const EMPTY_IMPACT = { saved: 0, co2: 0, rides: 0, weekly: [] };
const MATCH_COLORS = [C.brand, C.amber, C.sky];
const FILTERS = ['Morning', 'Afternoon', 'Evening'];

const TAB_BAR_ITEMS = [
  { key: 'home', label: 'Home', iconOn: 'home', iconOff: 'home-outline' },
  { key: 'matches', label: 'Find', iconOn: 'search', iconOff: 'search-outline' },
  { key: 'rides', label: 'Activity', iconOn: 'calendar', iconOff: 'calendar-outline' },
  { key: 'chat', label: 'Chat', iconOn: 'chatbubbles', iconOff: 'chatbubbles-outline' },
];

const badgeTone = {
  brand: { bg: C.brandSoft, fg: C.brand },
  sky: { bg: 'rgba(78,168,245,0.12)', fg: C.sky },
  amber: { bg: 'rgba(245,166,35,0.12)', fg: C.amber },
  gray: { bg: 'rgba(255,255,255,0.07)', fg: C.muted },
};

function Badge({ label, tone = 'gray' }) {
  const t = badgeTone[tone];
  return (
    <View style={[s.badge, { backgroundColor: t.bg }]}>
      <Text style={[s.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

function Avatar({ initials, color, size = 42 }) {
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={s.avatarText}>{initials}</Text>
    </View>
  );
}

function greetingLine() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function userInitials(displayName, email) {
  const raw = String(displayName || email || '?').trim();
  if (!raw) return '?';
  if (raw.includes('@')) {
    const local = raw.split('@')[0];
    return (local.slice(0, 2) || '?').toUpperCase();
  }
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return raw.slice(0, 2).toUpperCase();
}

function firstLineAddress(addr) {
  if (!addr || typeof addr !== 'string') return '';
  const line = addr.split(',')[0].trim();
  return line.length > 36 ? `${line.slice(0, 34)}…` : line;
}

function normalizeMatch(x, i) {
  const displayName = x.name ?? x.full_name ?? 'Member';
  const score = x.score ?? x.match_score ?? 0;
  const overlap = x.route_overlap ?? x.overlap ?? score;
  const timeScoreRaw = x.time_score ?? 0;
  return {
    id: String(x.id),
    name: displayName,
    email: typeof x.email === 'string' ? x.email : '',
    initials:
      x.initials ??
      (displayName
        .split(' ')
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase() || '?'),
    score: Math.round(score <= 1 ? score * 100 : score),
    overlap: Math.round(overlap <= 1 ? overlap * 100 : overlap),
    timeScore: Math.round(timeScoreRaw <= 1 ? timeScoreRaw * 100 : timeScoreRaw),
    time:
      x.depart_time ??
      x.departure_time ??
      (x.work_schedule && typeof x.work_schedule === 'object' && x.work_schedule.start_time
        ? String(x.work_schedule.start_time)
        : ''),
    area: x.pickup_area ?? x.neighborhood ?? firstLineAddress(x.home_address),
    color: MATCH_COLORS[i % MATCH_COLORS.length],
    // Find list row extras (mock UI); real API matches omit these — keep defined for .toFixed / labels.
    seats: x.seats != null ? x.seats : 2,
    role: x.role ?? 'Carpool',
    team: x.team ?? 'match',
    eta: Number(x.eta ?? 0) || 0,
    detour: Number(x.detour ?? 0) || 0,
    cost: Number(x.cost ?? x.share ?? 0) || 0,
    co2: Number(x.co2 ?? x.co2_kg ?? 0) || 0,
  };
}

/**
 * Signed-in shell: Home (impact + schedule) / Find / Activity / Chat / Profile.
 */
function MainApp({ accessToken, accountEmail, displayName, onLogout }) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('home');
  const [matches, setMatches] = useState([]);
  const [impact, setImpact] = useState(EMPTY_IMPACT);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [loadingImpact, setLoadingImpact] = useState(true);
  const [search, setSearch] = useState('');
  const [sheet, setSheet] = useState(null);
  /** Driver user ids (string) with a pending request from you */
  const [pendingDriverIds, setPendingDriverIds] = useState([]);
  /** Maps driver id string → ride id for pending requests you sent (for cancel from Find). */
  const [pendingRideByDriverId, setPendingRideByDriverId] = useState({});
  const [cancellingDriverId, setCancellingDriverId] = useState(null);
  const [ridesRefreshKey, setRidesRefreshKey] = useState(0);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [chatSub, setChatSub] = useState('list');
  /** set when opening a thread from the inbox or Find */
  const [chatThread, setChatThread] = useState(null);
  const [chatRefreshKey, setChatRefreshKey] = useState(0);
  /** When set, Find tab scrolls to this match and highlights it (e.g. from Home). */
  const [findFocusId, setFindFocusId] = useState(null);
  const [filters, setFilters] = useState([]);
  const [homeProfileMenuOpen, setHomeProfileMenuOpen] = useState(false);
  /** Increment to tell Profile tab to enter edit mode (from Home menu). */
  const [profileEditSignal, setProfileEditSignal] = useState(0);

  useEffect(() => {
    let live = true;
    if (!accessToken) {
      setLoadingMatches(false);
      return () => {
        live = false;
      };
    }
    (async () => {
      try {
        const [matchData, ridesData] = await Promise.all([
          getMatches(accessToken),
          getRides(accessToken).catch(() => ({ rides: [] })),
        ]);
        if (!live) return;
        const list = matchData.matches ?? [];
        setMatches(Array.isArray(list) ? list.map(normalizeMatch) : []);
        const pendingRides = (ridesData.rides ?? []).filter(
          (r) => r.role === 'requester' && r.status === 'pending',
        );
        setPendingDriverIds(pendingRides.map((r) => String(r.other_user.id)));
        setPendingRideByDriverId(
          Object.fromEntries(pendingRides.map((r) => [String(r.other_user.id), r.id])),
        );
      } catch {
        setMatches([]);
      } finally {
        if (live) setLoadingMatches(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [accessToken, ridesRefreshKey]);

  useEffect(() => {
    let live = true;
    if (!accessToken) {
      setLoadingImpact(false);
      return () => {
        live = false;
      };
    }
    setLoadingImpact(true);
    getImpact(accessToken)
      .then((d) => {
        if (!live) return;
        setImpact({
          saved: Number(d.total_saved ?? d.saved ?? 0),
          co2: Number(d.total_co2_kg ?? d.co2_saved ?? 0),
          rides: Number(d.rides_shared ?? d.total_rides ?? 0),
          weekly:
            Array.isArray(d.weekly) && d.weekly.length
              ? d.weekly.map((x) => ({ d: x.day ?? x.d, v: x.value ?? x.v }))
              : [],
        });
      })
      .catch(() => {
        if (live) setImpact(EMPTY_IMPACT);
      })
      .finally(() => {
        if (live) setLoadingImpact(false);
      });
    return () => {
      live = false;
    };
  }, [accessToken, ridesRefreshKey]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return matches;
    return matches.filter((m) =>
      [m.name, m.email, m.area].some((v) => String(v || '').toLowerCase().includes(q)),
    );
  }, [matches, search]);

  const displayedMatches = useMemo(() => {
    if (!findFocusId) return shown;
    const focus = matches.find((m) => m.id === findFocusId);
    if (!focus || shown.some((m) => m.id === findFocusId)) return shown;
    return [focus, ...shown.filter((m) => m.id !== findFocusId)];
  }, [shown, matches, findFocusId]);

  useEffect(() => {
    if (tab !== 'matches' || !findFocusId) return;
    const t = setTimeout(() => setFindFocusId(null), 3500);
    return () => clearTimeout(t);
  }, [tab, findFocusId]);

  const top = shown[0] ?? matches[0];
  const commute = pendingDriverIds.length ? matches.find((m) => pendingDriverIds.includes(m.id)) ?? top : top;

  const toggleFilter = useCallback(
    (f) => setFilters((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f])),
    [],
  );

  const cancelPendingRide = useCallback(
    (driverIdStr) => {
      const rideId = pendingRideByDriverId[driverIdStr];
      if (!accessToken || rideId == null) {
        Alert.alert('Could not cancel', 'Request not found. Open Activity or try again in a moment.');
        return;
      }
      Alert.alert('Cancel this request?', 'You can send a new request later from Find.', [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel request',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setCancellingDriverId(driverIdStr);
              try {
                await patchRideStatus(accessToken, rideId, 'cancelled');
                setRidesRefreshKey((k) => k + 1);
              } catch (e) {
                Alert.alert('Could not cancel', e instanceof Error ? e.message : String(e));
              } finally {
                setCancellingDriverId(null);
              }
            })();
          },
        },
      ]);
    },
    [accessToken, pendingRideByDriverId],
  );

  const openChatFromFind = useCallback(
    async (match) => {
      if (!accessToken) return;
      const otherId = Number(match.id);
      if (!Number.isFinite(otherId)) {
        Alert.alert('Chat', 'Invalid match.');
        return;
      }
      try {
        const dm = await openOrGetDm(accessToken, otherId);
        setChatThread({ id: String(dm.conversation_id), title: dm.title });
        setChatSub('thread');
        setTab('chat');
      } catch (e) {
        Alert.alert('Chat', e instanceof Error ? e.message : String(e));
      }
    },
    [accessToken],
  );

  const confirm = async () => {
    if (!sheet || !accessToken) return;
    const driverId = Number(sheet.id);
    if (!Number.isFinite(driverId)) {
      Alert.alert('Request failed', 'Invalid match.');
      return;
    }
    setConfirmLoading(true);
    try {
      const data = await createRideRequest(accessToken, { driver_id: driverId });
      setPendingDriverIds((cur) => (cur.includes(sheet.id) ? cur : [sheet.id, ...cur]));
      if (data?.id != null) {
        setPendingRideByDriverId((prev) => ({ ...prev, [sheet.id]: data.id }));
      }
      setRidesRefreshKey((k) => k + 1);
      setSheet(null);
      setTab('home');
    } catch (e) {
      Alert.alert('Request failed', e instanceof Error ? e.message : String(e));
    } finally {
      setConfirmLoading(false);
    }
  };

  const name = displayName || 'there';
  const greet = greetingLine();

  const Home = () => (
    <>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.pad}>
        <View style={s.homeHeaderRow}>
          <View style={s.homeHeaderText}>
            <Text style={s.smallMuted}>{greet}</Text>
            <Text style={s.title}>{name}</Text>
            <Text style={s.sub}>
              {matches.length === 0
                ? 'No route matches yet — open Find when coworkers are onboarded'
                : '3 coworkers from Two Sigma on your route today'}
            </Text>
          </View>
          <AppPressable
            variant="ghost"
            style={s.homeAvatarBtn}
            onPress={() => setHomeProfileMenuOpen(true)}
            accessibilityLabel="Account menu"
          >
            <Avatar initials={userInitials(displayName, accountEmail)} color={C.brand} size={44} />
          </AppPressable>
        </View>
      <AppPressable
        variant="solid"
        style={s.alert}
        onPress={() => setTab('matches')}
        android_ripple={{ color: 'rgba(0,0,0,0.14)' }}
      >
        <Text style={s.alertOver}>{pendingDriverIds.length ? 'Ride requested' : "Today's commute"}</Text>
        <Text style={s.alertTitle}>
          {commute ? `${pendingDriverIds.length ? 'Waiting on' : 'Best match:'} ${commute.name}` : 'No ride lined up yet'}
        </Text>
        <Text style={s.alertSub}>
          {commute
            ? [commute.time, commute.area].filter(Boolean).join(' · ') || 'Carpool match from your profile'
            : 'Open Find to request a ride'}
        </Text>
        <View style={s.rowWrap}>
          <View style={s.pill}>
            <Text style={s.pillText}>{pendingDriverIds.length ? 'Pending confirmation' : `${commute?.score ?? 0}% match`}</Text>
          </View>
          {commute ? (
            <View style={s.pill}>
              <Text style={s.pillText}>Route {commute.overlap}%</Text>
            </View>
          ) : null}
        </View>
      </AppPressable>
      <Text style={s.section}>Coworkers driving today</Text>
      {loadingMatches ? (
        <ActivityIndicator color={C.brand} style={s.loader} />
      ) : matches.length === 0 ? (
        <View style={s.card}>
          <Text style={s.rowTitle}>No matches yet</Text>
          <Text style={s.rowSub}>Complete onboarding and wait for coworkers on similar routes.</Text>
        </View>
      ) : (
        matches.slice(0, 3).map((m, i) => (
          <AppPressable
            key={m.id}
            variant="default"
            style={s.row}
            onPress={() => {
              setFindFocusId(m.id);
              setTab('matches');
            }}
            android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
          >
            <Avatar initials={m.initials} color={m.color} />
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>{m.name}</Text>
              <Text style={s.rowSub}>
                {m.score}% match · Route {m.overlap}% · Time {m.timeScore}%
                {m.area ? ` · ${m.area}` : ''}
              </Text>
            </View>
            <Badge label={i === 0 ? 'Top' : 'View'} tone={i === 0 ? 'brand' : 'gray'} />
          </AppPressable>
        ))
      )}
      <Text style={s.section}>Your Impact</Text>
      {loadingImpact ? (
        <ActivityIndicator color={C.brand} style={{ paddingVertical: 24 }} />
      ) : (
        <View style={s.stats}>
          <View style={s.stat}>
            <Text style={[s.statNum, { color: C.brand }]}>${impact.saved}</Text>
            <Text style={s.statKey}>Saved</Text>
          </View>
          <View style={s.stat}>
            <Text style={[s.statNum, { color: C.sky }]}>{impact.co2}kg</Text>
            <Text style={s.statKey}>CO2 less</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statNum}>{impact.rides}</Text>
            <Text style={s.statKey}>Rides</Text>
          </View>
        </View>
      )}
      <Text style={s.section}>This week</Text>
      <View style={s.card}>
        <Text style={s.rowSub}>
          Calendar sync is not connected yet. Use Find to plan rides with matched coworkers.
        </Text>
        <AppPressable
          variant="ghost"
          style={[s.ghostBtn, { alignSelf: 'flex-start', marginTop: 12 }]}
          onPress={() => setTab('matches')}
        >
          <Text style={s.ghostText}>Open Find</Text>
        </AppPressable>
      </View>
      </ScrollView>
      <Modal
        visible={homeProfileMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setHomeProfileMenuOpen(false)}
      >
        <View style={s.profileMenuRoot}>
          <Pressable style={s.profileMenuBackdrop} onPress={() => setHomeProfileMenuOpen(false)} />
          <View style={[s.profileMenuSheet, { top: insets.top + 8, right: 16 }]}>
          <AppPressable
            variant="default"
            style={s.profileMenuRow}
            onPress={() => {
              setHomeProfileMenuOpen(false);
              setTab('profile');
              setProfileEditSignal((n) => n + 1);
            }}
          >
            <Ionicons name="person-outline" size={20} color={C.text} />
            <Text style={s.profileMenuText}>Edit profile</Text>
          </AppPressable>
          <View style={s.profileMenuDivider} />
          <AppPressable
            variant="default"
            style={s.profileMenuRow}
            onPress={() => {
              setHomeProfileMenuOpen(false);
              onLogout();
            }}
          >
            <Ionicons name="log-out-outline" size={20} color="#f87171" />
            <Text style={[s.profileMenuText, { color: '#f87171' }]}>Sign out</Text>
          </AppPressable>
          </View>
        </View>
      </Modal>
    </>
  );

  const tabBarBottomPad = Math.max(insets.bottom, 8);
  const tabBarHeight = 58 + tabBarBottomPad;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <View style={s.root}>
        {tab === 'home' && <Home />}
        {tab === 'matches' && (
          <FindMatchesList
            displayedMatches={displayedMatches}
            shown={shown}
            loadingMatches={loadingMatches}
            findFocusId={findFocusId}
            search={search}
            setSearch={setSearch}
            filters={filters}
            toggleFilter={toggleFilter}
            pendingDriverIds={pendingDriverIds}
            cancellingDriverId={cancellingDriverId}
            onCancelPendingRide={cancelPendingRide}
            openChatFromFind={openChatFromFind}
            setSheet={setSheet}
            setTab={setTab}
          />
        )}
        {tab === 'rides' && (
          <RidesTab
            accessToken={accessToken}
            bottomPadding={tabBarHeight}
            refreshKey={ridesRefreshKey}
            onPressFind={() => {
              setFindFocusId(null);
              setTab('matches');
            }}
            onRidesMutated={() => setRidesRefreshKey((k) => k + 1)}
          />
        )}
        {tab === 'chat' && chatSub === 'list' && (
          <ChatList
            accessToken={accessToken}
            refreshKey={chatRefreshKey}
            bottomPadding={tabBarHeight}
            onOpenThread={(c) => {
              setChatThread({ id: c.id, title: c.title });
              setChatSub('thread');
            }}
          />
        )}
        {tab === 'chat' && chatSub === 'thread' && chatThread != null && (
          <ChatThread
            accessToken={accessToken}
            conversationId={chatThread.id}
            threadTitle={chatThread.title}
            bottomPadding={tabBarHeight}
            onBack={() => {
              setChatSub('list');
              setChatThread(null);
              setChatRefreshKey((k) => k + 1);
            }}
            onMessagesChanged={() => setChatRefreshKey((k) => k + 1)}
          />
        )}
        {tab === 'profile' && (
          <View style={s.profileWrap}>
            <View style={[s.profileStackHeader, { paddingTop: Math.max(insets.top, 12) }]}>
              <AppPressable
                variant="ghost"
                style={s.profileBackRow}
                onPress={() => setTab('home')}
                accessibilityRole="button"
                accessibilityLabel="Back to Home"
              >
                <Ionicons name="chevron-back" size={24} color={C.text} />
                <Text style={s.profileBackText}>Home</Text>
              </AppPressable>
            </View>
            <ProfileSettingsScreen
              accessToken={accessToken}
              accountEmail={accountEmail}
              onLogout={onLogout}
              onSaveSuccess={() => setTab('home')}
              scrollBottomPadding={Math.max(insets.bottom, 16) + 24}
              editSignal={profileEditSignal}
              embeddedProfileChrome={false}
            />
          </View>
        )}
        {tab !== 'profile' && (
        <View style={[s.tabs, { paddingBottom: tabBarBottomPad }]}>
          {TAB_BAR_ITEMS.map(({ key: k, label: l, iconOn, iconOff }) => {
            const on = tab === k;
            return (
              <AppPressable
                key={k}
                variant="tab"
                style={[s.tab, on && s.tabOn]}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={l}
                onPress={() => {
                  if (k === 'chat') {
                    setChatSub('list');
                    setChatThread(null);
                  }
                  if (k === 'matches') {
                    setFindFocusId(null);
                  }
                  setTab(k);
                }}
              >
                <View style={s.tabInner}>
                  <Ionicons name={on ? iconOn : iconOff} size={22} color={on ? C.brand : C.faint} />
                  <Text style={[s.tabText, on && { color: C.brand }]}>{l}</Text>
                </View>
              </AppPressable>
            );
          })}
        </View>
        )}
      </View>
      <Modal visible={!!sheet} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <View style={s.backdrop}>
          <AppPressable variant="none" style={StyleSheet.absoluteFill} onPress={() => setSheet(null)} />
          <View style={s.sheet}>
            <View style={s.handle} />
            {sheet && (
              <>
                <Text style={s.sheetTitle}>Confirm ride request</Text>
                <Text style={s.sheetBody}>
                  Send {sheet.name} a request to share a commute. After they accept, either of you can mark the
                  ride complete under Activity → Upcoming. That adds the estimated savings and CO₂ to both of your
                  Impact tabs.
                </Text>
                <View style={s.card}>
                  {[
                    ['Match score', `${sheet.score}%`],
                    ['Route overlap', `${sheet.overlap}%`],
                    ['Time fit', `${sheet.timeScore}%`],
                  ].map(([rowLabel, v], idx) => (
                    <View key={String(rowLabel)} style={[s.sheetRow, idx === 2 && { borderBottomWidth: 0 }]}>
                      <Text style={s.rowSub}>{rowLabel}</Text>
                      <Text style={s.sheetVal}>{v}</Text>
                    </View>
                  ))}
                </View>
                <AppPressable
                  variant="primary"
                  style={[s.sheetConfirmBtn, confirmLoading && { opacity: 0.65 }]}
                  onPress={confirm}
                  disabled={confirmLoading}
                  accessibilityRole="button"
                  accessibilityLabel={confirmLoading ? 'Sending request' : 'Confirm ride request'}
                >
                  <Text style={s.sheetConfirmText}>{confirmLoading ? 'Sending…' : 'Confirm request'}</Text>
                </AppPressable>
                <AppPressable
                  variant="link"
                  style={{ alignItems: 'center', paddingVertical: 14 }}
                  onPress={() => setSheet(null)}
                >
                  <Text style={s.sub}>Cancel</Text>
                </AppPressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  root: { flex: 1, backgroundColor: C.panel },
  profileWrap: { flex: 1, backgroundColor: C.panel },
  profileStackHeader: {
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    paddingHorizontal: 8,
    paddingBottom: 4,
    backgroundColor: C.panel,
  },
  profileBackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
    borderRadius: 12,
  },
  profileBackText: { color: C.text, fontSize: 17, fontWeight: '600' },
  pad: { paddingBottom: 112 },
  homeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    padding: 20,
    paddingBottom: 16,
    backgroundColor: C.card,
  },
  homeHeaderText: { flex: 1, minWidth: 0 },
  homeAvatarBtn: { borderRadius: 999, overflow: 'hidden' },
  profileMenuRoot: { flex: 1 },
  profileMenuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  profileMenuSheet: {
    position: 'absolute',
    backgroundColor: C.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    minWidth: 208,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  profileMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  profileMenuText: { color: C.text, fontSize: 16, fontWeight: '600' },
  profileMenuDivider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line },
  /** Greeting + name: same size/weight as former "Good Evening" line */
  heroHeadline: {
    color: C.text,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    marginBottom: 6,
  },
  smallMuted: { color: C.muted, fontSize: 14 },
  title: { color: C.text, fontSize: 28, fontWeight: '800', marginTop: 2 },
  sub: { color: C.muted, fontSize: 13, marginTop: 6 },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  section: {
    color: C.faint,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  alert: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: C.brand,
    borderRadius: 22,
    padding: 18,
    overflow: 'hidden',
  },
  alertOver: { color: 'rgba(0,0,0,0.55)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  alertTitle: { color: '#021b14', fontSize: 21, fontWeight: '800', marginTop: 6 },
  alertSub: { color: 'rgba(0,0,0,0.66)', fontSize: 13, marginTop: 6 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  pill: { backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { color: 'rgba(0,0,0,0.7)', fontSize: 11, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 14 },
  stat: {
    flex: 1,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statNum: { color: C.text, fontSize: 22, fontWeight: '800' },
  statKey: { color: C.faint, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 8,
    borderRadius: 18,
    overflow: 'hidden',
  },
  rowTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
  rowSub: { color: C.muted, fontSize: 12, marginTop: 4 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  card: {
    marginHorizontal: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  weekDay: { width: 34, color: C.faint, fontSize: 11, fontWeight: '800' },
  weekText: { flex: 1, color: C.text, fontSize: 13 },
  ghostBtn: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  ghostBtnWide: {
    minWidth: 74,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  ghostText: { color: C.text, fontSize: 12, fontWeight: '700' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchLbl: { color: C.faint, fontSize: 12, fontWeight: '700' },
  input: { flex: 1, color: C.text, fontSize: 14, paddingVertical: 0 },
  chips: { paddingHorizontal: 16, gap: 8, paddingTop: 10, paddingBottom: 4 },
  chip: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: C.brandSoft, borderColor: C.brand },
  chipText: { color: C.muted, fontSize: 12, fontWeight: '700' },
  tip: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 12,
    backgroundColor: C.brandSoft,
    borderWidth: 1,
    borderColor: C.brand,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  tipText: { color: C.text, fontSize: 12.5 },
  center: { paddingVertical: 40, alignItems: 'center' },
  loader: { paddingVertical: 24 },
  match: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 22,
    padding: 18,
  },
  matchFocused: {
    borderWidth: 2,
    borderColor: C.brand,
    backgroundColor: 'rgba(0,200,150,0.06)',
  },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  matchName: { color: C.text, fontSize: 17, fontWeight: '800' },
  matchEmail: { color: C.faint, fontSize: 11, marginTop: 4 },
  score: { color: C.brand, fontSize: 28, fontWeight: '800' },
  scoreLbl: { color: C.faint, fontSize: 10, textTransform: 'uppercase', fontWeight: '700' },
  bar: {
    height: 6,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 12,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: C.brand, borderRadius: 99 },
  micro: { color: C.faint, fontSize: 10, marginTop: 6 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  metric: {
    flexGrow: 1,
    minWidth: '22%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 11,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  metricNum: { color: C.text, fontSize: 13, fontWeight: '800' },
  metricKey: { color: C.faint, fontSize: 9.5, fontWeight: '700', textTransform: 'uppercase', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  primary: {
    flex: 1,
    backgroundColor: C.brand,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    minHeight: 48,
  },
  /** Light text on brand green — dark text was hard to see on some devices */
  primaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  cancelPrimary: {
    flex: 1,
    backgroundColor: 'rgba(255,80,80,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,80,80,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    minHeight: 48,
  },
  cancelPrimaryText: { color: '#ff8a80', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  sheetConfirmBtn: {
    marginTop: 18,
    backgroundColor: C.brand,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  sheetConfirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  impactHero: {
    marginHorizontal: 16,
    marginTop: 0,
    backgroundColor: C.brandSoft,
    borderWidth: 1,
    borderColor: C.brand,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  heroNum: { color: C.brand, fontSize: 52, fontWeight: '800', marginTop: 8 },
  statsMini: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  subCenter: { color: C.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10 },
  tabs: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(10,10,15,0.96)',
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 10,
  },
  tab: { borderRadius: 14, paddingHorizontal: 6, paddingVertical: 6, minWidth: 56 },
  tabOn: { backgroundColor: C.brandSoft },
  tabInner: { alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabText: { color: C.faint, fontSize: 10, fontWeight: '700' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: C.panel,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: C.line,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: 18,
  },
  sheetTitle: { color: C.text, fontSize: 22, fontWeight: '800' },
  sheetBody: { color: C.muted, fontSize: 14, lineHeight: 20, marginTop: 8 },
  sheetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  sheetVal: { color: C.text, fontSize: 13, fontWeight: '800' },
});

/** Row height hint for getItemLayout + scroll math; keep ≤ real height to avoid overscrolling. */
const FIND_MATCH_ROW_ESTIMATE = 330;
/** Extra pixels to subtract from target offset so the focused card sits higher (scroll feels less “deep”). */
const FIND_FOCUS_SCROLL_BACK_PX = 128;

/** Stable screen (not defined inside MainApp) so React does not remount Find on every parent render. */
function FindMatchesList({
  displayedMatches,
  shown,
  loadingMatches,
  findFocusId,
  search,
  setSearch,
  filters,
  toggleFilter,
  pendingDriverIds,
  cancellingDriverId,
  onCancelPendingRide,
  openChatFromFind,
  setSheet,
  setTab,
}) {
  const listRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(300);

  const listData = loadingMatches || displayedMatches.length === 0 ? [] : displayedMatches;

  const tryScrollToFocused = useCallback(() => {
    if (!findFocusId || loadingMatches || displayedMatches.length === 0) return;
    const index = displayedMatches.findIndex((m) => m.id === findFocusId);
    if (index < 0) return;
    const offset = Math.max(
      0,
      headerHeight + FIND_MATCH_ROW_ESTIMATE * index - FIND_FOCUS_SCROLL_BACK_PX,
    );
    listRef.current?.scrollToOffset({ offset, animated: true });
  }, [findFocusId, loadingMatches, displayedMatches, headerHeight]);

  useEffect(() => {
    if (listData.length === 0) return;
    const t = setTimeout(tryScrollToFocused, 0);
    const t2 = setTimeout(tryScrollToFocused, 120);
    const t3 = setTimeout(tryScrollToFocused, 450);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [listData.length, tryScrollToFocused, findFocusId, headerHeight]);

  const listHeader = useMemo(
    () => (
      <View
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0) setHeaderHeight(h);
        }}
      >
        <View style={s.head}>
          <View>
            <Text style={s.title}>Find a Ride</Text>
            <Text style={s.sub}>Two Sigma · matched for tomorrow morning</Text>
          </View>
        </View>
        <View style={s.search}>
          <Text style={s.searchLbl}>Search</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Two Sigma, teams, neighborhoods"
            placeholderTextColor={C.faint}
            style={s.input}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {FILTERS.map((f) => {
            const on = filters.includes(f);
            return (
              <AppPressable
                key={f}
                variant="chip"
                style={[s.chip, on && s.chipOn]}
                onPress={() => toggleFilter(f)}
              >
                <Text style={[s.chipText, on && { color: C.brand }]}>{f}</Text>
              </AppPressable>
            );
          })}
        </ScrollView>
        <View style={s.tip}>
          <Text style={s.tipText}>Score = route overlap x 0.6 + time proximity x 0.4</Text>
        </View>
        {loadingMatches ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={C.brand} />
            <Text style={s.sub}>Finding your best commute matches...</Text>
          </View>
        ) : displayedMatches.length === 0 ? (
          <View style={s.card}>
            <Text style={s.rowTitle}>No matches for these filters yet</Text>
            <Text style={s.rowSub}>Try removing a filter or search by another neighborhood.</Text>
          </View>
        ) : null}
      </View>
    ),
    [loadingMatches, displayedMatches.length, search, filters, toggleFilter, setSearch],
  );

  const renderItem = useCallback(
    ({ item: m, index: i }) => {
      const done = pendingDriverIds.includes(m.id);
      const cancelBusy = cancellingDriverId === m.id;
      const focused = findFocusId === m.id;
      const isTopMatch = m.id === shown[0]?.id;
      return (
        <View style={[s.match, isTopMatch && !focused && { borderColor: C.brand }, focused && s.matchFocused]}>
          <View style={s.between}>
            <Badge label={isTopMatch ? 'Top Match' : 'Driving tomorrow'} tone={isTopMatch ? 'brand' : 'gray'} />
            {done ? <Badge label="Pending" tone="sky" /> : <Badge label={`${m.seats ?? 2} seats`} />}
          </View>
          <View style={[s.row, { marginHorizontal: 0, paddingHorizontal: 0 }]}>
            <Avatar initials={m.initials} color={m.color} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={s.matchName}>{m.name}</Text>
              <Text style={s.rowSub}>
                {[m.role, m.team].filter(Boolean).join(' · ') || 'Route match'}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.score}>{m.score}%</Text>
              <Text style={s.scoreLbl}>match</Text>
            </View>
          </View>
          <Text style={s.rowSub}>
            {[m.time, m.area].filter(Boolean).join(' · ') || 'Commute details from profile'}
            {m.eta != null && m.eta > 0 ? ` · ${m.eta} min est.` : ''}
          </Text>
          <View style={s.bar}>
            <View style={[s.fill, { width: `${m.overlap}%` }]} />
          </View>
          <View style={s.between}>
            <Text style={s.micro}>Your home</Text>
            <Text style={s.micro}>{m.overlap}% overlap</Text>
            <Text style={s.micro}>Office</Text>
          </View>
          <View style={s.metrics}>
            <View style={s.metric}>
              <Text style={[s.metricNum, { color: i === 1 ? C.amber : C.brand }]}>
                +{Number(m.detour ?? 0)} min
              </Text>
              <Text style={s.metricKey}>Detour</Text>
            </View>
            <View style={s.metric}>
              <Text style={s.metricNum}>{m.time}</Text>
              <Text style={s.metricKey}>Departs</Text>
            </View>
            <View style={s.metric}>
              <Text style={[s.metricNum, { color: C.brand }]}>${Number(m.cost ?? 0).toFixed(2)}</Text>
              <Text style={s.metricKey}>Your share</Text>
            </View>
            <View style={s.metric}>
              <Text style={[s.metricNum, { color: C.sky }]}>{Number(m.co2 ?? 0).toFixed(1)}kg</Text>
              <Text style={s.metricKey}>CO2 saved</Text>
            </View>
          </View>
          <View style={s.actions}>
            {done ? (
              <AppPressable
                variant="ghost"
                disabled={cancelBusy}
                style={[s.cancelPrimary, cancelBusy && { opacity: 0.55 }]}
                onPress={() => onCancelPendingRide(m.id)}
                accessibilityLabel="Cancel ride request"
              >
                <Text style={s.cancelPrimaryText}>{cancelBusy ? 'Cancelling…' : 'Cancel request'}</Text>
              </AppPressable>
            ) : (
              <AppPressable variant="primary" style={s.primary} onPress={() => setSheet(m)}>
                <Text style={s.primaryText}>Request Ride</Text>
              </AppPressable>
            )}
            <AppPressable
              variant="ghost"
              style={s.ghostBtnWide}
              onPress={() => {
                void openChatFromFind(m);
              }}
            >
              <Text style={s.ghostText}>Chat</Text>
            </AppPressable>
          </View>
        </View>
      );
    },
    [
      findFocusId,
      shown,
      pendingDriverIds,
      cancellingDriverId,
      onCancelPendingRide,
      openChatFromFind,
      setSheet,
      setTab,
    ],
  );

  return (
    <FlatList
      ref={listRef}
      style={{ flex: 1 }}
      data={listData}
      keyExtractor={(item) => item.id}
      extraData={`${findFocusId}-${pendingDriverIds.join(',')}-${cancellingDriverId ?? ''}`}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={listHeader}
      renderItem={renderItem}
      contentContainerStyle={listData.length === 0 ? [s.pad, { flexGrow: 1 }] : s.pad}
      getItemLayout={(_, index) => ({
        length: FIND_MATCH_ROW_ESTIMATE,
        offset: headerHeight + FIND_MATCH_ROW_ESTIMATE * index,
        index,
      })}
      onScrollToIndexFailed={({ index, averageItemLength }) => {
        const len = averageItemLength || FIND_MATCH_ROW_ESTIMATE;
        listRef.current?.scrollToOffset({
          offset: Math.max(0, headerHeight + len * index - FIND_FOCUS_SCROLL_BACK_PX),
          animated: true,
        });
      }}
    />
  );
}

export default MainApp;
