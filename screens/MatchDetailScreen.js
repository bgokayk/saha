import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Platform, Share, Linking
} from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { formatMatchDate, avatarColor, initials, calcRating, ratingColor } from '../lib/utils';

function haptic(type = 'light') {
  if (Platform.OS === 'web') return;
  try {
    const H = require('expo-haptics');
    if (type === 'success') H.notificationAsync(H.NotificationFeedbackType.Success);
    else H.impactAsync(H.ImpactFeedbackStyle.Light);
  } catch (_) {}
}

const FORMAT_COLORS = {
  '5v5': '#3B82F6', '6v6': '#8B5CF6', '7v7': '#10B981', '8v8': '#F59E0B',
};

export default function MatchDetailScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { matchId } = route.params || {};

  const [match, setMatch]           = useState(null);
  const [players, setPlayers]       = useState([]);
  const [myId, setMyId]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const isJoined   = players.some(p => p.user_id === myId);
  const isOrganizer = match?.organizer_id === myId;
  const isPast      = match?.match_date && new Date(match.match_date) < new Date();
  const fmtColor    = FORMAT_COLORS[match?.format] || '#3B82F6';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: { user } }, { data: m }, { data: mp }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('matches').select('*, venues(*), organizer:profiles!organizer_id(id, full_name)').eq('id', matchId).single(),
        supabase.from('match_players').select('user_id, profiles(id, full_name, position, goals, assists, matches_played, avatar_url)').eq('match_id', matchId),
      ]);
      setMyId(user?.id || null);
      setMatch(m);
      setPlayers(mp || []);
    } catch (err) {
      console.warn('load error:', err);
      Alert.alert('Hata', 'Maç bilgileri yüklenirken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => { load(); }, [load]);

  if (!matchId) {
    return (
      <View style={[styles.loadWrap, { paddingTop: insets.top }]}>
        <Text style={{ color: '#94A3B8' }}>Geçersiz maç ID.</Text>
      </View>
    );
  }

  async function handleJoin() {
    if (!myId) { Alert.alert('Giriş Gerekli', 'Önce giriş yap.'); return; }
    setActionLoading(true);
    const { error } = await supabase.from('match_players').insert({ match_id: matchId, user_id: myId });
    if (error) {
      if (error.code === '23505') Alert.alert('Zaten Katıldın ⚽', '');
      else Alert.alert('Hata', error.message);
    } else {
      // Trigger handles current_players increment automatically
      haptic('success');
      load();
    }
    setActionLoading(false);
  }

  async function handleLeave() {
    Alert.alert('Maçtan Ayrıl', 'Bu maçtan ayrılmak istediğinden emin misin?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Ayrıl', style: 'destructive', onPress: async () => {
        setActionLoading(true);
        try {
          const { error } = await supabase.from('match_players').delete().eq('match_id', matchId).eq('user_id', myId);
          if (error) { Alert.alert('Hata', error.message); return; }
          // Trigger handles current_players decrement automatically
          haptic();
          await load();
        } catch (err) {
          console.warn('handleLeave error:', err);
          Alert.alert('Hata', 'Maçtan ayrılırken bir sorun oluştu.');
        } finally {
          setActionLoading(false);
        }
      }},
    ]);
  }

  async function handleEndMatch() {
    Alert.alert('Maçı Bitir', 'Maçı tamamlandı olarak işaretlemek istiyor musun?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Bitir', onPress: async () => {
        try {
          const { error } = await supabase.from('matches').update({ status: 'completed' }).eq('id', matchId);
          if (error) { Alert.alert('Hata', error.message); return; }
          haptic('success');
          await load();
        } catch (err) {
          console.warn('handleEndMatch error:', err);
          Alert.alert('Hata', 'Maç bitirilirken bir sorun oluştu.');
        }
      }},
    ]);
  }

  async function handleShare() {
    if (!match) return;
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

  function handleShareWhatsApp() {
    if (!match) return;
    const date = match.match_date ? new Date(match.match_date) : null;
    const dateStr = date ? date.toLocaleDateString('tr-TR') : '';
    const msg = encodeURIComponent(
      `⚽ Maça gel! ${match.venues?.name || 'Halı Saha'} - ${dateStr} ${match.format}`
    );
    Linking.openURL(`whatsapp://send?text=${msg}`).catch(() => {
      Alert.alert('WhatsApp Bulunamadı', 'WhatsApp yüklü değil.');
    });
  }

  if (loading) {
    return (
      <View style={[styles.loadWrap, { paddingTop: insets.top }]}>
        <ActivityIndicator color="#00D4FF" size="large" />
      </View>
    );
  }

  if (!match) {
    return (
      <View style={[styles.loadWrap, { paddingTop: insets.top }]}>
        <Text style={{ color: '#94A3B8' }}>Maç bulunamadı.</Text>
      </View>
    );
  }

  const maxP    = match.max_players || 10;
  const slots   = Array.from({ length: maxP });
  const ratio   = Math.min((match.current_players || 0) / maxP, 1);
  const barColor = ratio >= 1 ? '#EF4444' : ratio >= 0.6 ? '#F59E0B' : '#10B981';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <View style={[styles.fmtBadge, { backgroundColor: fmtColor + '22' }]}>
          <Text style={[styles.fmtBadgeText, { color: fmtColor }]}>{match.format || '5v5'}</Text>
        </View>
        {isOrganizer && (
          <TouchableOpacity onPress={() => navigation.navigate('Chat', { matchId: matchId, isMatch: true, otherName: `${match.format} Maçı` })}>
            <Text style={styles.chatIconBtn}>💬</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={[styles.hero, { borderBottomColor: fmtColor }]}>
          <Text style={styles.heroVenue} numberOfLines={2}>{match.venues?.name || 'Saha'}</Text>
          <Text style={styles.heroLocation}>📍 {[match.venues?.district, match.venues?.city].filter(Boolean).join(', ') || 'Bursa'}</Text>
          <Text style={styles.heroDate}>🕐 {formatMatchDate(match.match_date)}</Text>
          <View style={styles.heroStatusRow}>
            <View style={[styles.statusBadge, match.status === 'open' ? styles.statusOpen : match.status === 'completed' ? styles.statusDone : styles.statusFull]}>
              <Text style={styles.statusText}>
                {match.status === 'open' ? '🟢 Açık' : match.status === 'completed' ? '✅ Tamamlandı' : '🔴 Dolu'}
              </Text>
            </View>
            {match.price > 0 && (
              <Text style={styles.heroPrice}>💳 {Math.ceil(match.price / (maxP / 2))}₺/kişi</Text>
            )}
          </View>

          {/* Doluluk bar */}
          <View style={styles.fillBar}>
            <View style={styles.fillBarBg}>
              <View style={[styles.fillBarFg, { width: `${ratio * 100}%`, backgroundColor: barColor }]} />
            </View>
            <Text style={styles.fillText}>{match.current_players || 0}/{maxP} oyuncu</Text>
          </View>
        </View>

        {/* Organizer */}
        {match.organizer && (
          <View style={styles.organizerRow}>
            <View style={[styles.orgAvatar, { backgroundColor: avatarColor(match.organizer.full_name) }]}>
              <Text style={styles.orgAvatarText}>{initials(match.organizer.full_name)}</Text>
            </View>
            <View>
              <Text style={styles.orgLabel}>Organizatör</Text>
              <Text style={styles.orgName}>{match.organizer.full_name}</Text>
            </View>
          </View>
        )}

        {/* Oyuncu Listesi */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Oyuncular ({match.current_players || 0}/{maxP})</Text>
          <View style={styles.playerGrid}>
            {slots.map((_, i) => {
              const mp = players[i];
              const prof = mp?.profiles;
              if (prof) {
                const rating = calcRating(prof);
                const rColor = ratingColor(rating);
                return (
                  <View key={i} style={styles.playerSlot}>
                    <View style={[styles.playerAvatar, { backgroundColor: avatarColor(prof.full_name) }]}>
                      <Text style={styles.playerAvatarText}>{initials(prof.full_name)}</Text>
                    </View>
                    <Text style={styles.playerName} numberOfLines={1}>{prof.full_name?.split(' ')[0]}</Text>
                    <Text style={styles.playerPos}>{prof.position?.slice(0, 3).toUpperCase() || 'OYN'}</Text>
                    <View style={[styles.playerRating, { backgroundColor: rColor + '22' }]}>
                      <Text style={[styles.playerRatingText, { color: rColor }]}>{rating.toFixed(1)}</Text>
                    </View>
                  </View>
                );
              }
              return (
                <View key={i} style={[styles.playerSlot, styles.playerSlotEmpty]}>
                  <View style={styles.playerAvatarEmpty}>
                    <Text style={styles.playerAvatarEmptyIcon}>+</Text>
                  </View>
                  <Text style={styles.playerEmptyText}>Boş</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Paylaşım butonları */}
        <View style={styles.shareRow}>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
            <Text style={styles.shareBtnText}>Davet Et 📤</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.whatsappBtn} onPress={handleShareWhatsApp}>
            <Text style={styles.whatsappBtnText}>WhatsApp'a Gönder</Text>
          </TouchableOpacity>
        </View>

        {/* Market butonu */}
        {(match.status === 'open' || isJoined) && (
          <TouchableOpacity
            style={styles.marketBtn}
            onPress={() => navigation.navigate('Market', { venueId: match.venue_id, matchId: matchId })}
          >
            <Text style={styles.marketBtnText}>🛒 Market</Text>
          </TouchableOpacity>
        )}

        {/* Saha kartı */}
        {match.venues && (
          <TouchableOpacity
            style={styles.venueCard}
            onPress={() => navigation.navigate('VenueDetail', { venueId: match.venue_id, venue: match.venues })}
          >
            <View style={styles.venueCardLeft}>
              <Text style={styles.venueCardIcon}>🏟️</Text>
              <View>
                <Text style={styles.venueCardName}>{match.venues.name}</Text>
                <Text style={styles.venueCardSub}>Saha Detayına Git →</Text>
              </View>
            </View>
            <Text style={styles.venueCardPrice}>{match.venues.price_per_hour || '—'}₺/sa</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Footer butonları */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {/* Chat */}
        <TouchableOpacity
          style={styles.chatBtn}
          onPress={() => navigation.navigate('Chat', { matchId: matchId, isMatch: true, otherName: `${match.format} Maçı` })}
        >
          <Text style={styles.chatBtnText}>💬</Text>
        </TouchableOpacity>

        {/* Ana aksiyon */}
        {actionLoading ? (
          <View style={[styles.mainBtn, { backgroundColor: '#94A3B8' }]}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : isPast && isJoined ? (
          <TouchableOpacity
            style={[styles.mainBtn, { backgroundColor: '#8B5CF6' }]}
            onPress={() => navigation.navigate('MatchRating', {
              matchId, venueId: match.venue_id, venueName: match.venues?.name,
              matchDate: match.match_date ? new Date(match.match_date).toLocaleDateString('tr-TR') : '',
              format: match.format,
            })}
          >
            <Text style={styles.mainBtnText}>⭐ Değerlendir</Text>
          </TouchableOpacity>
        ) : isJoined ? (
          <TouchableOpacity style={[styles.mainBtn, { backgroundColor: '#EF4444' }]} onPress={handleLeave}>
            <Text style={styles.mainBtnText}>Ayrıl</Text>
          </TouchableOpacity>
        ) : match.status !== 'open' || (match.current_players || 0) >= maxP ? (
          <View style={[styles.mainBtn, { backgroundColor: '#94A3B8' }]}>
            <Text style={styles.mainBtnText}>Dolu</Text>
          </View>
        ) : (
          <TouchableOpacity style={[styles.mainBtn, { backgroundColor: fmtColor }]} onPress={handleJoin}>
            <Text style={styles.mainBtnText}>⚽ Katıl</Text>
          </TouchableOpacity>
        )}

        {/* Organizer: Bitir butonu */}
        {isOrganizer && !isPast && match.status === 'open' && (
          <TouchableOpacity style={styles.endBtn} onPress={handleEndMatch}>
            <Text style={styles.endBtnText}>✅</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1628' },
  loadWrap:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A1628' },

  header: { backgroundColor: '#0A1628', paddingBottom: 14, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(0,212,255,0.12)' },
  backText:     { color: 'rgba(255,255,255,0.45)', fontSize: 14 },
  fmtBadge:     { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  fmtBadgeText: { fontSize: 13, fontWeight: '800' },
  chatIconBtn:  { fontSize: 22 },

  hero: { backgroundColor: '#0F1E35', padding: 20, borderBottomWidth: 3, marginBottom: 12, gap: 6 },
  heroVenue:    { fontSize: 22, fontWeight: '900', color: '#FFFFFF' },
  heroLocation: { fontSize: 13, color: '#8B9BB4' },
  heroDate:     { fontSize: 14, color: '#8B9BB4', fontWeight: '600' },
  heroStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  statusBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusOpen:   { backgroundColor: 'rgba(0,224,150,0.12)' },
  statusDone:   { backgroundColor: 'rgba(0,212,255,0.12)' },
  statusFull:   { backgroundColor: 'rgba(255,71,87,0.12)' },
  statusText:   { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  heroPrice:    { fontSize: 13, fontWeight: '700', color: '#FFB800' },
  fillBar:      { marginTop: 10, gap: 4 },
  fillBarBg:    { height: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' },
  fillBarFg:    { height: '100%', borderRadius: 4 },
  fillText:     { fontSize: 11, color: '#8B9BB4', fontWeight: '600' },

  organizerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#0F1E35', paddingHorizontal: 20, paddingVertical: 12, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(0,212,255,0.08)' },
  orgAvatar:    { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  orgAvatarText:{ color: '#fff', fontSize: 14, fontWeight: '800' },
  orgLabel:     { fontSize: 10, color: '#8B9BB4', fontWeight: '600' },
  orgName:      { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  section:      { paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', marginBottom: 12 },

  playerGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  playerSlot:  { width: '22%', backgroundColor: '#0F1E35', borderRadius: 14, padding: 10, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: 'rgba(0,212,255,0.12)' },
  playerSlotEmpty: { backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1.5, borderColor: 'rgba(0,212,255,0.15)', borderStyle: 'dashed' },
  playerAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  playerAvatarText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  playerAvatarEmpty: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' },
  playerAvatarEmptyIcon: { fontSize: 20, color: '#8B9BB4' },
  playerName:   { fontSize: 10, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  playerPos:    { fontSize: 9, color: '#8B9BB4', fontWeight: '600' },
  playerRating: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  playerRatingText: { fontSize: 10, fontWeight: '800' },
  playerEmptyText: { fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: '600' },

  shareRow:      { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 12 },
  shareBtn:      { flex: 1, backgroundColor: 'rgba(0,212,255,0.1)', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,212,255,0.3)' },
  shareBtnText:  { color: '#00D4FF', fontSize: 13, fontWeight: '700' },
  whatsappBtn:   { flex: 1, backgroundColor: 'rgba(37,211,102,0.1)', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(37,211,102,0.3)' },
  whatsappBtnText: { color: '#25D366', fontSize: 13, fontWeight: '700' },
  marketBtn:     { marginHorizontal: 16, marginBottom: 12, backgroundColor: 'rgba(255,184,0,0.1)', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,184,0,0.3)' },
  marketBtnText: { color: '#FFB800', fontSize: 13, fontWeight: '700' },

  venueCard:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0F1E35', marginHorizontal: 16, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(0,212,255,0.12)' },
  venueCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  venueCardIcon: { fontSize: 24 },
  venueCardName: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  venueCardSub:  { fontSize: 11, color: '#00D4FF', marginTop: 2 },
  venueCardPrice:{ fontSize: 13, fontWeight: '700', color: '#FFB800' },

  footer:    { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#0A1628', padding: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,212,255,0.12)', flexDirection: 'row', gap: 10 },
  chatBtn:   { width: 50, height: 50, borderRadius: 14, backgroundColor: 'rgba(0,212,255,0.08)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,212,255,0.2)' },
  chatBtnText: { fontSize: 22 },
  mainBtn:   { flex: 1, paddingVertical: 15, borderRadius: 14, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  mainBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  endBtn:    { width: 50, height: 50, borderRadius: 14, backgroundColor: 'rgba(0,224,150,0.12)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,224,150,0.3)' },
  endBtnText:{ fontSize: 22 },
});
