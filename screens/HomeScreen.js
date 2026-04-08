import {
  View, Text, StyleSheet, ScrollView, FlatList,
  TouchableOpacity, ActivityIndicator, Platform
} from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { avatarColor, initials, calcRating, ratingColor } from '../lib/utils';

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

function MatchCard({ match, onJoin }) {
  const maxP = match.max_players ?? 10;
  const curP = match.current_players ?? 0;
  const ratio = maxP ? Math.min(curP / maxP, 1) : 0;
  const fmtColor = FORMAT_COLORS[match.format] || '#3B82F6';
  const barColor = ratio >= 0.9 ? '#EF4444' : ratio >= 0.6 ? '#F59E0B' : '#10B981';
  const timeLabel = hoursFromNow(match.match_date);

  return (
    <TouchableOpacity
      style={styles.matchCard}
      onPress={() => { haptic(); onJoin(match); }}
      activeOpacity={0.85}
    >
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
          <Text style={styles.joinBtnText}>Katıl →</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [profile, setProfile]   = useState(null);
  const [matches, setMatches]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState('home');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: prof } = await supabase
          .from('profiles').select('*').eq('id', user.id).single();
        setProfile(prof);
      }
      const { data: matchData } = await supabase
        .from('matches')
        .select('*, venues(name, district, city)')
        .eq('status', 'open')
        .order('match_date', { ascending: true })
        .limit(8);
      setMatches(matchData || []);
    } catch (_) {}
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleJoin(match) {
    haptic('success');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('match_players').insert({ match_id: match.id, user_id: user.id });
    navigation.navigate('MatchList');
  }

  const displayName = profile?.full_name || 'Oyuncu';
  const firstName   = displayName.split(' ')[0];
  const rating      = calcRating(profile);
  const rColor      = ratingColor(rating);

  const STATS = [
    { val: profile?.matches_played ?? 0, label: 'Maç',   color: '#3B82F6', bg: '#EFF6FF', icon: '🎮' },
    { val: profile?.goals ?? 0,          label: 'Gol',   color: '#EF4444', bg: '#FEF2F2', icon: '⚽' },
    { val: profile?.assists ?? 0,        label: 'Asist', color: '#10B981', bg: '#F0FDF4', icon: '🅰️' },
    { val: rating.toFixed(1),            label: 'Rating', color: rColor,   bg: '#FFFBEB', icon: '⭐' },
  ];

  const QUICK_ACTIONS = [
    { emoji: '⚽', title: 'Maç Kur',    desc: 'Hemen başlat',  color: '#3B82F6', screen: 'CreateMatch' },
    { emoji: '🔍', title: 'Maç Bul',    desc: 'Açık maçlar',   color: '#10B981', screen: 'MatchList'   },
    { emoji: '👥', title: 'Oyuncu Bul', desc: 'Swipe & davet', color: '#8B5CF6', screen: 'Discover'    },
    { emoji: '🛒', title: 'Market',     desc: 'Ekipman al',    color: '#F59E0B', screen: 'Market'      },
  ];

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={styles.greeting}>Merhaba, {firstName} 👋</Text>
          <Text style={styles.subtitle}>Bugün maç var mı?</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.navigate('Wallet')}
          >
            <Text style={styles.headerIconTxt}>💳</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.navigate('ChatList')}
          >
            <Text style={styles.headerIconTxt}>💬</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.avatarCircle, { backgroundColor: avatarColor(displayName) }]}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.avatarText}>{initials(displayName)}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Stat Kutuları ── */}
        <View style={styles.statsRow}>
          {STATS.map((s, i) => (
            <View key={i} style={[styles.statBox, { backgroundColor: s.bg, borderTopColor: s.color }]}>
              <Text style={styles.statIcon}>{s.icon}</Text>
              <Text style={[styles.statNum, { color: s.color }]}>{s.val}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

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
              <View style={[styles.qaEmojiWrap, { backgroundColor: qa.color + '18' }]}>
                <Text style={styles.qaEmoji}>{qa.emoji}</Text>
              </View>
              <Text style={styles.qaTitle}>{qa.title}</Text>
              <Text style={styles.qaDesc}>{qa.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Yakın Maçlar ── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Yakın Maçlar</Text>
          <TouchableOpacity onPress={() => navigation.navigate('MatchList')}>
            <Text style={styles.seeAll}>Tümü →</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color="#00A0D2" style={{ marginLeft: 20, marginBottom: 12 }} />
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
              <MatchCard match={item} onJoin={handleJoin} />
            )}
          />
        )}

        <View style={{ height: Math.max(insets.bottom, 12) + 90 }} />
      </ScrollView>

      {/* ── Tab Bar ── */}
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {[
          { key: 'home',     icon: '🏠', label: 'Ana',    screen: 'Home'        },
          { key: 'discover', icon: '🔍', label: 'Keşfet', screen: 'Discover'    },
          { key: 'fab',      icon: '+',  label: '',        screen: 'CreateMatch', isFab: true },
          { key: 'matches',  icon: '📋', label: 'Maçlar', screen: 'MatchList'   },
          { key: 'profile',  icon: '👤', label: 'Profil', screen: 'Profile'     },
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
  container: { flex: 1, backgroundColor: '#F4F6F9' },

  // Header
  header: {
    backgroundColor: '#001F5B',
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting:     { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  subtitle:     { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 2 },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIconBtn:{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerIconTxt:{ fontSize: 17 },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  avatarText:   { color: '#FFF', fontSize: 14, fontWeight: '800' },

  // Stats
  statsRow:  { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, gap: 10 },
  statBox:   { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', gap: 3, borderTopWidth: 3, backgroundColor: '#fff', shadowColor: '#001F5B', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  statIcon:  { fontSize: 18 },
  statNum:   { fontSize: 20, fontWeight: '800' },
  statLabel: { color: '#64748B', fontSize: 10, fontWeight: '600' },

  // Sections
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#001F5B', marginHorizontal: 20, marginTop: 22, marginBottom: 12 },
  sectionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 20, marginTop: 22, marginBottom: 12 },
  seeAll:       { color: '#00A0D2', fontSize: 13, fontWeight: '600' },

  // Quick Actions
  qaGrid:    { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10 },
  qaCard:    { width: '47%', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, gap: 8, shadowColor: '#001F5B', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  qaEmojiWrap:{ width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  qaEmoji:   { fontSize: 24 },
  qaTitle:   { fontSize: 15, fontWeight: '700', color: '#001F5B' },
  qaDesc:    { fontSize: 11, color: '#94A3B8' },

  // Match Cards (horizontal)
  matchScroll:   { paddingLeft: 20, paddingRight: 8, paddingBottom: 4 },
  matchCard:     { width: 200, backgroundColor: '#FFFFFF', borderRadius: 18, marginRight: 12, overflow: 'hidden', flexDirection: 'row', shadowColor: '#001F5B', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  matchStrip:    { width: 5 },
  matchBody:     { flex: 1, padding: 14, gap: 5 },
  matchTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fmtBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  fmtBadgeText:  { fontSize: 11, fontWeight: '700' },
  matchTime:     { fontSize: 10, color: '#94A3B8' },
  matchVenue:    { fontSize: 14, fontWeight: '700', color: '#001F5B' },
  matchDistrict: { fontSize: 11, color: '#94A3B8' },
  matchBarBg:    { height: 5, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
  matchBarFg:    { height: '100%', borderRadius: 3 },
  matchCount:    { fontSize: 10, color: '#64748B' },
  joinBtn:       { paddingVertical: 8, borderRadius: 10, alignItems: 'center', marginTop: 2 },
  joinBtnText:   { color: '#FFF', fontSize: 12, fontWeight: '700' },

  // Empty
  emptyHorizontal: { marginLeft: 20, marginBottom: 8 },
  emptyText:       { color: '#94A3B8', fontSize: 14 },
  emptyAction:     { color: '#00A0D2', fontSize: 13, fontWeight: '600', marginTop: 4 },

  // Tab Bar
  tabBar:       { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', flexDirection: 'row', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0F0F0', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  tabItem:      { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4 },
  tabIcon:      { fontSize: 20 },
  tabLabel:     { fontSize: 10, color: '#94A3B8', fontWeight: '500' },
  tabLabelActive:{ color: '#001F5B', fontWeight: '700' },
  fab:          { width: 56, height: 56, backgroundColor: '#00A0D2', borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginTop: -24, shadowColor: '#00A0D2', shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 12 },
  fabText:      { color: '#FFFFFF', fontSize: 32, fontWeight: '300', lineHeight: 38 },
});
