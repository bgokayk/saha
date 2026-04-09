import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Share, Linking, Platform, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { avatarColor, initials, calcRating, ratingColor, formatMatchDate } from '../lib/utils';

// ── Theme ──────────────────────────────────────────────────────
const C = {
  navy:    '#0A1628',
  navy2:   '#0F1E35',
  cyan:    '#00D4FF',
  gold:    '#FFB800',
  gray:    '#8B9BB4',
  success: '#00E096',
  danger:  '#FF4757',
  white:   '#FFFFFF',
};

function haptic(type = 'light') {
  if (Platform.OS === 'web') return;
  try {
    const H = require('expo-haptics');
    if (type === 'selection') H.selectionAsync();
    else if (type === 'success') H.notificationAsync(H.NotificationFeedbackType.Success);
    else H.impactAsync(H.ImpactFeedbackStyle.Light);
  } catch (_) {}
}

export default function MatchRatingScreen({ navigation, route }) {
  const { matchId, venueId, venueName, matchDate, format } = route.params || {};
  const insets = useSafeAreaInsets();

  const isSubmitting = useRef(false);
  const [step, setStep] = useState('own'); // 'own' | 'rate' | 'share'
  const [myGoals, setMyGoals] = useState(0);
  const [myAssists, setMyAssists] = useState(0);
  const [players, setPlayers] = useState([]);
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0);
  const [myId, setMyId] = useState(null);
  const [myProfile, setMyProfile] = useState(null);
  const [saving, setSaving] = useState(false);

  // Animation for step transitions
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [step, currentPlayerIdx]);

  async function loadData() {
    if (!matchId) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMyId(user.id);

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setMyProfile(prof);

      const { data: mp } = await supabase
        .from('match_players')
        .select('user_id, profiles(id, full_name, position, goals, assists, matches_played)')
        .eq('match_id', matchId)
        .neq('user_id', user.id);
      setPlayers(mp?.map(p => p.profiles).filter(Boolean) || []);
    } catch (e) {
      Alert.alert('Hata', 'Veriler yüklenemedi.');
    }
  }

  // ── Step 1: Save own stats ────────────────────────────────────
  async function saveAndContinue() {
    if (!myId) return;
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    setSaving(true);
    try {
      // Prevent double counting: check if self-stat marker already exists
      const { data: existing } = await supabase
        .from('match_ratings')
        .select('id')
        .eq('match_id', matchId)
        .eq('from_user', myId)
        .eq('to_user', myId)
        .maybeSingle();

      const { data: prof } = await supabase
        .from('profiles')
        .select('goals, assists, matches_played')
        .eq('id', myId)
        .single();

      if (!existing) {
        // Mark own stats recorded (from_user = to_user = self)
        await supabase.from('match_ratings').upsert({
          match_id: matchId, from_user: myId, to_user: myId, rating: 0,
        }, { onConflict: 'match_id,from_user,to_user' });

        await supabase.from('profiles').update({
          goals: (prof?.goals || 0) + myGoals,
          assists: (prof?.assists || 0) + myAssists,
          matches_played: (prof?.matches_played || 0) + 1,
        }).eq('id', myId);
      }

      // Update local profile for share screen
      setMyProfile(prev => prev ? {
        ...prev,
        goals: (prev.goals || 0) + myGoals,
        assists: (prev.assists || 0) + myAssists,
        matches_played: (prev.matches_played || 0) + 1,
      } : prev);

      haptic('success');

      if (players.length > 0) {
        setStep('rate');
      } else {
        setStep('share');
      }
    } catch (e) {
      Alert.alert('Hata', 'Kaydedilemedi, tekrar dene.');
    } finally {
      setSaving(false);
      isSubmitting.current = false;
    }
  }

  // ── Step 2: Submit rating for a player ────────────────────────
  async function submitRating(toUserId, rating) {
    haptic('selection');
    try {
      await supabase.from('match_ratings').upsert({
        match_id: matchId,
        from_user: myId,
        to_user: toUserId,
        rating,
      }, { onConflict: 'match_id,from_user,to_user' });

      // Recalculate average rating for this player
      const { data: allRatings } = await supabase
        .from('match_ratings')
        .select('rating')
        .eq('to_user', toUserId)
        .neq('from_user', toUserId); // exclude self-marker
      if (allRatings && allRatings.length > 0) {
        const validRatings = allRatings.filter(r => r.rating > 0);
        if (validRatings.length > 0) {
          const avg = validRatings.reduce((s, r) => s + r.rating, 0) / validRatings.length;
          await supabase.from('profiles').update({ rating: parseFloat(avg.toFixed(2)) }).eq('id', toUserId);
        }
      }
    } catch (e) {
      // Silent fail — don't block flow
    }

    const next = currentPlayerIdx + 1;
    if (next >= players.length) {
      setStep('share');
    } else {
      setCurrentPlayerIdx(next);
    }
  }

  // ── Step 3: Share ─────────────────────────────────────────────
  async function sharePerformance() {
    const r = calcRating(myProfile);
    const msg = `\u26BD SAHA ile oynad\u0131m!\n\n\uD83C\uDFDF\uFE0F ${venueName || 'Hal\u0131 Saha'}\n\uD83D\uDCC5 ${matchDate || 'Bug\u00FCn'} \u00B7 ${format || '7v7'}\n\n\u26BD ${myGoals} Gol | \uD83C\uDD70\uFE0F ${myAssists} Asist\n\u2B50 Rating: ${r?.toFixed(1) || '5.0'}\n\nSAHA uygulamasını indir: https://saha.app`;
    if (Platform.OS === 'web') {
      Alert.alert('Performansın', msg);
      return;
    }
    try {
      await Share.share({ message: msg });
    } catch (_) {}
  }

  async function shareWhatsApp() {
    const msg = encodeURIComponent(`Maça davetlisin! \uD83C\uDFDF\uFE0F ${venueName} \u00B7 ${matchDate}\nhttps://saha.app/mac/${matchId}`);
    if (Platform.OS === 'web') {
      try { window.open(`https://wa.me/?text=${msg}`, '_blank'); } catch (_) {}
      return;
    }
    const url = `whatsapp://send?text=${msg}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        Linking.openURL(url);
      } else {
        sharePerformance();
      }
    } catch (_) {
      sharePerformance();
    }
  }

  const rating = calcRating(myProfile);
  const rColor = ratingColor(rating);

  // ── Guard: no matchId ─────────────────────────────────────────
  if (!matchId) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.headerBack}>← Geri</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Hata</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: C.gray, fontSize: 15, textAlign: 'center' }}>Maç bilgisi bulunamadı.</Text>
        </View>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // STEP 1 — Own Performance
  // ════════════════════════════════════════════════════════════════
  if (step === 'own') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.headerBack}>← Geri</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Maç Sona Erdi 🏁</Text>
          <View style={{ width: 50 }} />
        </View>

        <Animated.ScrollView
          contentContainerStyle={styles.scroll}
          style={{ opacity: fadeAnim }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.stepTitle}>Maç Sona Erdi 🏁</Text>
          <Text style={styles.stepSub}>Bu maçta kaç gol attın, kaç asist yaptın?</Text>

          {/* Goal Counter */}
          <View style={styles.counterCard}>
            <Text style={styles.counterLabel}>⚽ Gol</Text>
            <View style={styles.counterRow}>
              <TouchableOpacity
                style={styles.counterBtn}
                onPress={() => { setMyGoals(Math.max(0, myGoals - 1)); haptic(); }}
                activeOpacity={0.7}
              >
                <Text style={styles.counterBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.counterNum}>{myGoals}</Text>
              <TouchableOpacity
                style={styles.counterBtn}
                onPress={() => { setMyGoals(myGoals + 1); haptic(); }}
                activeOpacity={0.7}
              >
                <Text style={styles.counterBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Assist Counter */}
          <View style={styles.counterCard}>
            <Text style={styles.counterLabel}>🅰️ Asist</Text>
            <View style={styles.counterRow}>
              <TouchableOpacity
                style={styles.counterBtn}
                onPress={() => { setMyAssists(Math.max(0, myAssists - 1)); haptic(); }}
                activeOpacity={0.7}
              >
                <Text style={styles.counterBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.counterNum}>{myAssists}</Text>
              <TouchableOpacity
                style={styles.counterBtn}
                onPress={() => { setMyAssists(myAssists + 1); haptic(); }}
                activeOpacity={0.7}
              >
                <Text style={styles.counterBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.cyanBtn, saving && { opacity: 0.6 }]}
            onPress={saveAndContinue}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={styles.cyanBtnText}>
              {saving ? 'Kaydediliyor...' : 'Devam →'}
            </Text>
          </TouchableOpacity>
        </Animated.ScrollView>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // STEP 2 — Rate Teammates
  // ════════════════════════════════════════════════════════════════
  if (step === 'rate') {
    const player = players[currentPlayerIdx];
    if (!player) { setStep('share'); return null; }
    const pr = calcRating(player);
    const pColor = ratingColor(pr);

    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={{ width: 50 }} />
          <Text style={styles.headerTitle}>Değerlendir</Text>
          <Text style={styles.headerSub}>{currentPlayerIdx + 1}/{players.length}</Text>
        </View>

        <Animated.View style={[styles.rateScreen, { opacity: fadeAnim }]}>
          {/* Player Card */}
          <View style={[styles.playerBigCard, { backgroundColor: avatarColor(player.full_name) }]}>
            <Text style={styles.playerBigInitials}>{initials(player.full_name)}</Text>
            <View style={[styles.playerRatingBadge, { backgroundColor: pColor }]}>
              <Text style={styles.playerRatingBadgeText}>{pr?.toFixed(1)}</Text>
            </View>
          </View>

          <Text style={styles.playerBigName}>{player.full_name}</Text>
          <Text style={styles.playerBigPos}>{player.position || 'Oyuncu'}</Text>

          <Text style={styles.rateQuestion}>Bu maçtaki performansını değerlendir:</Text>

          {/* Rating Buttons: 2 rows of 5 */}
          <View style={styles.ratingGrid}>
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.ratingBtn, {
                    backgroundColor: r <= 3
                      ? 'rgba(255,71,87,0.8)'
                      : r <= 5
                        ? 'rgba(255,184,0,0.8)'
                        : 'rgba(0,224,150,0.8)',
                  }]}
                  onPress={() => submitRating(player.id, r)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.ratingBtnText}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.ratingRow}>
              {[6, 7, 8, 9, 10].map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.ratingBtn, {
                    backgroundColor: r <= 6
                      ? 'rgba(255,184,0,0.8)'
                      : 'rgba(0,224,150,0.8)',
                  }]}
                  onPress={() => submitRating(player.id, r)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.ratingBtnText}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity onPress={() => {
            const next = currentPlayerIdx + 1;
            if (next >= players.length) setStep('share');
            else setCurrentPlayerIdx(next);
          }}>
            <Text style={styles.skipText}>Bu oyuncuyu atla →</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // STEP 3 — Share
  // ════════════════════════════════════════════════════════════════
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.headerTitle}>Harika Maç! 🎉</Text>
        <View style={{ width: 50 }} />
      </View>

      <Animated.ScrollView
        contentContainerStyle={styles.scroll}
        style={{ opacity: fadeAnim }}
        showsVerticalScrollIndicator={false}
      >
        {/* Performance Card */}
        <View style={[styles.perfCard, { borderColor: rColor }]}>
          <View style={[styles.perfAvatar, { backgroundColor: avatarColor(myProfile?.full_name || '') }]}>
            <Text style={styles.perfInitials}>{initials(myProfile?.full_name || '')}</Text>
          </View>
          <Text style={styles.perfName}>{myProfile?.full_name || 'Oyuncu'}</Text>

          {/* Rating circle */}
          <View style={[styles.ratingCircle, { backgroundColor: rColor }]}>
            <Text style={styles.ratingCircleNum}>{rating?.toFixed(1)}</Text>
          </View>

          <Text style={styles.perfStatsLine}>
            ⚽ {myGoals} Gol  |  🅰️ {myAssists} Asist
          </Text>

          <Text style={styles.perfVenue}>
            {venueName || 'Halı Saha'} · {matchDate || 'Bugün'}
          </Text>

          <Text style={styles.perfBrand}>SAHA by LumenCo.</Text>
        </View>

        {/* Share Buttons */}
        <TouchableOpacity style={styles.shareBtnCyan} onPress={sharePerformance} activeOpacity={0.85}>
          <Text style={styles.shareBtnCyanText}>📱 Performansı Paylaş</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.shareBtnWa} onPress={shareWhatsApp} activeOpacity={0.85}>
          <Text style={styles.shareBtnWaText}>💬 WhatsApp'a Gönder</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => navigation.navigate('Home')}
          activeOpacity={0.85}
        >
          <Text style={styles.homeBtnText}>Ana Sayfaya Dön</Text>
        </TouchableOpacity>
      </Animated.ScrollView>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════
// Styles
// ════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.navy,
  },

  // ── Header ──────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerBack:  { color: C.gray, fontSize: 14 },
  headerTitle: { color: C.white, fontSize: 17, fontWeight: '700' },
  headerSub:   { color: C.gray, fontSize: 13, width: 50, textAlign: 'right' },

  scroll: { padding: 20, paddingBottom: 48 },

  // ── Step 1: Own Performance ─────────────────────────────────
  stepTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: C.white,
    marginBottom: 6,
  },
  stepSub: {
    fontSize: 14,
    color: C.gray,
    marginBottom: 28,
  },

  counterCard: {
    backgroundColor: C.navy2,
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
  },
  counterLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: C.gray,
    marginBottom: 14,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  counterBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.navy2,
    borderWidth: 2,
    borderColor: C.cyan,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterBtnText: {
    fontSize: 26,
    fontWeight: '700',
    color: C.cyan,
  },
  counterNum: {
    fontSize: 48,
    fontWeight: '900',
    color: C.white,
    minWidth: 64,
    textAlign: 'center',
  },

  cyanBtn: {
    backgroundColor: C.cyan,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: C.cyan,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  cyanBtnText: {
    color: C.navy,
    fontSize: 16,
    fontWeight: '800',
  },

  skipText: {
    textAlign: 'center',
    color: C.gray,
    fontSize: 13,
    marginTop: 20,
  },

  // ── Step 2: Rate Teammates ──────────────────────────────────
  rateScreen: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
  },

  playerBigCard: {
    width: '100%',
    height: 200,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  playerBigInitials: {
    fontSize: 56,
    fontWeight: '800',
    color: C.white,
  },
  playerRatingBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  playerRatingBadgeText: {
    color: C.white,
    fontSize: 14,
    fontWeight: '800',
  },

  playerBigName: {
    fontSize: 22,
    fontWeight: '800',
    color: C.white,
    marginBottom: 4,
  },
  playerBigPos: {
    fontSize: 13,
    color: C.gray,
    marginBottom: 24,
  },

  rateQuestion: {
    fontSize: 14,
    fontWeight: '600',
    color: C.gray,
    marginBottom: 18,
    textAlign: 'center',
  },

  ratingGrid: {
    width: '100%',
    gap: 10,
    marginBottom: 16,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  ratingBtn: {
    width: 52,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  ratingBtnText: {
    color: C.white,
    fontSize: 18,
    fontWeight: '800',
  },

  // ── Step 3: Share ───────────────────────────────────────────
  perfCard: {
    backgroundColor: C.navy2,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
  },
  perfAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  perfInitials: {
    fontSize: 28,
    fontWeight: '800',
    color: C.white,
  },
  perfName: {
    fontSize: 20,
    fontWeight: '800',
    color: C.white,
    marginBottom: 12,
  },

  ratingCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  ratingCircleNum: {
    fontSize: 28,
    fontWeight: '900',
    color: C.white,
  },

  perfStatsLine: {
    fontSize: 16,
    fontWeight: '700',
    color: C.white,
    marginBottom: 12,
  },
  perfVenue: {
    fontSize: 12,
    color: C.gray,
    marginBottom: 12,
  },
  perfBrand: {
    fontSize: 11,
    color: C.cyan,
    fontWeight: '600',
  },

  shareBtnCyan: {
    backgroundColor: C.cyan,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: C.cyan,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  shareBtnCyanText: {
    color: C.navy,
    fontSize: 15,
    fontWeight: '700',
  },

  shareBtnWa: {
    backgroundColor: '#25D366',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#25D366',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  shareBtnWaText: {
    color: C.white,
    fontSize: 15,
    fontWeight: '700',
  },

  homeBtn: {
    backgroundColor: C.navy2,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 14,
  },
  homeBtnText: {
    color: C.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
