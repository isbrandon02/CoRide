import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const C = {
  panel: '#111118',
  line: 'rgba(255,255,255,0.08)',
  text: '#f0f0f5',
  muted: 'rgba(240,240,245,0.62)',
  faint: 'rgba(240,240,245,0.34)',
  brand: '#00c896',
  sky: '#4ea8f5',
};

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

/**
 * @param {{ bottomPadding: number, onOpenThread: (c: { id: string, title: string, preview?: string, time?: string }) => void }} props
 */
export function ChatList({ onOpenThread, bottomPadding }) {
  const conversations = [];

  return (
    <View style={styles.flex}>
      <View style={styles.head}>
        <Text style={styles.title}>Messages</Text>
        <Pressable style={styles.ghostBtn} disabled>
          <Text style={[styles.ghostText, { opacity: 0.45 }]}>+ Group</Text>
        </Pressable>
      </View>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listPad, { paddingBottom: bottomPadding }]}
        ListEmptyComponent={
          <View style={styles.emptyInbox}>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptyBody}>When messaging is available, threads will appear here.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.cRow} onPress={() => onOpenThread(item)}>
            <View style={styles.emojiWrap}>
              <Text style={styles.emoji}>💬</Text>
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
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
      />
    </View>
  );
}

export function ChatThread({ conversationId, threadTitle = 'Chat', onBack, bottomPadding }) {
  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    setRows([]);
    setDraft('');
  }, [conversationId]);

  const scrollEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  useEffect(() => {
    scrollEnd();
  }, [rows, scrollEnd]);

  const send = () => {
    const t = draft.trim();
    if (!t) return;
    setRows((r) => [...r, { id: `u-${Date.now()}`, kind: 'me', initials: 'You', color: C.sky, body: t, time: timeNow() }]);
    setDraft('');
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

  const title = threadTitle || 'Chat';

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <View style={styles.threadHead}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.threadTitle} numberOfLines={1}>
          {title}
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
        ListEmptyComponent={
          <Text style={styles.threadEmpty}>No messages yet. Say hello below.</Text>
        }
      />
      <View style={[styles.inputBar, { marginBottom: bottomPadding }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={`Message ${title}…`}
          placeholderTextColor={C.faint}
          style={styles.input}
          multiline
          onSubmitEditing={send}
          blurOnSubmit={false}
        />
        <Pressable style={styles.sendBtn} onPress={send}>
          <Text style={styles.sendTxt}>➤</Text>
        </Pressable>
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
  emptyInbox: { paddingHorizontal: 28, paddingVertical: 36, alignItems: 'center' },
  emptyTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  emptyBody: { color: C.muted, fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 20 },
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
  threadTitle: { flex: 1, textAlign: 'center', color: C.text, fontSize: 16, fontWeight: '700' },
  threadList: { paddingHorizontal: 16, paddingTop: 12 },
  threadEmpty: { textAlign: 'center', color: C.faint, fontSize: 13, paddingVertical: 24 },
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
