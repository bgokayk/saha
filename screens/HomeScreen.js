import {
  View, Text, StyleSheet, ScrollView, FlatList,
  TouchableOpacity, ActivityIndicator, Platform, Alert, Animated
} from 'react-native';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { avatarColor, initials, calcRating, ratingColor } from '../lib/utils';
import { useNotifications } from '../context/NotificationContext';

function haptic(type = 'light') {
  if (Platform.OS === 'web') return;
  try {
    const H = require('expo-haptics');
    if (type === 'selection') H.selectionAsync();
    else if (type === 'success') H.notificationAsync(H.NotificationFeedbackType.Success);
    else H.impactAsync(H.ImpactFeedbackStyle.Light);
  } catch (_) {}
}

const FORMAT_COLORS = {
  '5v5': '#3B82F6', '6v6': '#8B5CF6', '7v7': '#10B981', '8v8': '#F59E0B', '11v11': '#EF4444',
};

function hoursFromNow(iso) {
  if (!iso) return null;
  const h = Math.round((new Date(iso) - new Date()) / 3600000);
  if (h < 0) return null;
  if (h === 0) return 'Az sonra';
  if (h < 24) return `${h} saat sonra`;
  return `${Math.round(h / 24)} gün sonra`;
}

function MatchCard({ match, onPress }) {
  const maxP = match.max_players ?? 10;
  const curP = match.current_players ?? 0;
  const ratio = maxP ? Math.min(curP / maxP, 1) : 0;
  const fmtColor = FORMAT_COLORS[match.format] || '#3B82F6';
  const barColor = ratio >= 0.9 ? '#FF4757' : ratio >= 0.6 ? '#FFB800' : '#00E096';
  const timeLabel = hoursFromNow(match.match_date);

  return (
    <TouchableOpacity style={styles.matchCard} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.matchStrip, { backgroundColor: fmtColor }]} />
      <View style={styles.matchBody}>
        <View style={styles.matchTop}>
          <View style={[styles.fmtBadge, { backgroundColor: fmtColor + '22' }]}>
            <Text style={[styles.fmtBadgeText, { color: fmtColor }]}>{match.format || '5v5'}</Text>
          </View>
          {timeLabel && <Text style={styles.matchTime}>{timeLabel}</Text>}
        </View>
        <Text style={styles.matchVenue} numberOfLines={1}>{match.venues?.name || 'Saha'}</Text>
        <Text style={styles.matchDistrict}>📍 {match.venues?.district || 'Bursa'}</Text>
        <View style={styles.matchBarBg}>
          <View style={[styles.matchBarFg, { width: `${ratio * 100}%`, backgroundColor: barColor }]} />
        </View>
        <Text style={styles.matchCount}>{curP}/{maxP} oyuncu</Text>
        <View style={[styles.joinBtn, { backgroundColor: fmtColor }]}>
          <Text style={styles.joinBtnText}>Detay →</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function SeekingCard({ match, onApply }) {
  const fmtColor = FORMAT_COLORS[match.format] || '#3B82F6';
  return (
    <View style={styles.seekingCard}>
      <View style={[styles.seekingCardStrip, { backgroundColor: '#FFB800' }]} />
      <View style={styles.seekingCardBody}>
        <Text style={styles.seekingCardVenue} numberOfLines={1}>{match.venues?.name || 'Saha'}</Text>
        <View style={[styles.seekingCardFmt, { backgroundColor: fmtColor + '22' }]}>
          <Text style={[styles.seekingCardFmtText, { color: fmtColor }]}>{match.format || '5v5'}</Text>
        </View>
        <View style={styles.seekingCardPositions}>
          {(match.needed_positions || []).slice(0, 3).map(pos => (
            <View key={pos} style={styles.seekingPosBadge}>
              <Text style={styles.seekingPosBadgeText}>{pos}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={styles.seekingCardBtn} onPress={onApply}>
          <Text style={styles.seekingCardBtnText}>Başvur →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const VENUE_COLORS = ['#0D1F3C', '#1A0F3C', '#0F2A1A', '#2A0F1A', '#1A2A0F', '#0F1A2A'];

function VenueCard({ venue, onPress }) {
  const bg = VENUE_COLORS[venue.name?.charCodeAt(0) % VENUE_COLORS.length] || '#0D1F3C';
  return (
    <TouchableOpacity style={styles.venueCard} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.venueCardTop, { backgroundColor: bg }]}>
        <Text style={styles.venueCardEmoji}>🏟️</Text>
        {venue.rating && (
          <View style={styles.venueCardRating}>
            <Text style={styles.venueCardRatingText}>⭐ {Number(venue.rating).toFixed(1)}</Text>
          </View>
        )}
      </View>
      <View style={styles.venueCardBody}>
        <Text style={styles.venueCardName} numberOfLines={1}>{venue.name}</Text>
        <Text style={styles.venueCardDistrict} numberOfLines={1}>📍 {venue.district || venue.city || 'Bursa'}</Text>
        <Text style={styles.venueCardPrice}>{venue.price_per_hour || '—'}₺/sa</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotifications();
  const [profile, setProfile]   = useState(null);
  const [matches, setMatches]   = useState([]);
  const [venues,  setVenues]    = useState([]);
  const [seekingMatches, setSeekingMatches] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const xpAnim = useRef(new Animated.Value(0)).current;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setProfile(prof);
      }
      const [{ data: matchData }, { data: venueData }, { data: seekingData }] = await Promise.all([
        supabase.from('matches').select('*, venues(name, district, city)').eq('status', 'open').order('match_date', { ascending: true }).limit(8),
        supabase.from('venues').select('*').order('rating', { ascending: false }).limit(6),
        supabase.from('matches').select('*, venues(name, district, city)').eq('status', 'open').eq('is_seeking_players', true).order('match_date', { ascending: true }).limit(3),
      ]);
      setMatches(matchData || []);
      setVenues(venueData || []);
      setSeekingMatches(seekingData || []);
    } catch (err) {
      console.warn('fetchData error:', err);
      Alert.alert('Hata', 'Veriler yüklenirken bir sorun oluştu.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!profile) return;
    const xpPct = Math.min((profile.matches_played || 0) % 10 / 10, 1);
    Animated.timing(xpAnim, { toValue: xpPct, duration: 1000, useNativeDriver: false }).start();
  }, [profile]);

  const displayName = profile?.full_name || 'Oyuncu';
  const firstName   = displayName.split(' ')[0];
  const rating      = profile ? calcRating(profile) : 5.0;
  const rColor      = ratingColor(rating);
  const matchesLeft = 10 - ((profile?.matches_played || 0) % 10);

  const STATS = [
    { val: profile?.matches_played ?? 0, label: 'MAÇ' },
    { val: profile?.goals ?? 0,          label: 'GOL' },
    { val: profile?.assists ?? 0,        label: 'ASİST' },
    { val: rating.toFixed(1),            label: 'RATING', color: rColor },
  ];

  const QUICK_ACTIONS = [
    { emoji: '⚽', title: 'Maç Kur',    desc: 'Hemen başlat',  color: '#00D4FF', screen: 'CreateMatch' },
    { emoji: '🔍', title: 'Maç Bul',    desc: 'Açık maçlar',   color: '#00E096', screen: 'MatchList'   },
    { emoji: '👥', title: 'Oyuncu Bul', desc: 'Swipe & davet', color: '#8B5CF6', screen: 'Discover'    },
    { emoji: '🛒', title: 'Market',     desc: 'Ekipman al',    color: '#FFB800', screen: 'Market'      },
  ];

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={[styles.avatarCircle, { backgroundColor: avatarColor(displayName) }]}
          onPress={() => navigation.navigate('Profile')}
        >
          <Text style={styles.avatarText}>{initials(displayName)}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.greeting}>Merhaba, {firstName} 👋</Text>
          <Text style={styles.subtitle}>Bugün maç var mı?</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.navigate('ChatList')}>
            <Text style={styles.headerIconTxt}>💬</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.navigate('Notifications')}>
            <Text style={styles.headerIconTxt}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Stat Bar ── */}
      <View style={styles.statBar}>
        {STATS.map((s, i) => (
          <View key={i} style={styles.statItem}>
            {i > 0 && <View style={styles.statDivider} />}
            <Text style={[styles.statNum, s.color ? { color: s.color } : {}]}>{s.val}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* ── XP Bar ── */}
      <View style={styles.xpWrap}>
        <View style={styles.xpBg}>
          <Animated.View style={[styles.xpFill, {
            width: xpAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
          }]} />
        </View>
        <Text style={styles.xpText}>Amatör → Pro: {matchesLeft} maç kaldı</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Hızlı Aksiyonlar ── */}
        <Text style={styles.sectionTitle}>Hızlı Aksiyonlar</Text>
        <View style={styles.qaGrid}>
          {QUICK_ACTIONS.map((qa, i) => (
            <TouchableOpacity
              key={i}
              style={styles.qaCard}
              onPress={() => { haptic(); navigation.navigate(qa.screen); }}
              activeOpacity={0.85}
            >
              <View style={[styles.qaEmojiWrap, { backgroundColor: qa.color + '20' }]}>
                <Text style={styles.qaEmoji}>{qa.emoji}</Text>
              </View>
              <View style={styles.qaTextWrap}>
                <Text style={styles.qaTitle}>{qa.title}</Text>
                <Text style={styles.qaDesc}>{qa.desc}</Text>
              </View>
              <Text style={styles.qaArrow}>→</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Yakın Maçlar ── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>⚡ YAKIN MAÇLAR</Text>
          <TouchableOpacity onPress={() => navigation.navigate('MatchList')}>
            <Text style={styles.seeAll}>Tümü →</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color="#00D4FF" style={{ marginLeft: 20, marginBottom: 12 }} />
        ) : matches.length === 0 ? (
          <View style={styles.emptyHorizontal}>
            <Text style={styles.emptyText}>⚽ Açık maç yok</Text>
            <TouchableOpacity onPress={() => navigation.navigate('CreateMatch')}>
              <Text style={styles.emptyAction}>İlk maçı sen kur →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={matches}
            keyExtractor={item => item.id?.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.matchScroll}
            renderItem={({ item }) => (
              <MatchCard
                match={item}
                onPress={() => navigation.navigate('MatchDetail', { matchId: item.id })}
              />
            )}
          />
        )}

        {/* ── Oyuncu Aranıyor ── */}
        {seekingMatches.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>⚡ OYUNCU ARANIYOR</Text>
              <TouchableOpacity onPress={() => navigation.navigate('MatchList')}>
                <Text style={styles.seeAll}>Tümü →</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={seekingMatches}
              keyExtractor={item => item.id?.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.matchScroll}
              renderItem={({ item }) => (
                <SeekingCard
                  match={item}
                  onApply={() => navigation.navigate('MatchList')}
                />
              )}
            />
          </>
        )}

        {/* ── Bursa Sahaları ── */}
        {venues.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>🏟️ BURSA SAHALARI</Text>
              <TouchableOpacity onPress={() => navigation.navigate('CreateMatch')}>
                <Text style={styles.seeAll}>Tümü →</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={venues}
              keyExtractor={item => item.id?.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.matchScroll}
              renderItem={({ item }) => (
                <VenueCard
                  venue={item}
                  onPress={() => navigation.navigate('VenueDetail', { venueId: item.id, venue: item })}
                />
              )}
            />
          </>
        )}

        <View style={{ height: Math.max(insets.bottom, 12) + 90 }} />
      </ScrollView>

      {/* ── Tab Bar ── */}
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {[
          { key: 'home',     icon: '🏠', label: 'Ana',    screen: 'Home'     },
          { key: 'discover', icon: '🔍', label: 'Keşfet', screen: 'Discover' },
          { key: 'fab',      icon: '+',  label: '',        screen: 'CreateMatch', isFab: true },
          { key: 'matches',  icon: '📋', label: 'Maçlar', screen: 'MatchList' },
          { key: 'profile',  icon: '👤', label: 'Profil', screen: 'Profile'  },
        ].map(tab => {
          if (tab.isFab) {
            return (
              <TouchableOpacity
                key="fab"
                style={styles.fab}
                onPress={() => { haptic('success'); navigation.navigate('CreateMatch'); }}
                activeOpacity={0.85}
              >
                <Text style={styles.fabText}>+</Text>
              </TouchableOpacity>
            );
          }
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              onPress={() => {
                haptic('selection');
                setActiveTab(tab.key);
                if (tab.screen !== 'Home') navigation.navigate(tab.screen);
              }}
            >
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1628' },

  header: {
    backgroundColor: '#0A1628',
    paddingBottom: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,212,255,0.12)',
  },
  headerCenter:  { flex: 1 },
  greeting:      { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  subtitle:      { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 1 },
  headerRight:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  headerIconTxt: { fontSize: 17 },
  notifBadge:    { position: 'absolute', top: -4, right: -4, backgroundColor: '#FF4757', width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#0A1628' },
  notifBadgeText:{ color: '#fff', fontSize: 8, fontWeight: '800' },
  avatarCircle:  { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(0,212,255,0.3)' },
  avatarText:    { color: '#FFF', fontSize: 15, fontWeight: '800' },

  statBar:    { flexDirection: 'row', backgroundColor: '#0A1628', paddingVertical: 12, paddingHorizontal: 20 },
  statItem:   { flex: 1, flexDirection: 'row', alignItems: 'center' },
  statDivider:{ width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.1)', marginRight: 12 },
  statNum:    { fontSize: 22, fontWeight: '900', color: '#FFFFFF', marginRight: 6 },
  statLabel:  { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.4)', letterSpacing: 1 },

  xpWrap: { paddingHorizontal: 20, paddingBottom: 12, backgroundColor: '#0A1628' },
  xpBg:   { height: 3, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, marginBottom: 4 },
  xpFill: { height: 3, backgroundColor: '#00D4FF', borderRadius: 2 },
  xpText: { color: 'rgba(255,255,255,0.3)', fontSize: 10 },

  sectionTitle: { fontSize: 10, fontWeight: '700', color: '#00D4FF', marginHorizontal: 20, marginTop: 20, marginBottom: 10, letterSpacing: 2 },
  sectionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 20, marginTop: 20, marginBottom: 10 },
  seeAll:       { color: '#00D4FF', fontSize: 12, fontWeight: '600' },

  qaGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10 },
  qaCard: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.15)',
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  qaEmojiWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  qaEmoji:     { fontSize: 22 },
  qaTextWrap:  { flex: 1 },
  qaTitle:     { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  qaDesc:      { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 },
  qaArrow:     { color: 'rgba(255,255,255,0.3)', fontSize: 14 },

  matchScroll: { paddingLeft: 20, paddingRight: 8, paddingBottom: 4 },
  matchCard:   {
    width: 200, height: 160,
    backgroundColor: '#0F1E35',
    borderRadius: 16, marginRight: 12, overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1, borderColor: 'rgba(0,212,255,0.12)',
  },
  matchStrip:    { width: 4 },
  matchBody:     { flex: 1, padding: 12, gap: 4 },
  matchTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fmtBadge:      { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  fmtBadgeText:  { fontSize: 10, fontWeight: '700' },
  matchTime:     { fontSize: 9, color: 'rgba(255,255,255,0.4)' },
  matchVenue:    { fontSize: 13, fontWeight: '800', color: '#FFFFFF', marginTop: 2 },
  matchDistrict: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  matchBarBg:    { height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 4 },
  matchBarFg:    { height: 4, borderRadius: 2 },
  matchCount:    { fontSize: 9, color: 'rgba(255,255,255,0.4)' },
  joinBtn:       { borderRadius: 8, paddingVertical: 6, alignItems: 'center', marginTop: 4 },
  joinBtnText:   { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  venueCard:     {
    width: 160, marginRight: 12, borderRadius: 14, overflow: 'hidden',
    backgroundColor: '#0F1E35',
    borderWidth: 1, borderColor: 'rgba(0,212,255,0.12)',
  },
  venueCardTop:  { height: 80, justifyContent: 'center', alignItems: 'center' },
  venueCardEmoji:{ fontSize: 32 },
  venueCardRating:{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  venueCardRatingText:{ color: '#FFB800', fontSize: 10, fontWeight: '700' },
  venueCardBody: { padding: 10 },
  venueCardName: { fontSize: 12, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
  venueCardDistrict:{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 },
  venueCardPrice:{ fontSize: 13, fontWeight: '800', color: '#FFB800' },

  emptyHorizontal:{ paddingHorizontal: 20, paddingBottom: 8 },
  emptyText:     { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  emptyAction:   { color: '#00D4FF', fontSize: 13, marginTop: 4 },

  tabBar: {
    backgroundColor: '#0A1628',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,212,255,0.12)',
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 72,
    paddingHorizontal: 8,
  },
  tabItem:       { flex: 1, alignItems: 'center', paddingTop: 10 },
  tabIcon:       { fontSize: 20, marginBottom: 2 },
  tabLabel:      { fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: '600' },
  tabLabelActive:{ color: '#00D4FF', fontWeight: '700' },
  fab: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#00D4FF',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8, marginHorizontal: 10,
    shadowColor: '#00D4FF', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  fabText: { color: '#0A1628', fontSize: 28, fontWeight: '900', marginTop: -2 },

  seekingCard: {
    width: 200,
    backgroundColor: '#0F1E35',
    borderRadius: 16, marginRight: 12, overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1, borderColor: 'rgba(255,184,0,0.25)',
  },
  seekingCardStrip:     { width: 4 },
  seekingCardBody:      { flex: 1, padding: 12, gap: 6 },
  seekingCardVenue:     { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  seekingCardFmt:       { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  seekingCardFmtText:   { fontSize: 10, fontWeight: '700' },
  seekingCardPositions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  seekingPosBadge:      { backgroundColor: 'rgba(255,184,0,0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,184,0,0.3)' },
  seekingPosBadgeText:  { fontSize: 9, fontWeight: '700', color: '#FFB800' },
  seekingCardBtn:       { backgroundColor: '#FFB800', borderRadius: 8, paddingVertical: 6, alignItems: 'center', marginTop: 2 },
  seekingCardBtnText:   { color: '#0A1628', fontSize: 11, fontWeight: '800' },
});
