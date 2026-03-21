import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import ProfileSettingsScreen from './ProfileSettingsScreen';

const bg = '#0B0B0C';
const surface = '#1C1C1E';
const surface2 = '#2C2C2E';
const muted = '#8E8E93';
const label = '#636366';
const teal = '#2DD4BF';
const tealDark = '#0D9488';
const green = '#34D399';
const blue = '#60A5FA';
const orange = '#FB923C';
const purple = '#A855F7';

const TABS = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'find', label: 'Find', icon: 'search', badge: 3 },
  { key: 'rides', label: 'Rides', icon: 'calendar-outline' },
  { key: 'chat', label: 'Chat', icon: 'chatbubble-outline', badge: 2 },
  { key: 'impact', label: 'Impact', icon: 'wallet-outline' },
  { key: 'profile', label: 'Profile', icon: 'person-outline' },
];

function greetingLine() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen({
  userName = 'Jamie Santos',
  accountEmail = null,
  accessToken,
  onLogout,
}) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('home');

  const greeting = greetingLine();

  if (tab === 'profile') {
    return (
      <View style={styles.root}>
        <ProfileSettingsScreen
          accessToken={accessToken}
          accountEmail={accountEmail}
          onLogout={onLogout}
          scrollBottomPadding={100 + insets.bottom}
        />
        <BottomBar tab={tab} onChange={setTab} bottomInset={insets.bottom} />
      </View>
    );
  }

  if (tab !== 'home') {
    return (
      <View style={styles.root}>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderTitle}>
            {TABS.find((t) => t.key === tab)?.label ?? 'Coming soon'}
          </Text>
          <Text style={styles.placeholderBody}>This section is not built yet.</Text>
        </View>
        <BottomBar tab={tab} onChange={setTab} bottomInset={insets.bottom} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>
              {greeting} <Text style={styles.wave}>👋</Text>
            </Text>
            <Text style={styles.userName}>{userName}</Text>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>3 coworkers driving your route today.</Text>
            </View>
          </View>
        </View>

        <View style={styles.featured}>
          <Text style={styles.featuredEyebrow}>TOMORROW MORNING</Text>
          <View style={styles.featuredRow}>
            <View style={styles.featuredLeft}>
              <Text style={styles.featuredTitle}>Riding with Alex Chen</Text>
              <Text style={styles.featuredMeta}>8:30 AM • Pickup on Oak St • 4 riders</Text>
              <View style={styles.pillRow}>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>✓ Confirmed</Text>
                </View>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>$3.40 your share</Text>
                </View>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>~26 min</Text>
                </View>
              </View>
            </View>
            <Text style={styles.carGlyph} accessibilityLabel="">
              🚗
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: green }]}>$142</Text>
            <Text style={styles.statLabel}>SAVED</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: blue }]}>47kg</Text>
            <Text style={styles.statLabel}>CO₂ LESS</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#F5F5F7' }]}>23</Text>
            <Text style={styles.statLabel}>RIDES</Text>
          </View>
        </View>

        <Text style={styles.sectionEyebrow}>COWORKERS DRIVING TODAY</Text>
        <View style={styles.listCard}>
          <DriverRow
            initials="AC"
            color={tealDark}
            name="Alex Chen"
            detail="8:30 AM • 2 seats • Oak St • +4 min detour"
            action={{ type: 'join' }}
          />
          <View style={styles.divider} />
          <DriverRow
            initials="MP"
            color={orange}
            name="Maya Patel"
            detail="9:00 AM • 1 seat • Maple Ave • +7 min"
            action={{ type: 'badge', text: '1 left' }}
          />
          <View style={styles.divider} />
          <DriverRow
            initials="DK"
            color={purple}
            name="Dan Kim"
            detail="8:15 AM • 3 seats • Elm Blvd • +2 min"
            action={{ type: 'join' }}
          />
        </View>

        <Text style={[styles.sectionEyebrow, { marginTop: 22 }]}>THIS WEEK</Text>
        <View style={styles.weekCard}>
          <WeekRow day="MON" main="Solo drive" tag={{ text: 'Solo', muted: true }} />
          <View style={styles.weekDivider} />
          <WeekRow day="TUE" main="Alex • 8:30 AM" icon="checkmark-circle" iconColor={green} />
          <View style={styles.weekDivider} />
          <WeekRow day="WED" main="WFH" tag={{ text: 'Remote', muted: true }} />
          <View style={styles.weekDivider} />
          <WeekRow
            day="THU"
            main="You're driving • 2 riders"
            tag={{ text: 'Driver', orange: true }}
          />
          <View style={styles.weekDivider} />
          <WeekRow day="FRI" main="No match yet" action={{ text: 'Find' }} />
        </View>
      </ScrollView>

      <BottomBar tab={tab} onChange={setTab} bottomInset={insets.bottom} />
    </View>
  );
}

