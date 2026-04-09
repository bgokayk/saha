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
  const [joinedIds, setJoinedIds]       = useState(new Set());
  const [listTab, setListTab]           = useState('all');

  const [applyModal, setApplyModal]     = useState(false);
  const [applyMatch, setApplyMatch]     = useState(null);
  const [applyPosition, setApplyPosition] = useState('');
  const [applyMessage, setApplyMessage] = useState('');
  const [applying, setApplying]         = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('match_players').select('match_id').eq('user_id', user.id).then(({ data }) => {
        if (data) setJoinedIds(new Set(data.map(r => r.match_id)));
      });
    });
  }, []);

  const fetchMatches = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    let query = supabase.from('matches').select('*, venues(name, district, city)').eq('status', 'open').order('match_date', { ascending: true });

    if (listTab === 'nearby') query = query.eq('is_seeking_players', true);

    if (selectedFormat === 'Bugün') {
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const todayEnd   = new Date(); todayEnd.setHours(23,59,59,999);
      query = query.gte('match_date', todayStart.toISOString()).lte('match_date', todayEnd.toISOString());
    } else if (selectedFormat !== 'Tümü' && selectedFormat !== 'Açık') {
      query = query.eq('format', selectedFormat);
    }

    try {
      const { data } = await query;
      setMatches(data ?? []);
    } catch (err) {
      console.warn('fetchMatches error:', err);
      Alert.alert('Hata', 'Maçlar yüklenirken bir sorun oluştu.');
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, [selectedFormat, listTab]);

  useEffect(() => { fetchMatches(); }, [fetchMatches]);

  async function handleJoin(match) {
    setJoiningId(match.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { Alert.alert('Giriş Gerekli', ''); return; }
      if (joinedIds.has(match.id)) { Alert.alert('Zaten Katıldın ⚽', ''); return; }

      const { error } = await supabase.from('match_players').insert({ match_id: match.id, user_id: user.id });
      if (error) {
        if (error.code === '23505') {
          setJoinedIds(prev => new Set([...prev, match.id]));
          Alert.alert('Zaten Katıldın ⚽', '');
        } else {
          Alert.alert('Hata', error.message);
        }
        return;
      }
      // Trigger handles DB update — only update local UI state
      haptic('success');
      setJoinedIds(prev => new Set([...prev, match.id]));
      setMatches(prev => prev.map(m =>
        m.id === match.id ? { ...m, current_players: (m.current_players || 0) + 1 } : m
      ));
    } catch (err) {
      console.warn('handleJoin error:', err);
      Alert.alert('Hata', 'Katılım sırasında bir sorun oluştu.');
    } finally {
      setJoiningId(null);
    }
  }

  async function handleApply() {
    if (!applyMatch || !applyPosition) return;
    setApplying(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { Alert.alert('Giriş Gerekli', ''); setApplying(false); return; }
    const { error } = await supabase.from('match_applications').insert({
      match_id: applyMatch.id, user_id: user.id,
      position: applyPosition, message: applyMessage, status: 'pending',
    });
    setApplying(false); setApplyModal(false); setApplyMessage(''); setApplyPosition('');
    if (error) {
      if (error.code === '23505') Alert.alert('Zaten Başvurdun ✓', '');
      else Alert.alert('Hata', error.message);
    } else {
      haptic('success');
      Alert.alert('Başvurun Alındı! 🎉', 'Maç organizatörü seni onaylayacak.');
    }
  }

  return (
    <View style={styles.container}>
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
        {[
          { key: 'nearby', label: '⚡ Oyuncu Aranıyor' },
          { key: 'all',    label: 'Tüm Maçlar' },
        ].map(t => (
          <TouchableOpacity key={t.key}
            style={[styles.listTabBtn, listTab === t.key && styles.listTabBtnActive]}
            onPress={() => { haptic(); setListTab(t.key); }}>
            <Text style={[styles.listTabText, listTab === t.key && styles.listTabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Format filtresi */}
      <View style={styles.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FORMATS.map(f => (
            <TouchableOpacity key={f}
              style={[styles.filterChip, selectedFormat === f && styles.filterChipActive]}
              onPress={() => setSelectedFormat(f)}>
              <Text style={[styles.filterChipText, selectedFormat === f && styles.filterChipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          {[1,2,3].map(i => <SkeletonCard key={i} />)}
        </View>
      ) : matches.length === 0 ? (
        <EmptyState onCreatePress={() => navigation.navigate('CreateMatch')} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchMatches(true)} tintColor="#00D4FF" colors={['#00D4FF']} />
          }
        >
          {matches.map(match => (
            <MatchCard
              key={match.id}
              match={match}
              joining={joiningId === match.id}
              isJoined={joinedIds.has(match.id)}
              onPress={() => navigation.navigate('MatchDetail', { matchId: match.id })}
              onJoin={() => handleJoin(match)}
              onApply={() => { setApplyMatch(match); setApplyModal(true); }}
              onRate={() => navigation.navigate('MatchRating', {
                matchId: match.id, venueId: match.venue_id,
                venueName: match.venues?.name, matchDate: match.match_date ? new Date(match.match_date).toLocaleDateString('tr-TR') : '',
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
              {['Kaleci','Defans','Orta Saha','Forvet'].map(pos => (
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
              value={applyMessage} onChangeText={setApplyMessage}
              placeholder="Kendini tanıt..." placeholderTextColor="#475569"
              multiline numberOfLines={3}
            />
            <TouchableOpacity
              style={[styles.applySubmitBtn, (!applyPosition || applying) && { opacity: 0.5 }]}
              onPress={handleApply} disabled={!applyPosition || applying}>
              <Text style={styles.applySubmitBtnText}>{applying ? 'Gönderiliyor…' : 'Başvur 🚀'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function MatchCard({ match, joining, isJoined, onPress, onJoin, onApply, onRate }) {
  const current   = match.current_players ?? 0;
  const max       = match.max_players ?? 10;
  const ratio     = Math.min(current / max, 1);
  const full      = current >= max;
  const barColor  = ratio >= 1 ? '#FF4757' : ratio >= 0.6 ? '#FFB800' : '#00E096';
  const fmtColor  = FORMAT_COLORS[match.format] || '#3B82F6';
  const timeLabel = hoursFromNow(match.match_date);
  const isPast    = match.match_date && new Date(match.match_date) < new Date();

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.92}>
      <View style={[styles.cardStrip, { backgroundColor: fmtColor }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={[styles.formatBadge, { backgroundColor: fmtColor + '22' }]}>
            <Text style={[styles.formatBadgeText, { color: fmtColor }]}>{match.format || '5v5'}</Text>
          </View>
          {!full && <View style={styles.statusBadge}><Text style={styles.statusBadgeText}>Kayıt Açık</Text></View>}
          {full && <View style={[styles.statusBadge, { backgroundColor: 'rgba(255,71,87,0.15)' }]}><Text style={[styles.statusBadgeText, { color: '#FF4757' }]}>Dolu</Text></View>}
          {timeLabel && <Text style={styles.timeLabel}>{timeLabel}</Text>}
        </View>
        <Text style={styles.venueName} numberOfLines={1}>{match.venues?.name ?? 'Saha'}</Text>
        <Text style={styles.location}>📍 {[match.venues?.district, match.venues?.city].filter(Boolean).join(', ') || 'Bursa'}</Text>
        <Text style={styles.dateText}>🕐 {formatMatchDate(match.match_date)}</Text>

        <View style={styles.fillBarBg}>
          <View style={[styles.fillBarFg, { width: `${ratio * 100}%`, backgroundColor: barColor }]} />
        </View>
        <Text style={styles.fillLabel}>{current}/{max} oyuncu · {max - current > 0 ? `${max - current} yer kaldı` : 'Dolu'}</Text>

        {match.is_seeking_players && (match.needed_positions || []).length > 0 && (
          <View style={styles.seekingBanner}>
            <Text style={styles.seekingText}>⚡ Oyuncu aranıyor: {(match.needed_positions || []).join(', ')}</Text>
            <TouchableOpacity style={styles.seekingApplyBtn} onPress={onApply}>
              <Text style={styles.seekingApplyBtnText}>Başvur</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.cardBottom}>
          <Text style={styles.priceText}>{match.price ? `${Math.ceil(match.price / (max / 2))}₺/kişi` : 'Ücretsiz'}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {isPast && isJoined ? (
              <TouchableOpacity style={styles.rateBtn} onPress={onRate}>
                <Text style={styles.rateBtnText}>⭐ Değerlendir</Text>
              </TouchableOpacity>
            ) : (
              <>
                {match.is_seeking_players && !isJoined && (
                  <TouchableOpacity style={styles.applyBtn} onPress={onApply}>
                    <Text style={styles.applyBtnText}>Başvur</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.joinBtn, isJoined && styles.joinBtnDone, full && styles.joinBtnFull]}
                  onPress={onJoin}
                  disabled={full || joining || isJoined}>
                  {joining
                    ? <ActivityIndicator color="#0A1628" size="small" />
                    : <Text style={[styles.joinBtnText, isJoined && { color: '#00E096' }]}>
                        {isJoined ? 'Katıldın ✓' : full ? 'Dolu' : 'Katıl'}
                      </Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function SkeletonCard() {
  return (
    <View style={styles.skeleton}>
      <View style={styles.skeletonLine} />
      <View style={[styles.skeletonLine, { width: '60%', marginTop: 8 }]} />
      <View style={[styles.skeletonLine, { width: '80%', marginTop: 8, height: 4 }]} />
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
  container: { flex: 1, backgroundColor: '#0A1628' },

  header: {
    backgroundColor: '#0A1628', paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,212,255,0.12)',
  },
  backText:      { color: 'rgba(255,255,255,0.45)', fontSize: 14 },
  headerCenter:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle:   { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  headerBadge:   { backgroundColor: '#00D4FF', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  headerBadgeText:{ color: '#0A1628', fontSize: 11, fontWeight: '800' },
  headerCta:     { backgroundColor: 'rgba(0,212,255,0.12)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,212,255,0.3)' },
  headerCtaText: { color: '#00D4FF', fontSize: 13, fontWeight: '700' },

  listTabs:        { flexDirection: 'row', backgroundColor: '#0A1628', borderBottomWidth: 1, borderBottomColor: 'rgba(0,212,255,0.08)' },
  listTabBtn:      { flex: 1, paddingVertical: 12, alignItems: 'center' },
  listTabBtnActive:{ borderBottomWidth: 2, borderBottomColor: '#00D4FF' },
  listTabText:     { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.35)' },
  listTabTextActive:{ color: '#00D4FF', fontWeight: '700' },

  filterWrap: { backgroundColor: '#0A1628', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(0,212,255,0.08)' },
  filterRow:  { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(0,212,255,0.2)',
  },
  filterChipActive:     { backgroundColor: 'rgba(0,212,255,0.12)', borderColor: '#00D4FF' },
  filterChipText:       { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
  filterChipTextActive: { color: '#00D4FF', fontWeight: '700' },

  loadingWrap: { padding: 16 },
  skeleton:    { backgroundColor: '#0F1E35', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(0,212,255,0.08)' },
  skeletonLine:{ height: 14, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.06)', width: '100%' },

  list: { paddingHorizontal: 16, paddingTop: 16 },
  card: {
    backgroundColor: '#0F1E35', borderRadius: 16, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(0,212,255,0.12)',
    flexDirection: 'row', overflow: 'hidden',
  },
  cardStrip:  { width: 4 },
  cardBody:   { flex: 1, padding: 14 },
  cardTop:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  venueName:  { fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginBottom: 3 },
  formatBadge:{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
  formatBadgeText:{ fontSize: 11, fontWeight: '700' },
  statusBadge:{ backgroundColor: 'rgba(0,224,150,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusBadgeText:{ color: '#00E096', fontSize: 10, fontWeight: '700' },
  timeLabel:  { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginLeft: 'auto' },
  location:   { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 2 },
  dateText:   { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 10 },

  fillBarBg:  { height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, marginBottom: 4 },
  fillBarFg:  { height: 4, borderRadius: 2 },
  fillLabel:  { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 8 },

  seekingBanner:       { backgroundColor: 'rgba(255,184,0,0.08)', borderWidth: 1, borderColor: 'rgba(255,184,0,0.3)', borderRadius: 10, padding: 10, marginBottom: 8 },
  seekingText:         { color: '#FFB800', fontSize: 12, fontWeight: '600' },
  seekingApplyBtn:     { backgroundColor: '#FFB800', borderRadius: 10, padding: 10, marginTop: 8, alignItems: 'center' },
  seekingApplyBtnText: { color: '#0A1628', fontWeight: '700', fontSize: 13 },

  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceText:  { fontSize: 13, fontWeight: '700', color: '#FFB800' },
  joinBtn:    { backgroundColor: '#00D4FF', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  joinBtnDone:{ backgroundColor: 'rgba(0,224,150,0.12)', borderWidth: 1, borderColor: '#00E096' },
  joinBtnFull:{ backgroundColor: 'rgba(255,255,255,0.06)' },
  joinBtnText:{ color: '#0A1628', fontSize: 12, fontWeight: '800' },
  applyBtn:   { backgroundColor: 'rgba(255,184,0,0.15)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,184,0,0.4)' },
  applyBtnText:{ color: '#FFB800', fontSize: 12, fontWeight: '700' },
  rateBtn:    { backgroundColor: 'rgba(139,92,246,0.15)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(139,92,246,0.4)' },
  rateBtnText:{ color: '#8B5CF6', fontSize: 12, fontWeight: '700' },

  neededRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  neededBadge:     { backgroundColor: 'rgba(255,184,0,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,184,0,0.3)' },
  neededBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFB800' },

  applyModalContainer: { flex: 1, backgroundColor: '#0A1628' },
  applyModalHeader:    { backgroundColor: '#0A1628', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(0,212,255,0.12)' },
  applyModalTitle:     { color: '#fff', fontSize: 18, fontWeight: '800' },
  applyModalClose:     { color: 'rgba(255,255,255,0.45)', fontSize: 18 },
  applyModalBody:      { padding: 16 },
  applyMatchInfo:      { backgroundColor: '#0F1E35', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(0,212,255,0.12)' },
  applyMatchVenue:     { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  applyMatchDate:      { fontSize: 13, color: 'rgba(255,255,255,0.45)' },
  applyLabel:          { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.6)', marginBottom: 8, marginTop: 8, letterSpacing: 1 },
  posRow:              { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  posChip:             { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,212,255,0.2)', backgroundColor: 'rgba(255,255,255,0.04)' },
  posChipActive:       { backgroundColor: 'rgba(0,212,255,0.12)', borderColor: '#00D4FF' },
  posChipText:         { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
  posChipTextActive:   { color: '#00D4FF', fontWeight: '700' },
  applyInput:          { backgroundColor: '#0F1E35', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,212,255,0.2)', paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#FFFFFF', marginBottom: 16, minHeight: 80, textAlignVertical: 'top' },
  applySubmitBtn:      { backgroundColor: '#00D4FF', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  applySubmitBtnText:  { color: '#0A1628', fontSize: 15, fontWeight: '800' },

  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIcon:  { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  emptySub:   { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 24 },
  emptyBtn:   { backgroundColor: '#00D4FF', paddingHorizontal: 28, paddingVertical: 13, borderRadius: 14 },
  emptyBtnText:{ color: '#0A1628', fontSize: 15, fontWeight: '800' },
});
