import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated, Alert, Modal, TextInput, Platform
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { calcRating, ratingColor, ratingLabel, getLevel, avatarColor, initials } from '../lib/utils';

function haptic(type = 'light') {
  if (Platform.OS === 'web') return;
  try {
    const H = require('expo-haptics');
    if (type === 'success') H.notificationAsync(H.NotificationFeedbackType.Success);
    else H.impactAsync(H.ImpactFeedbackStyle.Light);
  } catch (_) {}
}

const ACHIEVEMENTS = [
  { id: 'first_match',    icon: '🔥', title: 'Ateşli Başlangıç', desc: 'İlk maçını oynadın',           req: p => p.matches_played >= 1,  xp: 100,  color: '#EF4444' },
  { id: 'first_goal',     icon: '⚡', title: 'Yıldırım',          desc: 'İlk golünü attın',              req: p => p.goals >= 1,           xp: 50,   color: '#F59E0B' },
  { id: 'ten_goals',      icon: '🎯', title: 'Sniper',            desc: '10 gol attın',                  req: p => p.goals >= 10,          xp: 200,  color: '#EF4444' },
  { id: 'fifty_goals',    icon: '👑', title: 'Kral',              desc: '50 gol attın',                  req: p => p.goals >= 50,          xp: 1000, color: '#F59E0B' },
  { id: 'hundred_goals',  icon: '💎', title: 'Efsane Forvet',     desc: '100 gol attın',                 req: p => p.goals >= 100,         xp: 5000, color: '#8B5CF6' },
  { id: 'organizer',      icon: '🤝', title: 'Organize',          desc: 'İlk maçını kurdu',              req: p => p.matches_played >= 1,  xp: 150,  color: '#10B981' },
  { id: 'hundred_matches',icon: '🏆', title: 'Efsane',            desc: '100 maç oynadın',               req: p => p.matches_played >= 100,xp: 5000, color: '#F59E0B' },
  { id: 'mvp',            icon: '⭐', title: 'MVP',               desc: 'Rating 8.5 üzeri',              req: p => calcRating(p) >= 8.5,   xp: 500,  color: '#F59E0B' },
  { id: 'eagle',          icon: '🦅', title: 'Kartal',            desc: '5 maç üst üste gol',            req: p => p.goals >= 5,           xp: 300,  color: '#3B82F6' },
  { id: 'wall',           icon: '🧤', title: 'Demir Duvar',       desc: 'Kaleci, 10 maç',                req: p => p.position === 'Kaleci' && p.matches_played >= 10, xp: 400, color: '#6366F1' },
  { id: 'magician',       icon: '🎪', title: 'Sihirbaz',          desc: '20 asist yaptın',               req: p => p.assists >= 20,        xp: 400,  color: '#EC4899' },
  { id: 'rising_star',    icon: '🌟', title: 'Yükselen Yıldız',   desc: 'Rating 7.0 üzeri, ilk 10 maç', req: p => calcRating(p) >= 7.0 && p.matches_played >= 1, xp: 250, color: '#F59E0B' },
];

const STAT_PERIODS = ['Bu Hafta', 'Bu Ay', 'Tüm Zamanlar'];

const POS_SHORT = { 'Kaleci': 'KAL', 'Defans': 'DEF', 'Orta Saha': 'ORT', 'Forvet': 'FOR' };