function DriverRow({ initials: ini, color, name, detail, action }) {
  return (
    <View style={styles.driverRow}>
      <View style={[styles.avatar, { backgroundColor: color }]}>
        <Text style={styles.avatarText}>{ini}</Text>
      </View>
      <View style={styles.driverMid}>
        <Text style={styles.driverName}>{name}</Text>
        <Text style={styles.driverDetail}>{detail}</Text>
      </View>
      {action.type === 'join' ? (
        <Pressable style={({ pressed }) => [styles.joinBtn, pressed && styles.pressed]}>
          <Text style={styles.joinText}>Join</Text>
        </Pressable>
      ) : (
        <View style={styles.leftBadge}>
          <Text style={styles.leftBadgeText}>{action.text}</Text>
        </View>
      )}
    </View>
  );
}

function WeekRow({ day, main, tag, icon, iconColor, action }) {
  return (
    <View style={styles.weekRow}>
      <Text style={styles.weekDay}>{day}</Text>
      <View style={styles.weekMain}>
        {icon ? (
          <View style={styles.weekMainRow}>
            <Ionicons name={icon} size={18} color={iconColor} style={{ marginRight: 6 }} />
            <Text style={styles.weekMainText}>{main}</Text>
          </View>
        ) : (
          <Text style={styles.weekMainText}>{main}</Text>
        )}
      </View>
      {tag ? (
        <View style={[styles.weekTag, tag.orange && styles.weekTagOrange, tag.muted && styles.weekTagMuted]}>
          <Text style={[styles.weekTagText, tag.orange && styles.weekTagTextOrange]}>{tag.text}</Text>
        </View>
      ) : action ? (
        <Pressable style={({ pressed }) => [styles.findBtn, pressed && styles.pressed]}>
          <Text style={styles.findBtnText}>{action.text}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function BottomBar({ tab, onChange, bottomInset }) {
  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(bottomInset, 8) }]}>
      {TABS.map((t) => {
        const active = tab === t.key;
        return (
          <Pressable
            key={t.key}
            style={styles.tabItem}
            onPress={() => onChange(t.key)}
          >
            <View style={styles.tabIconWrap}>
              <Ionicons
                name={t.icon}
                size={22}
                color={active ? teal : muted}
              />
              {t.badge ? (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{t.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerRow: {
    marginBottom: 20,
  },
  greeting: {
    fontSize: 15,
    color: muted,
    marginBottom: 4,
  },
  wave: {
    fontSize: 15,
  },
  userName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F5F5F7',
    letterSpacing: -0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: green,
  },
  statusText: {
    fontSize: 13,
    color: label,
    flex: 1,
  },
  headerText: {},
  featured: {
    backgroundColor: teal,
    borderRadius: 20,
    padding: 20,
    marginBottom: 18,
    overflow: 'hidden',
  },
  featuredEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: 'rgba(15, 23, 42, 0.65)',
    marginBottom: 10,
  },
  featuredRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  featuredLeft: {
    flex: 1,
    paddingRight: 8,
  },
  featuredTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  featuredMeta: {
    fontSize: 14,
    color: 'rgba(15, 23, 42, 0.75)',
    marginBottom: 14,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    backgroundColor: 'rgba(15, 23, 42, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  carGlyph: {
    fontSize: 44,
    opacity: 0.85,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 22,
  },
  statCard: {
    flex: 1,
    backgroundColor: surface,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: label,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: label,
    marginBottom: 10,
  },
  listCard: {
    backgroundColor: surface,
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 14,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  driverMid: {
    flex: 1,
    marginLeft: 12,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F5F5F7',
    marginBottom: 4,
  },
  driverDetail: {
    fontSize: 13,
    color: muted,
  },
  joinBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  joinText: {
    color: green,
    fontSize: 15,
    fontWeight: '600',
  },
  leftBadge: {
    backgroundColor: 'rgba(96, 165, 250, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  leftBadgeText: {
    color: blue,
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: surface2,
    marginLeft: 56,
  },
  weekCard: {
    backgroundColor: surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 8,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    minHeight: 48,
  },
  weekDay: {
    width: 40,
    fontSize: 12,
    fontWeight: '700',
    color: label,
  },
  weekMain: {
    flex: 1,
  },
  weekMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekMainText: {
    fontSize: 15,
    color: '#E5E5EA',
  },
  weekTag: {
    backgroundColor: surface2,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  weekTagMuted: {},
  weekTagOrange: {
    backgroundColor: 'rgba(251, 146, 60, 0.25)',
  },
  weekTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: muted,
  },
  weekTagTextOrange: {
    color: orange,
  },
  findBtn: {
    borderWidth: 1,
    borderColor: '#F5F5F7',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  findBtnText: {
    color: '#F5F5F7',
    fontSize: 13,
    fontWeight: '600',
  },
  weekDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: surface2,
  },
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: '#161618',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2C2C2E',
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  tabIconWrap: {
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    right: -10,
    top: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: green,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notifBadgeText: {
    color: '#0B0B0C',
    fontSize: 10,
    fontWeight: '700',
  },
  tabLabel: {
    fontSize: 10,
    color: muted,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: teal,
    fontWeight: '600',
  },
  placeholder: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F5F5F7',
    marginBottom: 8,
  },
  placeholderBody: {
    fontSize: 15,
    color: muted,
    textAlign: 'center',
    marginBottom: 24,
  },
  signOutBtn: {
    borderWidth: 1,
    borderColor: tealDark,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  signOutLabel: {
    color: teal,
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});
