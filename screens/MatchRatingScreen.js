import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Share, Linking, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { avatarColor, initials, calcRating, ratingColor } from '../lib/utils';

export default function MatchRatingScreen({ navigation, route }) {
  const { matchId, venueId, venueName, matchDate, format } = route.params || {};
  const [step, setStep] = useState('own'); // 'own' | 'rate' | 'share'
  const [myGoals, setMyGoals] = useState(0);
  const [myAssists, setMyAssists] = useState(0);
  const [players, setPlayers] = useState([]);
  const [ratings, setRatings] = useState({});
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0);
  const [myId, setMyId] = useState(null);
  const [myProfile, setMyProfile] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setMyProfile(prof);

    const { data: mp } = await supabase
      .from('match_players')
      .select('user_id, profiles(id, full_name, position, goals, assists, matches_played)')
      .eq('match_id', matchId)
      .neq('user_id', user.id);
    setPlayers(mp?.map(p => p.profiles).filter(Boolean) || []);
  }

  async function saveAndContinue() {
    if (!myId) return;
    setSaving(true);
    try {
      // Çift sayılmayı önle: bu maç için daha önce kendi statsını kaydettiyse atla
      const { data: existing } = await supabase
        .from('match_ratings')
        .select('id')
        .eq('match_id', matchId)
        .eq('from_user', myId)
        .eq('to_user', myId)
        .maybeSingle();

      const { data: prof } = await supabase.from('profiles').select('goals, assists, matches_played').eq('id', myId).single();

      if (!existing) {
        // Kendi istatistiklerini işaretle (from_user = to_user = kendisi)
        await supabase.from('match_ratings').upsert({
          match_id: matchId, from_user: myId, to_user: myId, rating: 0,
        }, { onConflict: 'match_id,from_user,to_user' });

        await supabase.from('profiles').update({
          goals: (prof?.goals || 0) + myGoals,
          assists: (prof?.assists || 0) + myAssists,
          matches_played: (prof?.matches_played || 0) + 1,
        }).eq('id', myId);
      }

      // Profili güncelle ki share ekranında güncel rating gösterilsin
      setMyProfile(prev => prev ? {
        ...prev,
        goals: (prev.goals || 0) + myGoals,
        assists: (prev.assists || 0) + myAssists,
        matches_played: (prev.matches_played || 0) + 1,
      } : prev);

      if (players.length > 0) {
        setStep('rate');
      } else {
        setStep('share');
      }
    } catch (e) {
      Alert.alert('Hata', 'Kaydedilemedi, tekrar dene.');
    }
    setSaving(false);
  }

  async function submitRating(toUserId, rating) {
    try {
      await supabase.from('match_ratings').upsert({
        match_id: matchId,
        from_user: myId,
        to_user: toUserId,
        rating,
      }, { onConflict: 'match_id,from_user,to_user' });

      // Oyuncunun ortalama rating'ini güncelle
      const { data: allRatings } = await supabase
        .from('match_ratings')
        .select('rating')
        .eq('to_user', toUserId)
        .neq('to_user', toUserId === myId ? '' : toUserId); // self-rating hariç
      if (allRatings && allRatings.length > 0) {
        const validRatings = allRatings.filter(r => r.rating > 0);
        if (validRatings.length > 0) {
          const avg = validRatings.reduce((s, r) => s + r.rating, 0) / validRatings.length;
          await supabase.from('profiles').update({ rating: parseFloat(avg.toFixed(2)) }).eq('id', toUserId);
        }
      }
    } catch (e) {
      console.error(e);
    }

    const next = currentPlayerIdx + 1;
    if (next >= players.length) {
      setStep('share');
    } else {
      setCurrentPlayerIdx(next);
    }
  }

  async function sharePerformance() {
    const rating = calcRating(myProfile);
    const msg = `⚽ SAHA ile oynadım!\n\n🏟️ ${venueName || 'Halı Saha'}\n📅 ${matchDate || 'Bugün'} · ${format || '7v7'}\n\n⚽ ${myGoals} Gol | 🅰️ ${myAssists} Asist\n⭐ Rating: ${rating?.toFixed(1) || '5.0'}\n\nSAHA uygulamasını indir: https://saha.app`;
    if (Platform.OS === 'web') {
      Alert.alert('Performansın', msg);
      return;
    }
    try {
      await Share.share({ message: msg });
    } catch (e) {}
  }

  async function shareWhatsApp() {
    const msg = encodeURIComponent(`Maça davetlisin! 🏟️ ${venueName} · ${matchDate}\nhttps://saha.app/mac/${matchId}`);
    if (Platform.OS === 'web') {
      window.open(`https://wa.me/?text=${msg}`, '_blank');
      return;
    }
    const url = `whatsapp://send?text=${msg}`;
    const canOpen = await Linking.canOpenURL(url).catch(() => false);
    if (canOpen) {
      Linking.openURL(url);
    } else {
      sharePerformance();
    }
  }

  const rating = calcRating(myProfile);
  const rColor = ratingColor(rating);

  // ── ADIM 1: Kendi performansını gir ──────────────────────────
  if (step === 'own') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.headerBack}>← Geri</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Maç Sonu 🏁</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.stepTitle}>Performansını gir</Text>
          <Text style={styles.stepSub}>Bu maçta kaç gol attın, kaç asist yaptın?</Text>

          <View style={styles.counterCard}>
            <Text style={styles.counterLabel}>⚽ Gol</Text>
            <View style={styles.counterRow}>
              <TouchableOpacity style={styles.counterBtn} onPress={() => setMyGoals(Math.max(0, myGoals - 1))}>
                <Text style={styles.counterBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.counterNum}>{myGoals}</Text>
              <TouchableOpacity style={styles.counterBtn} onPress={() => setMyGoals(myGoals + 1)}>
                <Text style={styles.counterBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.counterCard}>
            <Text style={styles.counterLabel}>🅰️ Asist</Text>
            <View style={styles.counterRow}>
              <TouchableOpacity style={styles.counterBtn} onPress={() => setMyAssists(Math.max(0, myAssists - 1))}>
                <Text style={styles.counterBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.counterNum}>{myAssists}</Text>
              <TouchableOpacity style={styles.counterBtn} onPress={() => setMyAssists(myAssists + 1)}>
                <Text style={styles.counterBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
            onPress={saveAndContinue}
            disabled={saving}
          >
            <Text style={styles.primaryBtnText}>
              {saving ? 'Kaydediliyor...' : players.length > 0 ? 'Takım Arkadaşlarını Değerlendir →' : 'Paylaş →'}
            </Text>
          </TouchableOpacity>

          {players.length === 0 && (
            <TouchableOpacity onPress={() => setStep('share')}>
              <Text style={styles.skipText}>Atla, paylaşım ekranına git →</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── ADIM 2: Takım arkadaşlarını değerlendir ──────────────────
  if (step === 'rate') {
    const player = players[currentPlayerIdx];
    if (!player) { setStep('share'); return null; }
    const pr = calcRating(player);
    const pColor = ratingColor(pr);

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={{ width: 50 }} />
          <Text style={styles.headerTitle}>Değerlendir</Text>
          <Text style={styles.headerSub}>{currentPlayerIdx + 1}/{players.length}</Text>
        </View>

        <View style={styles.rateScreen}>
          <View style={[styles.playerBigCard, { backgroundColor: avatarColor(player.full_name) }]}>
            <Text style={styles.playerBigInitials}>{initials(player.full_name)}</Text>
            <View style={[styles.playerRatingBadge, { backgroundColor: pColor }]}>
              <Text style={styles.playerRatingBadgeText}>{pr?.toFixed(1)}</Text>
            </View>
          </View>

          <Text style={styles.playerBigName}>{player.full_name}</Text>
          <Text style={styles.playerBigPos}>{player.position || 'Oyuncu'}</Text>

          <Text style={styles.rateQuestion}>Bu maçtaki performansını değerlendir:</Text>

          <View style={styles.ratingButtons}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.ratingBtn, {
                  backgroundColor: r >= 8 ? '#C9A84C' : r >= 6 ? '#10B981' : r >= 4 ? '#3B82F6' : '#EF4444',
                }]}
                onPress={() => submitRating(player.id, r)}
              >
                <Text style={styles.ratingBtnText}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity onPress={() => {
            const next = currentPlayerIdx + 1;
            if (next >= players.length) setStep('share');
            else setCurrentPlayerIdx(next);
          }}>
            <Text style={styles.skipText}>Bu oyuncuyu atla →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── ADIM 3: Paylaşım ──────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.headerTitle}>Harika Maç! 🎉</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Performans kartı */}
        <View style={[styles.perfCard, { borderColor: rColor }]}>
          <View style={[styles.perfAvatar, { backgroundColor: avatarColor(myProfile?.full_name || '') }]}>
            <Text style={styles.perfInitials}>{initials(myProfile?.full_name || '')}</Text>
          </View>
          <Text style={styles.perfName}>{myProfile?.full_name || 'Oyuncu'}</Text>
          <Text style={styles.perfVenue}>{venueName || 'Halı Saha'} · {format || '7v7'}</Text>

          <View style={styles.perfStats}>
            <View style={styles.perfStat}>
              <Text style={styles.perfStatNum}>{myGoals}</Text>
              <Text style={styles.perfStatLabel}>Gol ⚽</Text>
            </View>
            <View style={styles.perfDivider} />
            <View style={styles.perfStat}>
              <Text style={styles.perfStatNum}>{myAssists}</Text>
              <Text style={styles.perfStatLabel}>Asist 🅰️</Text>
            </View>
            <View style={styles.perfDivider} />
            <View style={styles.perfStat}>
              <Text style={[styles.perfStatNum, { color: rColor }]}>
                {rating?.toFixed(1)}
              </Text>
              <Text style={styles.perfStatLabel}>Rating ⭐</Text>
            </View>
          </View>
        </View>

        {/* Paylaş butonları */}
        <Text style={styles.shareTitle}>Paylaş</Text>

        <TouchableOpacity style={styles.shareBtn} onPress={sharePerformance}>
          <Text style={styles.shareBtnIcon}>📤</Text>
          <Text style={styles.shareBtnText}>Performansımı Paylaş</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.shareBtn, styles.shareBtnWa]} onPress={shareWhatsApp}>
          <Text style={styles.shareBtnIcon}>💬</Text>
          <Text style={[styles.shareBtnText, { color: '#fff' }]}>WhatsApp'ta Paylaş</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryBtn, { marginTop: 24 }]}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.primaryBtnText}>Ana Sayfaya Dön</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F9' },

  header: {
    backgroundColor: '#001F5B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerBack:  { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  headerSub:   { color: 'rgba(255,255,255,0.6)', fontSize: 13 },

  scroll: { padding: 20, paddingBottom: 40 },

  stepTitle: { fontSize: 22, fontWeight: '800', color: '#001F5B', marginBottom: 6 },
  stepSub:   { fontSize: 14, color: '#94A3B8', marginBottom: 24 },

  counterCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#001F5B',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  counterLabel: { fontSize: 15, fontWeight: '700', color: '#64748B', marginBottom: 12 },
  counterRow:   { flexDirection: 'row', alignItems: 'center', gap: 20 },
  counterBtn: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center',
  },
  counterBtnText: { fontSize: 24, fontWeight: '700', color: '#001F5B' },
  counterNum:     { fontSize: 36, fontWeight: '900', color: '#001F5B', minWidth: 48, textAlign: 'center' },

  primaryBtn: {
    backgroundColor: '#001F5B',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#001F5B',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  skipText: { textAlign: 'center', color: '#94A3B8', fontSize: 13, marginTop: 16 },

  // Rate step
  rateScreen: { flex: 1, alignItems: 'center', padding: 24 },

  playerBigCard: {
    width: 100, height: 100, borderRadius: 30,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12, marginTop: 8,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
  },
  playerBigInitials:    { fontSize: 36, fontWeight: '800', color: '#fff' },
  playerRatingBadge: {
    position: 'absolute', bottom: -8, right: -8,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10, borderWidth: 2, borderColor: '#fff',
  },
  playerRatingBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  playerBigName: { fontSize: 20, fontWeight: '800', color: '#001F5B', marginBottom: 4 },
  playerBigPos:  { fontSize: 13, color: '#94A3B8', marginBottom: 24 },

  rateQuestion: { fontSize: 14, fontWeight: '600', color: '#64748B', marginBottom: 16, textAlign: 'center' },

  ratingButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  ratingBtn: {
    width: 52, height: 52, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, elevation: 2,
  },
  ratingBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },

  // Share step
  perfCard: {
    backgroundColor: '#001F5B',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 3,
  },
  perfAvatar: {
    width: 80, height: 80, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  perfInitials: { fontSize: 28, fontWeight: '800', color: '#fff' },
  perfName:     { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 },
  perfVenue:    { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 20 },

  perfStats: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'space-around' },
  perfStat:  { alignItems: 'center' },
  perfStatNum:   { fontSize: 28, fontWeight: '900', color: '#00A0D2' },
  perfStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 },
  perfDivider:   { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.15)' },

  shareTitle: { fontSize: 16, fontWeight: '700', color: '#001F5B', marginBottom: 12 },

  shareBtn: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    shadowColor: '#001F5B',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  shareBtnWa:   { backgroundColor: '#25D366' },
  shareBtnIcon: { fontSize: 20 },
  shareBtnText: { fontSize: 15, fontWeight: '700', color: '#001F5B' },
});
