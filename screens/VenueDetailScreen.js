import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Linking, Platform
} from 'react-native';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

const FEATURES = [
  { key: 'has_camera',     icon: '📹', label: 'Kamera' },
  { key: 'has_referee',    icon: '👔', label: 'Hakem' },
  { key: 'is_indoor',      icon: '🏠', label: 'Kapalı' },
  { key: 'has_lighting',   icon: '💡', label: 'Işık' },
  { key: 'has_shower',     icon: '🚿', label: 'Duş' },
  { key: 'has_parking',    icon: '🚗', label: 'Otopark' },
  { key: 'has_scoreboard', icon: '📊', label: 'Skor' },
  { key: 'has_wifi',       icon: '📶', label: 'WiFi' },
];

const HEADER_COLORS = [
  ['#001F5B', '#00A0D2'],
  ['#0F172A', '#3B82F6'],
  ['#134E4A', '#10B981'],
  ['#1E1B4B', '#8B5CF6'],
  ['#431407', '#F59E0B'],
];

function hashColor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return HEADER_COLORS[Math.abs(h) % HEADER_COLORS.length];
}

export default function VenueDetailScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { venueId, venue: preloaded } = route.params || {};

  const [venue, setVenue]       = useState(preloaded || null);
  const [features, setFeatures] = useState(null);
  const [ratings, setRatings]   = useState([]);
  const [loading, setLoading]   = useState(!preloaded);
  const [avgRating, setAvgRating] = useState(null);

  useEffect(() => {
    const id = venueId || preloaded?.id;
    if (!id) return;
    load(id);
  }, [venueId]);

  async function load(id) {
    setLoading(true);
    const [{ data: v }, { data: f }, { data: r }] = await Promise.all([
      supabase.from('venues').select('*').eq('id', id).single(),
      supabase.from('venue_features').select('*').eq('venue_id', id).maybeSingle(),
      supabase
        .from('match_ratings')
        .select('*, profiles(full_name, avatar_url)')
        .eq('venue_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);
    if (v) setVenue(v);
    setFeatures(f || {});
    setRatings(r || []);
    if (r && r.length > 0) {
      const avg = r.reduce((s, x) => s + (x.overall_rating || x.rating || 0), 0) / r.length;
      setAvgRating(avg.toFixed(1));
    }
    setLoading(false);
  }

  function openWhatsApp() {
    const phone = venue?.phone || '';
    const text  = encodeURIComponent(`Merhaba, ${venue?.name} hakkında bilgi almak istiyorum.`);
    const url   = phone
      ? `whatsapp://send?phone=${phone}&text=${text}`
      : `https://wa.me/?text=${text}`;
    if (Platform.OS === 'web') {
      window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
    } else {
      Linking.openURL(url).catch(() => Alert.alert('WhatsApp bulunamadı'));
    }
  }

  function goReserve() {
    navigation.navigate('CreateMatch', { preselectedVenue: venue });
  }

  if (loading || !venue) {
    return (
      <View style={[styles.loadWrap, { paddingTop: insets.top }]}>
        <ActivityIndicator color="#00A0D2" size="large" />
      </View>
    );
  }

  const colors = hashColor(venue.name || 'saha');

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[0]}>
        {/* Gradient Header */}
        <View style={[styles.heroWrap, { paddingTop: insets.top }]}>
          <View style={[styles.heroGrad, { backgroundColor: colors[0] }]}>
            <View style={[styles.heroAccent, { backgroundColor: colors[1] + '40' }]} />
            <View style={styles.heroOverlay}>
              <View style={styles.heroIconWrap}>
                <Text style={styles.heroIcon}>🏟️</Text>
              </View>
              <Text style={styles.heroName}>{venue.name}</Text>
              <Text style={styles.heroLocation}>
                📍 {[venue.district, venue.city].filter(Boolean).join(', ') || 'Bursa'}
              </Text>
              {(avgRating || venue.rating) && (
                <View style={styles.heroRating}>
                  <Text style={styles.heroRatingStar}>⭐</Text>
                  <Text style={styles.heroRatingVal}>{avgRating || venue.rating?.toFixed(1)}</Text>
                  <Text style={styles.heroRatingCount}>({ratings.length} yorum)</Text>
                </View>
              )}
            </View>
          </View>

          {/* Geri butonu - header'ın üstünde */}
          <TouchableOpacity
            style={[styles.backBtn, { top: insets.top + 10 }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
        </View>

        {/* Fiyat & saatler */}
        <View style={styles.infoRow}>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardIcon}>💳</Text>
            <Text style={styles.infoCardVal}>{venue.price_per_hour || '—'}₺</Text>
            <Text style={styles.infoCardLabel}>Saatlik</Text>
          </View>
          {features?.working_hours && (
            <View style={styles.infoCard}>
              <Text style={styles.infoCardIcon}>🕐</Text>
              <Text style={styles.infoCardVal}>{features.working_hours}</Text>
              <Text style={styles.infoCardLabel}>Çalışma Saati</Text>
            </View>
          )}
          {features?.ground_type && (
            <View style={styles.infoCard}>
              <Text style={styles.infoCardIcon}>⚽</Text>
              <Text style={styles.infoCardVal}>{features.ground_type}</Text>
              <Text style={styles.infoCardLabel}>Zemin</Text>
            </View>
          )}
          {features?.field_size && (
            <View style={styles.infoCard}>
              <Text style={styles.infoCardIcon}>📐</Text>
              <Text style={styles.infoCardVal}>{features.field_size}</Text>
              <Text style={styles.infoCardLabel}>Saha</Text>
            </View>
          )}
        </View>

        {/* Özellikler Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tesis Özellikleri</Text>
          <View style={styles.featGrid}>
            {FEATURES.map(f => {
              const active = features?.[f.key] === true;
              return (
                <View key={f.key} style={[styles.featCell, !active && styles.featCellOff]}>
                  <Text style={[styles.featIcon, !active && styles.featIconOff]}>{f.icon}</Text>
                  <Text style={[styles.featLabel, !active && styles.featLabelOff]}>{f.label}</Text>
                  {!active && <View style={styles.featOffLine} />}
                </View>
              );
            })}
          </View>
        </View>

        {/* Yorumlar */}
        {ratings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Yorumlar</Text>
            {ratings.map(r => (
              <RatingRow key={r.id} rating={r} />
            ))}
          </View>
        )}

        {ratings.length === 0 && (
          <View style={styles.noRatingWrap}>
            <Text style={styles.noRatingText}>Henüz yorum yok. İlk maçı oyna, sen değerlendir!</Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Alt butonlar */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity style={styles.waBtn} onPress={openWhatsApp}>
          <Text style={styles.waBtnText}>💬 WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.reserveBtn} onPress={goReserve}>
          <Text style={styles.reserveBtnText}>⚽ Rezervasyon Yap</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function RatingRow({ rating }) {
  const stars = Math.round(rating.overall_rating || rating.rating || 0);
  const name  = rating.profiles?.full_name || 'Oyuncu';
  const comment = rating.comment || '';
  return (
    <View style={styles.ratingRow}>
      <View style={styles.ratingAvatar}>
        <Text style={styles.ratingAvatarText}>{name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.ratingBody}>
        <View style={styles.ratingTop}>
          <Text style={styles.ratingName}>{name}</Text>
          <Text style={styles.ratingStars}>{'⭐'.repeat(Math.min(stars, 5))}</Text>
        </View>
        {comment ? <Text style={styles.ratingComment}>{comment}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F9' },
  loadWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F6F9' },

  heroWrap: { position: 'relative' },
  heroGrad: { paddingBottom: 28, overflow: 'hidden' },
  heroAccent: { position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: 90 },
  heroOverlay: { alignItems: 'center', paddingTop: 16, paddingBottom: 8, paddingHorizontal: 20 },
  heroIconWrap: { width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  heroIcon: { fontSize: 40 },
  heroName: { color: '#fff', fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 6 },
  heroLocation: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 10 },
  heroRating: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  heroRatingStar: { fontSize: 14 },
  heroRatingVal: { color: '#fff', fontSize: 16, fontWeight: '800' },
  heroRatingCount: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },

  backBtn: { position: 'absolute', left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  backBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },

  infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 16 },
  infoCard: { flex: 1, minWidth: 80, backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', gap: 4, shadowColor: '#001F5B', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  infoCardIcon: { fontSize: 20 },
  infoCardVal: { fontSize: 14, fontWeight: '800', color: '#001F5B', textAlign: 'center' },
  infoCardLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },

  section: { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#001F5B', marginBottom: 12 },

  featGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  featCell: { width: '22%', backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, alignItems: 'center', gap: 6, shadowColor: '#001F5B', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, borderWidth: 1.5, borderColor: '#E2E8F0' },
  featCellOff: { backgroundColor: '#F8FAFC', borderColor: '#F1F5F9' },
  featIcon: { fontSize: 22 },
  featIconOff: { opacity: 0.3 },
  featLabel: { fontSize: 11, fontWeight: '700', color: '#001F5B' },
  featLabelOff: { color: '#CBD5E1' },
  featOffLine: { position: 'absolute', top: '50%', left: '10%', right: '10%', height: 1.5, backgroundColor: '#CBD5E1', transform: [{ rotate: '-15deg' }] },

  ratingRow: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#001F5B', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  ratingAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#001F5B', justifyContent: 'center', alignItems: 'center' },
  ratingAvatarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  ratingBody: { flex: 1, gap: 4 },
  ratingTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ratingName: { fontSize: 13, fontWeight: '700', color: '#001F5B' },
  ratingStars: { fontSize: 12 },
  ratingComment: { fontSize: 13, color: '#64748B', lineHeight: 18 },

  noRatingWrap: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 32 },
  noRatingText: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0', flexDirection: 'row', gap: 12 },
  waBtn: { flex: 0.4, backgroundColor: '#25D366', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  waBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  reserveBtn: { flex: 0.6, backgroundColor: '#001F5B', paddingVertical: 14, borderRadius: 14, alignItems: 'center', shadowColor: '#001F5B', shadowOpacity: 0.35, shadowRadius: 10, elevation: 5 },
  reserveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
