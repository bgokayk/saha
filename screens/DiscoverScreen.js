import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Animated, PanResponder,
  TouchableOpacity, Dimensions, SafeAreaView, StatusBar, Platform, Image,
  useWindowDimensions, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { calcRating, ratingColor, avatarColor, initials } from '../lib/utils';

const SWIPE_THRESHOLD = 80;

function haptic(type = 'light') {
  if (Platform.OS === 'web') return;
  try {
    const H2 = require('expo-haptics');
    if (type === 'success') H2.notificationAsync(H2.NotificationFeedbackType.Success);
    else H2.impactAsync(H2.ImpactFeedbackStyle.Light);
  } catch (_) {}
}

const POS_SHORT = { 'Kaleci': 'KAL', 'Defans': 'DEF', 'Orta Saha': 'ORT', 'Forvet': 'FOR' };

function cardBg(rating) {
  if (rating >= 8.5) return '#1A0F00';
  if (rating >= 7.0) return '#001A10';
  if (rating >= 5.5) return '#001020';
  return '#1A0008';
}

function PlayerCard({ profile, style, cardW, cardH }) {
  const rating  = calcRating(profile);
  const rColor  = ratingColor(rating);
  const bgColor = avatarColor(profile.full_name);
  const posShort = POS_SHORT[profile.position] || 'OYN';
  const topH = cardH * 0.60;
  const botH = cardH * 0.40;

  return (
    <View style={[styles.card, { width: cardW, height: cardH, borderColor: rColor }, style]}>
      {/* Üst: renkli avatar alanı */}
      <View style={[styles.cardTop, { height: topH, backgroundColor: bgColor }]}>
        <View style={styles.cardTopLeft}>
          <Text style={[styles.cardRating, { color: rColor }]}>{rating.toFixed(1)}</Text>
          <Text style={[styles.cardPos, { color: rColor }]}>{posShort}</Text>
          <Text style={styles.cardFlag}>🇹🇷</Text>
        </View>
        <View style={[styles.bigCircle, { borderColor: rColor }]}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.bigAvatarImg} />
          ) : (
            <Text style={styles.bigInitials}>{initials(profile.full_name)}</Text>
          )}
        </View>
        <View style={styles.cardShine} />
      </View>

      {/* Alt: dark panel */}
      <View style={[styles.cardBottom, { height: botH, backgroundColor: cardBg(rating) }]}>
        <View style={[styles.divider, { backgroundColor: rColor }]} />
        <Text style={[styles.cardName, { color: rColor }]} numberOfLines={1}>
          {(profile.full_name || '').toUpperCase()}
        </Text>
        <View style={styles.statsRow}>
          {[
            { label: 'MAÇ', val: profile.matches_played || 0 },
            { label: 'GOL', val: profile.goals || 0 },
            { label: 'ASİ', val: profile.assists || 0 },
          ].map((s, i) => (
            <View key={i} style={styles.statItem}>
              {i > 0 && <View style={styles.statSep} />}
              <Text style={[styles.statNum, { color: rColor }]}>{s.val}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export default function DiscoverScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const CARD_W = W * 0.82;
  const CARD_H = H * 0.60;

  const [players, setPlayers]       = useState([]);
  const [index, setIndex]           = useState(0);
  const [filter, setFilter]         = useState('Tümü');
  const [loading, setLoading]       = useState(true);
  const [lastAction, setLastAction] = useState(null);
  const [myId, setMyId]             = useState(null);

  const position     = useRef(new Animated.ValueXY()).current;
  const rotate       = position.x.interpolate({ inputRange: [-W, 0, W], outputRange: ['-15deg', '0deg', '15deg'] });
  const leftOpacity  = position.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });
  const rightOpacity = position.x.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });

  const filters = ['Tümü', 'Kaleci', 'Defans', 'Orta Saha', 'Forvet'];

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setMyId(user?.id || null));
  }, []);

  useEffect(() => { fetchPlayers(); }, [filter, myId]);

  async function fetchPlayers() {
    setLoading(true);
    try {
      let q = supabase.from('profiles').select('*').order('matches_played', { ascending: false });
      if (filter !== 'Tümü') q = q.eq('position', filter);
      if (myId) q = q.neq('id', myId);
      const { data } = await q.limit(20);
      setPlayers(data || []);
      setIndex(0);
    } catch (err) {
      Alert.alert('Hata', 'Oyuncular yüklenirken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  }

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, g) => position.setValue({ x: g.dx, y: g.dy }),
    onPanResponderRelease: (_, g) => {
      if (g.dx > SWIPE_THRESHOLD) swipeRight();
      else if (g.dx < -SWIPE_THRESHOLD) swipeLeft();
      else Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
    },
  })).current;

  function swipeLeft() {
    haptic();
    setLastAction('gec');
    Animated.timing(position, { toValue: { x: -W * 1.5, y: 0 }, duration: 300, useNativeDriver: false }).start(() => {
      position.setValue({ x: 0, y: 0 });
      setIndex(i => i + 1);
      setTimeout(() => setLastAction(null), 1500);
    });
  }

  function swipeRight() {
    haptic('success');
    setLastAction('davet');
    const current = players[index];
    if (myId && current) {
      supabase.from('match_invites').insert({ from_user: myId, to_user: current.id, status: 'pending' })
        .then(({ error }) => { if (error) Alert.alert('Davet Gönderilemedi', error.message); });
    }
    Animated.timing(position, { toValue: { x: W * 1.5, y: 0 }, duration: 300, useNativeDriver: false }).start(() => {
      position.setValue({ x: 0, y: 0 });
      setIndex(i => i + 1);
      setTimeout(() => setLastAction(null), 1500);
    });
  }

  const current = players[index];
  const next1   = players[index + 1];
  const next2   = players[index + 2];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A1628" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Oyuncu Bul</Text>
        <Text style={styles.countText}>{Math.max(0, players.length - index)} oyuncu</Text>
      </View>

      {/* Filtreler */}
      <View style={styles.filterWrap}>
        {filters.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Kart Alanı */}
      <View style={styles.cardArea}>
        {loading ? (
          <View style={[styles.emptyCard, { backgroundColor: '#0F1E35', borderColor: 'rgba(0,212,255,0.15)' }]}>
            <Text style={styles.emptyTitle}>Yükleniyor...</Text>
          </View>
        ) : !current ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>😴</Text>
            <Text style={styles.emptyTitle}>Bugünlük hepsi bu!</Text>
            <Text style={styles.emptySub}>Yeni oyuncular için yarın tekrar gel</Text>
            <TouchableOpacity style={styles.reloadBtn} onPress={fetchPlayers}>
              <Text style={styles.reloadText}>Yenile</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {next2 && (
              <View style={[styles.stackCard, { transform: [{ scale: 0.88 }, { translateY: -22 }], zIndex: 1 }]}>
                <PlayerCard profile={next2} cardW={CARD_W} cardH={CARD_H} />
              </View>
            )}
            {next1 && (
              <View style={[styles.stackCard, { transform: [{ scale: 0.94 }, { translateY: -11 }], zIndex: 2 }]}>
                <PlayerCard profile={next1} cardW={CARD_W} cardH={CARD_H} />
              </View>
            )}
            <Animated.View
              style={[styles.stackCard, {
                zIndex: 10,
                transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }],
              }]}
              {...panResponder.panHandlers}
            >
              <Animated.View style={[styles.overlayLeft, { opacity: leftOpacity }]}>
                <Text style={styles.overlayTextLeft}>GEÇ ✗</Text>
              </Animated.View>
              <Animated.View style={[styles.overlayRight, { opacity: rightOpacity }]}>
                <Text style={styles.overlayTextRight}>DAVET ✓</Text>
              </Animated.View>
              <PlayerCard profile={current} cardW={CARD_W} cardH={CARD_H} />
            </Animated.View>
          </>
        )}
      </View>

      {/* Toast */}
      {lastAction && (
        <View style={[styles.toast, lastAction === 'davet' ? styles.toastGreen : styles.toastRed]}>
          <Text style={styles.toastText}>
            {lastAction === 'davet' ? '🎉 Davet Gönderildi!' : '👋 Geçildi'}
          </Text>
        </View>
      )}

      {/* Alt butonlar */}
      {current && !loading && (
        <View style={[styles.actionRow, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity style={styles.btnSkip} onPress={swipeLeft}>
            <Text style={styles.btnIcon}>✗</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSuper} onPress={() => { haptic('success'); swipeRight(); }}>
            <Text style={styles.btnIconSm}>⭐</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnInvite} onPress={swipeRight}>
            <Text style={styles.btnIcon}>✓</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1628' },

  header: {
    backgroundColor: '#0A1628',
    paddingBottom: 14, paddingHorizontal: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,212,255,0.12)',
  },
  backText:    { color: 'rgba(255,255,255,0.45)', fontSize: 14 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  countText:   { color: '#00D4FF', fontSize: 13 },

  filterWrap: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  filterBtn:  {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(0,212,255,0.2)',
  },
  filterBtnActive: { backgroundColor: 'rgba(0,212,255,0.12)', borderColor: '#00D4FF' },
  filterText:      { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600' },
  filterTextActive:{ color: '#00D4FF', fontWeight: '700' },

  cardArea:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stackCard: { position: 'absolute' },

  card: { borderRadius: 20, overflow: 'hidden', borderWidth: 2, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 16 },

  cardTop:     { justifyContent: 'center', alignItems: 'center', position: 'relative' },
  cardTopLeft: { position: 'absolute', top: 16, left: 20 },
  cardRating:  { fontSize: 44, fontWeight: '900', lineHeight: 48 },
  cardPos:     { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  cardFlag:    { fontSize: 18, marginTop: 4 },
  cardShine:   { position: 'absolute', top: 0, right: 0, width: 120, height: 120, borderBottomLeftRadius: 120, backgroundColor: 'rgba(255,255,255,0.05)' },

  bigCircle:    { width: 120, height: 120, borderRadius: 60, borderWidth: 2.5, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  bigInitials:  { color: '#fff', fontSize: 42, fontWeight: '900' },
  bigAvatarImg: { width: 120, height: 120, borderRadius: 60 },

  cardBottom: { justifyContent: 'center', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20 },
  divider:    { height: 2, width: 40, borderRadius: 2, marginBottom: 8, opacity: 0.6 },
  cardName:   { fontSize: 20, fontWeight: '900', letterSpacing: 2, textAlign: 'center', marginBottom: 10 },
  statsRow:   { flexDirection: 'row', justifyContent: 'center', gap: 0 },
  statItem:   { alignItems: 'center', flexDirection: 'row', gap: 6 },
  statSep:    { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 12 },
  statNum:    { fontSize: 22, fontWeight: '900' },
  statLabel:  { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '700' },

  overlayLeft:      { position: 'absolute', inset: 0, borderRadius: 20, zIndex: 20, backgroundColor: 'rgba(255,71,87,0.8)', justifyContent: 'center', alignItems: 'center' },
  overlayRight:     { position: 'absolute', inset: 0, borderRadius: 20, zIndex: 20, backgroundColor: 'rgba(0,224,150,0.8)', justifyContent: 'center', alignItems: 'center' },
  overlayTextLeft:  { color: '#fff', fontSize: 44, fontWeight: '900', transform: [{ rotate: '-20deg' }] },
  overlayTextRight: { color: '#fff', fontSize: 44, fontWeight: '900', transform: [{ rotate: '20deg' }] },

  actionRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20, paddingTop: 16 },
  btnSkip:   { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FF4757', justifyContent: 'center', alignItems: 'center', shadowColor: '#FF4757', shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
  btnSuper:  { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFB800', justifyContent: 'center', alignItems: 'center' },
  btnInvite: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#00E096', justifyContent: 'center', alignItems: 'center', shadowColor: '#00E096', shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
  btnIcon:   { color: '#fff', fontSize: 26, fontWeight: '900' },
  btnIconSm: { color: '#0A1628', fontSize: 20, fontWeight: '900' },

  toast:      { position: 'absolute', top: 140, alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 30 },
  toastGreen: { backgroundColor: '#00E096' },
  toastRed:   { backgroundColor: '#FF4757' },
  toastText:  { color: '#fff', fontWeight: '800', fontSize: 15 },

  emptyCard:   { width: Dimensions.get('window').width * 0.82, height: Dimensions.get('window').height * 0.42, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F1E35', borderWidth: 1, borderColor: 'rgba(0,212,255,0.12)', gap: 12 },
  emptyEmoji:  { fontSize: 48 },
  emptyTitle:  { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  emptySub:    { color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },
  reloadBtn:   { backgroundColor: '#00D4FF', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10, marginTop: 4 },
  reloadText:  { color: '#0A1628', fontWeight: '800', fontSize: 14 },
});
