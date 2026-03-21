import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import AppPressable from '../components/AppPressable';
import { API_BASE_URL } from '../src/config';
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

const MATCHES = [
  { id: 'alex', name: 'Alex Chen', role: 'Software Engineer', team: 'Engineering', initials: 'AC', score: 94, overlap: 94, detour: 4, cost: 3.4, co2: 5.8, time: '8:30 AM', area: 'Oak St area', eta: 26, seats: 2, color: C.brand },
  { id: 'maya', name: 'Maya Patel', role: 'Product Designer', team: 'Product', initials: 'MP', score: 78, overlap: 78, detour: 7, cost: 2.8, co2: 4.1, time: '9:00 AM', area: 'Maple Ave', eta: 31, seats: 1, color: C.amber },
  { id: 'dan', name: 'Dan Kim', role: 'Data Analyst', team: 'Finance', initials: 'DK', score: 71, overlap: 71, detour: 2, cost: 2.2, co2: 3.6, time: '8:15 AM', area: 'Elm Blvd', eta: 29, seats: 3, color: C.sky },
];
const IMPACT = { saved: 142, co2: 47, rides: 23, weekly: [{ d: 'Mon', v: 9 }, { d: 'Tue', v: 14 }, { d: 'Wed', v: 0 }, { d: 'Thu', v: 11 }, { d: 'Fri', v: 7 }, { d: 'Sat', v: 3 }, { d: 'Sun', v: 0 }] };
const FILTERS = ['Morning', 'Has car', '<=10 min detour', '2+ seats'];

