import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Linking, Platform, Image
} from 'react-native';
import { useEffect, useState, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

function hashColor(name) {
  const colors = ['#1a3a5c', '#1a4c3a', '#3a1a4c', '#4c1a1a', '#1a3a3a', '#3a3a1a'];
  let h = 0;
  for (let c of (name || '')) h = c.charCodeAt(0) + h * 31;
  return colors[Math.abs(h) % colors.length];
}

/* ── Feature tanımlari ─────────────────────────────────── */
const FEATURES = [
  { key: 'has_camera',     icon: '\u{1F4F9}', label: 'Kamera'        },
  { key: 'has_referee',    icon: '\u{1F454}', label: 'Hakem'         },
  { key: 'is_indoor',      icon: '\u{1F3E0}', label: 'Kapal\u0131 Alan'    },
  { key: 'has_lighting',   icon: '\u{1F4A1}', label: '\u0130\u015F\u0131kland\u0131rma' },
  { key: 'has_scoreboard', icon: '\u{1F4CA}', label: 'Skor Tabelas\u0131'  },
  { key: 'has_shower',     icon: '\u{1F6BF}', label: 'Du\u015F/Soyunma'    },
  { key: 'has_parking',    icon: '\u{1F697}', label: 'Otopark'       },
];

const HOURS = Array.from({ length: 16 }, (_, i) => i + 8); // 08-23

function padHour(h) {
  return `${String(h).padStart(2, '0')}:00`;
}

function todayDateStr() {
  const d = new Date();
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

function todayLabel() {
  const d = new Date();
  return d.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
}

/* ── Component ─────────────────────────────────────────── */
export default function VenueDetailScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { venueId, venue: preloaded } = route.params || {};
  const id = venueId || preloaded?.id;

  const [venue, setVenue]           = useState(preloaded || null);
  const [features, setFeatures]     = useState(null);
  const [busyHours, setBusyHours]   = useState([]);
  const [selectedHour, setSelectedHour] = useState(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    if (!id) return;
    loadData(id);
  }, [id]);

  async function loadData(venueId) {
    setLoading(true);
    try {
      const today = todayDateStr();
      const todayStart = `${today}T00:00:00`;
      const todayEnd   = `${today}T23:59:59`;

      const [venueRes, featRes, matchRes] = await Promise.all([
        supabase.from('venues').select('*').eq('id', venueId).single(),
        supabase.from('venue_features').select('*').eq('venue_id', venueId).maybeSingle(),
        supabase
          .from('matches')
          .select('match_date')
          .eq('venue_id', venueId)
          .gte('match_date', todayStart)
          .lte('match_date', todayEnd)
          .neq('status', 'cancelled'),
      ]);

      if (venueRes.data) setVenue(venueRes.data);
      setFeatures(featRes.data || {});

      // Dolu saatleri cikart
      const hours = (matchRes.data || []).map(m => new Date(m.match_date).getHours());
      setBusyHours(hours);
    } catch (err) {
      Alert.alert('Hata', 'Saha bilgileri y\u00FCklenemedi.');
    } finally {
      setLoading(false);
    }
  }

  /* Feature source: venue_features varsa oradan, yoksa venues tablosundan */
  const featureSource = useMemo(() => {
    if (features && Object.keys(features).length > 0) return features;
    return venue || {};
  }, [features, venue]);

  function openWhatsApp() {
    if (!venue?.phone) {
      Alert.alert('Bilgi', 'Bu sahan\u0131n telefon numaras\u0131 bulunamad\u0131.');
      return;
    }
    const cleanPhone = venue.phone.replace(/\D/g, '');
    const phone = cleanPhone.startsWith('90') ? cleanPhone : `90${cleanPhone}`;
    const text = encodeURIComponent(`Merhaba, ${venue.name} hakk\u0131nda bilgi almak istiyorum.`);
    const url = Platform.OS === 'web'
      ? `https://wa.me/${phone}?text=${text}`
      : `whatsapp://send?phone=+${phone}&text=${text}`;

    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(() => Alert.alert('Hata', 'WhatsApp a\u00E7\u0131lamad\u0131.'));
    }
  }

  function handleSlotPress(hour) {
    if (busyHours.includes(hour)) return;
    setSelectedHour(prev => (prev === hour ? null : hour));
  }

  function handleJoin() {
    if (selectedHour == null) return;
    navigation.navigate('CreateMatch', {
      preselectedVenue: venue,
      preselectedHour: selectedHour,
    });
  }

  function handleReserve() {
    navigation.navigate('CreateMatch', { preselectedVenue: venue });
  }

  /* ── Loading ── */
  if (loading && !venue) {
    return (
      <View style={[styles.loadWrap, { paddingTop: insets.top }]}>
        <ActivityIndicator color="#00D4FF" size="large" />
      </View>
    );
  }

  if (!venue) {
    return (
      <View style={[styles.loadWrap, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Saha bulunamad\u0131.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.errorBack}>Geri D\u00F6n</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

        {/* ── Hero Section ── */}
        <View style={[styles.hero, { paddingTop: insets.top }]}>
          {/* Background: photo or gradient placeholder */}
          {venue.photo_url ? (
            <Image
              source={{ uri: venue.photo_url }}
              style={styles.heroBgImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.heroBgPlaceholder, { backgroundColor: hashColor(venue.name) }]}>
              <Text style={styles.heroBgEmoji}>{'\u{1F3DF}\uFE0F'}</Text>
            </View>
          )}
          {/* Dark overlay for text legibility */}
          <View style={styles.heroOverlay} />

          {/* Back button */}
          <TouchableOpacity
            style={[styles.backBtn, { top: insets.top + 10 }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.backBtnText}>{'\u2190'}</Text>
          </TouchableOpacity>

          {/* Premium badge */}
          {venue.is_active && venue.price_per_hour >= 500 && (
            <View style={[styles.heroPremiumBadge, { top: insets.top + 10 }]}>
              <Text style={styles.heroPremiumText}>Premium</Text>
            </View>
          )}

          {/* Rating badge */}
          <View style={styles.heroRatingBadge}>
            <Text style={styles.heroRatingText}>
              {'\u2B50'} {venue.rating ? Number(venue.rating).toFixed(1) : '5.0'}
            </Text>
          </View>

          {/* Venue info overlay */}
          <View style={styles.heroContent}>
            <Text style={styles.heroName}>{venue.name}</Text>
            <Text style={styles.heroLocation}>
              {'\u{1F4CD}'} {[venue.district, venue.city].filter(Boolean).join(', ') || 'Bursa'}
            </Text>
          </View>
        </View>

        {/* ── Info Card ── */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            {/* Rating */}
            <View style={styles.infoItem}>
              <Text style={styles.infoStar}>{'\u2B50'}</Text>
              <Text style={styles.infoRating}>
                {venue.rating ? Number(venue.rating).toFixed(1) : '5.0'}
              </Text>
              <Text style={styles.infoGray}>puan</Text>
            </View>

            <View style={styles.infoDivider} />

            {/* Price */}
            <View style={styles.infoItem}>
              <Text style={styles.infoPrice}>{venue.price_per_hour || '---'}{'\u20BA'}</Text>
              <Text style={styles.infoGray}>/ saat</Text>
            </View>
          </View>

          {/* Working hours */}
          {features?.working_hours && (
            <View style={styles.workingHours}>
              <Text style={styles.workingHoursIcon}>{'\u{1F570}\uFE0F'}</Text>
              <Text style={styles.workingHoursText}>
                {`\u00C7al\u0131\u015Fma Saatleri: ${features.working_hours}`}
              </Text>
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.waBtn} onPress={openWhatsApp} activeOpacity={0.85}>
              <Text style={styles.waBtnText}>{`WhatsApp'a Yaz \u{1F4AC}`}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.reserveBtn} onPress={handleReserve} activeOpacity={0.85}>
              <Text style={styles.reserveBtnText}>Rezervasyon Yap {'\u2192'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Facility Features ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{`TES\u0130S \u00D6ZELL\u0130KLER\u0130`}</Text>
          <View style={styles.featGrid}>
            {FEATURES.map(f => {
              const active = featureSource[f.key] === true;
              return (
                <View
                  key={f.key}
                  style={[
                    styles.featCell,
                    active ? styles.featCellActive : styles.featCellInactive,
                  ]}
                >
                  <Text style={[styles.featIcon, !active && styles.featIconOff]}>
                    {f.icon}
                  </Text>
                  <Text style={[styles.featLabel, !active && styles.featLabelOff]}>
                    {f.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Time Slot Grid (Olleyy Style) ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{`M\u00DCSA\u0130T SAATLER`}</Text>
          <Text style={styles.dateLabel}>{todayLabel()}</Text>

          <View style={styles.slotGrid}>
            {HOURS.map(hour => {
              const isBusy    = busyHours.includes(hour);
              const isSelected = selectedHour === hour;

              return (
                <TouchableOpacity
                  key={hour}
                  style={[
                    styles.slot,
                    isBusy    && styles.slotBusy,
                    isSelected && styles.slotSelected,
                  ]}
                  onPress={() => handleSlotPress(hour)}
                  activeOpacity={isBusy ? 1 : 0.7}
                  disabled={isBusy}
                >
                  <Text
                    style={[
                      styles.slotText,
                      isBusy    && styles.slotTextBusy,
                      isSelected && styles.slotTextSelected,
                    ]}
                  >
                    {padHour(hour)}
                  </Text>
                  {isBusy && <Text style={styles.slotBusyLabel}>Dolu</Text>}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Join button */}
          {selectedHour != null && (
            <TouchableOpacity style={styles.joinBtn} onPress={handleJoin} activeOpacity={0.85}>
              <Text style={styles.joinBtnText}>{`Kat\u0131l \u2192`}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Address */}
        {venue.address && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ADRES</Text>
            <Text style={styles.addressText}>{venue.address}</Text>
          </View>
        )}

        {/* Description */}
        {venue.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>HAKKINDA</Text>
            <Text style={styles.descText}>{venue.description}</Text>
          </View>
        )}

        <View style={{ height: Math.max(insets.bottom, 16) + 20 }} />
      </ScrollView>
    </View>
  );
}

/* ── Styles ────────────────────────────────────────────── */
const NAVY   = '#0A1628';
const NAVY2  = '#0F1E35';
const CYAN   = '#00D4FF';
const GOLD   = '#FFB800';
const GRAY   = '#8B9BB4';
const BORDER = 'rgba(0,212,255,0.15)';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },
  loadWrap:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: NAVY },
  errorText: { color: GRAY, fontSize: 15, marginBottom: 12, textAlign: 'center' },
  errorBack: { color: CYAN, fontSize: 14, fontWeight: '700' },

  /* Hero */
  hero: {
    height: 260,
    position: 'relative',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  heroBgImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroBgPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroBgEmoji: {
    fontSize: 72,
    opacity: 0.35,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,22,40,0.55)',
  },
  heroContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 2,
  },
  heroName: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroLocation: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
  },
  heroPremiumBadge: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    zIndex: 10,
  },
  heroPremiumText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  heroRatingBadge: {
    position: 'absolute',
    bottom: 56,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    zIndex: 10,
  },
  heroRatingText: {
    color: GOLD,
    fontSize: 14,
    fontWeight: '800',
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },

  /* Info Card */
  infoCard: {
    backgroundColor: NAVY2,
    marginHorizontal: 16,
    marginTop: -10,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    paddingHorizontal: 16,
  },
  infoDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  infoStar:   { fontSize: 16 },
  infoRating: { color: GOLD, fontSize: 20, fontWeight: '900' },
  infoGray:   { color: GRAY, fontSize: 12 },
  infoPrice:  { color: GOLD, fontSize: 20, fontWeight: '900' },

  workingHours: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  workingHoursIcon: { fontSize: 14 },
  workingHoursText: { color: GRAY, fontSize: 12 },

  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  waBtn: {
    flex: 1,
    backgroundColor: '#25D366',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  waBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  reserveBtn: {
    flex: 1,
    backgroundColor: CYAN,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: CYAN,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  reserveBtnText: {
    color: NAVY,
    fontSize: 13,
    fontWeight: '800',
  },

  /* Section */
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: CYAN,
    letterSpacing: 2,
    marginBottom: 12,
  },

  /* Features Grid */
  featGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  featCell: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: NAVY2,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  featCellActive: {
    borderColor: 'rgba(0,212,255,0.3)',
  },
  featCellInactive: {
    borderColor: 'rgba(255,255,255,0.05)',
    opacity: 0.3,
  },
  featIcon: {
    fontSize: 20,
  },
  featIconOff: {
    opacity: 0.5,
  },
  featLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  featLabelOff: {
    color: GRAY,
    fontWeight: '500',
  },

  /* Time Slot Grid */
  dateLabel: {
    color: GRAY,
    fontSize: 12,
    marginBottom: 12,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slot: {
    width: '23%',
    backgroundColor: NAVY2,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.2)',
  },
  slotBusy: {
    backgroundColor: NAVY,
    borderColor: 'rgba(255,255,255,0.05)',
    opacity: 0.4,
  },
  slotSelected: {
    backgroundColor: 'rgba(0,212,255,0.12)',
    borderColor: CYAN,
  },
  slotText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  slotTextBusy: {
    color: GRAY,
  },
  slotTextSelected: {
    color: CYAN,
  },
  slotBusyLabel: {
    color: GRAY,
    fontSize: 9,
    marginTop: 2,
    fontWeight: '600',
  },

  joinBtn: {
    backgroundColor: CYAN,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: CYAN,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  joinBtnText: {
    color: NAVY,
    fontSize: 15,
    fontWeight: '900',
  },

  /* Address & Description */
  addressText: {
    color: GRAY,
    fontSize: 13,
    lineHeight: 20,
  },
  descText: {
    color: GRAY,
    fontSize: 13,
    lineHeight: 20,
  },
});
