import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, Image,
  Share, Platform, ScrollView
} from 'react-native';
import { useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { calcRating, ratingColor, avatarColor, initials } from '../lib/utils';

const FORMATIONS = {
  '5v5': {
    name: '5v5 — 2-2-1',
    positions: [
      { id: 'gk',   label: 'KAL', x: 50, y: 85 },
      { id: 'def1', label: 'DEF', x: 25, y: 65 },
      { id: 'def2', label: 'DEF', x: 75, y: 65 },
      { id: 'mid1', label: 'ORT', x: 25, y: 40 },
      { id: 'mid2', label: 'ORT', x: 75, y: 40 },
      { id: 'fwd',  label: 'FOR', x: 50, y: 16 },
    ]
  },
  '6v6': {
    name: '6v6 — 2-2-1-1',
    positions: [
      { id: 'gk',   label: 'KAL', x: 50, y: 85 },
      { id: 'def1', label: 'DEF', x: 25, y: 68 },
      { id: 'def2', label: 'DEF', x: 75, y: 68 },
      { id: 'mid1', label: 'ORT', x: 25, y: 46 },
      { id: 'mid2', label: 'ORT', x: 75, y: 46 },
      { id: 'cam',  label: 'ORT', x: 50, y: 30 },
      { id: 'fwd',  label: 'FOR', x: 50, y: 12 },
    ]
  },
  '7v7': {
    name: '7v7 — 3-2-2',
    positions: [
      { id: 'gk',   label: 'KAL', x: 50, y: 85 },
      { id: 'def1', label: 'DEF', x: 20, y: 67 },
      { id: 'def2', label: 'DEF', x: 50, y: 69 },
      { id: 'def3', label: 'DEF', x: 80, y: 67 },
      { id: 'mid1', label: 'ORT', x: 30, y: 44 },
      { id: 'mid2', label: 'ORT', x: 70, y: 44 },
      { id: 'fwd1', label: 'FOR', x: 28, y: 18 },
      { id: 'fwd2', label: 'FOR', x: 72, y: 18 },
    ]
  },
  '8v8': {
    name: '8v8 — 3-3-2',
    positions: [
      { id: 'gk',   label: 'KAL', x: 50, y: 85 },
      { id: 'def1', label: 'DEF', x: 20, y: 68 },
      { id: 'def2', label: 'DEF', x: 50, y: 70 },
      { id: 'def3', label: 'DEF', x: 80, y: 68 },
      { id: 'mid1', label: 'ORT', x: 20, y: 46 },
      { id: 'mid2', label: 'ORT', x: 50, y: 48 },
      { id: 'mid3', label: 'ORT', x: 80, y: 46 },
      { id: 'fwd1', label: 'FOR', x: 33, y: 20 },
      { id: 'fwd2', label: 'FOR', x: 67, y: 20 },
    ]
  }
};


export default function LineupScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const matchId = route?.params?.matchId || null;
  const initialFormat = route?.params?.format || '7v7';
  const [selectedFormat, setSelectedFormat] = useState(initialFormat);
  const [homePlayers, setHomePlayers] = useState({});   // posId -> profile
  const [awayPlayers, setAwayPlayers] = useState({});   // posId -> profile
  const [activeTeam, setActiveTeam] = useState('home');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPos,   setEditingPos]   = useState(null);
  const [search,  setSearch]    = useState('');
  const [results, setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [teamName, setTeamName] = useState('');

  const formation = FORMATIONS[selectedFormat];
  const currentPlayers = activeTeam === 'home' ? homePlayers : awayPlayers;
  const homeCount = Object.values(homePlayers).filter(Boolean).length;
  const awayCount = Object.values(awayPlayers).filter(Boolean).length;
  const maxPerTeam = formation.positions.length;
  const accentColor = activeTeam === 'home' ? '#00D4FF' : '#FFB800';

  // Load match players from DB
  useEffect(() => {
    if (!matchId) return;
    loadMatchPlayers();
  }, [matchId]);

  async function loadMatchPlayers() {
    try {
      const { data } = await supabase
        .from('match_players')
        .select('*, profiles(id, full_name, position, goals, assists, matches_played, avatar_url)')
        .eq('match_id', matchId);
      if (!data) return;
      const home = {};
      const away = {};
      const homeItems = data.filter(d => d.team === 'home');
      const awayItems = data.filter(d => d.team === 'away');
      // Map to formation positions in order
      const positions = formation.positions;
      homeItems.forEach((item, i) => {
        if (i < positions.length && item.profiles) {
          home[positions[i].id] = item.profiles;
        }
      });
      awayItems.forEach((item, i) => {
        if (i < positions.length && item.profiles) {
          away[positions[i].id] = item.profiles;
        }
      });
      setHomePlayers(home);
      setAwayPlayers(away);
    } catch (e) { console.error(e); }
  }

  // Search players
  useEffect(() => {
    if (search.length < 1) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const sanitized = search.replace(/[%_]/g, '');
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, position, goals, assists, matches_played, avatar_url')
          .ilike('full_name', `%${sanitized}%`)
          .limit(8);
        setResults(data || []);
      } catch (e) {
        console.error(e);
        setResults([]);
      }
      setSearching(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  function openModal(pos) {
    setEditingPos(pos);
    setSearch('');
    setResults([]);
    setModalVisible(true);
  }

  async function selectPlayer(profile) {
    if (activeTeam === 'home') {
      setHomePlayers(prev => ({ ...prev, [editingPos.id]: profile }));
    } else {
      setAwayPlayers(prev => ({ ...prev, [editingPos.id]: profile }));
    }

    // Save to DB if matchId exists
    if (matchId && profile.id) {
      try {
        await supabase.from('match_players').upsert({
          match_id: matchId,
          user_id: profile.id,
          team: activeTeam,
        }, { onConflict: 'match_id,user_id' });
      } catch (e) { console.error(e); }
    }

    setModalVisible(false);
  }

  async function removePlayer(posId) {
    const players = activeTeam === 'home' ? homePlayers : awayPlayers;
    const profile = players[posId];

    if (activeTeam === 'home') {
      setHomePlayers(prev => { const n = { ...prev }; delete n[posId]; return n; });
    } else {
      setAwayPlayers(prev => { const n = { ...prev }; delete n[posId]; return n; });
    }

    if (matchId && profile?.id) {
      try {
        await supabase.from('match_players')
          .delete()
          .eq('match_id', matchId)
          .eq('user_id', profile.id);
      } catch (e) { console.error(e); }
    }
  }

  async function invitePlayer(profile) {
    if (!matchId) {
      selectPlayer(profile);
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('match_invites').insert({
        match_id: matchId,
        from_user: user.id,
        to_user: profile.id,
        status: 'pending',
      });
      Alert.alert('Davet Gonderildi! \u{1F4E9}', `${profile.full_name} maca davet edildi.`);
    } catch (e) {
      if (e?.code === '23505') {
        Alert.alert('Zaten Davet Edildi', 'Bu oyuncuya zaten davet gonderilmis.');
      } else {
        Alert.alert('Hata', 'Davet gonderilemedi.');
      }
    }
    setModalVisible(false);
  }

  function clearAll() {
    Alert.alert('Kadroyu Temizle', 'Tum oyuncular silinecek.', [
      { text: 'Iptal', style: 'cancel' },
      { text: 'Temizle', style: 'destructive', onPress: () => {
        setHomePlayers({});
        setAwayPlayers({});
      }},
    ]);
  }

  async function handleShare() {
    const homeNames = Object.values(homePlayers).filter(Boolean).map(p => p.full_name).join(', ');
    const awayNames = Object.values(awayPlayers).filter(Boolean).map(p => p.full_name).join(', ');
    const msg = `\u26BD ${selectedFormat} Mac Kadrosu\n\n\u{1F3E0} Ev Sahibi:\n${homeNames || 'Henuz oyuncu yok'}\n\n\u26BD Rakip:\n${awayNames || 'Henuz oyuncu yok'}\n\nSAHA by LumenCo.`;
    try {
      if (Platform.OS === 'web') {
        Alert.alert('Kadro', msg);
      } else {
        await Share.share({ message: msg });
      }
    } catch (_) {}
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{'\u2190'} Geri</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {matchId ? `Rez: ${matchId.slice(0, 8)}` : 'Kadro Olusturucu'}
          </Text>
          <Text style={styles.headerSub}>Ev: {homeCount}/{maxPerTeam} {'\u00B7'} Rakip: {awayCount}/{maxPerTeam}</Text>
        </View>
        <TouchableOpacity onPress={clearAll}>
          <Text style={styles.clearText}>Temizle</Text>
        </TouchableOpacity>
      </View>

      {/* Format bar */}
      <View style={[styles.formatBar, matchId && { opacity: 0.5 }]}
        pointerEvents={matchId ? 'none' : 'auto'}
      >
        {Object.keys(FORMATIONS).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.fmtBtn, selectedFormat === f && styles.fmtBtnActive]}
            onPress={() => { setSelectedFormat(f); setHomePlayers({}); setAwayPlayers({}); }}
          >
            <Text style={[styles.fmtText, selectedFormat === f && styles.fmtTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Team Tabs */}
      <View style={styles.teamTabs}>
        <TouchableOpacity
          style={[
            styles.teamTab,
            activeTeam === 'home' ? styles.teamTabHomeActive : styles.teamTabInactive,
          ]}
          onPress={() => setActiveTeam('home')}
        >
          <Text style={[
            styles.teamTabText,
            activeTeam === 'home' && styles.teamTabTextActive,
          ]}>{'\u{1F3E0}'} Ev Sahibi</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.teamTab,
            activeTeam === 'away' ? styles.teamTabAwayActive : styles.teamTabInactive,
          ]}
          onPress={() => setActiveTeam('away')}
        >
          <Text style={[
            styles.teamTabText,
            activeTeam === 'away' && styles.teamTabTextAwayActive,
          ]}>{'\u26BD'} Rakip Takim</Text>
        </TouchableOpacity>
      </View>

      {/* Saha */}
      <View style={styles.pitchWrap}>
        <View style={styles.pitch}>
          {/* Cizgiler */}
          <View style={styles.centerLine} />
          <View style={styles.centerCircle} />
          <View style={styles.penTop} />
          <View style={styles.penBot} />
          <View style={styles.goalTop} />
          <View style={styles.goalBot} />

          {/* Oyuncular */}
          {formation.positions.map(pos => {
            const profile = currentPlayers[pos.id];
            const rating  = calcRating(profile);
            const rColor  = ratingColor(rating);
            const isGk    = pos.id === 'gk';

            return (
              <TouchableOpacity
                key={pos.id}
                style={[styles.spotWrap, { left: `${pos.x}%`, top: `${pos.y}%` }]}
                onPress={() => profile ? removePlayer(pos.id) : openModal(pos)}
                onLongPress={() => openModal(pos)}
              >
                {/* Avatar */}
                <View style={[
                  styles.avatarRing,
                  profile
                    ? { borderColor: accentColor }
                    : { borderColor: isGk ? '#FFA500' : 'rgba(255,255,255,0.5)' }
                ]}>
                  {profile?.avatar_url ? (
                    <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
                  ) : (
                    <View style={[styles.avatarFallback, { backgroundColor: profile ? avatarColor(profile.full_name) : (isGk ? 'rgba(255,165,0,0.3)' : 'rgba(255,255,255,0.15)') }]}>
                      <Text style={styles.avatarInitials}>
                        {profile ? initials(profile.full_name) : pos.label}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Rating badge */}
                {profile && rating && (
                  <View style={[styles.ratingBadge, { backgroundColor: rColor }]}>
                    <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
                  </View>
                )}

                {/* Isim tag */}
                {profile ? (
                  <View style={styles.nameTag}>
                    <Text style={styles.nameText} numberOfLines={1}>
                      {profile.full_name?.split(' ')[0]}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.emptyTag}>
                    <Text style={styles.emptyText}>+</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Takim adi */}
      <TextInput
        style={styles.teamInput}
        placeholder="Takim adi (opsiyonel)"
        placeholderTextColor="#475569"
        value={teamName}
        onChangeText={setTeamName}
      />

      {/* Alt bilgi */}
      <View style={styles.footer}>
        <Text style={styles.footerHint}>{formation.name}  {'\u00B7'}  Bos yere dokun oyuncu ekle, dolu yere dokun kaldir</Text>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Text style={styles.shareBtnText}>Paylas {'\u{1F4E4}'}</Text>
        </TouchableOpacity>
      </View>

      {/* Oyuncu Arama Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: accentColor }]}>{editingPos?.label} {'\u2014'} Oyuncu Sec</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalClose}>{'\u2715'}</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Isim ile ara..."
              placeholderTextColor="#475569"
              value={search}
              onChangeText={setSearch}
              autoFocus
            />

            {searching && <ActivityIndicator color={accentColor} style={{ marginTop: 12 }} />}

            <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
              {results.map(p => {
                const r = calcRating(p);
                const rc = ratingColor(r);
                return (
                  <View key={p.id} style={styles.resultRow}>
                    {/* Mini avatar */}
                    <View style={[styles.miniAvatarRing, { borderColor: rc }]}>
                      {p.avatar_url ? (
                        <Image source={{ uri: p.avatar_url }} style={styles.miniAvatarImg} />
                      ) : (
                        <View style={[styles.miniAvatarFallback, { backgroundColor: avatarColor(p.full_name) }]}>
                          <Text style={styles.miniInitials}>{initials(p.full_name)}</Text>
                        </View>
                      )}
                    </View>

                    {/* Bilgiler */}
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultName}>{p.full_name}</Text>
                      <View style={styles.resultStats}>
                        <Text style={styles.resultStat}>{'\u26BD'} {p.goals ?? 0}</Text>
                        <Text style={styles.resultStat}>{'\u{1F170}\uFE0F'} {p.assists ?? 0}</Text>
                        <Text style={styles.resultStat}>{'\u{1F3AE}'} {p.matches_played ?? 0}</Text>
                        {p.position && <Text style={[styles.resultStat, { color: accentColor }]}>{p.position}</Text>}
                      </View>
                    </View>

                    {/* Rating */}
                    <View style={[styles.resultRating, { backgroundColor: rc }]}>
                      <Text style={styles.resultRatingText}>{r?.toFixed(1) ?? '\u2014'}</Text>
                    </View>

                    {/* Action buttons */}
                    <View style={styles.actionBtns}>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: accentColor }]}
                        onPress={() => selectPlayer(p)}
                      >
                        <Text style={styles.actionBtnText}>Ekle</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.inviteBtn]}
                        onPress={() => invitePlayer(p)}
                      >
                        <Text style={styles.inviteBtnText}>{'\u{1F4E9}'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}

              {results.length === 0 && search.length > 0 && !searching && (
                <Text style={styles.noResult}>Kullanici bulunamadi. Kayit olmayan oyuncular icin isim girin.</Text>
              )}

              {/* Manuel isim girisi */}
              {search.length > 0 && (
                <TouchableOpacity
                  style={styles.manualBtn}
                  onPress={() => selectPlayer({ full_name: search, goals: 0, assists: 0, matches_played: 0 })}
                >
                  <Text style={styles.manualBtnText}>"{search}" {'\u2014'} Manuel ekle</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0A1628' },

  header:      { paddingTop: 10, paddingBottom: 14, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0A1628' },
  headerCenter:{ alignItems: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  headerSub:   { color: '#00D4FF', fontSize: 11, marginTop: 1 },
  backText:    { color: 'rgba(255,255,255,0.45)', fontSize: 14 },
  clearText:   { color: '#EF4444', fontSize: 13 },

  formatBar:   { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 8, backgroundColor: '#0A1628' },
  fmtBtn:      { flex: 1, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  fmtBtnActive:{ backgroundColor: '#00D4FF', borderColor: '#00D4FF' },
  fmtText:     { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600' },
  fmtTextActive:{ color: '#FFFFFF' },

  // Team tabs
  teamTabs:    { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6, gap: 8, backgroundColor: '#0A1628' },
  teamTab:     { flex: 1, paddingVertical: 9, borderRadius: 20, alignItems: 'center', borderWidth: 1.5 },
  teamTabHomeActive: { backgroundColor: '#00D4FF', borderColor: '#00D4FF' },
  teamTabAwayActive: { backgroundColor: '#FFB800', borderColor: '#FFB800' },
  teamTabInactive:   { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.15)' },
  teamTabText:       { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },
  teamTabTextActive: { color: '#FFFFFF' },
  teamTabTextAwayActive: { color: '#0A1628' },

  pitchWrap:   { flex: 1, padding: 12, paddingBottom: 6 },
  pitch:       { flex: 1, backgroundColor: '#1A6B2E', borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', overflow: 'hidden', position: 'relative' },
  centerLine:  { position: 'absolute', left: 0, right: 0, top: '50%', height: 1.5, backgroundColor: 'rgba(255,255,255,0.25)' },
  centerCircle:{ position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)', left: '50%', top: '50%', marginLeft: -36, marginTop: -36 },
  penTop:      { position: 'absolute', left: '25%', right: '25%', top: 0, height: '18%', borderWidth: 1.5, borderTopWidth: 0, borderColor: 'rgba(255,255,255,0.22)' },
  penBot:      { position: 'absolute', left: '25%', right: '25%', bottom: 0, height: '18%', borderWidth: 1.5, borderBottomWidth: 0, borderColor: 'rgba(255,255,255,0.22)' },
  goalTop:     { position: 'absolute', left: '38%', right: '38%', top: 0, height: '7%', borderWidth: 1.5, borderTopWidth: 0, borderColor: 'rgba(255,255,255,0.22)' },
  goalBot:     { position: 'absolute', left: '38%', right: '38%', bottom: 0, height: '7%', borderWidth: 1.5, borderBottomWidth: 0, borderColor: 'rgba(255,255,255,0.22)' },

  spotWrap:    { position: 'absolute', alignItems: 'center', transform: [{ translateX: -26 }, { translateY: -26 }] },
  avatarRing:  { width: 50, height: 50, borderRadius: 25, borderWidth: 2.5, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  avatarImg:   { width: 46, height: 46, borderRadius: 23 },
  avatarFallback:{ width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  avatarInitials:{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  ratingBadge: { position: 'absolute', top: -5, right: -8, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 8, minWidth: 28, alignItems: 'center' },
  ratingText:  { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },

  nameTag:     { marginTop: 4, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  nameText:    { color: '#FFFFFF', fontSize: 9, fontWeight: '600', maxWidth: 72, textAlign: 'center' },
  emptyTag:    { marginTop: 4 },
  emptyText:   { color: 'rgba(255,255,255,0.35)', fontSize: 14 },

  teamInput:   { marginHorizontal: 12, marginBottom: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14, color: '#FFFFFF', fontSize: 13, textAlign: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },

  footer:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 28, paddingTop: 4 },
  footerHint:  { color: 'rgba(255,255,255,0.3)', fontSize: 10, flex: 1 },
  shareBtn:    { backgroundColor: '#00D4FF', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18 },
  shareBtnText:{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' },

  // Modal
  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalBox:    { backgroundColor: '#0F1E35', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle:  { color: '#00D4FF', fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  modalClose:  { color: 'rgba(255,255,255,0.4)', fontSize: 18 },

  searchInput: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, color: '#FFFFFF', fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 12 },

  resultRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', gap: 8 },
  miniAvatarRing:{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  miniAvatarImg:{ width: 36, height: 36, borderRadius: 18 },
  miniAvatarFallback:{ width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  miniInitials:{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  resultInfo:  { flex: 1 },
  resultName:  { color: '#FFFFFF', fontSize: 13, fontWeight: '600', marginBottom: 3 },
  resultStats: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  resultStat:  { color: 'rgba(255,255,255,0.4)', fontSize: 10 },
  resultRating:{ width: 32, height: 32, borderRadius: 7, justifyContent: 'center', alignItems: 'center' },
  resultRatingText:{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' },

  // Action buttons in modal
  actionBtns:  { flexDirection: 'row', gap: 6, marginLeft: 4 },
  actionBtn:   { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  actionBtnText:{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  inviteBtn:   { backgroundColor: 'rgba(255,184,0,0.2)', borderWidth: 1, borderColor: '#FFB800' },
  inviteBtnText:{ color: '#FFB800', fontSize: 13 },

  noResult:    { color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', marginTop: 20, marginBottom: 10 },
  manualBtn:   { marginTop: 12, backgroundColor: 'rgba(0,160,210,0.15)', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,160,210,0.3)' },
  manualBtnText:{ color: '#00D4FF', fontSize: 14 },
});