const TAB_BAR_ITEMS = [
  { key: 'home', label: 'Home', iconOn: 'home', iconOff: 'home-outline' },
  { key: 'matches', label: 'Find', iconOn: 'search', iconOff: 'search-outline' },
  { key: 'rides', label: 'Activity', iconOn: 'calendar', iconOff: 'calendar-outline' },
  { key: 'chat', label: 'Chat', iconOn: 'chatbubbles', iconOff: 'chatbubbles-outline' },
  { key: 'profile', label: 'Profile', iconOn: 'person', iconOff: 'person-outline' },
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

function normalizeMatch(x, i) {
  const base = MATCHES[i % MATCHES.length];
  const score = x.score ?? x.match_score ?? 0.8;
  const overlap = x.route_overlap ?? x.overlap ?? score;
  return {
    id: String(x.id ?? base.id),
    name: x.name ?? x.full_name ?? base.name,
    role: x.role ?? base.role,
    team: x.team ?? x.department ?? base.team,
    initials:
      x.initials ??
      (x.name ?? x.full_name ?? base.name)
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase(),
    score: Math.round(score <= 1 ? score * 100 : score),
    overlap: Math.round(overlap <= 1 ? overlap * 100 : overlap),
    detour: Math.round(x.detour_minutes ?? x.detour ?? base.detour),
    cost: Number(x.cost_share ?? x.cost ?? base.cost),
    co2: Number(x.co2_saved_kg ?? x.co2 ?? base.co2),
    time: x.depart_time ?? x.departure_time ?? base.time,
    area: x.pickup_area ?? x.neighborhood ?? base.area,
    eta: Math.round(x.eta_minutes ?? x.eta ?? base.eta),
    seats: Math.round(x.seats_available ?? x.seats ?? base.seats),
    color: base.color,
  };
}

/**
 * Signed-in shell: Home (impact + schedule) / Find / Rides / Chat / Profile.
 */
function MainApp({ accessToken, accountEmail, displayName, onLogout }) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('home');
  const [matches, setMatches] = useState(MATCHES);
  const [impact, setImpact] = useState(IMPACT);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [loadingImpact, setLoadingImpact] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(['Morning']);
  const [sheet, setSheet] = useState(null);
  const [requested, setRequested] = useState([]);
  /** chat: inbox vs thread (demo) */
  const [chatSub, setChatSub] = useState('list');
  const [chatConvId, setChatConvId] = useState('morning');
  /** When set, Find tab scrolls to this match and highlights it (e.g. from Home). */
  const [findFocusId, setFindFocusId] = useState(null);

  const apiBase = API_BASE_URL;

  useEffect(() => {
    let live = true;
    fetch(`${apiBase}/matches`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        const list = Array.isArray(d) ? d : d.matches;
        if (live && Array.isArray(list) && list.length) setMatches(list.map(normalizeMatch));
      })
      .catch(() => null)
      .finally(() => live && setLoadingMatches(false));
    fetch(`${apiBase}/impact`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (live)
          setImpact({
            saved: Number(d.total_saved ?? d.saved ?? IMPACT.saved),
            co2: Number(d.total_co2_kg ?? d.co2_saved ?? IMPACT.co2),
            rides: Number(d.rides_shared ?? d.total_rides ?? IMPACT.rides),
            weekly:
              Array.isArray(d.weekly) && d.weekly.length
                ? d.weekly.map((x) => ({ d: x.day ?? x.d, v: x.value ?? x.v }))
                : IMPACT.weekly,
          });
      })
      .catch(() => null)
      .finally(() => live && setLoadingImpact(false));
    return () => {
      live = false;
    };
  }, [apiBase]);

  const shown = useMemo(
    () =>
      matches.filter((m) => {
        const q = search.trim().toLowerCase();
        const passQ = !q || [m.name, m.team, m.area].some((v) => v.toLowerCase().includes(q));
        const passF = filters.every((f) =>
          f === 'Morning'
            ? /AM/i.test(m.time)
            : f === '<=10 min detour'
              ? m.detour <= 10
              : f === '2+ seats'
                ? m.seats >= 2
                : true,
        );
        return passQ && passF;
      }),
    [matches, search, filters],
  );

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
  const commute = requested.length ? matches.find((m) => m.id === requested[0]) ?? top : top;
  const week = [
    ['MON', 'Solo drive', 'Solo'],
    ['TUE', 'Alex - 8:30 AM', 'Confirmed'],
    ['WED', 'WFH', 'Remote'],
    ['THU', "You're driving - 2 riders", 'Driver'],
    ['FRI', 'No match yet', 'Find'],
  ];

  const toggleFilter = useCallback(
    (f) => setFilters((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f])),
    [],
  );
  const confirm = () => {
    if (!sheet) return;
    setRequested((cur) => (cur.includes(sheet.id) ? cur : [sheet.id, ...cur]));
    setSheet(null);
    setTab('home');
  };

  const name = displayName || 'there';
  const greet = greetingLine();

  const Home = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.pad}>
      <View style={s.hero}>
        <Text style={s.heroHeadline}>{`${greet},`}</Text>
        <Text style={s.heroHeadline}>{name}</Text>
        <Text style={s.sub}>{matches.slice(0, 3).length} coworkers are driving your route today</Text>
      </View>
      <AppPressable
        variant="solid"
        style={s.alert}
        onPress={() => setTab('matches')}
        android_ripple={{ color: 'rgba(0,0,0,0.14)' }}
      >
        <Text style={s.alertOver}>{requested.length ? 'Ride requested' : "Today's commute"}</Text>
          <Text style={s.alertTitle}>
            {commute ? `${requested.length ? 'Waiting on' : 'Best match:'} ${commute.name}` : 'No ride lined up yet'}
          </Text>
          <Text style={s.alertSub}>
            {commute
              ? `${commute.time} - ${commute.area} - ${commute.seats} seats open`
              : 'Open Find to request tomorrow morning'}
          </Text>
          <View style={s.rowWrap}>
            <View style={s.pill}>
              <Text style={s.pillText}>{requested.length ? 'Pending confirmation' : `${commute?.score ?? 0}% match`}</Text>
            </View>
            <View style={s.pill}>
              <Text style={s.pillText}>${(commute?.cost ?? 0).toFixed(2)} share</Text>
            </View>
            <View style={s.pill}>
              <Text style={s.pillText}>{commute?.eta ?? 0} min est.</Text>
            </View>
          </View>
      </AppPressable>

        <Text style={s.section}>Coworkers Driving Today</Text>
      {loadingMatches ? (
        <ActivityIndicator color={C.brand} style={s.loader} />
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
                {m.time} - {m.seats} seats - {m.area} - +{m.detour} min
              </Text>
            </View>
            <Badge label={i === 1 ? '1 left' : 'Join'} tone={i === 1 ? 'sky' : 'brand'} />
          </AppPressable>
        ))
      )}

      <Text style={s.impactHomeEyebrow}>Your Impact</Text>
      <View style={s.impactHero}>
        {loadingImpact ? (
          <ActivityIndicator color={C.brand} style={{ paddingVertical: 24 }} />
        ) : (
          <>
            <Text style={s.impactHomeLabel}>Total gas money saved</Text>
            <Text style={s.heroNum}>${impact.saved}</Text>
            <View style={s.statsMini}>
              <View style={{ alignItems: 'center' }}>
                <Text style={[s.statNum, { color: C.sky }]}>{impact.co2}kg</Text>
                <Text style={s.statKey}>CO2 avoided</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={s.statNum}>{impact.rides}</Text>
                <Text style={s.statKey}>Rides shared</Text>
              </View>
            </View>
          </>
        )}
      </View>

      <Text style={s.section}>This Week</Text>
      <View style={s.card}>
        {week.map(([d, detail, b]) => (
          <View key={d} style={s.weekRow}>
            <Text style={[s.weekDay, d === 'TUE' && { color: C.brand }]}>{d}</Text>
            <Text style={[s.weekText, (b === 'Solo' || b === 'Remote') && { color: C.muted }]}>{detail}</Text>
            {b === 'Find' ? (
              <AppPressable
                variant="ghost"
                style={s.ghostBtn}
                onPress={() => {
                  setFindFocusId(null);
                  setTab('matches');
                }}
                android_ripple={{ color: 'rgba(255,255,255,0.12)' }}
              >
                <Text style={s.ghostText}>Find</Text>
              </AppPressable>
            ) : (
              <Badge label={b} tone={b === 'Confirmed' ? 'brand' : b === 'Driver' ? 'amber' : 'gray'} />
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );

  /** Tab row (icons + labels) + one safe-area inset — not doubled with screen safe area. */
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
            requested={requested}
            setSheet={setSheet}
            setChatConvId={setChatConvId}
            setChatSub={setChatSub}
            setTab={setTab}
          />
        )}
        {tab === 'rides' && (
          <RidesTab
            bottomPadding={tabBarHeight}
            onPressFind={() => {
              setFindFocusId(null);
              setTab('matches');
            }}
          />
        )}
        {tab === 'chat' && chatSub === 'list' && (
          <ChatList
            bottomPadding={tabBarHeight}
            onOpenThread={(id) => {
              setChatConvId(id);
              setChatSub('thread');
            }}
          />
        )}
        {tab === 'chat' && chatSub === 'thread' && (
          <ChatThread
            conversationId={chatConvId}
            bottomPadding={tabBarHeight}
            onBack={() => setChatSub('list')}
          />
        )}
        {tab === 'profile' && (
          <View style={s.profileWrap}>
            <ProfileSettingsScreen
              accessToken={accessToken}
              accountEmail={accountEmail}
              onLogout={onLogout}
              scrollBottomPadding={tabBarHeight}
            />
          </View>
        )}
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
                  Send a request to {sheet.name} for the {sheet.time} commute from {sheet.area}.
                </Text>
                <View style={s.card}>
                  {[
                    ['Match score', `${sheet.score}%`],
                    ['Detour', `+${sheet.detour} min`],
                    ['Estimated share', `$${sheet.cost.toFixed(2)}`],
                    ['CO2 saved', `${sheet.co2.toFixed(1)}kg`],
                  ].map(([rowLabel, v], idx) => (
                    <View key={String(rowLabel)} style={[s.sheetRow, idx === 3 && { borderBottomWidth: 0 }]}>
                      <Text style={s.rowSub}>{rowLabel}</Text>
                      <Text style={s.sheetVal}>{v}</Text>
                    </View>
                  ))}
                </View>
                <AppPressable variant="primary" style={s.sheetConfirmBtn} onPress={confirm}>
                  <Text style={s.sheetConfirmText}>Confirm</Text>
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
  profileWrap: { flex: 1 },
  pad: { paddingBottom: 112 },
  hero: { padding: 20, backgroundColor: C.card },
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
    paddingVertical: 14,
  },
  primaryText: { color: '#021b14', fontSize: 14, fontWeight: '800' },
  /** Modal confirm: do not use flex:1 from primary — it stretches the hit area and can hide label */
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
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  impactHomeEyebrow: {
    color: C.faint,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 8,
  },
  impactHomeLabel: {
    color: C.muted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 0,
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
  requested,
  setSheet,
  setChatConvId,
  setChatSub,
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
            <Text style={s.sub}>Matched for tomorrow morning</Text>
          </View>
          <AppPressable variant="ghost" style={s.ghostBtn}>
            <Text style={s.ghostText}>Filter</Text>
          </AppPressable>
        </View>
        <View style={s.search}>
          <Text style={s.searchLbl}>Search</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Coworkers, teams, neighborhoods"
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
      const done = requested.includes(m.id);
      const focused = findFocusId === m.id;
      const isTopMatch = m.id === shown[0]?.id;
      return (
        <View style={[s.match, isTopMatch && !focused && { borderColor: C.brand }, focused && s.matchFocused]}>
          <View style={s.between}>
            <Badge label={isTopMatch ? 'Top Match' : 'Driving tomorrow'} tone={isTopMatch ? 'brand' : 'gray'} />
            {done ? <Badge label="Requested" tone="sky" /> : <Badge label={`${m.seats} seats`} />}
          </View>
          <View style={[s.row, { marginHorizontal: 0, paddingHorizontal: 0 }]}>
            <Avatar initials={m.initials} color={m.color} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={s.matchName}>{m.name}</Text>
              <Text style={s.rowSub}>
                {m.role} - {m.team}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.score}>{m.score}%</Text>
              <Text style={s.scoreLbl}>match</Text>
            </View>
          </View>
          <Text style={s.rowSub}>
            {m.time} from {m.area} - {m.eta} min est.
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
              <Text style={[s.metricNum, { color: i === 1 ? C.amber : C.brand }]}>+{m.detour} min</Text>
              <Text style={s.metricKey}>Detour</Text>
            </View>
            <View style={s.metric}>
              <Text style={s.metricNum}>{m.time}</Text>
              <Text style={s.metricKey}>Departs</Text>
            </View>
            <View style={s.metric}>
              <Text style={[s.metricNum, { color: C.brand }]}>${m.cost.toFixed(2)}</Text>
              <Text style={s.metricKey}>Your share</Text>
            </View>
            <View style={s.metric}>
              <Text style={[s.metricNum, { color: C.sky }]}>{m.co2.toFixed(1)}kg</Text>
              <Text style={s.metricKey}>CO2 saved</Text>
            </View>
          </View>
          <View style={s.actions}>
            <AppPressable
              variant="primary"
              disabled={done}
              style={[s.primary, done && { opacity: 0.55 }]}
              onPress={() => setSheet(m)}
            >
              <Text style={s.primaryText}>{done ? 'Ride Requested' : 'Request Ride'}</Text>
            </AppPressable>
            <AppPressable
              variant="ghost"
              style={s.ghostBtnWide}
              onPress={() => {
                setChatConvId('morning');
                setChatSub('thread');
                setTab('chat');
              }}
            >
              <Text style={s.ghostText}>Chat</Text>
            </AppPressable>
          </View>
        </View>
      );
    },
    [findFocusId, shown, requested, setSheet, setChatConvId, setChatSub, setTab],
  );

  return (
    <FlatList
      ref={listRef}
      style={{ flex: 1 }}
      data={listData}
      keyExtractor={(item) => item.id}
      extraData={`${findFocusId}-${requested.join(',')}`}
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
