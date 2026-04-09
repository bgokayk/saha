import {
  View, Text, StyleSheet, ScrollView, FlatList,
  TouchableOpacity, ActivityIndicator, Platform, Alert, Animated, Share, Image
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

async function shareMatch(match) {
  const date = match.match_date ? new Date(match.match_date) : null;
  const dateStr = date
    ? `${date.toLocaleDateString('tr-TR')} ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
    : '';
  const spotsLeft = (match.max_players || 10) - (match.current_players || 0);
  const msg =
    `⚽ Maça davetlisin!\n\n` +
    `🏟️ ${match.venues?.name || 'Halı Saha'}\n` +
    `📅 ${dateStr}\n` +
    `⚽ ${match.format} · ${spotsLeft > 0 ? `${spotsLeft} yer kaldı` : 'Dolu'}\n\n` +
    `SAHA uygulamasını indir!`;
  if (Platform.OS === 'web') { Alert.alert('Maç Bilgileri', msg); return; }
  try {
    await Share.share({ message: msg });
  } catch (_) {}
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
          <TouchableOpacity
            style={styles.matchShareBtn}
            onPress={(e) => { e.stopPropagation?.(); shareMatch(match); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.matchShareIcon}>📤</Text>
          </TouchableOpacity>
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

function hashColor(name) {
  const colors = ['#1a3a5c', '#1a4c3a', '#3a1a4c', '#4c1a1a', '#1a3a3a', '#3a3a1a'];
  let h = 0;
  for (let c of (name || '')) h = c.charCodeAt(0) + h * 31;
  return colors[Math.abs(h) % colors.length];
}

function VenueCard({ venue, onPress }) {
  return (
    <TouchableOpacity style={styles.venueCardNew} onPress={onPress} activeOpacity={0.85}>
      {/* Photo area */}
      <View style={styles.venuePhotoArea}>
        {venue.photo_url ? (
          <Image source={{ uri: venue.photo_url }} style={styles.venuePhoto} />
        ) : (
          <View style={[styles.venuePhotoPlaceholder, { backgroundColor: hashColor(venue.name) }]}>
            <Text style={styles.venuePhotoEmoji}>🏟️</Text>
            <Text style={styles.venuePhotoText}>{venue.name}</Text>
          </View>
        )}
        {/* Rating badge (bottom right on photo) */}
        <View style={styles.venueRatingBadge}>
          <Text style={styles.venueRatingText}>⭐ {Number(venue.rating || 4.5).toFixed(1)}</Text>
        </View>
        {/* Premium badge (top left, if venue is premium/featured) */}
        {venue.is_active && venue.price_per_hour >= 500 && (
          <View style={styles.venuePremiumBadge}>
            <Text style={styles.venuePremiumText}>Premium</Text>
          </View>
        )}
      </View>
      {/* Info below photo */}
      <View style={styles.venueInfoArea}>
        <Text style={styles.venueCardName}>{venue.name}</Text>
        <Text style={styles.venueCardLocation}>📍 {venue.district || 'Bursa'}, {venue.city || 'Bursa'}</Text>
        <View style={styles.venueCardBottom}>
          <Text style={styles.venueCardPrice}>₺{venue.price_per_hour}/sa</Text>
          <View style={styles.venueCardBtn}>
            <Text style={styles.venueCardBtnText}>Detay →</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const BRANCHES = ['Futbol'];
const CITIES   = ['Bursa', 'İstanbul', 'Ankara', 'İzmir', 'Antalya'];

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { unreadCount, checkMatchReminders } = useNotifications();
  const [profile, setProfile]   = useState(null);
  const [matches, setMatches]   = useState([]);
  const [venues,  setVenues]    = useState([]);
  const [seekingMatches, setSeekingMatches] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const xpAnim = useRef(new Animated.Value(0)).current;

  const [selectedBranch, setSelectedBranch] = useState('Futbol');
  const [selectedCity,   setSelectedCity]   = useState('Bursa');
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [showCityPicker,   setShowCityPicker]   = useState(false);

  const [leaderboard,   setLeaderboard]   = useState([]);
  const [activePlayers, setActivePlayers] = useState([]);
  const [weeklyStats,   setWeeklyStats]   = useState({ matches: 0, goals: 0, players: 0 });
  const [extraLoading,  setExtraLoading]  = useState(true);

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
      checkMatchReminders();
    } catch (err) {
      Alert.alert('Hata', 'Veriler yüklenirken bir sorun oluştu.');
    }
    setLoading(false);
  }, []);

  const fetchExtraData = useCallback(async () => {
    setExtraLoading(true);
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [
        { data: lbData },
        { data: apData },
        { data: weekMatchData },
      ] = await Promise.all([
        supabase.from('profiles').select('id, full_name, goals, assists, matches_played, position, avatar_url').order('goals', { ascending: false }).limit(5),
        supabase.from('profiles').select('id, full_name, matches_played, position, avatar_url').order('matches_played', { ascending: false }).limit(6),
        supabase.from('matches').select('id, current_players').gte('match_date', sevenDaysAgo),
      ]);
      setLeaderboard(lbData || []);
      setActivePlayers(apData || []);
      if (weekMatchData) {
        const totalGoals = (weekMatchData || []).reduce((s, m) => s + (m.current_players || 0), 0);
        const totalPlayers = (weekMatchData || []).reduce((s, m) => s + (m.current_players || 0), 0);
        setWeeklyStats({ matches: weekMatchData.length, goals: totalGoals, players: totalPlayers });
      }
    } catch (_) {}
    setExtraLoading(false);
  }, []);

  useEffect(() => { fetchData(); fetchExtraData(); }, [fetchData, fetchExtraData]);

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

      {/* ── Branch + Şehir Filtre ── */}
      <View style={styles.filterRow}>
        <TouchableOpacity style={[styles.filterChip, selectedBranch && styles.filterChipActive]} onPress={() => setShowBranchPicker(true)}>
          <Text style={styles.filterChipIcon}>⚽</Text>
          <Text style={styles.filterChipText}>{selectedBranch || 'Futbol'}</Text>
          <Text style={styles.filterChipArrow}>▾</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterChip, selectedCity && styles.filterChipActive]} onPress={() => setShowCityPicker(true)}>
          <Text style={styles.filterChipIcon}>📍</Text>
          <Text style={styles.filterChipText}>{selectedCity || 'Bursa'}</Text>
          <Text style={styles.filterChipArrow}>▾</Text>
        </TouchableOpacity>
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
            <View style={styles.venueListWrap}>
              {venues.map(item => (
                <VenueCard
                  key={item.id?.toString()}
                  venue={item}
                  onPress={() => navigation.navigate('VenueDetail', { venueId: item.id, venue: item })}
                />
              ))}
            </View>
          </>
        )}

        {/* ── Bu Hafta ── */}
        <View style={styles.weeklyCard}>
          <Text style={styles.weeklyTitle}>📊 BU HAFTA</Text>
          {extraLoading ? (
            <ActivityIndicator color="#00D4FF" size="small" style={{ marginTop: 8 }} />
          ) : (
            <View style={styles.weeklyRow}>
              <View style={styles.weeklyStat}>
                <Text style={styles.weeklyNum}>{weeklyStats.matches}</Text>
                <Text style={styles.weeklyLabel}>maç oynandı</Text>
              </View>
              <View style={styles.weeklyDivider} />
              <View style={styles.weeklyStat}>
                <Text style={styles.weeklyNum}>{weeklyStats.goals}</Text>
                <Text style={styles.weeklyLabel}>katılım</Text>
              </View>
              <View style={styles.weeklyDivider} />
              <View style={styles.weeklyStat}>
                <Text style={styles.weeklyNum}>{weeklyStats.players}</Text>
                <Text style={styles.weeklyLabel}>oyuncu sayısı</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Liderlik Tablosu ── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>🏆 LİDERLİK TABLOSU</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Discover')}>
            <Text style={styles.seeAll}>Tümünü Gör →</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.leaderboardWrap}>
          {extraLoading ? (
            <ActivityIndicator color="#00D4FF" style={{ margin: 16 }} />
          ) : leaderboard.length === 0 ? (
            <Text style={[styles.emptyText, { marginHorizontal: 20, marginBottom: 12 }]}>Henüz veri yok</Text>
          ) : leaderboard.map((p, i) => {
            const r = calcRating(p);
            const rC = ratingColor(r);
            const RANK_COLORS = ['#FFB800', '#C0C0C0', '#CD7F32', '#8B9BB4', '#8B9BB4'];
            return (
              <TouchableOpacity
                key={p.id}
                style={styles.lbRow}
                onPress={() => navigation.navigate('Profile', { profileId: p.id })}
                activeOpacity={0.8}
              >
                <Text style={[styles.lbRank, { color: RANK_COLORS[i] || '#8B9BB4' }]}>#{i + 1}</Text>
                <View style={[styles.lbAvatar, { backgroundColor: avatarColor(p.full_name) }]}>
                  {p.avatar_url ? (
                    <Image source={{ uri: p.avatar_url }} style={styles.lbAvatarImg} />
                  ) : (
                    <Text style={styles.lbAvatarText}>{initials(p.full_name)}</Text>
                  )}
                </View>
                <View style={styles.lbInfo}>
                  <Text style={styles.lbName} numberOfLines={1}>{p.full_name}</Text>
                  <Text style={styles.lbPos}>{p.position || 'Oyuncu'}</Text>
                </View>
                <View style={styles.lbGoals}>
                  <Text style={styles.lbGoalNum}>{p.goals || 0}</Text>
                  <Text style={styles.lbGoalLabel}>gol</Text>
                </View>
                <View style={[styles.lbRating, { backgroundColor: rC + '22' }]}>
                  <Text style={[styles.lbRatingText, { color: rC }]}>{r.toFixed(1)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Aktif Oyuncular ── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>🔥 AKTİF OYUNCULAR</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Discover')}>
            <Text style={styles.seeAll}>Tümü →</Text>
          </TouchableOpacity>
        </View>
        {extraLoading ? (
          <ActivityIndicator color="#00D4FF" style={{ marginLeft: 20, marginBottom: 12 }} />
        ) : activePlayers.length === 0 ? (
          <View style={styles.emptyHorizontal}>
            <Text style={styles.emptyText}>Henüz aktif oyuncu yok</Text>
          </View>
        ) : (
          <FlatList
            data={activePlayers}
            keyExtractor={item => item.id?.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.matchScroll}
            renderItem={({ item }) => {
              const r = calcRating(item);
              const rC = ratingColor(r);
              return (
                <TouchableOpacity
                  style={styles.playerCard}
                  onPress={() => navigation.navigate('Profile', { profileId: item.id })}
                  activeOpacity={0.85}
                >
                  <View style={[styles.playerAvatar, { backgroundColor: avatarColor(item.full_name) }]}>
                    {item.avatar_url ? (
                      <Image source={{ uri: item.avatar_url }} style={styles.playerAvatarImg} />
                    ) : (
                      <Text style={styles.playerAvatarText}>{initials(item.full_name)}</Text>
                    )}
                  </View>
                  <Text style={styles.playerName} numberOfLines={1}>{(item.full_name || '').split(' ')[0]}</Text>
                  <Text style={styles.playerPos}>{item.position || '—'}</Text>
                  <View style={[styles.playerRating, { backgroundColor: rC + '22' }]}>
                    <Text style={[styles.playerRatingText, { color: rC }]}>{r.toFixed(1)}</Text>
                  </View>
                  <Text style={styles.playerMatches}>{item.matches_played || 0} maç</Text>
                </TouchableOpacity>
              );
            }}
          />
        )}

        <View style={{ height: Math.max(insets.bottom, 12) + 90 }} />
      </ScrollView>

      {/* ── Branch Picker Modal ── */}
      {showBranchPicker && (
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowBranchPicker(false)}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Branş Seç</Text>
            {BRANCHES.map(b => (
              <TouchableOpacity
                key={b}
                style={[styles.pickerItem, selectedBranch === b && styles.pickerItemActive]}
                onPress={() => { setSelectedBranch(b); setShowBranchPicker(false); }}
              >
                <Text style={[styles.pickerItemText, selectedBranch === b && styles.pickerItemTextActive]}>⚽ {b}</Text>
                {selectedBranch === b && <Text style={styles.pickerCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      )}

      {/* ── City Picker Modal ── */}
      {showCityPicker && (
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowCityPicker(false)}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Şehir Seç</Text>
            {CITIES.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.pickerItem, selectedCity === c && styles.pickerItemActive]}
                onPress={() => { setSelectedCity(c); setShowCityPicker(false); }}
              >
                <Text style={[styles.pickerItemText, selectedCity === c && styles.pickerItemTextActive]}>📍 {c}</Text>
                {selectedCity === c && <Text style={styles.pickerCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      )}

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
  matchTime:     { fontSize: 9, color: 'rgba(255,255,255,0.4)', flex: 1 },
  matchShareBtn: { padding: 2 },
  matchShareIcon:{ fontSize: 12 },
  matchVenue:    { fontSize: 13, fontWeight: '800', color: '#FFFFFF', marginTop: 2 },
  matchDistrict: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  matchBarBg:    { height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 4 },
  matchBarFg:    { height: 4, borderRadius: 2 },
  matchCount:    { fontSize: 9, color: 'rgba(255,255,255,0.4)' },
  joinBtn:       { borderRadius: 8, paddingVertical: 6, alignItems: 'center', marginTop: 4 },
  joinBtnText:   { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  venueListWrap: { paddingHorizontal: 20 },
  venueCardNew: {
    backgroundColor: '#0F1E35',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.12)',
    overflow: 'hidden',
  },
  venuePhotoArea: {
    height: 180,
    position: 'relative',
  },
  venuePhoto: {
    width: '100%',
    height: '100%',
  },
  venuePhotoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  venuePhotoEmoji: { fontSize: 48, marginBottom: 8 },
  venuePhotoText: { color: 'rgba(255,255,255,0.3)', fontSize: 14, fontWeight: '600' },
  venueRatingBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  venueRatingText: { color: '#FFB800', fontSize: 13, fontWeight: '700' },
  venuePremiumBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  venuePremiumText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  venueInfoArea: { padding: 14 },
  venueCardName: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  venueCardLocation: { color: '#8B9BB4', fontSize: 12, marginBottom: 10 },
  venueCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  venueCardPrice: { color: '#FFB800', fontSize: 15, fontWeight: '800' },
  venueCardBtn: { backgroundColor: 'rgba(0,212,255,0.1)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,212,255,0.3)' },
  venueCardBtnText: { color: '#00D4FF', fontSize: 12, fontWeight: '600' },

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

  // Filter row
  filterRow:         { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 10, gap: 10, backgroundColor: '#0A1628' },
  filterChip:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0F1E35', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(0,212,255,0.18)' },
  filterChipActive:  { borderColor: '#00D4FF', backgroundColor: 'rgba(0,212,255,0.08)' },
  filterChipIcon:    { fontSize: 14 },
  filterChipText:    { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  filterChipArrow:   { color: '#00D4FF', fontSize: 11 },

  // Picker modal
  pickerOverlay:     { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end', zIndex: 999 },
  pickerSheet:       { backgroundColor: '#0F1E35', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, borderTopWidth: 1, borderColor: 'rgba(0,212,255,0.2)' },
  pickerTitle:       { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginBottom: 16 },
  pickerItem:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  pickerItemActive:  { backgroundColor: 'rgba(0,212,255,0.06)', marginHorizontal: -24, paddingHorizontal: 24 },
  pickerItemText:    { color: 'rgba(255,255,255,0.65)', fontSize: 15, fontWeight: '600' },
  pickerItemTextActive:{ color: '#00D4FF' },
  pickerCheck:       { color: '#00D4FF', fontSize: 16, fontWeight: '800' },

  // Liderlik tablosu
  leaderboardWrap:   { marginHorizontal: 16, backgroundColor: '#0F1E35', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,212,255,0.12)' },
  lbRow:             { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, gap: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  lbRank:            { fontSize: 13, fontWeight: '900', width: 28, textAlign: 'center' },
  lbAvatar:          { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  lbAvatarImg:       { width: '100%', height: '100%' },
  lbAvatarText:      { color: '#FFF', fontSize: 13, fontWeight: '800' },
  lbInfo:            { flex: 1 },
  lbName:            { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  lbPos:             { color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 1 },
  lbGoals:           { alignItems: 'center' },
  lbGoalNum:         { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  lbGoalLabel:       { color: 'rgba(255,255,255,0.3)', fontSize: 9, letterSpacing: 1 },
  lbRating:          { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginLeft: 6 },
  lbRatingText:      { fontSize: 12, fontWeight: '800' },

  // Aktif oyuncular
  playerCard:        { width: 90, marginRight: 12, alignItems: 'center', backgroundColor: '#0F1E35', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: 'rgba(0,212,255,0.12)', gap: 4 },
  playerAvatar:      { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 4 },
  playerAvatarImg:   { width: '100%', height: '100%' },
  playerAvatarText:  { color: '#FFF', fontSize: 16, fontWeight: '800' },
  playerName:        { color: '#FFFFFF', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  playerPos:         { color: 'rgba(255,255,255,0.35)', fontSize: 9, textAlign: 'center' },
  playerRating:      { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  playerRatingText:  { fontSize: 11, fontWeight: '800' },
  playerMatches:     { color: 'rgba(255,255,255,0.25)', fontSize: 9 },

  // Bu hafta
  weeklyCard:        { marginHorizontal: 16, marginTop: 20, backgroundColor: '#0F1E35', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(0,212,255,0.12)' },
  weeklyTitle:       { color: '#00D4FF', fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 12 },
  weeklyRow:         { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  weeklyStat:        { alignItems: 'center' },
  weeklyNum:         { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  weeklyLabel:       { color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2 },
  weeklyDivider:     { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.08)' },
});
