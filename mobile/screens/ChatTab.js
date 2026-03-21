import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import AppPressable from '../components/AppPressable';

const C = {
  panel: '#111118',
  line: 'rgba(255,255,255,0.08)',
  text: '#f0f0f5',
  muted: 'rgba(240,240,245,0.62)',
  faint: 'rgba(240,240,245,0.34)',
  brand: '#00c896',
  brandSoft: 'rgba(0,200,150,0.12)',
  sky: '#4ea8f5',
  amber: '#f5a623',
  purple: '#a78bfa',
};

export const CONVERSATIONS = [
  { id: 'morning', emoji: '🚘', title: 'Tuesday Morning Crew', preview: 'Alex: No worries, pulling up now 🚘', time: '8:33 AM', unread: 2 },
  { id: 'evening', emoji: '🌆', title: 'Evening Carpool', preview: 'Maya: See you all at 5:30!', time: 'Yesterday', unread: 0 },
  { id: 'friday', emoji: '☀️', title: 'Friday Flex Crew', preview: "Dan: Who's in this Friday?", time: 'Fri', unread: 0 },
];

const SEED = {
  morning: [
    { id: 'm1', kind: 'sep', text: 'Tuesday, Jan 14' },
    { id: 'm2', kind: 'them', sender: 'Alex Chen', initials: 'AC', color: C.brand, body: 'Hey everyone! Confirmed for tomorrow 8:30 AM pickup at Oak & Main.', time: '8:42 PM' },
    { id: 'm3', kind: 'them', sender: 'Maya Patel', initials: 'MP', color: C.amber, body: "Oak & Main works! I'll be there at 8:25 👍", time: '8:51 PM' },
    { id: 'm4', kind: 'sep', text: 'Today · Jan 15' },
    { id: 'm5', kind: 'me', initials: 'You', color: C.sky, body: 'Running 2 min late, there at 8:37 🙏', time: '8:31 AM' },
    { id: 'm6', kind: 'them', sender: 'Alex Chen', initials: 'AC', color: C.brand, body: 'No worries, pulling up now 🚘', time: '8:33 AM' },
  ],
  evening: [
    { id: 'e1', kind: 'them', sender: 'Maya Patel', initials: 'MP', color: C.amber, body: 'See you all at 5:30!', time: '4:12 PM' },
  ],
  friday: [
    { id: 'f1', kind: 'them', sender: 'Dan Kim', initials: 'DK', color: C.sky, body: "Who's in this Friday?", time: 'Wed 3:00 PM' },
  ],
};

const MOCK_REPLIES = ['Got it 👍', 'Sounds good!', 'See you there 🚘', 'Thanks!', 'On my way'];
const MOCK_SENDERS = [
  { initials: 'AC', color: C.brand, name: 'Alex Chen' },
  { initials: 'MP', color: C.amber, name: 'Maya Patel' },
  { initials: 'DK', color: C.sky, name: 'Dan Kim' },
];

function timeNow() {
  return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function Avatar({ initials, color, size = 32 }) {
  return (
    <View style={[aStyles.av, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[aStyles.avText, { fontSize: size * 0.34 }]}>{initials}</Text>
    </View>
  );
}

const aStyles = StyleSheet.create({
  av: { alignItems: 'center', justifyContent: 'center' },
  avText: { color: '#fff', fontWeight: '800' },
});

export function ChatList({ onOpenThread, bottomPadding }) {
  return (
    <View style={styles.flex}>
      <View style={styles.head}>
        <Text style={styles.title}>Messages</Text>
        <AppPressable variant="ghost" style={styles.ghostBtn}>
          <Text style={styles.ghostText}>+ Group</Text>
        </AppPressable>
      </View>
      <FlatList
        data={CONVERSATIONS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listPad, { paddingBottom: bottomPadding }]}
        renderItem={({ item }) => (
          <AppPressable variant="default" style={styles.cRow} onPress={() => onOpenThread(item.id)}>
            <View style={styles.emojiWrap}>
              <Text style={styles.emoji}>{item.emoji}</Text>
              {item.unread > 0 ? (
                <View style={styles.dot}>
                  <Text style={styles.dotTxt}>{item.unread}</Text>
                </View>
              ) : null}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.cName} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.cPrev} numberOfLines={1}>
                {item.preview}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.cTime}>{item.time}</Text>
            </View>
          </AppPressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
      />
    </View>
  );
}

