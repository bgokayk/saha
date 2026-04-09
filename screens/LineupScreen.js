import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, Image
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
  const [players, setPlayers]   = useState({});   // posId → profile obj
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPos,   setEditingPos]   = useState(null);
  const [search,  setSearch]    = useState('');
  const [results, setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [teamName, setTeamName] = useState('');

  const formation = FORMATIONS[selectedFormat];
  const filledCount = Object.values(players).filter(Boolean).length;

  useEffect(() => {
    if (search.length < 1) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      setSearching(true);
      const sanitized = search.replace(/[%_]/g, '');
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, position, goals, assists, matches_played, avatar_url')
        .ilike('full_name', `%${sanitized}%`)
        .limit(8);
      setResults(data || []);
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

  function selectPlayer(profile) {
    setPlayers(prev => ({ ...prev, [editingPos.id]: profile }));
    setModalVisible(false);
  }

  function removePlayer(posId) {
    setPlayers(prev => { const n = { ...prev }; delete n[posId]; return n; });
  }

  function clearAll() {
    Alert.alert('Kadroyu Temizle', 'Tüm oyuncular silinecek.', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Temizle', style: 'destructive', onPress: () => setPlayers({}) },
    ]);
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Kadro Oluşturucu</Text>
          <Text style={styles.headerSub}>{filledCount}/{formation.positions.length} oyuncu</Text>
        </View>
        <TouchableOpacity onPress={clearAll}>
          <Text style={styles.clearText}>Temizle</Text>
        </TouchableOpacity>
      </View>

      {/* Format bar */}
      <View style={styles.formatBar}>
        {Object.keys(FORMATIONS).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.fmtBtn, selectedFormat === f && styles.fmtBtnActive]}
            onPress={() => { setSelectedFormat(f); setPlayers({}); }}
          >
            <Text style={[styles.fmtText, selectedFormat === f && styles.fmtTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Saha */}
      <View style={styles.pitchWrap}>
        <View style={styles.pitch}>
          {/* Çizgiler */}
          <View style={styles.centerLine} />
          <View style={styles.centerCircle} />
          <View style={styles.penTop} />
          <View style={styles.penBot} />
          <View style={styles.goalTop} />
          <View style={styles.goalBot} />

          {/* Oyuncular */}
          {formation.positions.map(pos => {
            const profile = players[pos.id];
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
                  profile ? { borderColor: rColor } : { borderColor: isGk ? '#FFA500' : 'rgba(255,255,255,0.5)' }
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

                {/* İsim tag */}
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

      {/* Takım adı */}
      <TextInput
        style={styles.teamInput}
        placeholder="Takım adı (opsiyonel)"
        placeholderTextColor="#475569"
        value={teamName}
        onChangeText={setTeamName}
      />

      {/* Alt bilgi */}
      <View style={styles.footer}>
        <Text style={styles.footerHint}>{formation.name}  ·  Boş yere dokun oyuncu ekle, dolu yere dokun kaldır</Text>
        <TouchableOpacity style={styles.shareBtn} onPress={() => Alert.alert('Yakında', 'Bu özellik yakında eklenecek.')}>
          <Text style={styles.shareBtnText}>Paylaş 📤</Text>
        </TouchableOpacity>
      </View>

      {/* Oyuncu Arama Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingPos?.label} — Oyuncu Seç</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="İsim ile ara..."
              placeholderTextColor="#475569"
              value={search}
              onChangeText={setSearch}
              autoFocus
            />

            {searching && <ActivityIndicator color="#00A0D2" style={{ marginTop: 12 }} />}

            {results.map(p => {
              const r = calcRating(p);
              const rc = ratingColor(r);
              return (
                <TouchableOpacity key={p.id} style={styles.resultRow} onPress={() => selectPlayer(p)}>
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
                      <Text style={styles.resultStat}>⚽ {p.goals ?? 0} gol</Text>
                      <Text style={styles.resultStat}>🅰️ {p.assists ?? 0} asist</Text>
                      <Text style={styles.resultStat}>🎮 {p.matches_played ?? 0} maç</Text>
                      {p.position && <Text style={[styles.resultStat, { color: '#00A0D2' }]}>{p.position}</Text>}
                    </View>
                  </View>

                  {/* Rating */}
                  <View style={[styles.resultRating, { backgroundColor: rc }]}>
                    <Text style={styles.resultRatingText}>{r?.toFixed(1) ?? '—'}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {results.length === 0 && search.length > 0 && !searching && (
              <Text style={styles.noResult}>Kullanıcı bulunamadı. Kayıt olmayan oyuncular için isim girin.</Text>
            )}

            {/* Manuel isim girişi */}
            {search.length > 0 && (
              <TouchableOpacity
                style={styles.manualBtn}
                onPress={() => selectPlayer({ full_name: search, goals: 0, assists: 0, matches_played: 0 })}
              >
                <Text style={styles.manualBtnText}>"{search}" — Manuel ekle</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#071428' },

  header:      { paddingTop: 10, paddingBottom: 14, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#040E1E' },
  headerCenter:{ alignItems: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  headerSub:   { color: '#00A0D2', fontSize: 11, marginTop: 1 },
  backText:    { color: 'rgba(255,255,255,0.45)', fontSize: 14 },
  clearText:   { color: '#EF4444', fontSize: 13 },

  formatBar:   { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 8, backgroundColor: '#040E1E' },
  fmtBtn:      { flex: 1, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  fmtBtnActive:{ backgroundColor: '#00A0D2', borderColor: '#00A0D2' },
  fmtText:     { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600' },
  fmtTextActive:{ color: '#FFFFFF' },

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
  shareBtn:    { backgroundColor: '#00A0D2', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18 },
  shareBtnText:{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' },

  // Modal
  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalBox:    { backgroundColor: '#0B1A30', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle:  { color: '#00A0D2', fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  modalClose:  { color: 'rgba(255,255,255,0.4)', fontSize: 18 },

  searchInput: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, color: '#FFFFFF', fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 12 },

  resultRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', gap: 12 },
  miniAvatarRing:{ width: 46, height: 46, borderRadius: 23, borderWidth: 2, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  miniAvatarImg:{ width: 42, height: 42, borderRadius: 21 },
  miniAvatarFallback:{ width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  miniInitials:{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  resultInfo:  { flex: 1 },
  resultName:  { color: '#FFFFFF', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  resultStats: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  resultStat:  { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
  resultRating:{ width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  resultRatingText:{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  noResult:    { color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', marginTop: 20, marginBottom: 10 },
  manualBtn:   { marginTop: 12, backgroundColor: 'rgba(0,160,210,0.15)', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,160,210,0.3)' },
  manualBtnText:{ color: '#00A0D2', fontSize: 14 },
});