export default function ProfileScreen({ navigation, route }) {
  const insets    = useSafeAreaInsets();
  const profileId = route?.params?.profileId || null;
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('stats');
  const [statPeriod, setStatPeriod] = useState('Tüm Zamanlar');
  const [achModal, setAchModal] = useState(null);
  const [matchHistory, setMatchHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editName, setEditName]   = useState('');
  const [editPos, setEditPos]     = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving]       = useState(false);

  // Animasyonlar
  const xpAnim    = useRef(new Animated.Value(0)).current;
  const cardAnim  = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const achScale  = useRef(new Animated.Value(0)).current;
  const pulsAnim  = useRef(new Animated.Value(1)).current;
  const barAnims  = useRef(Array.from({ length: 4 }, () => new Animated.Value(0))).current;
  const confettiAnims = useRef(Array.from({ length: 8 }, () => ({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    o: new Animated.Value(0),
  }))).current;

  useEffect(() => { fetchProfile(); startPulse(); }, []);

  useEffect(() => {
    if (tab !== 'stats' || !profile) return;
    const r = calcRating(profile);
    const vals = [
      Math.min(10, 5 + (profile.goals || 0) * 0.15),
      Math.min(10, 5 + (profile.assists || 0) * 0.12),
      Math.min(10, 4 + (profile.matches_played || 0) * 0.08),
      r,
    ];
    barAnims.forEach((anim, i) => {
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: vals[i] / 10,
        duration: 1000,
        delay: i * 120,
        useNativeDriver: false,
      }).start();
    });
  }, [tab, profile]);

  function startPulse() {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulsAnim, { toValue: 1.12, duration: 900, useNativeDriver: true }),
        Animated.timing(pulsAnim, { toValue: 1.0,  duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }

  async function fetchMatchHistory(userId) {
    setHistoryLoading(true);
    const { data } = await supabase
      .from('match_players')
      .select('*, matches(id, format, match_date, status, venues(name, district))')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false })
      .limit(30);
    setMatchHistory(data || []);
    setHistoryLoading(false);
  }

  async function fetchProfile() {
    let id = profileId;
    if (!id) {
      const { data: { user } } = await supabase.auth.getUser();
      id = user?.id;
    }
    if (!id) { setLoading(false); return; }
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
    setProfile(data);
    setLoading(false);
    fetchMatchHistory(id);
  }

  useEffect(() => {
    if (!profile) return;
    const unlockedAch = ACHIEVEMENTS.filter(a => a.req(profile));
    const xpTotal = unlockedAch.reduce((s, a) => s + a.xp, 0);
    const xpMax   = ACHIEVEMENTS.reduce((s, a) => s + a.xp, 0);
    const xpRatio = Math.min(xpTotal / xpMax, 1);

    Animated.sequence([
      Animated.timing(cardAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(statsAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    Animated.timing(xpAnim, { toValue: xpRatio, duration: 1200, delay: 600, useNativeDriver: false }).start();
  }, [profile]);

  function openAchievement(a) {
    haptic('success');
    setAchModal(a);
    achScale.setValue(0);
    confettiAnims.forEach(c => { c.x.setValue(0); c.y.setValue(0); c.o.setValue(0); });

    Animated.sequence([
      Animated.spring(achScale, { toValue: 1.2, tension: 120, friction: 5, useNativeDriver: true }),
      Animated.spring(achScale, { toValue: 1.0, tension: 80,  friction: 8, useNativeDriver: true }),
    ]).start();

    // Konfeti
    confettiAnims.forEach((c, i) => {
      const angle = (i / confettiAnims.length) * Math.PI * 2;
      const dist = 80 + Math.random() * 40;
      Animated.parallel([
        Animated.timing(c.o, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(c.x, { toValue: Math.cos(angle) * dist, duration: 600, useNativeDriver: true }),
        Animated.timing(c.y, { toValue: Math.sin(angle) * dist - 30, duration: 600, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(400),
          Animated.timing(c.o, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
      ]).start();
    });
  }

  async function handleSignOut() {
    Alert.alert('Çıkış Yap', 'Hesabından çıkmak istiyor musun?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  function openEdit() {
    setEditName(profile.full_name || '');
    setEditPos(profile.position || '');
    setEditPhone(profile.phone || '');
    setEditModal(true);
  }

  async function saveEdit() {
    if (!editName.trim()) { Alert.alert('Hata', 'İsim boş olamaz.'); return; }
    setSaving(true);
    const updates = { full_name: editName.trim(), position: editPos };
    if (editPhone.trim()) updates.phone = editPhone.trim();
    const { error } = await supabase.from('profiles').update(updates).eq('id', profile.id);
    setSaving(false);
    if (error) { Alert.alert('Hata', error.message); return; }
    setEditModal(false);
    fetchProfile();
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#00A0D2" size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#001F5B' }]}>
        <Text style={{ color: '#fff', fontSize: 16 }}>Profil bulunamadı.</Text>
        <TouchableOpacity style={{ marginTop: 16 }} onPress={() => navigation.goBack()}>
          <Text style={{ color: '#00A0D2', fontSize: 15 }}>← Geri dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const rating      = calcRating(profile);
  const rColor      = ratingColor(rating);
  const level       = getLevel(profile);
  const bgColor     = avatarColor(profile.full_name);
  const unlockedAch = ACHIEVEMENTS.filter(a => a.req(profile));
  const xpTotal     = unlockedAch.reduce((s, a) => s + a.xp, 0);
  const xpMax       = ACHIEVEMENTS.reduce((s, a) => s + a.xp, 0);
  const posShort    = POS_SHORT[profile.position] || profile.position || '—';

  const xpBarWidth  = xpAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  const CONFETTI_COLORS = ['#F59E0B', '#EF4444', '#22C55E', '#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F97316'];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profil</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={openEdit}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.headerIcon}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.navigate('Wallet')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.headerIcon}>💳</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={handleSignOut}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.headerIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── FIFA Kart ── */}
        <Animated.View style={[styles.fifaCard, {
          opacity: cardAnim,
          transform: [{ scale: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }]
        }]}>
          <View style={[styles.fifaDecor, { backgroundColor: rColor + '18' }]} />

          <View style={styles.fifaLeft}>
            <Text style={[styles.fifaRating, { color: rColor }]}>{rating.toFixed(1)}</Text>
            <Text style={[styles.fifaPos, { color: rColor }]}>{posShort}</Text>
            <Animated.View style={[styles.fifaLevelBadge, { backgroundColor: level.color, transform: [{ scale: pulsAnim }] }]}>
              <Text style={styles.fifaLevelText}>{level.title}</Text>
            </Animated.View>
            <Text style={styles.fifaFlag}>🇹🇷</Text>
          </View>

          <View style={styles.fifaCenter}>
            <View style={[styles.fifaAvatarRing, { borderColor: rColor }]}>
              <View style={[styles.fifaAvatarInner, { backgroundColor: bgColor }]}>
                <Text style={styles.fifaInitials}>{initials(profile.full_name)}</Text>
              </View>
            </View>
            <Text style={styles.fifaName}>{profile.full_name}</Text>
            <Text style={[styles.fifaRatingLabel, { color: rColor }]}>{ratingLabel(rating)}</Text>
          </View>

          <View style={styles.fifaRight}>
            {[
              { num: profile.goals || 0,         label: 'GOL' },
              { num: profile.assists || 0,         label: 'ASİ' },
              { num: profile.matches_played || 0,  label: 'MAÇ' },
            ].map((s, i) => (
              <View key={i} style={styles.fifaStat}>
                <Text style={styles.fifaStatNum}>{s.num}</Text>
                <Text style={styles.fifaStatLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* ── XP Bar ── */}
        <Animated.View style={[styles.xpSection, { opacity: statsAnim }]}>
          <View style={styles.xpRow}>
            <Text style={styles.xpLabel}>⚡ {xpTotal} XP</Text>
            <Text style={styles.xpLabel}>{unlockedAch.length}/{ACHIEVEMENTS.length} başarım</Text>
          </View>
          <View style={styles.xpBarBg}>
            <Animated.View style={[styles.xpBarFill, { width: xpBarWidth, backgroundColor: level.color }]} />
          </View>
          {level.next && <Text style={styles.xpNextText}>Sonraki seviye için {level.next} maç daha</Text>}
        </Animated.View>

        {/* ── Stat Kartları ── */}
        <Animated.View style={[styles.statsGrid, { opacity: statsAnim }]}>
          {[
            { icon: '🎮', num: profile.matches_played || 0, label: 'Maç',   bg: '#EFF6FF', ic: '#3B82F6' },
            { icon: '⚽', num: profile.goals || 0,          label: 'Gol',   bg: '#FEF2F2', ic: '#EF4444' },
            { icon: '🅰️', num: profile.assists || 0,         label: 'Asist', bg: '#F0FDF4', ic: '#22C55E' },
            { icon: '📊', num: (profile.goals || 0) + (profile.assists || 0), label: 'Katkı', bg: '#FFFBEB', ic: '#F59E0B' },
          ].map((s, i) => (
            <View key={i} style={[styles.statCard, { backgroundColor: s.bg, borderTopColor: s.ic }]}>
              <Text style={styles.statIcon}>{s.icon}</Text>
              <Text style={[styles.statNum, { color: s.ic }]}>{s.num}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* ── Maç Başı Oran ── */}
        <View style={styles.ratioCard}>
          <Text style={styles.ratioTitle}>Maç Başı Ortalama</Text>
          <View style={styles.ratioRow}>
            {[
              { num: profile.matches_played ? (profile.goals / profile.matches_played).toFixed(2) : '0.00', label: 'Gol/Maç' },
              { num: profile.matches_played ? (profile.assists / profile.matches_played).toFixed(2) : '0.00', label: 'Asist/Maç' },
              { num: profile.matches_played ? ((profile.goals + profile.assists) / profile.matches_played).toFixed(2) : '0.00', label: 'Katkı/Maç' },
            ].map((r, i, arr) => (
              <View key={i} style={styles.ratioGroup}>
                <View style={styles.ratioItem}>
                  <Text style={styles.ratioNum}>{r.num}</Text>
                  <Text style={styles.ratioLabel}>{r.label}</Text>
                </View>
                {i < arr.length - 1 && <View style={styles.ratioDivider} />}
              </View>
            ))}
          </View>
        </View>

        {/* ── Sekme ── */}
        <View style={styles.tabSegment}>
          {[
            { key: 'stats',        label: '📈 İstatistik' },
            { key: 'achievements', label: '🏆 Başarımlar' },
            { key: 'history',      label: '📅 Geçmiş' },
          ].map(t => (
            <TouchableOpacity key={t.key} style={[styles.tabSegBtn, tab === t.key && styles.tabSegBtnActive]} onPress={() => setTab(t.key)}>
              <Text style={[styles.tabSegText, tab === t.key && styles.tabSegTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* İSTATİSTİK */}
        {tab === 'stats' && (
          <View style={styles.section}>
            <View style={styles.periodRow}>
              {STAT_PERIODS.map(p => (
                <TouchableOpacity key={p} style={[styles.periodBtn, statPeriod === p && styles.periodBtnActive]} onPress={() => setStatPeriod(p)}>
                  <Text style={[styles.periodText, statPeriod === p && styles.periodTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionSubTitle}>Rating Dağılımı</Text>
            {[
              { label: 'Hücum',   rawVal: Math.min(10, 5 + (profile.goals || 0) * 0.15),          color: '#EF4444', idx: 0 },
              { label: 'Katkı',   rawVal: Math.min(10, 5 + (profile.assists || 0) * 0.12),         color: '#3B82F6', idx: 1 },
              { label: 'Deneyim', rawVal: Math.min(10, 4 + (profile.matches_played || 0) * 0.08),  color: '#8B5CF6', idx: 2 },
              { label: 'Genel',   rawVal: rating, color: rColor, idx: 3 },
            ].map((bar) => (
              <View key={bar.idx} style={styles.barRow}>
                <Text style={styles.barLabel}>{bar.label}</Text>
                <View style={styles.barBg}>
                  <Animated.View style={[styles.barFill, {
                    width: barAnims[bar.idx].interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                    backgroundColor: bar.color,
                  }]} />
                </View>
                <Text style={[styles.barVal, { color: bar.color }]}>{bar.rawVal.toFixed(1)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* BAŞARIMLAR */}
        {tab === 'achievements' && (
          <View style={styles.section}>
            <Text style={styles.sectionSubTitle}>
              {unlockedAch.length}/{ACHIEVEMENTS.length} Başarım Açık • {xpTotal} XP
            </Text>
            <View style={styles.achGrid}>
              {ACHIEVEMENTS.map(a => {
                const unlocked = a.req(profile);
                return (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.achCard, unlocked ? { borderColor: a.color, borderWidth: 2 } : styles.achCardLocked]}
                    onPress={() => unlocked && openAchievement(a)}
                    activeOpacity={unlocked ? 0.8 : 1}
                  >
                    <View style={[styles.achIconWrap, { backgroundColor: unlocked ? a.color + '22' : '#F1F5F9' }]}>
                      <Text style={[styles.achIcon, !unlocked && { opacity: 0.25 }]}>{a.icon}</Text>
                    </View>
                    <Text style={[styles.achCardTitle, !unlocked && { color: '#94A3B8' }]} numberOfLines={2}>{a.title}</Text>
                    <Text style={[styles.achCardXP, { color: unlocked ? a.color : '#CBD5E1' }]}>+{a.xp} XP</Text>
                    {!unlocked && <View style={styles.achLock}><Text style={styles.achLockIcon}>🔒</Text></View>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* MAÇ GEÇMİŞİ */}
        {tab === 'history' && (
          <View style={styles.section}>
            {historyLoading ? (
              <ActivityIndicator color="#00A0D2" style={{ marginTop: 20 }} />
            ) : matchHistory.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Text style={styles.emptyHistoryIcon}>⚽</Text>
                <Text style={styles.emptyHistoryText}>Henüz maç geçmişin yok</Text>
                <TouchableOpacity onPress={() => navigation.navigate('MatchList')}>
                  <Text style={styles.emptyHistoryLink}>Maç bul →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              matchHistory.map((mp, i) => {
                const m = mp.matches;
                const won = Math.random() > 0.5; // gerçek sonuç gelene kadar
                const goals   = mp.goals   || 0;
                const assists = mp.assists || 0;
                const rating  = mp.rating  || null;
                return (
                  <View key={mp.id || i} style={[styles.historyCard, { borderLeftColor: won ? '#10B981' : '#EF4444' }]}>
                    <View style={styles.historyTop}>
                      <View style={[styles.historyFormatBadge, { backgroundColor: won ? '#D1FAE5' : '#FEE2E2' }]}>
                        <Text style={[styles.historyFormatText, { color: won ? '#065F46' : '#991B1B' }]}>
                          {m?.format || '5v5'}
                        </Text>
                      </View>
                      <Text style={styles.historyDate}>
                        {m?.match_date ? new Date(m.match_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : '—'}
                      </Text>
                      {rating && (
                        <View style={[styles.historyRatingBadge, { backgroundColor: ratingColor(rating) + '22' }]}>
                          <Text style={[styles.historyRatingText, { color: ratingColor(rating) }]}>{rating.toFixed(1)}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.historyVenue}>{m?.venues?.name || 'Bilinmeyen Saha'}</Text>
                    <Text style={styles.historyDistrict}>📍 {m?.venues?.district || 'Bursa'}</Text>
                    <View style={styles.historyStats}>
                      {goals > 0   && <Text style={styles.historyStatItem}>⚽ {goals} gol</Text>}
                      {assists > 0 && <Text style={styles.historyStatItem}>🅰️ {assists} asist</Text>}
                      {goals === 0 && assists === 0 && <Text style={[styles.historyStatItem, { color: '#94A3B8' }]}>Katkı yok</Text>}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Profil Düzenleme Modal ── */}
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <View style={styles.editOverlay}>
          <View style={styles.editSheet}>
            <View style={styles.editHandle} />
            <Text style={styles.editTitle}>Profili Düzenle</Text>

            <Text style={styles.editLabel}>İsim Soyisim</Text>
            <TextInput
              style={styles.editInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Adınızı girin"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.editLabel}>Pozisyon</Text>
            <View style={styles.posRow}>
              {['Kaleci', 'Defans', 'Orta Saha', 'Forvet'].map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.posChip, editPos === p && styles.posChipActive]}
                  onPress={() => setEditPos(p)}
                >
                  <Text style={[styles.posChipText, editPos === p && styles.posChipTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.editLabel}>Telefon (opsiyonel)</Text>
            <TextInput
              style={styles.editInput}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="05XX XXX XX XX"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
            />

            <View style={styles.editBtnRow}>
              <TouchableOpacity style={styles.editCancelBtn} onPress={() => setEditModal(false)}>
                <Text style={styles.editCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.editSaveBtn} onPress={saveEdit} disabled={saving}>
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.editSaveText}>Kaydet</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Başarım Modal ── */}
      <Modal visible={!!achModal} transparent animationType="fade" onRequestClose={() => setAchModal(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setAchModal(null)}>
          <View style={styles.modalContainer} onStartShouldSetResponder={() => true}>
            {/* Konfeti */}
            {confettiAnims.map((c, i) => (
              <Animated.View
                key={i}
                style={[styles.confettiDot, {
                  backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                  opacity: c.o,
                  transform: [{ translateX: c.x }, { translateY: c.y }],
                }]}
              />
            ))}

            <Animated.View style={[styles.modalCard, { transform: [{ scale: achScale }] }]}>
              <View style={[styles.modalIconWrap, { backgroundColor: achModal?.color + '22' }]}>
                <Text style={styles.modalIcon}>{achModal?.icon}</Text>
              </View>
              <Text style={styles.modalTitle}>{achModal?.title}</Text>
              <Text style={styles.modalDesc}>{achModal?.desc}</Text>
              <View style={[styles.modalXPBadge, { backgroundColor: achModal?.color }]}>
                <Text style={styles.modalXPText}>+{achModal?.xp} XP Kazandın! 🎉</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setAchModal(null)}>
                <Text style={styles.modalCloseBtnText}>Harika!</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F9' },

  header: { backgroundColor: '#001F5B', paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backText: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerIconBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerIcon: { fontSize: 17 },

  // FIFA Kart
  fifaCard: { backgroundColor: '#001F5B', marginHorizontal: 16, marginTop: 16, borderRadius: 22, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden', shadowColor: '#001F5B', shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  fifaDecor: { position: 'absolute', width: 200, height: 200, borderRadius: 100, top: -50, right: -50 },
  fifaLeft: { alignItems: 'center', gap: 4, minWidth: 55 },
  fifaRating: { fontSize: 36, fontWeight: '900' },
  fifaPos: { fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  fifaLevelBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4 },
  fifaLevelText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  fifaFlag: { fontSize: 16, marginTop: 4 },
  fifaCenter: { alignItems: 'center', flex: 1 },
  fifaAvatarRing: { width: 84, height: 84, borderRadius: 42, borderWidth: 3, padding: 3, marginBottom: 10 },
  fifaAvatarInner: { width: '100%', height: '100%', borderRadius: 42, justifyContent: 'center', alignItems: 'center' },
  fifaInitials: { color: '#FFFFFF', fontSize: 30, fontWeight: '800' },
  fifaName: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', textAlign: 'center', marginBottom: 2 },
  fifaRatingLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  fifaRight: { alignItems: 'center', gap: 10, minWidth: 55 },
  fifaStat: { alignItems: 'center' },
  fifaStatNum: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  fifaStatLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9, letterSpacing: 1 },

  // XP
  xpSection: { marginHorizontal: 16, marginTop: 14, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, shadowColor: '#001F5B', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  xpLabel: { color: '#64748B', fontSize: 12, fontWeight: '600' },
  xpBarBg: { height: 10, backgroundColor: '#F1F5F9', borderRadius: 5, overflow: 'hidden', marginBottom: 6 },
  xpBarFill: { height: '100%', borderRadius: 5 },
  xpNextText: { color: '#94A3B8', fontSize: 11 },

  // Stat grid
  statsGrid: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 12, gap: 10 },
  statCard: { flex: 1, borderRadius: 14, paddingVertical: 16, alignItems: 'center', gap: 4, shadowColor: '#001F5B', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, borderTopWidth: 3 },
  statIcon: { fontSize: 18 },
  statNum: { fontSize: 22, fontWeight: '800' },
  statLabel: { color: '#64748B', fontSize: 10 },

  // Ratio
  ratioCard: { backgroundColor: '#FFFFFF', marginHorizontal: 16, marginTop: 12, borderRadius: 14, padding: 16, shadowColor: '#001F5B', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  ratioTitle: { color: '#001F5B', fontSize: 12, fontWeight: '700', marginBottom: 12 },
  ratioRow: { flexDirection: 'row', justifyContent: 'space-around' },
  ratioGroup: { flexDirection: 'row', alignItems: 'center' },
  ratioItem: { alignItems: 'center' },
  ratioNum: { color: '#001F5B', fontSize: 20, fontWeight: '800' },
  ratioLabel: { color: '#64748B', fontSize: 11, marginTop: 2 },
  ratioDivider: { width: 1, height: 40, backgroundColor: '#E2E8F0', marginHorizontal: 14 },

  // Tab
  tabSegment: { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, marginBottom: 4, backgroundColor: '#E2E8F0', borderRadius: 12, padding: 4 },
  tabSegBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabSegBtnActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  tabSegText: { color: '#64748B', fontSize: 13 },
  tabSegTextActive: { color: '#001F5B', fontWeight: '700' },

  section: { paddingHorizontal: 16, paddingTop: 12 },
  sectionSubTitle: { color: '#001F5B', fontSize: 12, fontWeight: '700', marginBottom: 12, letterSpacing: 0.3 },

  // Period
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  periodBtn: { flex: 1, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#E2E8F0', alignItems: 'center' },
  periodBtnActive: { backgroundColor: '#001F5B', borderColor: '#001F5B' },
  periodText: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  periodTextActive: { color: '#FFFFFF' },

  // Rating barlar
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  barLabel: { color: '#64748B', fontSize: 12, width: 60 },
  barBg: { flex: 1, height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barVal: { fontSize: 12, fontWeight: '700', width: 30, textAlign: 'right' },

  // Başarımlar grid
  achGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  achCard: { width: '30%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, alignItems: 'center', gap: 6, shadowColor: '#001F5B', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, position: 'relative' },
  achCardLocked: { opacity: 0.5, borderWidth: 1, borderColor: '#E2E8F0' },
  achIconWrap: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  achIcon: { fontSize: 28 },
  achCardTitle: { color: '#001F5B', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  achCardXP: { fontSize: 10, fontWeight: '700' },
  achLock: { position: 'absolute', top: 6, right: 6 },
  achLockIcon: { fontSize: 10 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 28, padding: 32, alignItems: 'center', width: 300, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 30, elevation: 20 },
  modalIconWrap: { width: 100, height: 100, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalIcon: { fontSize: 52 },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#001F5B', marginBottom: 8, textAlign: 'center' },
  modalDesc: { fontSize: 14, color: '#64748B', marginBottom: 20, textAlign: 'center' },
  modalXPBadge: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginBottom: 20 },
  modalXPText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  modalCloseBtn: { backgroundColor: '#001F5B', paddingHorizontal: 36, paddingVertical: 14, borderRadius: 20 },
  modalCloseBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  confettiDot: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },

  // Edit modal
  editOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  editSheet:      { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  editHandle:     { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  editTitle:      { fontSize: 18, fontWeight: '800', color: '#001F5B', marginBottom: 20 },
  editLabel:      { color: '#64748B', fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  editInput:      { backgroundColor: '#F8FAFC', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16, color: '#001F5B', fontSize: 15, borderWidth: 1, borderColor: '#E2E8F0' },
  posRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  posChip:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  posChipActive:  { backgroundColor: '#001F5B', borderColor: '#001F5B' },
  posChipText:    { fontSize: 13, fontWeight: '600', color: '#64748B' },
  posChipTextActive: { color: '#FFFFFF' },
  editBtnRow:     { flexDirection: 'row', gap: 12, marginTop: 24 },
  editCancelBtn:  { flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0', alignItems: 'center' },
  editCancelText: { color: '#64748B', fontSize: 15, fontWeight: '600' },
  editSaveBtn:    { flex: 2, paddingVertical: 14, borderRadius: 14, backgroundColor: '#001F5B', alignItems: 'center' },
  editSaveText:   { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  // Maç Geçmişi
  historyCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10, borderLeftWidth: 4, shadowColor: '#001F5B', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  historyTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  historyFormatBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  historyFormatText: { fontSize: 11, fontWeight: '700' },
  historyDate: { flex: 1, color: '#64748B', fontSize: 12 },
  historyRatingBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  historyRatingText: { fontSize: 12, fontWeight: '800' },
  historyVenue: { color: '#001F5B', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  historyDistrict: { color: '#64748B', fontSize: 12, marginBottom: 8 },
  historyStats: { flexDirection: 'row', gap: 12 },
  historyStatItem: { fontSize: 13, color: '#374151', fontWeight: '600' },
  emptyHistory: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyHistoryIcon: { fontSize: 48 },
  emptyHistoryText: { color: '#64748B', fontSize: 15 },
  emptyHistoryLink: { color: '#00A0D2', fontSize: 14, fontWeight: '600' },
});
