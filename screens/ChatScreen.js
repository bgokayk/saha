import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert
} from 'react-native';
import { useEffect, useRef, useState, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

export default function ChatScreen({ navigation, route }) {
  const params = route?.params || {};
  const otherId = params.otherId ?? null;
  const otherName = params.otherName ?? 'Sohbet';
  const matchId = params.matchId ?? null;
  const isMatch = params.isMatch ?? false;
  const insets      = useSafeAreaInsets();
  const scrollRef   = useRef(null);
  const [messages, setMessages] = useState([]);
  const [text, setText]         = useState('');
  const [myId, setMyId]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);

  useEffect(() => {
    let sub;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMyId(user.id);

      // İlk yükleme
      await loadMessages(user.id);

      // Gerçek zamanlı
      const channel = isMatch
        ? supabase.channel(`match-chat-${matchId}`)
        : supabase.channel(`dm-${[user.id, otherId].sort().join('-')}`);

      sub = channel
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: isMatch
            ? `match_id=eq.${matchId}`
            : `from_user=eq.${otherId}`,
        }, (payload) => {
          setMessages(prev => {
            if (prev.some(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        })
        .subscribe();
    })();

    return () => { if (sub) supabase.removeChannel(sub); };
  // otherId/matchId değişirse yeni subscription kur
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherId, matchId, isMatch]);

  async function loadMessages(uid) {
    let query = supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(100);

    if (isMatch) {
      query = query.eq('match_id', matchId);
    } else {
      query = query.or(
        `and(from_user.eq.${uid},to_user.eq.${otherId}),and(from_user.eq.${otherId},to_user.eq.${uid})`
      ).is('match_id', null);
    }

    const { data } = await query;
    setMessages(data || []);
    setLoading(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);

    // Mark incoming messages as read
    if (!isMatch && otherId) {
      supabase.from('messages')
        .update({ read: true })
        .eq('from_user', otherId)
        .eq('to_user', uid)
        .eq('read', false)
        .then(() => {});
    }
  }

  async function sendMessage() {
    if (!text.trim() || !myId || sending) return;
    setSending(true);
    const content = text.trim();
    setText('');

    const payload = {
      from_user: myId,
      content,
      read: false,
    };
    if (isMatch) {
      payload.match_id = matchId;
      payload.to_user = myId; // maç chatinde herkes
    } else {
      payload.to_user = otherId;
    }

    const { data, error } = await supabase.from('messages').insert(payload).select().single();
    if (error) {
      setText(content);
      Alert.alert('Hata', 'Mesaj gönderilemedi, lütfen tekrar dene.');
    } else if (data) {
      setMessages(prev => {
        if (prev.some(m => m.id === data.id)) return prev;
        return [...prev, data];
      });
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
    setSending(false);
  }

  function formatTime(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDay(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  }

  // Mesajları gün gruplarına böl
  const grouped = useMemo(() => {
    const result = [];
    let lastDay = null;
    for (const m of messages) {
      const day = new Date(m.created_at).toDateString();
      if (day !== lastDay) {
        result.push({ type: 'divider', day: m.created_at });
        lastDay = day;
      }
      result.push({ type: 'msg', ...m });
    }
    return result;
  }, [messages]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.headerAvatar, { backgroundColor: isMatch ? '#0F1E35' : '#00D4FF' }]}>
            <Text style={styles.headerAvatarText}>{isMatch ? '⚽' : (otherName?.[0] || '?')}</Text>
          </View>
          <Text style={styles.headerName} numberOfLines={1}>{otherName || 'Sohbet'}</Text>
        </View>
        <View style={{ width: 50 }} />
      </View>

      {/* Mesajlar */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#00D4FF" size="large" />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.msgList}
          contentContainerStyle={styles.msgContent}
          showsVerticalScrollIndicator={false}
        >
          {grouped.length === 0 && (
            <View style={styles.emptyChat}>
              <Text style={{ fontSize: 36, marginBottom: 12 }}>💬</Text>
              <Text style={styles.emptyChatText}>Konuşmayı sen başlat!</Text>
              {isMatch && <Text style={styles.emptyChatSub}>Bugün {new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} maçına hazır mısın? 💪</Text>}
            </View>
          )}
          {grouped.map((item, i) => {
            if (item.type === 'divider') {
              return (
                <View key={`d-${i}`} style={styles.dayDivider}>
                  <View style={styles.dayLine} />
                  <Text style={styles.dayText}>{formatDay(item.day)}</Text>
                  <View style={styles.dayLine} />
                </View>
              );
            }
            const isMe = item.from_user === myId;
            return (
              <View key={item.id || i} style={[styles.msgRow, isMe && styles.msgRowMe]}>
                <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                  <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.content}</Text>
                  <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>{formatTime(item.created_at)}</Text>
                </View>
              </View>
            );
          })}
          <View style={{ height: 10 }} />
        </ScrollView>
      )}

      {/* Input */}
      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={isMatch ? "Maç chatine yaz..." : "Mesaj yaz..."}
          placeholderTextColor="#94A3B8"
          multiline
          maxLength={500}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!text.trim() || sending}
        >
          {sending
            ? <ActivityIndicator color="#FFFFFF" size="small" />
            : <Text style={styles.sendBtnText}>↑</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1628' },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    backgroundColor: '#0A1628', paddingBottom: 14, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,212,255,0.12)',
  },
  backText:        { color: 'rgba(255,255,255,0.45)', fontSize: 14, minWidth: 50 },
  headerCenter:    { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'center' },
  headerAvatar:    { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  headerAvatarText:{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  headerName:      { color: '#FFFFFF', fontSize: 16, fontWeight: '700', maxWidth: 160 },

  msgList:    { flex: 1 },
  msgContent: { paddingHorizontal: 16, paddingTop: 16 },

  emptyChat:    { alignItems: 'center', paddingTop: 60 },
  emptyChatText:{ fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 6 },
  emptyChatSub: { fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', paddingHorizontal: 20 },

  dayDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 12, gap: 10 },
  dayLine:    { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  dayText:    { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: '600' },

  msgRow:   { flexDirection: 'row', marginBottom: 4, justifyContent: 'flex-start' },
  msgRowMe: { justifyContent: 'flex-end' },

  bubble:      { maxWidth: '75%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleThem:  { backgroundColor: '#0F1E35', borderWidth: 1, borderColor: 'rgba(0,212,255,0.15)', borderBottomLeftRadius: 4 },
  bubbleMe:    { backgroundColor: 'rgba(0,212,255,0.15)', borderWidth: 1, borderColor: 'rgba(0,212,255,0.3)', borderBottomRightRadius: 4 },
  bubbleText:  { fontSize: 14, color: '#FFFFFF', lineHeight: 20 },
  bubbleTextMe:{ color: '#FFFFFF' },
  bubbleTime:  { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4, textAlign: 'right' },
  bubbleTimeMe:{ color: 'rgba(0,212,255,0.6)' },

  inputBar:        { backgroundColor: '#0A1628', flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,212,255,0.12)', alignItems: 'flex-end', gap: 10 },
  input:           { flex: 1, backgroundColor: '#0F1E35', borderRadius: 22, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 14, color: '#FFFFFF', maxHeight: 100, borderWidth: 1, borderColor: 'rgba(0,212,255,0.2)' },
  sendBtn:         { width: 44, height: 44, borderRadius: 22, backgroundColor: '#00D4FF', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.1)' },
  sendBtnText:     { color: '#0A1628', fontSize: 20, fontWeight: '800', marginTop: -2 },
});
