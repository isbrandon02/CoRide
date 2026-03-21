import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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

const UPCOMING = [
  {
    id: 'up-1',
    time: '8:30 AM',
    dateLabel: 'Tomorrow · Tue Jan 15',
    status: 'Confirmed',
    tone: 'brand',
    driver: { name: 'Alex Chen', initials: 'AC', color: C.brand, vehicle: '2019 Honda Accord · White · XYZ 4892' },
    riderSummary: '3 riders · 1 open seat',
    pickup: 'Oak St pickup',
  },
  {
    id: 'up-2',
    time: '8:15 AM',
    dateLabel: "Thu Jan 17 · You're driving",
    status: 'Driving',
    tone: 'amber',
    driver: { name: 'You', initials: 'You', color: '#555', vehicle: 'Your car · 2 riders joining' },
    riderSummary: '+ 2 open spots',
    estEarn: 6.8,
  },
];

const HISTORY = [
  { id: 'h1', title: 'Rode with Alex', sub: 'Mon Jan 13 · $3.20', initials: 'AC', color: C.brand, badge: 'Done', tone: 'brand' },
  { id: 'h2', title: 'You drove · 2 riders', sub: 'Fri Jan 10 · +$6.40 earned', initials: 'Y', color: '#555', badge: 'Drove', tone: 'amber' },
  { id: 'h3', title: 'Rode with Maya', sub: 'Thu Jan 9 · $2.80', initials: 'MP', color: C.amber, badge: 'Done', tone: 'brand' },
];

const DRIVING = [
  {
    id: 'd1',
    dateLabel: 'Thu Jan 17',
    status: 'Open',
    line: '8:15 AM · 2 confirmed · 2 spots left · Est. earn $6.80',
    pips: [
      { initials: 'DK', color: C.sky },
      { initials: 'SL', color: '#34d399' },
    ],
  },
];

function Badge({ label, tone }) {
  const bg = tone === 'amber' ? 'rgba(245,166,35,0.12)' : C.brandSoft;
  const fg = tone === 'amber' ? C.amber : C.brand;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeTxt, { color: fg }]}>{label}</Text>
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

const SUBS = [
  { key: 'up', label: 'Upcoming' },
  { key: 'past', label: 'History' },
  { key: 'drv', label: 'Driving' },
];

export default function RidesTab({ bottomPadding, onPressFind }) {
  const [sub, setSub] = useState('up');

  return (
    <ScrollView
      style={styles.flex}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: bottomPadding }}
    >
      <View style={styles.head}>
        <View>
          <Text style={styles.title}>Activity</Text>
          <Text style={styles.sub}>Upcoming, history & driving</Text>
        </View>
        <Pressable style={styles.findBtn} onPress={onPressFind}>
          <Text style={styles.findBtnTxt}>+ Find</Text>
        </Pressable>
      </View>

      <View style={styles.tabRow}>
        {SUBS.map((t) => {
          const on = sub === t.key;
          return (
            <Pressable key={t.key} style={styles.tabCell} onPress={() => setSub(t.key)}>
              <Text style={[styles.tabTxt, on && { color: C.brand }]}>{t.label}</Text>
              {on ? <View style={styles.tabUnd} /> : null}
            </Pressable>
          );
        })}
      </View>

      {sub === 'up' && (
        <>
          {UPCOMING.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No upcoming rides</Text>
              <Text style={styles.emptySub}>Request a ride from Find to see it here.</Text>
              <Pressable style={styles.primary} onPress={onPressFind}>
                <Text style={styles.primaryTxt}>Find a ride</Text>
              </Pressable>
            </View>
          ) : (
            UPCOMING.map((ride) => (
              <View key={ride.id} style={styles.rcard}>
                <View style={styles.rcHead}>
                  <View>
                    <Text style={styles.rcTime}>{ride.time}</Text>
                    <Text style={styles.rcDate}>{ride.dateLabel}</Text>
                  </View>
                  <Badge label={ride.status} tone={ride.tone} />
                </View>
                <View style={styles.mapBox}>
                  <Text style={styles.mapCap}>Route preview</Text>
                </View>
                <View style={styles.drvRow}>
                  <Avatar initials={ride.driver.initials} color={ride.driver.color} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.drvName}>{ride.driver.name}</Text>
                    <Text style={styles.drvVeh}>{ride.driver.vehicle}</Text>
                  </View>
                </View>
                <Text style={styles.riderHint}>{ride.riderSummary}</Text>
                {ride.estEarn != null ? (
                  <Text style={styles.earn}>
                    Est. earn <Text style={styles.earnBold}>+${ride.estEarn.toFixed(2)}</Text>
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </>
      )}

      {sub === 'past' && (
        <>
          {HISTORY.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No ride history yet</Text>
              <Text style={styles.emptySub}>Completed carpools will show up here.</Text>
            </View>
          ) : (
            <View style={styles.histCard}>
              {HISTORY.map((h, idx) => (
                <View key={h.id} style={[styles.histRow, idx === HISTORY.length - 1 && { borderBottomWidth: 0 }]}>
                  <Avatar initials={h.initials} color={h.color} size={32} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.histTitle}>{h.title}</Text>
                    <Text style={styles.histSub}>{h.sub}</Text>
                  </View>
                  <Badge label={h.badge} tone={h.tone} />
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {sub === 'drv' && (
        <>
          <View style={styles.banner}>
            <Text style={styles.bannerTxt}>
              Post your drive so coworkers on your route can join. You earn a driver incentive per rider.
            </Text>
          </View>
          {DRIVING.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No drives posted</Text>
              <Text style={styles.emptySub}>Share your commute when you are driving in.</Text>
            </View>
          ) : (
            DRIVING.map((d) => (
              <View key={d.id} style={styles.rcard}>
                <View style={styles.rcHead}>
                  <Text style={styles.rcTimeSm}>{d.dateLabel}</Text>
                  <Badge label={d.status} tone="amber" />
                </View>
                <Text style={styles.rcDate}>{d.line}</Text>
                <View style={styles.pips}>
                  {d.pips.map((p) => (
                    <View key={p.initials} style={[styles.pip, { backgroundColor: p.color }]}>
                      <Text style={styles.pipTxt}>{p.initials}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))
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
  findBtnTxt: { color: '#021b14', fontSize: 12, fontWeight: '800' },
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
    alignItems: 'center',
  },
  primaryTxt: { color: '#021b14', fontSize: 14, fontWeight: '800' },
});
