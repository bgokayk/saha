import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, Animated, Share, Switch
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

function haptic(type = 'light') {
  if (Platform.OS === 'web') return;
  try {
    const H = require('expo-haptics');
    if (type === 'success') H.notificationAsync(H.NotificationFeedbackType.Success);
    else H.impactAsync(H.ImpactFeedbackStyle.Light);
  } catch (_) {}
}

const FORMATS = [
  { id: '5v5',  icon: '⚽', label: '5v5',  desc: '10 oyuncu, hızlı tempolu', players: 10, color: '#3B82F6' },
  { id: '6v6',  icon: '🏃', label: '6v6',  desc: '12 oyuncu, dengeli oyun',  players: 12, color: '#8B5CF6' },
  { id: '7v7',  icon: '🎯', label: '7v7',  desc: '14 oyuncu, taktiksel',     players: 14, color: '#10B981' },
  { id: '8v8',  icon: '🏆', label: '8v8',  desc: '16 oyuncu, büyük maç',    players: 16, color: '#F59E0B' },
];

const HOURS = Array.from({ length: 16 }, (_, i) => i + 8); // 08–23

export default function CreateMatchScreen({ navigation, route }) {
  const insets  = useSafeAreaInsets();
  const [step, setStep]         = useState(1);   // 1, 2, 3
  const [venues, setVenues]     = useState([]);
  const [format, setFormat]     = useState(null);
  const [venue,  setVenue]      = useState(route?.params?.preselectedVenue ?? null);
  const [date,   setDate]       = useState('');
  const [time,   setTime]       = useState('');
  const [price,  setPrice]      = useState('');
  const [loading, setLoading]   = useState(false);
  const [isSeeking, setIsSeeking]       = useState(false);
  const [neededPositions, setNeededPositions] = useState([]);
  const [busyHours, setBusyHours]       = useState([]);

  const isSubmitting = useRef(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const confetti  = useRef(Array.from({ length: 12 }, () => ({
    x: new Animated.Value(0), y: new Animated.Value(0), o: new Animated.Value(0),
  }))).current;
  const [done, setDone] = useState(false);
  const [createdMatch, setCreatedMatch] = useState(null);

  useEffect(() => { fetchVenues(); }, []);

  useEffect(() => {
    if (venue && date) fetchBusyHours();
    else setBusyHours([]);
  }, [venue, date]);

  async function fetchBusyHours() {
    try {
      const dayStart = `${date}T00:00:00`;
      const dayEnd   = `${date}T23:59:59`;
      const { data, error } = await supabase
        .from('matches')
        .select('match_date')
        .eq('venue_id', venue.id)
        .gte('match_date', dayStart)
        .lte('match_date', dayEnd);
      if (!error) setBusyHours((data || []).map(m => new Date(m.match_date).getHours()));
    } catch (_) {}
  }

  async function fetchVenues() {
    try {
      const { data } = await supabase.from('venues').select('*').order('name');
      setVenues(data || []);
    } catch (_) {}
  }

  function goStep(n) {
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: -30, duration: 120, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue:   0, duration: 180, useNativeDriver: true }),
    ]).start();
    setStep(n);
    haptic();
  }

  async function handleCreate() {
    if (isSubmitting.current) return;
    if (!venue || !format || !date || !time) {
      Alert.alert('Eksik Bilgi', 'Tüm alanları doldurun.');
      return;
    }
    const dt = new Date(`${date}T${time}:00`);
    if (isNaN(dt.getTime())) { Alert.alert('Hata', 'Geçersiz tarih/saat.'); return; }
    if (dt < new Date()) { Alert.alert('Geçersiz Tarih', 'Geçmiş bir tarih/saat seçemezsiniz.'); return; }

    isSubmitting.current = true;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { Alert.alert('Hata', 'Oturum bulunamadı, lütfen tekrar giriş yapın.'); return; }

      const maxP = FORMATS.find(f => f.id === format)?.players || 10;

      const { error, data: created } = await supabase.from('matches').insert({
        venue_id:           venue.id,
        organizer_id:       user.id,
        format,
        match_date:         dt.toISOString(),
        max_players:        maxP,
        price:              price ? parseInt(price) : (venue.price_per_hour || 300),
        status:             'open',
        is_seeking_players: isSeeking,
        needed_positions:   isSeeking ? neededPositions : [],
      }).select().single();

      if (error) { Alert.alert('Hata', error.message); return; }

      haptic('success');
      launchConfetti();
      setCreatedMatch(created);
      setDone(true);
    } catch (e) {
      Alert.alert('Hata', 'Maç oluşturulamadı, tekrar dene.');
    } finally {
      setLoading(false);
      isSubmitting.current = false;
    }
  }

  function launchConfetti() {
    const COLORS = ['#F59E0B','#EF4444','#22C55E','#3B82F6','#8B5CF6','#EC4899'];
    confetti.forEach((c, i) => {
      const angle = (i / confetti.length) * Math.PI * 2;
      const dist  = 120 + Math.random() * 60;
      c.x.setValue(0); c.y.setValue(0); c.o.setValue(1);
      Animated.parallel([
        Animated.timing(c.x, { toValue: Math.cos(angle) * dist, duration: 700, useNativeDriver: true }),
        Animated.timing(c.y, { toValue: Math.sin(angle) * dist - 60, duration: 700, useNativeDriver: true }),
        Animated.sequence([Animated.delay(500), Animated.timing(c.o, { toValue: 0, duration: 400, useNativeDriver: true })]),
      ]).start();
    });
  }

  async function handleShare() {
    const spotsLeft = maxPlayers;
    const msg =
      `⚽ Maça davetlisin!\n\n` +
      `🏟️ ${venue?.name || 'Halı Saha'}\n` +
      `📅 ${date} ${time}\n` +
      `⚽ ${format} · ${spotsLeft} oyuncu\n` +
      (price ? `💳 ${Math.ceil(parseInt(price) / (spotsLeft / 2))}₺/kişi\n` : '') +
      `\nSAHA uygulamasını indir!`;
    if (Platform.OS === 'web') {
      Alert.alert('Maç Bilgileri', msg);
      return;
    }
    try {
      await Share.share({ message: msg });
    } catch (_) {}
  }

  const fmtObj   = FORMATS.find(f => f.id === format);
  const maxPlayers = fmtObj?.players || 10;
  const CONFETTI_COLORS = ['#F59E0B','#EF4444','#22C55E','#3B82F6','#8B5CF6','#EC4899','#10B981','#F97316','#6366F1','#EC4899','#0EA5E9','#84CC16'];

  // ── Tamamlandı ekranı ──────────────────────────────────────────────────────
  if (done) {
    return (
      <View style={[styles.doneContainer, { paddingTop: insets.top }]}>
        {confetti.map((c, i) => (
          <Animated.View key={i} style={[styles.confettiDot, {
            backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            opacity: c.o, transform: [{ translateX: c.x }, { translateY: c.y }],
          }]} />
        ))}
        <Text style={styles.doneIcon}>⚽</Text>
        <Text style={styles.doneTitle}>Maç Oluşturuldu!</Text>
        <Text style={styles.doneSub}>Oyuncular katılmaya başlayabilir</Text>
        <View style={styles.doneSummary}>
          <Text style={styles.doneLine}>🏟️ {venue?.name}</Text>
          <Text style={styles.doneLine}>⚽ {format} · {maxPlayers} oyuncu</Text>
          <Text style={styles.doneLine}>📅 {date} {time}</Text>
        </View>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Text style={styles.shareBtnText}>Maçı Paylaş 📤</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.lineupBtn} onPress={() => navigation.navigate('Lineup', { matchId: createdMatch?.id, format })}>
          <Text style={styles.lineupBtnText}>👥 Kadro Kur</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.homeBtn} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.homeBtnText}>Ana Sayfa</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => step > 1 ? goStep(step - 1) : navigation.goBack()}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Maç Oluştur</Text>
        <Text style={styles.stepCount}>{step}/3</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` }]} />
      </View>

      <Animated.ScrollView
        style={[styles.body, { transform: [{ translateX: slideAnim }] }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── ADIM 1: Format ── */}
        {step === 1 && (
          <View>
            <Text style={styles.stepTitle}>Format Seç</Text>
            <Text style={styles.stepSub}>Kaç kişilik maç kurmak istiyorsun?</Text>
            <View style={styles.formatGrid}>
              {FORMATS.map(f => {
                const active = format === f.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.formatCard, active && { borderColor: f.color, borderWidth: 2.5, backgroundColor: f.color + '0D' }]}
                    onPress={() => { setFormat(f.id); haptic(); }}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.formatIconWrap, { backgroundColor: f.color + '18' }]}>
                      <Text style={styles.formatIcon}>{f.icon}</Text>
                    </View>
                    <Text style={[styles.formatLabel, active && { color: f.color }]}>{f.label}</Text>
                    <Text style={styles.formatDesc}>{f.desc}</Text>
                    <View style={[styles.formatPlayerBadge, { backgroundColor: active ? f.color : '#E2E8F0' }]}>
                      <Text style={[styles.formatPlayerText, { color: active ? '#fff' : '#64748B' }]}>{f.players} kişi</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── ADIM 2: Saha ── */}
        {step === 2 && (
          <View>
            <Text style={styles.stepTitle}>Saha Seç</Text>
            <Text style={styles.stepSub}>Maçın oynanacağı sahayı seç</Text>
            {venues.map(v => {
              const active = venue?.id === v.id;
              return (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.venueCard, active && { borderColor: '#00D4FF', borderWidth: 2 }]}
                  onPress={() => { setVenue(v); if (!price) setPrice(String(v.price_per_hour || '')); haptic(); }}
                  activeOpacity={0.85}
                >
                  <View style={styles.venueRow}>
                    <View style={[styles.venueAvatar, { backgroundColor: 'rgba(0,212,255,0.12)' }]}>
                      <Text style={styles.venueAvatarIcon}>🏟️</Text>
                    </View>
                    <View style={styles.venueInfo}>
                      <Text style={[styles.venueName, active && { color: '#00D4FF' }]}>{v.name}</Text>
                      <Text style={styles.venueDistrict}>📍 {v.district || 'Bursa'}</Text>
                      <Text style={styles.venuePrice}>{v.price_per_hour || 300}₺/sa</Text>
                    </View>
                    <View style={styles.venueRight}>
                      <Text style={styles.venueRating}>⭐ {v.rating?.toFixed(1) || '4.5'}</Text>
                      <TouchableOpacity
                        onPress={() => navigation.navigate('VenueDetail', { venueId: v.id, venue: v })}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Text style={styles.venueDetailLink}>Detay →</Text>
                      </TouchableOpacity>
                      {active && <Text style={styles.venueCheck}>✓</Text>}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── ADIM 3: Tarih + Özet ── */}
        {step === 3 && (
          <View>
            <Text style={styles.stepTitle}>Tarih & Saat</Text>
            <Text style={styles.stepSub}>Maç zamanını belirle</Text>

            {/* Hızlı tarih seçici */}
            <Text style={styles.inputLabel}>Tarih</Text>
            <View style={styles.quickRow}>
              {[0, 1, 2, 3, 4, 5, 6].map(offset => {
                const d = new Date();
                d.setDate(d.getDate() + offset);
                const iso = d.toISOString().slice(0, 10);
                const label = offset === 0 ? 'Bugün' : offset === 1 ? 'Yarın'
                  : d.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' });
                const active = date === iso;
                return (
                  <TouchableOpacity key={iso}
                    style={[styles.quickChip, active && styles.quickChipActive]}
                    onPress={() => setDate(iso)}>
                    <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput style={[styles.input, { marginBottom: 16 }]} placeholder="veya yaz: 2026-04-15"
              placeholderTextColor="#94A3B8" value={date} onChangeText={setDate} />

            {/* Saat grid */}
            <Text style={styles.inputLabel}>Saat</Text>
            {venue && !date && (
              <Text style={styles.slotHint}>Önce tarih seç, dolu saatler griye döner</Text>
            )}
            <View style={styles.slotGrid}>
              {HOURS.map(h => {
                const label = `${String(h).padStart(2, '0')}:00`;
                const busy  = busyHours.includes(h);
                const sel   = time === label;
                return (
                  <TouchableOpacity
                    key={h}
                    style={[styles.slotCell, sel && styles.slotCellActive, busy && styles.slotCellBusy]}
                    onPress={() => { if (!busy) { setTime(label); haptic(); } }}
                    disabled={busy}
                    activeOpacity={busy ? 1 : 0.7}
                  >
                    <Text style={[styles.slotText, sel && styles.slotTextActive, busy && styles.slotTextBusy]}>
                      {label}
                    </Text>
                    {busy && <Text style={styles.slotBusyTag}>Dolu</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.inputLabel}>Toplam Fiyat (₺)</Text>
            <TextInput
              style={[styles.input, { marginBottom: 6 }]}
              placeholder="Saha fiyatı otomatik"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={price}
              onChangeText={t => setPrice(t.replace(/[^0-9]/g, ''))}
            />
            {price ? <Text style={styles.priceHint}>💡 Oyuncu başı: {Math.ceil(parseInt(price) / (maxPlayers / 2))}₺</Text> : null}

            {/* Oyuncu Aranıyor */}
            <View style={styles.seekingCard}>
              <View style={styles.seekingRow}>
                <View>
                  <Text style={styles.seekingTitle}>⚡ Eksik Oyuncu Var Mı?</Text>
                  <Text style={styles.seekingSub}>Açık pozisyonlar ilan panosuına düşer</Text>
                </View>
                <Switch
                  value={isSeeking}
                  onValueChange={setIsSeeking}
                  trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(0,212,255,0.3)' }}
                  thumbColor={isSeeking ? '#00D4FF' : '#fff'}
                />
              </View>
              {isSeeking && (
                <>
                  <Text style={styles.seekingPosLabel}>Hangi Pozisyonlar?</Text>
                  <View style={styles.posRow}>
                    {['Kaleci', 'Defans', 'Orta Saha', 'Forvet'].map(pos => {
                      const sel = neededPositions.includes(pos);
                      return (
                        <TouchableOpacity
                          key={pos}
                          style={[styles.posChip, sel && styles.posChipActive]}
                          onPress={() => {
                            setNeededPositions(prev =>
                              sel ? prev.filter(p => p !== pos) : [...prev, pos]
                            );
                          }}>
                          <Text style={[styles.posChipText, sel && styles.posChipTextActive]}>{pos}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </View>

            {/* Özet */}
            {venue && format && (
              <View style={styles.summary}>
                <Text style={styles.summaryTitle}>📋 MAÇ ÖZETİ</Text>
                <View style={styles.summaryRow}><Text style={styles.summaryIcon}>🏟️</Text><Text style={styles.summaryText}>{venue.name}</Text></View>
                <View style={styles.summaryRow}><Text style={styles.summaryIcon}>⚽</Text><Text style={styles.summaryText}>{format} · {maxPlayers} oyuncu</Text></View>
                {date && time && <View style={styles.summaryRow}><Text style={styles.summaryIcon}>🕐</Text><Text style={styles.summaryText}>{date} — {time}</Text></View>}
                {price && <View style={styles.summaryRow}><Text style={styles.summaryIcon}>💳</Text><Text style={styles.summaryText}>{price}₺ toplam</Text></View>}
                {isSeeking && <View style={styles.summaryRow}><Text style={styles.summaryIcon}>⚡</Text><Text style={styles.summaryText}>{neededPositions.length > 0 ? neededPositions.join(', ') : 'Oyuncu Aranıyor'}</Text></View>}
              </View>
            )}
          </View>
        )}

        <View style={{ height: 140 }} />
      </Animated.ScrollView>

      {/* Alt buton */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {step < 3 ? (
          <TouchableOpacity
            style={[styles.nextBtn, !((step === 1 && format) || (step === 2 && venue)) && styles.nextBtnDisabled]}
            onPress={() => goStep(step + 1)}
            disabled={!(step === 1 ? format : venue)}
          >
            <Text style={styles.nextBtnText}>Devam Et →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.nextBtn, (!venue || !format || !date || !time) && styles.nextBtnDisabled]}
            onPress={handleCreate}
            disabled={loading || !venue || !format || !date || !time}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.nextBtnText}>⚽ Maçı Oluştur</Text>}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1628' },
  header: { backgroundColor: '#0A1628', paddingBottom: 14, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(0,212,255,0.12)' },
  backText: { color: 'rgba(255,255,255,0.45)', fontSize: 14 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  stepCount: { color: 'rgba(255,255,255,0.35)', fontSize: 13 },
  progressBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.06)' },
  progressFill: { height: '100%', backgroundColor: '#00D4FF' },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  stepTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 },
  stepSub: { fontSize: 14, color: '#8B9BB4', marginBottom: 24 },

  // Format grid
  formatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  formatCard: { width: '47%', backgroundColor: '#0F1E35', borderRadius: 18, padding: 16, gap: 8, borderWidth: 1.5, borderColor: 'rgba(0,212,255,0.15)' },
  formatIconWrap: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  formatIcon: { fontSize: 24 },
  formatLabel: { fontSize: 20, fontWeight: '900', color: '#FFFFFF' },
  formatDesc: { fontSize: 11, color: '#8B9BB4' },
  formatPlayerBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' },
  formatPlayerText: { fontSize: 11, fontWeight: '700' },

  // Venue
  venueCard: { backgroundColor: '#0F1E35', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: 'rgba(0,212,255,0.15)' },
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  venueAvatar: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  venueAvatarIcon: { fontSize: 20 },
  venueInfo: { flex: 1, gap: 2 },
  venueName: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  venueDistrict: { fontSize: 12, color: '#8B9BB4' },
  venuePrice: { fontSize: 12, color: '#FFB800', fontWeight: '600' },
  venueRight: { alignItems: 'flex-end', gap: 4 },
  venueRating: { fontSize: 12, fontWeight: '700' },
  venueDetailLink: { fontSize: 11, color: '#00D4FF', fontWeight: '600' },
  venueCheck: { fontSize: 18, color: '#00D4FF' },

  // Date
  dateRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  inputGroup: { flex: 1 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#8B9BB4', marginBottom: 8, marginTop: 4 },
  input: { backgroundColor: '#0F1E35', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 14, fontSize: 14, color: '#FFFFFF', borderWidth: 1.5, borderColor: 'rgba(0,212,255,0.2)' },
  priceHint: { fontSize: 12, color: '#8B9BB4', marginBottom: 16 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  quickChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(0,212,255,0.2)', backgroundColor: 'rgba(255,255,255,0.04)' },
  quickChipActive: { backgroundColor: 'rgba(0,212,255,0.12)', borderColor: '#00D4FF' },
  quickChipText: { fontSize: 12, fontWeight: '600', color: '#8B9BB4' },
  quickChipTextActive: { color: '#00D4FF' },

  slotHint: { fontSize: 12, color: '#8B9BB4', marginBottom: 8 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  slotCell: { width: '22%', aspectRatio: 1.6, backgroundColor: '#0F1E35', borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(0,212,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  slotCellActive: { backgroundColor: 'rgba(0,212,255,0.15)', borderColor: '#00D4FF' },
  slotCellBusy: { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' },
  slotText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  slotTextActive: { color: '#00D4FF' },
  slotTextBusy: { color: 'rgba(255,255,255,0.2)', fontSize: 12 },
  slotBusyTag: { fontSize: 9, color: '#8B9BB4', marginTop: 1 },

  // Summary
  summary: { backgroundColor: '#0F1E35', borderRadius: 16, padding: 18, marginTop: 20, gap: 10, borderWidth: 1, borderColor: 'rgba(0,212,255,0.2)' },
  summaryTitle: { color: '#00D4FF', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryIcon: { fontSize: 16, width: 24 },
  summaryText: { color: '#fff', fontSize: 14 },

  // Seeking
  seekingCard: { backgroundColor: '#0F1E35', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1.5, borderColor: 'rgba(0,212,255,0.15)' },
  seekingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seekingTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  seekingSub: { fontSize: 12, color: '#8B9BB4', marginTop: 2 },
  seekingPosLabel: { fontSize: 12, fontWeight: '600', color: '#8B9BB4', marginTop: 12, marginBottom: 8 },
  posRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  posChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(0,212,255,0.2)', backgroundColor: 'rgba(255,255,255,0.04)' },
  posChipActive: { backgroundColor: 'rgba(0,212,255,0.12)', borderColor: '#00D4FF' },
  posChipText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
  posChipTextActive: { color: '#00D4FF' },

  // Footer
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#0A1628', padding: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,212,255,0.12)' },
  nextBtn: { backgroundColor: '#00D4FF', paddingVertical: 16, borderRadius: 14, alignItems: 'center', shadowColor: '#00D4FF', shadowOpacity: 0.35, shadowRadius: 10, elevation: 5 },
  nextBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.1)', shadowOpacity: 0 },
  nextBtnText: { color: '#0A1628', fontSize: 16, fontWeight: '700' },

  // Done ekranı
  doneContainer: { flex: 1, backgroundColor: '#0A1628', alignItems: 'center', justifyContent: 'center', padding: 32 },
  doneIcon: { fontSize: 72, marginBottom: 16 },
  doneTitle: { color: '#fff', fontSize: 28, fontWeight: '900', marginBottom: 8 },
  doneSub: { color: 'rgba(255,255,255,0.6)', fontSize: 15, marginBottom: 28 },
  doneSummary: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 18, width: '100%', gap: 8, marginBottom: 24 },
  doneLine: { color: '#fff', fontSize: 14 },
  shareBtn: { backgroundColor: '#C9A84C', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, marginBottom: 12, width: '100%', alignItems: 'center' },
  shareBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  lineupBtn: { backgroundColor: '#10B981', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, marginBottom: 10, width: '100%', alignItems: 'center' },
  lineupBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  homeBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, width: '100%', alignItems: 'center' },
  homeBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '600' },
  confettiDot: { position: 'absolute', width: 12, height: 12, borderRadius: 6 },
});
