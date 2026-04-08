import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Alert, Animated, Platform,
  Modal, TextInput
} from 'react-native';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { formatMatchDate } from '../lib/utils';

function haptic(type = 'light') {
  if (Platform.OS === 'web') return;
  try {
    const H = require('expo-haptics');
    if (type === 'success') H.notificationAsync(H.NotificationFeedbackType.Success);
    else if (type === 'medium') H.impactAsync(H.ImpactFeedbackStyle.Medium);
    else H.impactAsync(H.ImpactFeedbackStyle.Light);
  } catch (_) {}
}

function hoursFromNow(iso) {
  if (!iso) return null;
  const diff = new Date(iso) - new Date();
  const h = Math.round(diff / 3600000);
  if (h < 0) return null;
  if (h === 0) return 'Az sonra';
  if (h < 24) return `${h} saat sonra`;
  return `${Math.round(h / 24)} gün sonra`;
}

const FORMAT_COLORS = {
  '5v5': '#3B82F6', '6v6': '#8B5CF6', '7v7': '#10B981',
  '8v8': '#F59E0B', '11v11': '#EF4444',
};

const FORMATS = ['Tümü', '5v5', '6v6', '7v7', '8v8', 'Açık', 'Bugün'];

export default function MatchListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [matches, setMatches]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [selectedFormat, setSelectedFormat] = useState('Tümü');
  const [joiningId, setJoiningId]       = useState(null);
  const [listTab, setListTab]           = useState('all'); // 'nearby' | 'all'

  // Başvuru modal
  const [applyModal, setApplyModal]     = useState(false);
  const [applyMatch, setApplyMatch]     = useState(null);
  const [applyPosition, setApplyPosition] = useState('');
  const [applyMessage, setApplyMessage] = useState('');
  const [applying, setApplying]         = useState(false);

  const fetchMatches = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    let query = supabase
      .from('matches')
      .select('*, venues(name, district, city)')
      .eq('status', 'open')
      .order('match_date', { ascending: true });

    if (listTab === 'nearby') {
      query = query.eq('is_seeking_players', true);
    }

    if (selectedFormat === 'Bugün') {
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const todayEnd   = new Date(); todayEnd.setHours(23,59,59,999);
      query = query.gte('match_date', todayStart.toISOString()).lte('match_date', todayEnd.toISOString());
    } else if (selectedFormat !== 'Tümü' && selectedFormat !== 'Açık') {
      query = query.eq('format', selectedFormat);
    }

    const { data } = await query;
    setMatches(data ?? []);

    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  }, [selectedFormat, listTab]);

  useEffect(() => { fetchMatches(); }, [fetchMatches]);

  async function handleJoin(match) {
    setJoiningId(match.id);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Giriş Gerekli', 'Maça katılmak için giriş yapmalısın.');
      setJoiningId(null);
      return;
    }

    const { error } = await supabase
      .from('match_players')
      .insert({ match_id: match.id, user_id: user.id });

    setJoiningId(null);

    if (error) {
      if (error.code === '23505') {
        Alert.alert('Zaten Katıldın ⚽', 'Bu maçta zaten kayıtlısın.');
      } else {
        Alert.alert('Hata', error.message);
      }
    } else {
      Alert.alert('Katıldın! 🎉', `${match.venues?.name ?? 'Maç'} için kaydın alındı.`);
      fetchMatches();
    }
  }

  async function handleApply() {
    if (!applyMatch || !applyPosition) return;
    setApplying(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { Alert.alert('Giriş Gerekli', 'Başvurmak için giriş yapmalısın.'); setApplying(false); return; }
    const { error } = await supabase.from('match_applications').insert({
      match_id: applyMatch.id,
      user_id: user.id,
      position: applyPosition,
      message: applyMessage,
      status: 'pending',
    });
    setApplying(false);
    setApplyModal(false);
    setApplyMessage('');
    setApplyPosition('');
    if (error) {
      if (error.code === '23505') Alert.alert('Zaten Başvurdun ✓', 'Bu maça zaten başvurdun.');
      else Alert.alert('Hata', error.message);
    } else {
      haptic('success');
      Alert.alert('Başvurun Alındı! 🎉', 'Maç organizatörü seni onaylayacak.');
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Maçlar</Text>
          {matches.length > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{matches.length}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.headerCta} onPress={() => navigation.navigate('CreateMatch')}>
          <Text style={styles.headerCtaText}>+ Kur</Text>
        </TouchableOpacity>
      </View>

      {/* 2 tab */}
      <View style={styles.listTabs}>
        <TouchableOpacity
          style={[styles.listTabBtn, listTab === 'nearby' && styles.listTabBtnActive]}
          onPress={() => { haptic(); setListTab('nearby'); }}>
          <Text style={[styles.listTabText, listTab === 'nearby' && styles.listTabTextActive]}>⚡ Oyuncu Aranıyor</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.listTabBtn, listTab === 'all' && styles.listTabBtnActive]}
          onPress={() => { haptic(); setListTab('all'); }}>
          <Text style={[styles.listTabText, listTab === 'all' && styles.listTabTextActive]}>Tüm Maçlar</Text>
        </TouchableOpacity>
      </View>

      {/* Format filtresi */}
      <View style={styles.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FORMATS.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, selectedFormat === f && styles.filterChipActive]}
              onPress={() => setSelectedFormat(f)}
            >
              <Text style={[styles.filterChipText, selectedFormat === f && styles.filterChipTextActive]}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </View>
      ) : matches.length === 0 ? (
        <EmptyState onCreatePress={() => navigation.navigate('CreateMatch')} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchMatches(true)}
              tintColor="#00A0D2"
              colors={['#00A0D2']}
            />
          }
        >
          {matches.map(match => (
            <MatchCard
              key={match.id}
              match={match}
              joining={joiningId === match.id}
              onJoin={() => handleJoin(match)}
              onApply={() => { setApplyMatch(match); setApplyModal(true); }}
              onRate={() => navigation.navigate('MatchRating', {
                matchId: match.id,
                venueId: match.venue_id,
                venueName: match.venues?.name,
                matchDate: match.match_date ? new Date(match.match_date).toLocaleDateString('tr-TR') : '',
                format: match.format,
              })}
            />
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Başvuru Modal */}
      <Modal visible={applyModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setApplyModal(false)}>
        <View style={styles.applyModalContainer}>
          <View style={styles.applyModalHeader}>
            <Text style={styles.applyModalTitle}>Oyuncu Başvurusu</Text>
            <TouchableOpacity onPress={() => setApplyModal(false)}>
              <Text style={styles.applyModalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.applyModalBody}>
            {applyMatch && (
              <View style={styles.applyMatchInfo}>
                <Text style={styles.applyMatchVenue}>{applyMatch.venues?.name}</Text>
                <Text style={styles.applyMatchDate}>{formatMatchDate(applyMatch.match_date)}</Text>
                {(applyMatch.needed_positions || []).length > 0 && (
                  <View style={styles.neededRow}>
                    {(applyMatch.needed_positions || []).map(pos => (
                      <View key={pos} style={styles.neededBadge}><Text style={styles.neededBadgeText}>{pos} aranıyor</Text></View>
                    ))}
                  </View>
                )}
              </View>
            )}

            <Text style={styles.applyLabel}>Pozisyon</Text>
            <View style={styles.posRow}>
              {['Kaleci', 'Defans', 'Orta Saha', 'Forvet'].map(pos => (
                <TouchableOpacity key={pos}
                  style={[styles.posChip, applyPosition === pos && styles.posChipActive]}
                  onPress={() => setApplyPosition(pos)}>
                  <Text style={[styles.posChipText, applyPosition === pos && styles.posChipTextActive]}>{pos}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.applyLabel}>Mesaj (İsteğe Bağlı)</Text>
            <TextInput
              style={styles.applyInput}
              value={applyMessage}
              onChangeText={setApplyMessage}
              placeholder="Kendini tanıt, neden oynamak istiyorsun?"
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.applySubmitBtn, (!applyPosition || applying) && { opacity: 0.5 }]}
              onPress={handleApply}
              disabled={!applyPosition || applying}>
              <Text style={styles.applySubmitBtnText}>{applying ? 'Gönderiliyor…' : 'Başvur 🚀'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function MatchCard({ match, joining, onJoin, onApply, onRate }) {
  const ballAnim  = useRef(new Animated.Value(0)).current;
  const ballOpacity = useRef(new Animated.Value(0)).current;
  const [joined, setJoined] = useState(false);

  const current  = match.current_players ?? 0;
  const max      = match.max_players ?? 10;
  const ratio    = Math.min(current / max, 1);
  const full     = current >= max;
  const barColor = ratio >= 1 ? '#EF4444' : ratio >= 0.6 ? '#F59E0B' : '#10B981';
  const fmtColor = FORMAT_COLORS[match.format] || '#3B82F6';
  const timeLabel = hoursFromNow(match.match_date);
  const isPast   = match.match_date && new Date(match.match_date) < new Date();

  function handlePress() {
    if (full || joining || joined) return;
    haptic('medium');
    // ⚽ fly up animation
    ballAnim.setValue(0);
    ballOpacity.setValue(1);
    Animated.parallel([
      Animated.timing(ballAnim, { toValue: -80, duration: 600, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(ballOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();
    setJoined(true);
    onJoin();
  }

  return (
    <View style={styles.card}>
      {/* Sol renkli şerit */}
      <View style={[styles.cardStrip, { backgroundColor: fmtColor }]} />

      <View style={styles.cardBody}>
        {/* Üst */}
        <View style={styles.cardTop}>
          <View style={styles.cardTopLeft}>
            <View style={[styles.formatBadge, { backgroundColor: fmtColor + '1A' }]}>
              <Text style={[styles.formatBadgeText, { color: fmtColor }]}>{match.format || '5v5'}</Text>
            </View>
            {!full && timeLabel && <Text style={styles.timeLabel}>{timeLabel}</Text>}
            {full && <View style={styles.fullBadge}><Text style={styles.fullBadgeText}>Dolu</Text></View>}
          </View>
        </View>

        <Text style={styles.venueName} numberOfLines={1}>
          {match.venues?.name ?? 'Saha'}
        </Text>
        <Text style={styles.location}>
          📍 {[match.venues?.district, match.venues?.city].filter(Boolean).join(', ') || 'Bursa'}
        </Text>
        <Text style={styles.dateText}>
          🕐 {formatMatchDate(match.match_date)}
        </Text>

        {/* Doluluk barı */}
        <View style={styles.fillSection}>
          <View style={styles.fillHeader}>
            <Text style={styles.fillLabel}>{current}/{max} oyuncu · {max - current > 0 ? `${max - current} yer kaldı` : 'Dolu'}</Text>
            <Text style={[styles.fillCount, { color: barColor }]}>{Math.round(ratio * 100)}%</Text>
          </View>
          <View style={styles.fillBarBg}>
            <View style={[styles.fillBarFg, { width: `${ratio * 100}%`, backgroundColor: barColor }]} />
          </View>
        </View>

        {/* Oyuncu aranıyor badge */}
        {match.is_seeking_players && (match.needed_positions || []).length > 0 && (
          <View style={styles.neededRow}>
            {(match.needed_positions || []).map(pos => (
              <View key={pos} style={styles.neededBadge}>
                <Text style={styles.neededBadgeText}>⚡ {pos}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Alt */}
        <View style={styles.cardBottom}>
          <Text style={styles.priceText}>
            {match.price ? `💳 ${Math.ceil(match.price / (max / 2))}₺/kişi` : 'Ücretsiz'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {/* ⚽ fly ball */}
            <Animated.Text style={[styles.flyBall, { transform: [{ translateY: ballAnim }], opacity: ballOpacity }]}>
              ⚽
            </Animated.Text>
            {isPast && joined ? (
              <TouchableOpacity style={styles.rateBtn} onPress={onRate}>
                <Text style={styles.rateBtnText}>⭐ Değerlendir</Text>
              </TouchableOpacity>
            ) : (
              <>
                {match.is_seeking_players && !joined && (
                  <TouchableOpacity style={styles.applyBtn} onPress={onApply}>
                    <Text style={styles.applyBtnText}>Başvur</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.joinBtn, (full || joined) && styles.joinBtnDone]}
                  onPress={handlePress}
                  disabled={full || joining || joined}
                >
                  {joining
                    ? <ActivityIndicator color="#FFF" size="small" />
                    : <Text style={styles.joinBtnText}>{joined ? 'Katıldın ✓' : full ? 'Dolu' : 'Katıl'}</Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

function SkeletonCard() {
  return (
    <View style={styles.skeleton}>
      <View style={styles.skeletonLine} />
      <View style={[styles.skeletonLine, { width: '60%', marginTop: 8 }]} />
      <View style={[styles.skeletonLine, { width: '80%', marginTop: 8, height: 6 }]} />
    </View>
  );
}

function EmptyState({ onCreatePress }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>⚽</Text>
      <Text style={styles.emptyTitle}>Henüz maç yok</Text>
      <Text style={styles.emptySub}>İlk maçı sen kur, oyuncular gelsin!</Text>
      <TouchableOpacity style={styles.emptyBtn} onPress={onCreatePress}>
        <Text style={styles.emptyBtnText}>Maç Oluştur</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F9' },

  header: { backgroundColor: '#001F5B', paddingTop: 12, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backText: { color: 'rgba(255,255,255,0.55)', fontSize: 14 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  headerBadge: { backgroundColor: '#10B981', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  headerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  headerCta: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  headerCtaText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  filterWrap: { backgroundColor: '#FFFFFF', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  filterRow: { paddingHorizontal: 16, gap: 8 },
  filterChip: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 22, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  filterChipActive: { backgroundColor: '#001F5B', borderColor: '#001F5B' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  filterChipTextActive: { color: '#FFFFFF' },

  loadingWrap: { padding: 16 },
  skeleton: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12 },
  skeletonLine: { height: 14, borderRadius: 7, backgroundColor: '#E2E8F0', width: '100%' },

  list: { paddingHorizontal: 16, paddingTop: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 12, shadowColor: '#001F5B', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3, flexDirection: 'row', overflow: 'hidden' },
  cardStrip: { width: 5 },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { marginBottom: 8 },
  cardTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  venueName: { fontSize: 15, fontWeight: '700', color: '#001F5B', marginBottom: 3 },
  formatBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  formatBadgeText: { fontSize: 12, fontWeight: '700' },
  timeLabel: { fontSize: 11, color: '#94A3B8' },
  fullBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  fullBadgeText: { color: '#EF4444', fontSize: 11, fontWeight: '700' },
  location: { fontSize: 12, color: '#94A3B8', marginBottom: 3 },
  dateText: { fontSize: 12, color: '#64748B', marginBottom: 10 },

  fillSection: { marginBottom: 14 },
  fillHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  fillLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  fillCount: { fontSize: 11, color: '#00A0D2', fontWeight: '700' },
  fillBarBg: { height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' },
  fillBarFg: { height: '100%', borderRadius: 4 },

  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceText: { fontSize: 13, fontWeight: '600', color: '#001F5B' },
  joinBtn: { backgroundColor: '#001F5B', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 22, alignItems: 'center', shadowColor: '#001F5B', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  joinBtnDone: { backgroundColor: '#10B981', shadowColor: '#10B981' },
  joinBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  flyBall: { position: 'absolute', fontSize: 20, alignSelf: 'center', bottom: 8, zIndex: 10 },

  listTabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  listTabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  listTabBtnActive: { borderBottomWidth: 2.5, borderBottomColor: '#001F5B' },
  listTabText: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
  listTabTextActive: { color: '#001F5B' },

  neededRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  neededBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  neededBadgeText: { fontSize: 11, fontWeight: '700', color: '#D97706' },

  applyBtn: { backgroundColor: '#F59E0B', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22 },
  applyBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  rateBtn: { backgroundColor: '#8B5CF6', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22 },
  rateBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  applyModalContainer: { flex: 1, backgroundColor: '#F4F6F9' },
  applyModalHeader: { backgroundColor: '#001F5B', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20 },
  applyModalTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  applyModalClose: { color: 'rgba(255,255,255,0.6)', fontSize: 18, fontWeight: '700' },
  applyModalBody: { padding: 16 },
  applyMatchInfo: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, gap: 4 },
  applyMatchVenue: { fontSize: 16, fontWeight: '800', color: '#001F5B' },
  applyMatchDate: { fontSize: 13, color: '#64748B' },
  applyLabel: { fontSize: 13, fontWeight: '700', color: '#001F5B', marginBottom: 8, marginTop: 4 },
  posRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  posChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#fff' },
  posChipActive: { backgroundColor: '#001F5B', borderColor: '#001F5B' },
  posChipText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  posChipTextActive: { color: '#fff' },
  applyInput: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#001F5B', marginBottom: 16, minHeight: 80, textAlignVertical: 'top' },
  applySubmitBtn: { backgroundColor: '#001F5B', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  applySubmitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#001F5B', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#94A3B8', textAlign: 'center', marginBottom: 24 },
  emptyBtn: { backgroundColor: '#001F5B', paddingHorizontal: 28, paddingVertical: 13, borderRadius: 14, shadowColor: '#001F5B', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  emptyBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
