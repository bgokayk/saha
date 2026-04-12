import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator
} from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { avatarColor, initials, timeAgo } from '../lib/utils';

export default function ChatListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [tab, setTab]         = useState('direct');
  const [convos, setConvos]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId]       = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setMyId(user.id);

      const { data: msgs } = await supabase
        .from('messages')
        .select('*, from_profile:profiles!messages_from_user_fkey(id, full_name), to_profile:profiles!messages_to_user_fkey(id, full_name)')
        .or(`from_user.eq.${user.id},to_user.eq.${user.id}`)
        .is('match_id', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!msgs) { setLoading(false); return; }

      const seen = new Map();
      for (const m of msgs) {
        const otherId = m.from_user === user.id ? m.to_user : m.from_user;
        const otherProfile = m.from_user === user.id ? m.to_profile : m.from_profile;
        if (!seen.has(otherId)) {
          seen.set(otherId, {
            otherId,
            otherName: otherProfile?.full_name || 'Kullanıcı',
            lastMsg: m.content,
            time: m.created_at,
            unread: !m.read && m.to_user === user.id ? 1 : 0,
          });
        }
      }
      setConvos(Array.from(seen.values()));
    } catch (err) {
      console.error('ChatList load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mesajlar</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.tabRow}>
        {[
          { key: 'direct', label: '💬 Direkt Mesajlar' },
          { key: 'match',  label: '⚽ Maç Chatleri'   },
        ].map(t => (
          <TouchableOpacity key={t.key}
            style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
            onPress={() => setTab(t.key)}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color="#00D4FF" size="large" /></View>
      ) : tab === 'direct' ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          {convos.length === 0 ? (
            <EmptyChat label="Henüz mesaj yok" sub="Oyuncu bul ve maça davet et!" navigation={navigation} showDiscoverBtn />
          ) : (
            convos.map((c) => (
              <TouchableOpacity key={c.otherId} style={styles.convoRow}
                onPress={() => navigation.navigate('Chat', { otherId: c.otherId, otherName: c.otherName })}>
                <View style={[styles.convoAvatar, { backgroundColor: avatarColor(c.otherName) }]}>
                  <Text style={styles.convoAvatarText}>{initials(c.otherName)}</Text>
                </View>
                <View style={styles.convoInfo}>
                  <View style={styles.convoTopRow}>
                    <Text style={styles.convoName}>{c.otherName}</Text>
                    <Text style={styles.convoTime}>{timeAgo(c.time)}</Text>
                  </View>
                  <View style={styles.convoMsgRow}>
                    <Text style={styles.convoMsg} numberOfLines={1}>{c.lastMsg || '...'}</Text>
                    {c.unread > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{c.unread}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        <MatchChatList navigation={navigation} myId={myId} />
      )}
    </View>
  );
}

function MatchChatList({ navigation, myId }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!myId) return;
      const { data } = await supabase
        .from('match_players')
        .select('match_id, matches(id, match_date, format, venues(name))')
        .eq('user_id', myId)
        .order('created_at', { ascending: false })
        .limit(20);
      setMatches(data?.map(d => d.matches).filter(Boolean) || []);
      setLoading(false);
    }
    load();
  }, [myId]);

  if (loading) return <ActivityIndicator color="#00D4FF" style={{ marginTop: 40 }} />;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {matches.length === 0 ? (
        <EmptyChat label="Maç chatine katılmak için önce bir maça katıl" sub="Maçlar → Katıl" />
      ) : (
        matches.map((m) => (
          <TouchableOpacity key={m.id} style={styles.convoRow}
            onPress={() => navigation.navigate('Chat', { matchId: m.id, otherName: `${m.venues?.name || 'Saha'} Maçı`, isMatch: true })}>
            <View style={[styles.convoAvatar, { backgroundColor: 'rgba(0,212,255,0.1)' }]}>
              <Text style={styles.convoAvatarText}>⚽</Text>
            </View>
            <View style={styles.convoInfo}>
              <View style={styles.convoTopRow}>
                <Text style={styles.convoName}>{m.venues?.name || 'Maç Chati'}</Text>
                <View style={styles.formatBadge}>
                  <Text style={styles.formatText}>{m.format}</Text>
                </View>
              </View>
              <Text style={styles.convoMsg}>
                {new Date(m.match_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </TouchableOpacity>
        ))
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function EmptyChat({ label, sub, navigation, showDiscoverBtn }) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={{ fontSize: 64, marginBottom: 12 }}>💬</Text>
      <Text style={styles.emptyTitle}>{label}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
      {showDiscoverBtn && navigation && (
        <TouchableOpacity style={styles.discoverBtn} onPress={() => navigation.navigate('Discover')}>
          <Text style={styles.discoverBtnText}>Oyuncu Bul →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1628' },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    backgroundColor: '#0A1628', paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,212,255,0.12)',
  },
  backText:    { color: 'rgba(255,255,255,0.45)', fontSize: 14 },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },

  tabRow:       { flexDirection: 'row', backgroundColor: '#0A1628', borderBottomWidth: 1, borderBottomColor: 'rgba(0,212,255,0.08)' },
  tabBtn:       { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: '#00D4FF' },
  tabText:      { fontSize: 13, color: 'rgba(255,255,255,0.35)', fontWeight: '600' },
  tabTextActive:{ color: '#00D4FF', fontWeight: '700' },

  convoRow:     { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,212,255,0.06)', alignItems: 'center' },
  convoAvatar:  { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  convoAvatarText:{ color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  convoInfo:    { flex: 1 },
  convoTopRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  convoName:    { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  convoTime:    { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
  convoMsgRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convoMsg:     { fontSize: 13, color: 'rgba(255,255,255,0.4)', flex: 1 },
  unreadBadge:  { backgroundColor: '#00D4FF', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  unreadText:   { color: '#0A1628', fontSize: 11, fontWeight: '700' },

  formatBadge:  { backgroundColor: 'rgba(0,212,255,0.12)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  formatText:   { color: '#00D4FF', fontSize: 11, fontWeight: '600' },

  emptyWrap:  { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40, flex: 1, justifyContent: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', marginBottom: 8 },
  emptySub:   { fontSize: 14, color: '#8B9BB4', textAlign: 'center' },
  discoverBtn: { marginTop: 20, backgroundColor: 'rgba(0,212,255,0.1)', borderWidth: 1, borderColor: '#00D4FF', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20 },
  discoverBtnText: { color: '#00D4FF', fontWeight: '700', fontSize: 14 },
});
