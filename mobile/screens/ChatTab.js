import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import AppPressable from '../components/AppPressable';
import {
  createGroupChat,
  getChatCandidates,
  getChatConversations,
  getChatMessages,
  openOrGetDm,
  renameChatConversation,
  sendChatMessage,
} from '../src/auth';

const C = {
  panel: '#111118',
  line: 'rgba(255,255,255,0.08)',
  text: '#f0f0f5',
  muted: 'rgba(240,240,245,0.62)',
  faint: 'rgba(240,240,245,0.34)',
  brand: '#00c896',
  sky: '#4ea8f5',
};

const AVATAR_PALETTE = ['#00c896', '#4ea8f5', '#f5a623', '#a78bfa', '#f472b6', '#fb7185', '#22d3ee'];

function accentForUser(userId) {
  const n = Number(userId);
  const i = Number.isFinite(n) ? Math.abs(n) : 0;
  return AVATAR_PALETTE[i % AVATAR_PALETTE.length];
}

function formatConvTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatMsgTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function initialsFromName(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

function Avatar({ initials, color, size = 32 }) {
  return (
    <View style={[aStyles.av, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[aStyles.avText, { fontSize: size * 0.34 }]}>{initials}</Text>
    </View>
  );
}

function PhotoOrInitials({ uri, name, userId, size = 40 }) {
  const [failed, setFailed] = useState(false);
  const color = accentForUser(userId);
  const ini = initialsFromName(name);
  const u = typeof uri === 'string' ? uri.trim() : '';
  const showImg =
    u.length > 0 &&
    !failed &&
    (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:image'));

  if (showImg) {
    return (
      <Image
        accessibilityIgnoresInvertColors
        source={{ uri: u }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: 'rgba(255,255,255,0.06)',
        }}
        onError={() => setFailed(true)}
      />
    );
  }
  return <Avatar initials={ini} color={color} size={size} />;
}

function ConversationRowAvatar({ members, isGroup, extraCount, fallbackTitle, fallbackConvId }) {
  const raw = Array.isArray(members) ? members : [];
  const list = raw
    .map((m) => {
      if (!m || typeof m !== 'object') return null;
      const uid = Number(m.user_id ?? m.userId);
      const displayName = String(m.display_name ?? m.displayName ?? '').trim();
      const av = m.avatar_url ?? m.avatarUrl;
      return {
        user_id: Number.isFinite(uid) && uid > 0 ? uid : 0,
        display_name: displayName || '?',
        avatar_url: typeof av === 'string' && av.trim() ? av.trim() : null,
      };
    })
    .filter((m) => m && m.user_id > 0);

  if (!list.length) {
    const fid = Number(fallbackConvId) || 0;
    return (
      <PhotoOrInitials
        uri={null}
        name={fallbackTitle || 'Chat'}
        userId={fid}
        size={50}
      />
    );
  }
  if (!isGroup && list.length === 1) {
    const m = list[0];
    return (
      <PhotoOrInitials
        uri={m.avatar_url}
        name={m.display_name}
        userId={m.user_id}
        size={50}
      />
    );
  }
  const stack = list.slice(0, 2);
  const size = 34;
  return (
    <View style={styles.stackWrap}>
      {stack.map((m, i) => (
        <View
          key={String(m.user_id)}
          style={[styles.stackItem, { marginLeft: i === 0 ? 0 : -10, zIndex: 20 - i }]}
        >
          <View style={styles.stackRing}>
            <PhotoOrInitials
              uri={m.avatar_url}
              name={m.display_name}
              userId={m.user_id}
              size={size}
            />
          </View>
        </View>
      ))}
      {extraCount > 0 ? (
        <View style={[styles.stackItem, { marginLeft: -8, zIndex: 0 }]}>
          <View style={styles.plusBadge}>
            <Text style={styles.plusBadgeTxt}>+{extraCount}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const aStyles = StyleSheet.create({
  av: { alignItems: 'center', justifyContent: 'center' },
  avText: { color: '#fff', fontWeight: '800' },
});

/**
 * @param {{ accessToken: string | null, refreshKey?: number, bottomPadding: number, onOpenThread: (c: object) => void, onConversationsChanged?: () => void }} props
 */
export function ChatList({ accessToken, refreshKey = 0, bottomPadding, onOpenThread, onConversationsChanged }) {
  const [mode, setMode] = useState('list');
  const [conversations, setConversations] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [error, setError] = useState(null);
  const [candidateError, setCandidateError] = useState(null);

  useEffect(() => {
    if (!accessToken) {
      setConversations([]);
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    setError(null);
    getChatConversations(accessToken)
      .then((data) => {
        if (!live) return;
        const list = data.conversations ?? [];
        setConversations(
          list.map((c) => ({
            id: String(c.id),
            title: c.title,
            preview: c.preview || 'No messages yet. Tap to start chatting.',
            time: formatConvTime(c.time),
            is_group: !!(c.is_group ?? c.isGroup),
            members: Array.isArray(c.members) ? c.members : [],
            extra_member_count: Number(c.extra_member_count ?? c.extraMemberCount) || 0,
          })),
        );
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
    if (!accessToken || mode !== 'create') {
      return;
    }
    let live = true;
    setCandidateLoading(true);
    setCandidateError(null);
    getChatCandidates(accessToken)
      .then((data) => {
        if (!live) return;
        setCandidates(Array.isArray(data.users) ? data.users : []);
      })
      .catch((e) => {
        if (live) setCandidateError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (live) setCandidateLoading(false);
      });
    return () => {
      live = false;
    };
  }, [accessToken, mode]);

  useEffect(() => {
    if (selectedIds.length <= 1 && groupTitle) {
      setGroupTitle('');
    }
  }, [selectedIds.length, groupTitle]);

  const filteredCandidates = candidates.filter((item) => {
    const q = candidateSearch.trim().toLowerCase();
    if (!q) return true;
    return [item.name, item.email].some((v) => String(v || '').toLowerCase().includes(q));
  });

  function resetGroupComposer() {
    setMode('list');
    setCandidateSearch('');
    setGroupTitle('');
    setSelectedIds([]);
    setCandidateError(null);
  }

  function toggleCandidate(userId) {
    setSelectedIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  }

  async function handleCreateGroup() {
    if (!accessToken || selectedIds.length < 1 || createBusy) return;
    setCreateBusy(true);
    try {
      let opened;
      if (selectedIds.length === 1) {
        const data = await openOrGetDm(accessToken, selectedIds[0]);
        opened = { id: String(data.conversation_id), title: data.title, is_group: false };
      } else {
        const data = await createGroupChat(accessToken, {
          user_ids: selectedIds,
          title: groupTitle,
        });
        opened = { id: String(data.conversation_id), title: data.title, is_group: true };
      }
      onConversationsChanged?.();
      resetGroupComposer();
      onOpenThread(opened);
    } catch (e) {
      setCandidateError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreateBusy(false);
    }
  }

  if (mode === 'create') {
    return (
      <View style={styles.flex}>
        <View style={styles.head}>
          <AppPressable variant="link" style={styles.backHit} onPress={resetGroupComposer}>
            <Text style={styles.back}>‹ Back</Text>
          </AppPressable>
          <Text style={styles.title}>New Chat</Text>
          <View style={{ width: 56 }} />
        </View>
        <View style={styles.composeWrap}>
          {selectedIds.length > 1 ? (
            <TextInput
              value={groupTitle}
              onChangeText={setGroupTitle}
              placeholder="Group name (optional)"
              placeholderTextColor={C.faint}
              style={styles.composeInput}
            />
          ) : null}
          <TextInput
            value={candidateSearch}
            onChangeText={setCandidateSearch}
            placeholder="Search coworkers"
            placeholderTextColor={C.faint}
            style={styles.composeInput}
          />
          <Text style={styles.composeHint}>
            {selectedIds.length > 1
              ? 'Choose multiple coworkers to create a group chat.'
              : 'Choose one coworker for a direct message, or select more than one to make a group chat.'}
          </Text>
          {selectedIds.length > 0 ? (
            <View style={styles.selectedWrap}>
              {selectedIds.map((id) => {
                const item = candidates.find((u) => u.id === id);
                if (!item) return null;
                return (
                  <View key={String(id)} style={styles.selectedChip}>
                    <Text style={styles.selectedChipTxt}>{item.name}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}
          {candidateError ? <Text style={styles.inlineError}>{candidateError}</Text> : null}
        </View>
        {candidateLoading ? (
          <ActivityIndicator color={C.brand} style={{ marginTop: 28 }} />
        ) : (
          <FlatList
            data={filteredCandidates}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={[styles.listPad, { paddingBottom: 120 + bottomPadding }]}
            renderItem={({ item }) => {
              const selected = selectedIds.includes(item.id);
              return (
                <AppPressable
                  variant="default"
                  style={[styles.cRow, selected && styles.selectedRow]}
                  onPress={() => toggleCandidate(item.id)}
                >
                  <PhotoOrInitials
                    uri={item.avatar_url}
                    name={item.name}
                    userId={item.id}
                    size={50}
                  />
                  <View style={styles.conversationTextWrap}>
                    <Text style={styles.cName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.cPrev} numberOfLines={1}>
                      {item.email}
                    </Text>
                  </View>
                  <View style={[styles.checkMarkBubble, selected && styles.checkMarkBubbleOn]}>
                    <Text style={styles.checkMarkTxt}>{selected ? '✓' : '+'}</Text>
                  </View>
                </AppPressable>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
          />
        )}
        <View style={[styles.createFooter, { paddingBottom: Math.max(bottomPadding, 12) }]}>
          <AppPressable
            variant="primary"
            style={[styles.createGroupBtn, (selectedIds.length < 1 || createBusy) && styles.dimmed]}
            onPress={handleCreateGroup}
            disabled={selectedIds.length < 1 || createBusy}
          >
            <Text style={styles.createGroupTxt}>
              {createBusy ? 'Creating...' : selectedIds.length > 1 ? 'Create group' : 'Start chat'}
            </Text>
          </AppPressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={styles.head}>
        <Text style={styles.title}>Messages</Text>
        <AppPressable variant="ghost" style={styles.ghostBtn} onPress={() => setMode('create')}>
          <Text style={styles.ghostText}>+ New</Text>
        </AppPressable>
      </View>
      {loading ? (
        <ActivityIndicator color={C.brand} style={{ marginTop: 28 }} />
      ) : error ? (
        <View style={styles.emptyInbox}>
          <Text style={styles.emptyTitle}>Could not load messages</Text>
          <Text style={styles.emptyBody}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listPad, { paddingBottom: bottomPadding }]}
          ListEmptyComponent={
            <View style={styles.emptyInbox}>
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptyBody}>Open Find and tap Chat on a match to start a thread.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <AppPressable variant="default" style={styles.cRow} onPress={() => onOpenThread(item)}>
              <ConversationRowAvatar
                members={item.members}
                isGroup={item.is_group}
                extraCount={item.extra_member_count}
                fallbackTitle={item.title}
                fallbackConvId={item.id}
              />
              <View style={styles.conversationTextWrap}>
                <Text style={styles.cName} numberOfLines={1}>
                  {item.title}
                </Text>
              <Text style={styles.cPrev} numberOfLines={1}>
                  {item.preview || 'No messages yet. Tap to start chatting.'}
              </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.cTime}>{item.time}</Text>
              </View>
            </AppPressable>
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      )}
    </View>
  );
}

function mapApiRowToBubble(m) {
  if (m.is_me) {
    return {
      id: String(m.id),
      kind: 'me',
      initials: 'You',
      color: C.sky,
      body: m.body,
      time: formatMsgTime(m.created_at),
    };
  }
  const name = m.sender_name || 'Member';
  return {
    id: String(m.id),
    kind: 'them',
    sender: name,
    initials: initialsFromName(name),
    color: C.brand,
    body: m.body,
    time: formatMsgTime(m.created_at),
  };
}

/**
 * @param {{ accessToken: string | null, conversationId: string, threadTitle?: string, onBack: () => void, bottomPadding: number, onMessagesChanged?: () => void }} props
 */
export function ChatThread({
  accessToken,
  conversationId,
  threadTitle = 'Chat',
  isGroup = false,
  onBack,
  bottomPadding,
  onMessagesChanged,
  onConversationRenamed,
}) {
  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendBusy, setSendBusy] = useState(false);
  const [renameMode, setRenameMode] = useState(false);
  const [renameBusy, setRenameBusy] = useState(false);
  const [titleDraft, setTitleDraft] = useState(threadTitle || '');
  const listRef = useRef(null);

  useEffect(() => {
    setDraft('');
    setRows([]);
    setRenameMode(false);
    setTitleDraft(threadTitle || '');
    if (!accessToken || !conversationId) {
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    getChatMessages(accessToken, conversationId)
      .then((data) => {
        if (!live) return;
        const msgs = data.messages ?? [];
        setRows(msgs.map(mapApiRowToBubble));
      })
      .catch(() => {
        if (live) setRows([]);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [accessToken, conversationId, threadTitle]);

  const scrollEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  useEffect(() => {
    scrollEnd();
  }, [rows, scrollEnd]);

  const send = () => {
    const t = draft.trim();
    if (!t || !accessToken || !conversationId || sendBusy) return;
    setSendBusy(true);
    sendChatMessage(accessToken, conversationId, t)
      .then((msg) => {
        setRows((r) => [...r, mapApiRowToBubble(msg)]);
        setDraft('');
        onMessagesChanged?.();
      })
      .catch(() => {})
      .finally(() => setSendBusy(false));
  };

  const submitRename = () => {
    const nextTitle = titleDraft.trim();
    if (!accessToken || !conversationId || !isGroup || !nextTitle || renameBusy) return;
    setRenameBusy(true);
    renameChatConversation(accessToken, conversationId, nextTitle)
      .then((data) => {
        const finalTitle = String(data.title || nextTitle);
        setTitleDraft(finalTitle);
        setRenameMode(false);
        onConversationRenamed?.({ id: String(data.id ?? conversationId), title: finalTitle });
        onMessagesChanged?.();
      })
      .catch(() => {})
      .finally(() => setRenameBusy(false));
  };

  const title = threadTitle || 'Chat';

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
          <Text style={styles.back}>‹ Back</Text>
        </AppPressable>
        {renameMode ? (
          <TextInput
            value={titleDraft}
            onChangeText={setTitleDraft}
            placeholder="Group name"
            placeholderTextColor={C.faint}
            style={styles.threadTitleInput}
            autoFocus
            editable={!renameBusy}
            onSubmitEditing={submitRename}
          />
        ) : (
          <Text style={styles.threadTitle} numberOfLines={1}>
            {title}
          </Text>
        )}
        {isGroup ? (
          <AppPressable
            variant="link"
            onPress={renameMode ? submitRename : () => setRenameMode(true)}
            style={styles.threadAction}
            disabled={renameBusy}
          >
            <Text style={styles.threadActionText}>
              {renameMode ? (renameBusy ? 'Saving' : 'Save') : 'Rename'}
            </Text>
          </AppPressable>
        ) : (
          <View style={{ width: 56 }} />
        )}
      </View>
      {loading ? (
        <ActivityIndicator color={C.brand} style={{ marginTop: 24 }} />
      ) : (
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
      )}
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
          editable={!sendBusy}
        />
        <AppPressable variant="primary" style={styles.sendBtn} onPress={send} disabled={sendBusy}>
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
  composeWrap: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 },
  composeInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: C.text,
    marginBottom: 10,
  },
  composeHint: { color: C.muted, fontSize: 12, lineHeight: 18 },
  selectedWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  selectedChip: {
    backgroundColor: 'rgba(0,200,150,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(0,200,150,0.32)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selectedChipTxt: { color: C.brand, fontSize: 12, fontWeight: '700' },
  inlineError: { color: '#fda4af', fontSize: 12, marginTop: 10 },
  listPad: { paddingHorizontal: 8, paddingBottom: 24 },
  emptyInbox: { paddingHorizontal: 28, paddingVertical: 36, alignItems: 'center' },
  emptyTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  emptyBody: { color: C.muted, fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  cRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 12 },
  conversationTextWrap: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 40,
    paddingTop: 18,
  },
  selectedRow: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16 },
  checkMarkBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  checkMarkBubbleOn: {
    backgroundColor: C.brand,
    borderColor: C.brand,
  },
  checkMarkTxt: { color: C.text, fontSize: 14, fontWeight: '800' },
  fallbackIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackWrap: {
    width: 50,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  stackItem: {},
  stackRing: {
    borderWidth: 2,
    borderColor: C.panel,
    borderRadius: 99,
    overflow: 'hidden',
  },
  plusBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 2,
    borderColor: C.panel,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  plusBadgeTxt: { fontSize: 10, fontWeight: '800', color: C.text },
  emoji: { fontSize: 22 },
  cName: { fontSize: 15, fontWeight: '600', color: C.text },
  cPrev: { fontSize: 12.5, color: C.muted, marginTop: 2 },
  cTime: { fontSize: 11, color: C.faint },
  sep: { height: 1, backgroundColor: C.line, marginLeft: 76 },
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
  threadTitleInput: {
    flex: 1,
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginHorizontal: 8,
  },
  threadAction: { minWidth: 56, alignItems: 'flex-end', paddingRight: 4 },
  threadActionText: { color: C.brand, fontSize: 13, fontWeight: '700' },
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
  createGroupBtn: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.brand,
  },
  createGroupTxt: { color: '#000', fontSize: 14, fontWeight: '800' },
  createFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: C.panel,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  dimmed: { opacity: 0.5 },
});
