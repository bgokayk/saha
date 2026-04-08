import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { avatarColor, initials } from '../lib/utils';

export default function ChatListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [tab, setTab]         = useState('direct');
  const [convos, setConvos]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId]       = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setMyId(user.id);

    // Direkt mesajlar: gönderdiğim veya aldığım son mesajlar
    const { data: msgs } = await supabase
      .from('messages')
      .select('*, from_profile:profiles!messages_from_user_fkey(id, full_name), to_profile:profiles!messages_to_user_fkey(id, full_name)')
      .or(`from_user.eq.${user.id},to_user.eq.${user.id}`)
      .is('match_id', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!msgs) { setLoading(false); return; }

    // Her kullanıcı için tek konuşma
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
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function timeAgo(iso) {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso)) / 1000;
    if (diff < 60) return 'Şimdi';
    if (diff < 3600) return `${Math.floor(diff / 60)}d`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}s`;
    return `${Math.floor(diff / 86400)}g`;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mesajlar</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Tab */}
      <View style={styles.tabRow}>
        {['direct', 'match'].map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'direct' ? '💬 Direkt Mesajlar' : '⚽ Maç Chatleri'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#00A0D2" size="large" />
        </View>
      ) : tab === 'direct' ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          {convos.length === 0 ? (
            <EmptyChat label="Henüz direkt mesajın yok" sub="Oyuncu keşfet ve konuşma başlat!" />
          ) : (
            convos.map((c, i) => (
              <TouchableOpacity
                key={i}
                style={styles.convoRow}
                onPress={() => navigation.navigate('Chat', { otherId: c.otherId, otherName: c.otherName })}
              >
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

  if (loading) return <ActivityIndicator color="#00A0D2" style={{ marginTop: 40 }} />;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {matches.length === 0 ? (
        <EmptyChat label="Maç chatine katılmak için önce bir maça katıl" sub="Maçlar → Katıl" />
      ) : (
        matches.map((m, i) => (
          <TouchableOpacity
            key={i}
            style={styles.convoRow}
            onPress={() => navigation.navigate('Chat', { matchId: m.id, otherName: `${m.venues?.name || 'Saha'} Maçı`, isMatch: true })}
          >
            <View style={[styles.convoAvatar, { backgroundColor: '#001F5B' }]}>
              <Text style={styles.convoAvatarText}>⚽</Text>
            </View>
            <View style={styles.convoInfo}>
              <View style={styles.convoTopRow}>
                <Text style={styles.convoName}>{m.venues?.name || 'Maç Chati'}</Text>
                <View style={[styles.formatBadge]}>
                  <Text style={styles.formatText}>{m.format}</Text>
                </View>
              </View>
              <Text style={styles.convoMsg}>{new Date(m.match_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          </TouchableOpacity>
        ))
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function EmptyChat({ label, sub }) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={{ fontSize: 44, marginBottom: 12 }}>💬</Text>
      <Text style={styles.emptyTitle}>{label}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F9' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#001F5B', paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backText: { color: 'rgba(255,255,255,0.55)', fontSize: 14 },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },

  tabRow: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  tabBtn: { flex: 1, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: '#001F5B' },
  tabText: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },
  tabTextActive: { color: '#001F5B', fontWeight: '700' },

  convoRow: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F4F6F9', alignItems: 'center' },
  convoAvatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  convoAvatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  convoInfo: { flex: 1 },
  convoTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  convoName: { fontSize: 15, fontWeight: '700', color: '#001F5B' },
  convoTime: { fontSize: 11, color: '#94A3B8' },
  convoMsgRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convoMsg: { fontSize: 13, color: '#64748B', flex: 1 },
  unreadBadge: { backgroundColor: '#00A0D2', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  unreadText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  formatBadge: { backgroundColor: '#E8F4FB', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  formatText: { color: '#00A0D2', fontSize: 11, fontWeight: '600' },

  emptyWrap: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#001F5B', textAlign: 'center', marginBottom: 8 },
  emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },
});
