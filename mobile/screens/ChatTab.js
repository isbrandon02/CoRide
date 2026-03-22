import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  card: '#18181f',
  line: 'rgba(255,255,255,0.08)',
  text: '#f0f0f5',
  muted: 'rgba(240,240,245,0.62)',
  faint: 'rgba(240,240,245,0.34)',
  brand: '#00c896',
  sky: '#4ea8f5',
  amber: '#f5a623',
  rose: '#f97393',
  violet: '#8b5cf6',
};

export const COMPANY_MEMBERS = [
  { id: 'alex', name: 'Alex Chen', role: 'Software Engineer', initials: 'AC', color: C.brand },
  { id: 'maya', name: 'Maya Patel', role: 'Product Designer', initials: 'MP', color: C.amber },
  { id: 'dan', name: 'Dan Kim', role: 'Data Analyst', initials: 'DK', color: C.sky },
  { id: 'priya', name: 'Priya Shah', role: 'Operations Manager', initials: 'PS', color: C.rose },
  { id: 'omar', name: 'Omar Reyes', role: 'Account Executive', initials: 'OR', color: C.violet },
  { id: 'zoe', name: 'Zoe Martin', role: 'Customer Success', initials: 'ZM', color: '#22c55e' },
];

export const INITIAL_CONVERSATIONS = [
  {
    id: 'conv-alex',
    title: 'Alex Chen',
    preview: 'I can leave around 8:10 if that works for you.',
    time: '8:42 AM',
    initials: 'AC',
    color: C.brand,
    isGroup: false,
    members: ['alex'],
    messages: [
      { id: 'a1', kind: 'other', sender: 'Alex Chen', initials: 'AC', color: C.brand, body: 'Hey, I saw we are a 94% route match.', time: '8:30 AM' },
      { id: 'a2', kind: 'other', sender: 'Alex Chen', initials: 'AC', color: C.brand, body: 'I can leave around 8:10 if that works for you.', time: '8:42 AM' },
    ],
  },
  {
    id: 'conv-morning',
    title: 'Morning Carpool Crew',
    preview: 'Maya: I can grab coffee on the way in.',
    time: 'Yesterday',
    initials: 'GC',
    color: C.sky,
    isGroup: true,
    members: ['alex', 'maya', 'dan'],
    messages: [
      { id: 'g1', kind: 'other', sender: 'Alex Chen', initials: 'AC', color: C.brand, body: 'Let us plan for an 8:20 pickup window tomorrow.', time: 'Yesterday' },
      { id: 'g2', kind: 'other', sender: 'Maya Patel', initials: 'MP', color: C.amber, body: 'I can grab coffee on the way in.', time: 'Yesterday' },
    ],
  },
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

export function ChatList({
  onOpenThread,
  bottomPadding,
  conversations = [],
  employees = [],
  onCreateGroup,
}) {
  const [mode, setMode] = useState('list');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((member) =>
      [member.name, member.role].some((value) => String(value || '').toLowerCase().includes(q)),
    );
  }, [employees, search]);

  function resetComposer() {
    setMode('list');
    setSearch('');
    setSelected([]);
  }

  function toggleMember(id) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function handleCreateGroup() {
    if (selected.length < 2) return;
    const created = onCreateGroup?.(selected);
    resetComposer();
    if (created) onOpenThread(created);
  }

  if (mode === 'picker') {
    return (
      <View style={styles.flex}>
        <View style={styles.head}>
          <AppPressable variant="link" style={styles.linkBtn} onPress={resetComposer}>
            <Text style={styles.backText}>Back</Text>
          </AppPressable>
          <Text style={styles.title}>New Group</Text>
          <AppPressable
            variant="ghost"
            style={[styles.ghostBtn, selected.length < 2 && styles.disabledBtn]}
            onPress={handleCreateGroup}
            disabled={selected.length < 2}
          >
            <Text style={[styles.ghostText, selected.length < 2 && styles.disabledText]}>
              Create
            </Text>
          </AppPressable>
        </View>

        <View style={styles.searchWrap}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search employees"
            placeholderTextColor={C.faint}
            style={styles.searchInput}
          />
          <Text style={styles.helperText}>
            Select at least 2 coworkers from your company to start a group chat.
          </Text>
        </View>

        {selected.length > 0 ? (
          <View style={styles.selectedWrap}>
            <Text style={styles.selectedLabel}>Selected</Text>
            <View style={styles.selectedRow}>
              {selected.map((id) => {
                const member = employees.find((item) => item.id === id);
                if (!member) return null;
                return (
                  <View key={id} style={styles.selectedChip}>
                    <Text style={styles.selectedChipText}>{member.name}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        <FlatList
          data={filteredEmployees}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listPad, { paddingBottom: bottomPadding }]}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => {
            const isSelected = selected.includes(item.id);
            return (
              <AppPressable
                variant="default"
                style={[styles.memberRow, isSelected && styles.memberRowSelected]}
                onPress={() => toggleMember(item.id)}
              >
                <Avatar initials={item.initials} color={item.color} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cName}>{item.name}</Text>
                  <Text style={styles.cPrev}>{item.role}</Text>
                </View>
                <View style={[styles.checkBox, isSelected && styles.checkBoxOn]}>
                  {isSelected ? <Text style={styles.checkMark}>✓</Text> : null}
                </View>
              </AppPressable>
            );
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={styles.head}>
        <Text style={styles.title}>Messages</Text>
        <AppPressable variant="ghost" style={styles.ghostBtn} onPress={() => setMode('picker')}>
          <Text style={styles.ghostText}>+ Group</Text>
        </AppPressable>
      </View>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listPad, { paddingBottom: bottomPadding }]}
        ListEmptyComponent={
          <View style={styles.emptyInbox}>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptyBody}>
              Start a direct chat or create a company group to see it here.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <AppPressable variant="default" style={styles.cRow} onPress={() => onOpenThread(item)}>
            <Avatar initials={item.initials} color={item.color} size={48} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.nameRow}>
                <Text style={styles.cName} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.isGroup ? <Text style={styles.groupTag}>Group</Text> : null}
              </View>
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

export function ChatThread({
  conversation,
  threadTitle = 'Chat',
  onBack,
  bottomPadding,
  onSendMessage,
  onRenameGroup,
}) {
  const [draft, setDraft] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const listRef = useRef(null);
  const rows = conversation?.messages ?? [];

  useEffect(() => {
    setDraft('');
    setEditingTitle(false);
    setTitleDraft(conversation?.title ?? '');
  }, [conversation?.id]);

  useEffect(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
  }, [conversation?.id, rows.length]);

  const send = () => {
    const text = draft.trim();
    if (!text || !conversation) return;
    onSendMessage?.(conversation.id, {
      id: `u-${Date.now()}`,
      kind: 'me',
      sender: 'You',
      initials: 'YO',
      color: C.sky,
      body: text,
      time: timeNow(),
    });
    setDraft('');
  };

  const title = threadTitle || conversation?.title || 'Chat';
  const isGroup = !!conversation?.isGroup;

  const saveTitle = () => {
    const nextTitle = titleDraft.trim();
    if (!isGroup || !nextTitle) {
      setEditingTitle(false);
      setTitleDraft(conversation?.title ?? '');
      return;
    }
    onRenameGroup?.(conversation.id, nextTitle);
    setEditingTitle(false);
  };

  const renderItem = ({ item }) => {
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
          <Text style={styles.backText}>Back</Text>
        </AppPressable>
        {editingTitle ? (
          <TextInput
            value={titleDraft}
            onChangeText={setTitleDraft}
            style={styles.threadTitleInput}
            placeholder="Group name"
            placeholderTextColor={C.faint}
            autoFocus
            onSubmitEditing={saveTitle}
          />
        ) : (
          <Text style={styles.threadTitle} numberOfLines={1}>
            {title}
          </Text>
        )}
        {isGroup ? (
          editingTitle ? (
            <AppPressable variant="link" onPress={saveTitle} style={styles.threadAction}>
              <Text style={styles.threadActionText}>Save</Text>
            </AppPressable>
          ) : (
            <AppPressable
              variant="link"
              onPress={() => {
                setTitleDraft(title);
                setEditingTitle(true);
              }}
              style={styles.threadAction}
            >
              <Text style={styles.threadActionText}>Rename</Text>
            </AppPressable>
          )
        ) : (
          <View style={{ width: 64 }} />
        )}
      </View>
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.threadList, { paddingBottom: 12 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.threadEmpty}>No messages yet. Say hello below.</Text>
        }
      />
      <View style={[styles.inputBar, { marginBottom: bottomPadding }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={`Message ${title}...`}
          placeholderTextColor={C.faint}
          style={styles.input}
          multiline
          onSubmitEditing={send}
          blurOnSubmit={false}
        />
        <AppPressable variant="primary" style={styles.sendBtn} onPress={send}>
          <Text style={styles.sendTxt}>Send</Text>
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
  disabledBtn: { opacity: 0.45 },
  disabledText: { opacity: 0.7 },
  linkBtn: { paddingVertical: 6, paddingRight: 8 },
  backText: { color: C.muted, fontSize: 15, fontWeight: '700' },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: C.text,
  },
  helperText: { color: C.muted, fontSize: 12, marginTop: 10, lineHeight: 18 },
  selectedWrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  selectedLabel: { color: C.faint, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  selectedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  selectedChip: {
    backgroundColor: 'rgba(0,200,150,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,200,150,0.32)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selectedChipText: { color: C.brand, fontSize: 12, fontWeight: '700' },
  listPad: { paddingHorizontal: 8, paddingBottom: 24 },
  emptyInbox: { paddingHorizontal: 28, paddingVertical: 36, alignItems: 'center' },
  emptyTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  emptyBody: { color: C.muted, fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  cRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 12 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 18 },
  memberRowSelected: { backgroundColor: 'rgba(255,255,255,0.05)' },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.card,
  },
  checkBoxOn: { backgroundColor: C.brand, borderColor: C.brand },
  checkMark: { color: '#04110d', fontSize: 13, fontWeight: '900' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupTag: { color: C.brand, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
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
  backHit: { justifyContent: 'center', paddingVertical: 4, paddingHorizontal: 4, minWidth: 48 },
  threadTitle: { flex: 1, textAlign: 'center', color: C.text, fontSize: 16, fontWeight: '700' },
  threadTitleInput: {
    flex: 1,
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 8,
  },
  threadAction: { minWidth: 64, alignItems: 'flex-end', paddingRight: 4 },
  threadActionText: { color: C.brand, fontSize: 13, fontWeight: '700' },
  threadList: { paddingHorizontal: 16, paddingTop: 12 },
  threadEmpty: { textAlign: 'center', color: C.faint, fontSize: 13, paddingVertical: 24 },
  msgRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginBottom: 12 },
  msgRowMe: { justifyContent: 'flex-end' },
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
    minWidth: 64,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  sendTxt: { color: '#000', fontSize: 13, fontWeight: '800' },
});
