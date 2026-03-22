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
  getProfile,
  getImpact,
  getMatches,
  getRides,
  openOrGetDm,
  patchRideStatus,
} from '../src/auth';
import { formatCurrency } from '../src/currency';
import { ChatList, ChatThread } from './ChatTab';
import GoalsScreen from './GoalsScreen';
import ProfileSettingsScreen from './ProfileSettingsScreen';
import RidesTab from './RidesTab';
import { colors as C, type as T } from '../src/theme';

const EMPTY_IMPACT = { saved: 0, co2: 0, rides: 0, weekly: [] };
const MATCH_COLORS = [C.brand, C.amber, C.sky];

/** Find tab: single-select sort (applied after search). */
const FIND_SORT_DEPART = 'depart';
const FIND_SORT_CO2 = 'co2';
const FIND_SORT_SHARE = 'share';
const FIND_SORT_RIDE = 'ride';
const FIND_SORT_OPTIONS = [
  { id: FIND_SORT_RIDE, label: 'Shortest ride' },
  { id: FIND_SORT_DEPART, label: 'Depart time' },
  { id: FIND_SORT_CO2, label: 'CO₂ saved' },
  { id: FIND_SORT_SHARE, label: 'Your share' },
];

/** Minutes since midnight for commute depart; unknown times sort last. */
function parseDepartMinutes(raw) {
  if (raw == null) return Number.POSITIVE_INFINITY;
  const s = String(raw).trim();
  if (!s) return Number.POSITIVE_INFINITY;
  const ampm = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)\s*$/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const min = parseInt(ampm[2], 10);
    const ap = ampm[3].toLowerCase();
    if (ap === 'pm' && h !== 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    if (h > 23 || min > 59) return Number.POSITIVE_INFINITY;
    return h * 60 + min;
  }
  const m24 = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m24) {
    const h = parseInt(m24[1], 10);
    const min = parseInt(m24[2], 10);
    if (h > 23 || min > 59) return Number.POSITIVE_INFINITY;
    return h * 60 + min;
  }
  return Number.POSITIVE_INFINITY;
}

function sortFindMatches(matches, mode) {
  const out = [...matches];
  switch (mode) {
    case FIND_SORT_DEPART:
      out.sort((a, b) => parseDepartMinutes(a.time) - parseDepartMinutes(b.time));
      break;
    case FIND_SORT_CO2:
      out.sort((a, b) => (b.co2 || 0) - (a.co2 || 0));
      break;
    case FIND_SORT_SHARE:
      out.sort((a, b) => (a.cost || 0) - (b.cost || 0));
      break;
    case FIND_SORT_RIDE: {
      out.sort((a, b) => {
        const ea = a.eta || 0;
        const eb = b.eta || 0;
        if (ea !== eb) return ea - eb;
        return (a.detour || 0) - (b.detour || 0);
      });
      break;
    }
    default:
      break;
  }
  return out;
}

const TAB_BAR_ITEMS = [
  { key: 'home', label: 'Home', iconOn: 'home', iconOff: 'home-outline' },
  { key: 'matches', label: 'Find', iconOn: 'search', iconOff: 'search-outline' },
  { key: 'goals', label: 'Goals', iconOn: 'trophy', iconOff: 'trophy-outline' },
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

function profileNameOverride(profile) {
  const raw = profile?.name ?? profile?.full_name ?? profile?.display_name ?? '';
  const trimmed = String(raw || '').trim();
  return trimmed || null;
}

function firstLineAddress(addr) {
  if (!addr || typeof addr !== 'string') return '';
  const line = addr.split(',')[0].trim();
  return line.length > 36 ? `${line.slice(0, 34)}…` : line;
}

/** Human-readable car line from API `vehicle` on match items. */
function formatMatchVehicleLabel(vehicle) {
  if (!vehicle || typeof vehicle !== 'object') return '';
  const make = String(vehicle.make ?? '').trim();
  const model = String(vehicle.model ?? '').trim();
  const year = vehicle.year != null && vehicle.year !== '' ? String(vehicle.year) : '';
  const color = String(vehicle.color ?? '').trim();
  if (!make && !model) return '';
  const name = [make, model].filter(Boolean).join(' ');
  const lead = year ? `${year} ${name}` : name;
  return color ? `${lead} · ${color}` : lead;
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
    eta: Number(x.eta_minutes ?? x.eta ?? 0) || 0,
    detour: Number(x.detour_minutes ?? x.detour ?? 0) || 0,
    totalDriveMiles: Number(x.total_drive_miles ?? x.totalDriveMiles ?? 0) || 0,
    cost: Number(x.share_usd ?? x.cost ?? x.share ?? 0) || 0,
    co2: Number(x.co2_saved_kg ?? x.co2 ?? x.co2_kg ?? 0) || 0,
    vehicleLabel: formatMatchVehicleLabel(x.vehicle),
  };
}