export function ChatThread({ conversationId, onBack, bottomPadding }) {
  const meta = CONVERSATIONS.find((c) => c.id === conversationId) ?? CONVERSATIONS[0];
  const seed = useMemo(() => SEED[conversationId] ?? SEED.morning, [conversationId]);
  const [rows, setRows] = useState(seed);
  const [draft, setDraft] = useState('');
  const timers = useRef([]);
  const listRef = useRef(null);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  const scrollEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  useEffect(() => {
    setRows(seed);
  }, [seed, conversationId]);

  useEffect(() => {
    scrollEnd();
  }, [rows, scrollEnd]);

  const send = () => {
    const t = draft.trim();
    if (!t) return;
    setRows((r) => [...r, { id: `u-${Date.now()}`, kind: 'me', initials: 'You', color: C.sky, body: t, time: timeNow() }]);
    setDraft('');
    if (Math.random() > 0.4) {
      const delay = 600 + Math.random() * 900;
      const timer = setTimeout(() => {
        const who = MOCK_SENDERS[Math.floor(Math.random() * MOCK_SENDERS.length)];
        const body = MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)];
        setRows((cur) => [
          ...cur,
          {
            id: `r-${Date.now()}`,
            kind: 'them',
            sender: who.name,
            initials: who.initials,
            color: who.color,
            body,
            time: timeNow(),
          },
        ]);
      }, delay);
      timers.current.push(timer);
    }
  };

  const renderItem = ({ item }) => {
    if (item.kind === 'sep') {
      return <Text style={styles.dateSep}>{item.text}</Text>;
    }
    if (item.kind === 'me') {
      return (
        <View style={[styles.msgRow, styles.msgRowMe]}>
          <View style={{ flex: 1 }} />
          <View style={{ maxWidth: '82%', alignItems: 'flex-end' }}>
            <View style={[styles.bubble, styles.bubbleMe]}>
              <Text style={styles.bubbleMeTxt}>{item.body}</Text>
            </View>
            <Text style={styles.metaR}>{item.time}</Text>
          </View>
          <Avatar initials={item.initials} color={item.color} size={32} />
        </View>
      );
    }
    return (
      <View style={styles.msgRow}>
        <Avatar initials={item.initials} color={item.color} size={32} />
        <View style={{ maxWidth: '82%' }}>
          <Text style={styles.sender}>{item.sender}</Text>
          <View style={styles.bubble}>
            <Text style={styles.bubbleTxt}>{item.body}</Text>
          </View>
          <Text style={styles.meta}>{item.time}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <View style={styles.threadHead}>
        <AppPressable variant="link" onPress={onBack} hitSlop={12} style={styles.backHit}>
          <Text style={styles.back}>‹ Back</Text>
        </AppPressable>
        <Text style={styles.threadTitle} numberOfLines={1}>
          {meta.title}
        </Text>
        <View style={{ width: 56 }} />
      </View>
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.threadList, { paddingBottom: 12 }]}
        onContentSizeChange={scrollEnd}
        showsVerticalScrollIndicator={false}
      />
      <View style={[styles.inputBar, { marginBottom: bottomPadding }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={`Message ${meta.title}…`}
          placeholderTextColor={C.faint}
          style={styles.input}
          multiline
          onSubmitEditing={send}
          blurOnSubmit={false}
        />
        <AppPressable variant="primary" style={styles.sendBtn} onPress={send}>
          <Text style={styles.sendTxt}>➤</Text>
        </AppPressable>
      </View>
    </KeyboardAvoidingView>
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
    paddingBottom: 8,
  },
  title: { color: C.text, fontSize: 28, fontWeight: '800' },
  ghostBtn: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ghostText: { color: C.text, fontSize: 12, fontWeight: '700' },
  listPad: { paddingHorizontal: 8, paddingBottom: 24 },
  cRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 12 },
  emojiWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 22 },
  dot: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  dotTxt: { fontSize: 8.5, fontWeight: '800', color: '#000' },
  cName: { fontSize: 15, fontWeight: '600', color: C.text },
  cPrev: { fontSize: 12.5, color: C.muted, marginTop: 2 },
  cTime: { fontSize: 11, color: C.faint },
  sep: { height: 1, backgroundColor: C.line, marginLeft: 72 },
  threadHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  back: { color: C.muted, fontSize: 16, fontWeight: '600' },
  backHit: { justifyContent: 'center', paddingVertical: 4, paddingHorizontal: 4, minWidth: 48 },
  threadTitle: { flex: 1, textAlign: 'center', color: C.text, fontSize: 16, fontWeight: '700' },
  threadList: { paddingHorizontal: 16, paddingTop: 12 },
  msgRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginBottom: 12 },
  msgRowMe: { justifyContent: 'flex-end' },
  dateSep: { textAlign: 'center', fontSize: 11, color: C.faint, marginVertical: 10 },
  sender: { fontSize: 10.5, color: C.faint, marginBottom: 3 },
  bubble: {
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 13,
  },
  bubbleTxt: { color: C.text, fontSize: 14, lineHeight: 20 },
  bubbleMe: { backgroundColor: C.brand, borderBottomLeftRadius: 16, borderBottomRightRadius: 4 },
  bubbleMeTxt: { color: '#021b14', fontSize: 14, lineHeight: 20, fontWeight: '500' },
  meta: { fontSize: 10, color: C.faint, marginTop: 3 },
  metaR: { fontSize: 10, color: C.faint, marginTop: 3, textAlign: 'right' },
  inputBar: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: C.line,
    backgroundColor: C.panel,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 24,
    paddingHorizontal: 17,
    paddingVertical: 10,
    fontSize: 14,
    color: C.text,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendTxt: { color: '#000', fontSize: 15, fontWeight: '800' },
});
