import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Animated, PanResponder,
  TouchableOpacity, Dimensions, SafeAreaView, StatusBar, Platform
} from 'react-native';
import { supabase } from '../lib/supabase';
import { calcRating, ratingColor, avatarColor, initials } from '../lib/utils';

const { width: W, height: H } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;
const CARD_W = W * 0.82;
const CARD_H = H * 0.60;

function haptic(type = 'light') {
  if (Platform.OS === 'web') return;
  try {
    const H2 = require('expo-haptics');
    if (type === 'success') H2.notificationAsync(H2.NotificationFeedbackType.Success);
    else H2.impactAsync(H2.ImpactFeedbackStyle.Light);
  } catch (_) {}
}

const POS_SHORT = { 'Kaleci': 'KAL', 'Defans': 'DEF', 'Orta Saha': 'ORT', 'Forvet': 'FOR' };

// ─── FIFA Kart: üst %60 renkli avatar, alt %40 panel ──────────────────────
function PlayerCard({ profile, style }) {
  const rating = calcRating(profile);
  const rColor = ratingColor(rating);
  const bgColor = avatarColor(profile.full_name);
  const posShort = POS_SHORT[profile.position] || 'OYN';

  const topH = CARD_H * 0.60;
  const botH = CARD_H * 0.40;

  return (
    <View style={[styles.card, { width: CARD_W, height: CARD_H }, style]}>
      {/* Üst %60: renkli avatar alanı */}
      <View style={[styles.cardTop, { height: topH, backgroundColor: bgColor }]}>
        {/* Sol üst: rating + pozisyon + bayrak */}
        <View style={styles.cardTopLeft}>
          <Text style={styles.cardRating}>{rating.toFixed(1)}</Text>
          <Text style={styles.cardPos}>{posShort}</Text>
          <Text style={styles.cardFlag}>🇹🇷</Text>
        </View>

        {/* Ortada büyük initials dairesi */}
        <View style={styles.bigCircle}>
          <Text style={styles.bigInitials}>{initials(profile.full_name)}</Text>
        </View>

        {/* Parlaklık efekti */}
        <View style={styles.cardShine} />
      </View>

      {/* Alt %40: beyaz panel */}
      <View style={[styles.cardBottom, { height: botH }]}>
        <Text style={[styles.cardName, { color: rColor }]} numberOfLines={1}>
          {(profile.full_name || '').toUpperCase()}
        </Text>
        <View style={[styles.divider, { backgroundColor: rColor }]} />
        <View style={styles.statsRow}>
          {[
            { label: 'MAÇ', val: profile.matches_played || 0 },
            { label: 'GOL', val: profile.goals || 0 },
            { label: 'ASİ', val: profile.assists || 0 },
          ].map((s, i) => (
            <View key={i} style={styles.statItem}>
              <Text style={[styles.statNum, { color: rColor }]}>{s.val}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Ana bileşen ────────────────────────────────────────────────────────────
export default function DiscoverScreen({ navigation }) {
  const [players, setPlayers]     = useState([]);
  const [index, setIndex]         = useState(0);
  const [filter, setFilter]       = useState('Tümü');
  const [loading, setLoading]     = useState(true);
  const [lastAction, setLastAction] = useState(null);
  const [myId, setMyId]           = useState(null);

  const position = useRef(new Animated.ValueXY()).current;
  const rotate   = position.x.interpolate({ inputRange: [-W, 0, W], outputRange: ['-15deg', '0deg', '15deg'] });
  const leftOpacity  = position.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });
  const rightOpacity = position.x.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });

  const filters = ['Tümü', 'Kaleci', 'Defans', 'Orta Saha', 'Forvet'];

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setMyId(user?.id || null);
    });
  }, []);

  useEffect(() => { fetchPlayers(); setIndex(0); }, [filter]);

  async function fetchPlayers() {
    setLoading(true);
    let q = supabase.from('profiles').select('*').order('matches_played', { ascending: false });
    if (filter !== 'Tümü') q = q.eq('position', filter);
    const { data } = await q.limit(20);
    setPlayers(data || []);
    setIndex(0);
    setLoading(false);
  }

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, g) => position.setValue({ x: g.dx, y: g.dy }),
    onPanResponderRelease: (_, g) => {
      if (g.dx > SWIPE_THRESHOLD) swipeRight();
      else if (g.dx < -SWIPE_THRESHOLD) swipeLeft();
      else Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
    },
  });

  function swipeLeft() {
    haptic();
    setLastAction('gec');
    Animated.timing(position, { toValue: { x: -W * 1.5, y: 0 }, duration: 300, useNativeDriver: false }).start(() => {
      position.setValue({ x: 0, y: 0 });
      setIndex(i => i + 1);
      setTimeout(() => setLastAction(null), 600);
    });
  }

  function swipeRight() {
    haptic('success');
    setLastAction('davet');

    const current = players[index];
    if (myId && current) {
      supabase.from('match_invites').insert({
        from_user: myId,
        to_user: current.id,
        status: 'pending',
      }).then(({ error }) => {
        if (error) console.warn('match_invites:', error.message);
      });
    }

    Animated.timing(position, { toValue: { x: W * 1.5, y: 0 }, duration: 300, useNativeDriver: false }).start(() => {
      position.setValue({ x: 0, y: 0 });
      setIndex(i => i + 1);
      setTimeout(() => setLastAction(null), 600);
    });
  }

  const current = players[index];
  const next1   = players[index + 1];
  const next2   = players[index + 2];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#001F5B" />

      {/* Header */}
      <View style={styles.header}>
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
          <View style={[styles.emptyCard, { backgroundColor: '#111827' }]}>
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
                <PlayerCard profile={next2} />
              </View>
            )}
            {next1 && (
              <View style={[styles.stackCard, { transform: [{ scale: 0.94 }, { translateY: -11 }], zIndex: 2 }]}>
                <PlayerCard profile={next1} />
              </View>
            )}

            {/* Öndeki kart (swipeable) */}
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
              <PlayerCard profile={current} />
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
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.btnSkip} onPress={swipeLeft}>
            <Text style={styles.btnIcon}>✗</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSuper} onPress={() => { haptic('success'); swipeRight(); }}>
            <Text style={styles.btnIcon}>⭐</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnInvite} onPress={swipeRight}>
            <Text style={styles.btnIcon}>✓</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0F1E' },

  header: {
    backgroundColor: '#001F5B',
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backText:    { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  countText:   { color: '#00A0D2', fontSize: 13 },

  filterWrap: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  filterBtn:  { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  filterBtnActive: { backgroundColor: '#00A0D2', borderColor: '#00A0D2' },
  filterText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: '#fff' },

  // Kart alanı
  cardArea:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stackCard: { position: 'absolute' },

  // Oyuncu kartı
  card:      { borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 16 },

  // Üst renkli alan
  cardTop:     { justifyContent: 'center', alignItems: 'center', position: 'relative' },
  cardTopLeft: { position: 'absolute', top: 16, left: 20 },
  cardRating:  { color: '#fff', fontSize: 48, fontWeight: '900', lineHeight: 52 },
  cardPos:     { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  cardFlag:    { fontSize: 18, textAlign: 'center', marginTop: 4 },
  cardShine:   { position: 'absolute', top: 0, right: 0, width: 120, height: 120, borderBottomLeftRadius: 120, backgroundColor: 'rgba(255,255,255,0.07)' },

  bigCircle:   { width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 3, borderColor: 'rgba(255,255,255,0.35)', justifyContent: 'center', alignItems: 'center' },
  bigInitials: { color: '#fff', fontSize: 54, fontWeight: '900' },

  // Alt beyaz panel
  cardBottom: { backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20 },
  cardName:   { fontSize: 20, fontWeight: '900', letterSpacing: 2, textAlign: 'center' },
  divider:    { height: 2, width: 40, borderRadius: 2, marginVertical: 10, opacity: 0.5 },
  statsRow:   { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
  statItem:   { alignItems: 'center' },
  statNum:    { fontSize: 24, fontWeight: '900' },
  statLabel:  { color: '#94A3B8', fontSize: 11, fontWeight: '700', marginTop: 2 },

  // Overlay
  overlayLeft:      { position: 'absolute', inset: 0, borderRadius: 20, zIndex: 20, backgroundColor: 'rgba(239,68,68,0.75)', justifyContent: 'center', alignItems: 'center' },
  overlayRight:     { position: 'absolute', inset: 0, borderRadius: 20, zIndex: 20, backgroundColor: 'rgba(16,185,129,0.75)', justifyContent: 'center', alignItems: 'center' },
  overlayTextLeft:  { color: '#fff', fontSize: 40, fontWeight: '900', transform: [{ rotate: '-20deg' }] },
  overlayTextRight: { color: '#fff', fontSize: 40, fontWeight: '900', transform: [{ rotate: '20deg' }] },

  // Butonlar
  actionRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20, paddingBottom: 30, paddingTop: 16 },
  btnSkip:   { width: 62, height: 62, borderRadius: 31, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', shadowColor: '#EF4444', shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
  btnSuper:  { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F59E0B', justifyContent: 'center', alignItems: 'center' },
  btnInvite: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', shadowColor: '#10B981', shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
  btnIcon:   { color: '#fff', fontSize: 24, fontWeight: '900' },

  // Toast
  toast:      { position: 'absolute', top: 140, alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 30 },
  toastGreen: { backgroundColor: '#10B981' },
  toastRed:   { backgroundColor: '#EF4444' },
  toastText:  { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Boş
  emptyCard:  { width: CARD_W, height: CARD_H, borderRadius: 20, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyEmoji: { fontSize: 60 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  emptySub:   { color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center' },
  reloadBtn:  { backgroundColor: '#00A0D2', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  reloadText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