/**
 * Signed-in shell: Home (impact + schedule) / Find / Activity / Chat / Profile.
 */
function MainApp({ accessToken, accountEmail, displayName, onLogout }) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('home');
  const [profileName, setProfileName] = useState(null);
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
  /** When set, Activity → Upcoming highlights this driver (other_user id string); from Ride requested home widget. */
  const [ridesFocusOtherUserId, setRidesFocusOtherUserId] = useState(null);
  const [findSortMode, setFindSortMode] = useState(FIND_SORT_DEPART);
  const [homeProfileMenuOpen, setHomeProfileMenuOpen] = useState(false);
  /** Increment to tell Profile tab to enter edit mode (from Home menu). */
  const [profileEditSignal, setProfileEditSignal] = useState(0);
  const [homeRides, setHomeRides] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    let live = true;
    if (!accessToken) {
      setLoadingMatches(false);
      setProfileName(null);
      return () => {
        live = false;
      };
    }
    (async () => {
      try {
        const [matchData, ridesData, profileData] = await Promise.all([
          getMatches(accessToken),
          getRides(accessToken).catch(() => ({ rides: [] })),
          getProfile(accessToken).catch(() => null),
        ]);
        if (!live) return;
        const list = matchData.matches ?? [];
        setMatches(Array.isArray(list) ? list.map(normalizeMatch) : []);
        setProfileName(profileNameOverride(profileData));
        const ridesList = ridesData.rides ?? [];
        setHomeRides(Array.isArray(ridesList) ? ridesList : []);
        const pendingRides = ridesList.filter(
          (r) => r.role === 'requester' && r.status === 'pending',
        );
        setPendingDriverIds(pendingRides.map((r) => String(r.other_user.id)));
        setPendingRideByDriverId(
          Object.fromEntries(pendingRides.map((r) => [String(r.other_user.id), r.id])),
        );
      } catch {
        setMatches([]);
        setHomeRides([]);
        setProfileName(null);
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
              ? d.weekly.map((x) => ({
                  d: x.day ?? x.d,
                  v: x.value ?? x.v,
                  label: x.label ?? x.date ?? '',
                  rides: Number(x.rides ?? x.n ?? 0),
                }))
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
  }, [accessToken, ridesRefreshKey, tab]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return matches;
    return matches.filter((m) =>
      [m.name, m.email, m.area].some((v) => String(v || '').toLowerCase().includes(q)),
    );
  }, [matches, search]);

  const sortedShown = useMemo(
    () => sortFindMatches(shown, findSortMode),
    [shown, findSortMode],
  );

  const displayedMatches = useMemo(() => {
    if (!findFocusId) return sortedShown;
    const focus = matches.find((m) => m.id === findFocusId);
    if (!focus || sortedShown.some((m) => m.id === findFocusId)) return sortedShown;
    return [focus, ...sortedShown.filter((m) => m.id !== findFocusId)];
  }, [sortedShown, matches, findFocusId]);

  const topSortedMatchId = sortedShown[0]?.id ?? null;

  useEffect(() => {
    if (tab !== 'matches' || !findFocusId) return;
    const t = setTimeout(() => setFindFocusId(null), 3500);
    return () => clearTimeout(t);
  }, [tab, findFocusId]);

  useEffect(() => {
    if (tab !== 'rides') {
      setRidesFocusOtherUserId(null);
      return;
    }
    if (!ridesFocusOtherUserId) return;
    const t = setTimeout(() => setRidesFocusOtherUserId(null), 5000);
    return () => clearTimeout(t);
  }, [tab, ridesFocusOtherUserId]);

  const top = shown[0] ?? matches[0];
  const commute = pendingDriverIds.length ? matches.find((m) => pendingDriverIds.includes(m.id)) ?? top : top;

  const rideNotifications = useMemo(() => {
    const list = homeRides ?? [];
    const incomingAsDriver = list.filter((r) => r.role === 'driver' && r.status === 'pending');
    const acceptedAsPassenger = list.filter((r) => r.role === 'requester' && r.status === 'accepted');
    return { incomingAsDriver, acceptedAsPassenger };
  }, [homeRides]);

  const notifCount =
    rideNotifications.incomingAsDriver.length + rideNotifications.acceptedAsPassenger.length;

  function formatNotifWhen(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function openNotificationRide(otherUserId) {
    setNotifOpen(false);
    setRidesFocusOtherUserId(String(otherUserId));
    setTab('rides');
  }

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
        setChatThread({ id: String(dm.conversation_id), title: dm.title, is_group: false });
        setChatSub('thread');
        setChatRefreshKey((k) => k + 1);
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

  const name = profileName || displayName || 'there';
  const greet = greetingLine();

  const Home = () => (
    <>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.pad}>
        <View style={s.homeHeaderRow}>
          <View style={s.homeHeaderText}>
            <Text style={s.smallMuted}>{greet}</Text>
            <Text style={s.title}>{name}</Text>
            <Text style={s.sub}>
              {loadingMatches
                ? 'Loading route matches…'
                : matches.length === 0
                  ? 'No route matches yet — open Find when coworkers are onboarded'
                  : `${matches.length} coworker${matches.length === 1 ? '' : 's'} on your route today`}
            </Text>
          </View>
          <View style={s.homeHeaderActions}>
            <AppPressable
              variant="ghost"
              style={s.homeBellBtn}
              onPress={() => setNotifOpen(true)}
              accessibilityLabel={`Notifications${notifCount ? `, ${notifCount} unread` : ''}`}
              accessibilityHint="Ride requests and confirmations"
            >
              <Ionicons name="notifications-outline" size={26} color={C.text} />
              {notifCount > 0 ? (
                <View style={s.homeBellBadge}>
                  <Text style={s.homeBellBadgeTxt}>{notifCount > 9 ? '9+' : String(notifCount)}</Text>
                </View>
              ) : null}
            </AppPressable>
            <AppPressable
              variant="ghost"
              style={s.homeAvatarBtn}
              onPress={() => setHomeProfileMenuOpen(true)}
              accessibilityLabel="Account menu"
            >
              <Avatar initials={userInitials(profileName || displayName, accountEmail)} color={C.brand} size={44} />
            </AppPressable>
          </View>
        </View>
      <AppPressable
        variant="solid"
        style={s.alert}
        onPress={() => {
          if (pendingDriverIds.length > 0) {
            const matchDriver = matches.find((m) => pendingDriverIds.includes(m.id));
            setRidesFocusOtherUserId(String(matchDriver?.id ?? pendingDriverIds[0]));
            setTab('rides');
          } else {
            setTab('matches');
          }
        }}
        android_ripple={{ color: 'rgba(0,0,0,0.14)' }}
        accessibilityRole="button"
        accessibilityHint={pendingDriverIds.length ? 'Opens Activity' : 'Opens Find'}
      >
        <View style={s.alertRow}>
          <View style={s.alertBody}>
            <Text style={s.alertOver}>{pendingDriverIds.length ? 'Ride requested' : 'Your commute'}</Text>
            <Text style={s.alertTitle}>
              {commute
                ? `${pendingDriverIds.length ? 'Waiting on' : 'Best match:'} ${commute.name}`
                : 'No ride lined up yet'}
            </Text>
            <Text style={s.alertSub}>
              {commute
                ? [commute.time, commute.area].filter(Boolean).join(' · ') || 'Carpool match from your profile'
                : 'Open Find to request a ride'}
            </Text>
            {pendingDriverIds.length ? (
              <View style={s.rowWrap}>
                <View style={s.pill}>
                  <Text style={s.pillText}>Pending confirmation</Text>
                </View>
              </View>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={22} color="rgba(2, 27, 20, 0.38)" style={s.alertChevron} />
        </View>
      </AppPressable>
      <Text style={s.section}>Coworkers for your commute</Text>
      {loadingMatches ? (
        <View style={s.skeletonBlock}>
          <Text style={s.skeletonCaption}>Finding matches…</Text>
          {[0, 1, 2].map((k) => (
            <View key={k} style={s.skeletonRow} />
          ))}
        </View>
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
                {[m.time && `${m.time} depart`, m.area].filter(Boolean).join(' · ') || 'Similar route'}
              </Text>
              {m.vehicleLabel ? (
                <Text style={[s.rowSub, s.homeCoworkerVehicle]}>{m.vehicleLabel}</Text>
              ) : null}
            </View>
            <Badge label={i === 0 ? 'Top' : 'View'} tone={i === 0 ? 'brand' : 'gray'} />
          </AppPressable>
        ))
      )}
      <Text style={s.section}>Your Impact</Text>
      {loadingImpact ? (
        <View style={s.stats}>
          {[0, 1, 2].map((k) => (
            <View key={k} style={[s.stat, s.skeletonStat]} />
          ))}
        </View>
      ) : (
        <View style={s.stats}>
          <View style={s.stat}>
            <Text style={[s.statNum, { color: C.brand }]}>{formatCurrency(impact.saved)}</Text>
            <Text style={s.statKey}>Saved</Text>
          </View>
          <View style={s.stat}>
            <Text style={[s.statNum, { color: C.sky }]}>{impact.co2}kg</Text>
            <Text style={s.statKey}>CO2 Saved</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statNum}>{impact.rides}</Text>
            <Text style={s.statKey}>Rides</Text>
          </View>
        </View>
      )}
      <Text style={s.section}>This week</Text>
      <View style={s.card}>
        {loadingImpact && impact.weekly.length === 0 ? (
          <ActivityIndicator color={C.brand} style={{ paddingVertical: 16 }} />
        ) : impact.weekly.length > 0 ? (
          <>
            {impact.weekly.map((row, idx) => (
              <View
                key={`${row.label}-${idx}`}
                style={[
                  s.weekRow,
                  idx === impact.weekly.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={{ width: 52 }}>
                  <Text style={s.weekDay}>{row.d}</Text>
                  {row.label ? <Text style={s.weekDate}>{row.label}</Text> : null}
                </View>
                <Text style={s.weekText}>
                  {row.rides > 0
                    ? `${row.rides} ride${row.rides === 1 ? '' : 's'} · ${formatCurrency(row.v)} saved`
                    : 'No shared rides'}
                </Text>
              </View>
            ))}
            <AppPressable
              variant="ghost"
              style={[s.ghostBtn, { alignSelf: 'flex-start', marginTop: 8 }]}
              onPress={() => setTab('matches')}
            >
              <Text style={s.ghostText}>Open Find</Text>
            </AppPressable>
          </>
        ) : (
          <>
            <Text style={s.rowSub}>
              Complete a carpool from Activity to see savings by day, or use Find to plan rides.
            </Text>
            <AppPressable
              variant="ghost"
              style={[s.ghostBtn, { alignSelf: 'flex-start', marginTop: 12 }]}
              onPress={() => setTab('matches')}
            >
              <Text style={s.ghostText}>Open Find</Text>
            </AppPressable>
          </>
        )}
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
      <Modal
        visible={notifOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setNotifOpen(false)}
      >
        <View style={s.notifModalRoot}>
          <Pressable style={s.notifBackdrop} onPress={() => setNotifOpen(false)} />
          <View style={[s.notifSheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            <View style={s.notifHandle} />
            <Text style={s.notifSheetTitle}>Notifications</Text>
            <Text style={s.notifSheetSub}>Ride requests and confirmations</Text>
            <ScrollView
              style={s.notifScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {notifCount === 0 ? (
                <Text style={s.notifEmpty}>You&apos;re all caught up.</Text>
              ) : null}
              {rideNotifications.incomingAsDriver.length > 0 ? (
                <>
                  <Text style={s.notifSection}>Needs your response</Text>
                  {rideNotifications.incomingAsDriver.map((ride) => {
                    const o = ride.other_user;
                    return (
                      <AppPressable
                        key={`nd-${ride.id}`}
                        variant="default"
                        style={s.notifRow}
                        onPress={() => openNotificationRide(o.id)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={s.notifRowTitle}>{o.name} asked to ride with you</Text>
                          <Text style={s.notifRowSub}>{formatNotifWhen(ride.created_at)}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={C.faint} />
                      </AppPressable>
                    );
                  })}
                </>
              ) : null}
              {rideNotifications.acceptedAsPassenger.length > 0 ? (
                <>
                  <Text style={[s.notifSection, rideNotifications.incomingAsDriver.length > 0 && s.notifSectionSpaced]}>
                    Confirmed for you
                  </Text>
                  {rideNotifications.acceptedAsPassenger.map((ride) => {
                    const o = ride.other_user;
                    return (
                      <AppPressable
                        key={`na-${ride.id}`}
                        variant="default"
                        style={s.notifRow}
                        onPress={() => openNotificationRide(o.id)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={s.notifRowTitle}>{o.name} accepted your ride request</Text>
                          <Text style={s.notifRowSub}>{formatNotifWhen(ride.created_at)}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={C.faint} />
                      </AppPressable>
                    );
                  })}
                </>
              ) : null}
            </ScrollView>
            <AppPressable variant="link" style={s.notifCloseBtn} onPress={() => setNotifOpen(false)}>
              <Text style={s.sub}>Close</Text>
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
        {tab === 'goals' && <GoalsScreen accessToken={accessToken} bottomPadding={tabBarHeight} />}
        {tab === 'matches' && (
          <FindMatchesList
            displayedMatches={displayedMatches}
            topSortedMatchId={topSortedMatchId}
            loadingMatches={loadingMatches}
            findFocusId={findFocusId}
            search={search}
            setSearch={setSearch}
            findSortMode={findSortMode}
            setFindSortMode={setFindSortMode}
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
            focusOtherUserId={ridesFocusOtherUserId}
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
            onConversationsChanged={() => setChatRefreshKey((k) => k + 1)}
            onOpenThread={(c) => {
              setChatThread({ id: c.id, title: c.title, is_group: !!c.is_group });
              setChatSub('thread');
            }}
          />
        )}
        {tab === 'chat' && chatSub === 'thread' && chatThread != null && (
          <ChatThread
            accessToken={accessToken}
            conversationId={chatThread.id}
            threadTitle={chatThread.title}
            isGroup={!!chatThread.is_group}
            bottomPadding={tabBarHeight}
            onBack={() => {
              setChatSub('list');
              setChatThread(null);
              setChatRefreshKey((k) => k + 1);
            }}
            onConversationRenamed={(updated) => {
              setChatThread((current) =>
                current && current.id === updated.id ? { ...current, title: updated.title } : current,
              );
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
              onSaveSuccess={(nextProfileName) => {
                setProfileName(nextProfileName || null);
                setTab('home');
              }}
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
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={l}
                onPress={() => {
                  if (k === 'chat') {
                    setChatSub('list');
                    setChatThread(null);
                    setChatRefreshKey((n) => n + 1);
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
                    ...(sheet.vehicleLabel ? [['Their vehicle', sheet.vehicleLabel]] : []),
                    ...(sheet.totalDriveMiles > 0
                      ? [['Total drive (w/ pickup)', `~${Number(sheet.totalDriveMiles).toFixed(1)} mi`]]
                      : []),
                  ].map(([rowLabel, v], idx, rows) => (
                    <View
                      key={String(rowLabel)}
                      style={[s.sheetRow, idx === rows.length - 1 && { borderBottomWidth: 0 }]}
                    >
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
  pad: { paddingBottom: 120 },
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
  homeHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  homeBellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeBellBadge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: C.sky,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeBellBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  homeAvatarBtn: { borderRadius: 999, overflow: 'hidden' },
  notifModalRoot: { flex: 1, justifyContent: 'flex-end' },
  notifBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  notifSheet: {
    backgroundColor: C.panel,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: C.line,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '78%',
  },
  notifHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.line,
    marginBottom: 14,
  },
  notifSheetTitle: { color: C.text, fontSize: 20, fontWeight: '800' },
  notifSheetSub: { color: C.muted, fontSize: 13, marginTop: 4, marginBottom: 12 },
  notifScroll: { maxHeight: 420 },
  notifEmpty: { color: C.muted, fontSize: 15, paddingVertical: 20, textAlign: 'center' },
  notifSection: {
    color: C.faint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
  },
  notifSectionSpaced: { marginTop: 20 },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  notifRowTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
  notifRowSub: { color: C.muted, fontSize: 13, marginTop: 4 },
  notifCloseBtn: { alignItems: 'center', paddingVertical: 16 },
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
    fontSize: T.caption,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 26,
    marginBottom: 12,
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
  alertRow: { flexDirection: 'row', alignItems: 'center' },
  alertBody: { flex: 1, minWidth: 0, paddingRight: 4 },
  alertChevron: { marginLeft: 4 },
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
  homeCoworkerVehicle: { marginTop: 4, fontSize: 12, color: C.faint, letterSpacing: 0.2 },
  findVehicleMeta: { marginTop: 4, fontSize: 12, color: C.faint, letterSpacing: 0.2 },
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
  weekDay: { color: C.faint, fontSize: 11, fontWeight: '800' },
  weekDate: { color: C.muted, fontSize: 10, fontWeight: '600', marginTop: 2 },
  weekText: { flex: 1, color: C.text, fontSize: 13 },
  ghostBtn: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
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
    marginBottom: 10,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchLbl: { color: C.faint, fontSize: 12, fontWeight: '700' },
  input: { flex: 1, color: C.text, fontSize: 14, paddingVertical: 0 },
  /** Find: sort card (aligned with search field) */
  findSortCard: {
    marginHorizontal: 16,
    marginBottom: 18,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 12,
  },
  findSortLabel: {
    color: C.faint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  findSortChips: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: 8,
    paddingRight: 4,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 99,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  chipOn: { backgroundColor: C.brandSoft, borderColor: C.brand },
  chipText: { color: C.muted, fontSize: 12, fontWeight: '700' },
  center: { paddingVertical: 40, alignItems: 'center' },
  loader: { paddingVertical: 24 },
  skeletonBlock: {
    marginTop: 4,
    paddingBottom: 8,
  },
  skeletonCaption: {
    color: C.faint,
    fontSize: T.bodyMd,
    fontWeight: '600',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  skeletonRow: {
    height: 72,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: C.line,
  },
  skeletonStat: {
    minHeight: 88,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  findSkeletonWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  findSkeletonCaption: {
    color: C.muted,
    fontSize: T.bodyMd,
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 20,
  },
  skeletonMatchCard: {
    height: 260,
    marginBottom: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: C.line,
  },
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
  metrics: { marginTop: 12, gap: 8 },
  metricsRow: { flexDirection: 'row', gap: 8 },
  metric: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 11,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  metricNum: { color: C.text, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  metricKey: {
    color: C.faint,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 4,
    textAlign: 'center',
  },
  metricNumEmphasis: { fontSize: 18, letterSpacing: -0.3 },
  metricKeyEmphasis: { fontSize: 10, marginTop: 6 },
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
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    shadowColor: C.brand,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 5,
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
  tab: {
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 8,
    minWidth: 56,
    minHeight: 48,
    justifyContent: 'center',
  },
  tabOn: { backgroundColor: C.brandSoft },
  tabInner: { alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 40 },
  tabText: { color: C.faint, fontSize: T.caption, fontWeight: '700' },
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
const FIND_MATCH_ROW_ESTIMATE = 400;
/** Extra pixels to subtract from target offset so the focused card sits higher (scroll feels less “deep”). */
const FIND_FOCUS_SCROLL_BACK_PX = 128;

/** Stable screen (not defined inside MainApp) so React does not remount Find on every parent render. */
function FindMatchesList({
  displayedMatches,
  topSortedMatchId,
  loadingMatches,
  findFocusId,
  search,
  setSearch,
  findSortMode,
  setFindSortMode,
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
            <Text style={s.sub}>Two Sigma · matched for your commute</Text>
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
        <View style={s.findSortCard}>
          <Text style={s.findSortLabel}>Sort by</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.findSortChips}
          >
            {FIND_SORT_OPTIONS.map((opt) => {
              const on = findSortMode === opt.id;
              return (
                <AppPressable
                  key={opt.id}
                  variant="chip"
                  style={[s.chip, on && s.chipOn]}
                  onPress={() => setFindSortMode(opt.id)}
                >
                  <Text style={[s.chipText, on && { color: C.brand }]}>{opt.label}</Text>
                </AppPressable>
              );
            })}
          </ScrollView>
        </View>
        {loadingMatches ? (
          <View style={s.findSkeletonWrap}>
            <Text style={s.findSkeletonCaption}>Finding your best commute matches…</Text>
            {[0, 1].map((k) => (
              <View key={k} style={s.skeletonMatchCard} />
            ))}
          </View>
        ) : displayedMatches.length === 0 ? (
          <View style={s.card}>
            <Text style={s.rowTitle}>No matches for your search</Text>
            <Text style={s.rowSub}>Try another name, area, or sort option.</Text>
          </View>
        ) : null}
      </View>
    ),
    [loadingMatches, displayedMatches.length, search, findSortMode, setFindSortMode, setSearch],
  );

  const renderItem = useCallback(
    ({ item: m }) => {
      const done = pendingDriverIds.includes(m.id);
      const cancelBusy = cancellingDriverId === m.id;
      const focused = findFocusId === m.id;
      const isTopMatch = m.id === topSortedMatchId;
      return (
        <View style={[s.match, isTopMatch && !focused && { borderColor: C.brand }, focused && s.matchFocused]}>
          <View style={s.between}>
            <Badge label={isTopMatch ? 'Top Match' : 'Commute match'} tone={isTopMatch ? 'brand' : 'gray'} />
            {done ? <Badge label="Pending" tone="sky" /> : <Badge label={`${m.seats ?? 2} seats`} />}
          </View>
          <View style={[s.row, { marginHorizontal: 0, paddingHorizontal: 0 }]}>
            <Avatar initials={m.initials} color={m.color} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={s.matchName}>{m.name}</Text>
              <Text style={s.rowSub}>
                {[m.role, m.team].filter(Boolean).join(' · ') || 'Route match'}
              </Text>
              {m.vehicleLabel ? (
                <Text style={[s.rowSub, s.findVehicleMeta]}>{m.vehicleLabel}</Text>
              ) : null}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.score}>{m.score}%</Text>
              <Text style={s.scoreLbl}>match</Text>
            </View>
          </View>
          <View style={s.metrics}>
            <View style={s.metricsRow}>
              <View style={s.metric}>
                <Text style={s.metricNum}>{m.time || '—'}</Text>
                <Text style={s.metricKey}>Departs</Text>
              </View>
              <View style={s.metric}>
                <Text style={s.metricNum}>{m.eta != null && m.eta > 0 ? `${m.eta} min` : '—'}</Text>
                <Text style={s.metricKey}>Est. ride</Text>
              </View>
              <View style={s.metric}>
                <Text style={[s.metricNum, { color: C.text }]}>
                  {m.totalDriveMiles > 0 ? `${m.totalDriveMiles.toFixed(1)} mi` : '—'}
                </Text>
                <Text style={s.metricKey}>Trip w/ stop</Text>
              </View>
            </View>
            <View style={s.metricsRow}>
            <View style={[s.metric, { paddingVertical: 12 }]}>
              <Text style={[s.metricNum, s.metricNumEmphasis, { color: C.brand }]}>
                  {formatCurrency(m.cost)}
              </Text>
              <Text style={[s.metricKey, s.metricKeyEmphasis]}>Your share</Text>
            </View>
              <View style={[s.metric, { paddingVertical: 12 }]}>
                <Text style={[s.metricNum, s.metricNumEmphasis, { color: C.sky }]}>
                  {Number(m.co2 ?? 0).toFixed(1)}kg
                </Text>
                <Text style={[s.metricKey, s.metricKeyEmphasis]}>CO₂ saved</Text>
              </View>
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
      topSortedMatchId,
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
      extraData={`${findSortMode}-${findFocusId}-${pendingDriverIds.join(',')}-${cancellingDriverId ?? ''}`}
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
