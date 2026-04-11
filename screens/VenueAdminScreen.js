import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Modal, Switch, Platform, Image
} from 'react-native';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

function haptic(type = 'light') {
  if (Platform.OS === 'web') return;
  try {
    const H = require('expo-haptics');
    if (type === 'success') H.notificationAsync(H.NotificationFeedbackType.Success);
    else if (type === 'medium') H.impactAsync(H.ImpactFeedbackStyle.Medium);
    else H.impactAsync(H.ImpactFeedbackStyle.Light);
  } catch (_) {}
}

function formatShort(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
}

const GROUND_TYPES = ['Çim', 'Suni Çim', 'Parke', 'Beton'];
const FIELD_SIZES  = ['5x5', '6x6', '7x7', '8x8', '11x11'];

const FEATURE_LIST = [
  { key: 'has_camera',     label: '📷 Kamera' },
  { key: 'has_referee',    label: '🟨 Hakem' },
  { key: 'is_indoor',      label: '🏠 Kapalı Alan' },
  { key: 'has_lighting',   label: '💡 Aydınlatma' },
  { key: 'has_scoreboard', label: '🖥️ Skor Tabelası' },
  { key: 'has_shower',     label: '🚿 Duş' },
  { key: 'has_parking',    label: '🚗 Otopark' },
];

export default function VenueAdminScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [venues, setVenues]       = useState([]);
  const [selected, setSelected]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState('info');

  // ── Saha Bilgisi ──
  const [editName, setEditName]           = useState('');
  const [editDesc, setEditDesc]           = useState('');
  const [editPhone, setEditPhone]         = useState('');
  const [editPrice, setEditPrice]         = useState('');
  const [editHours, setEditHours]         = useState('');
  const [editGround, setEditGround]       = useState('Suni Çim');
  const [editSize, setEditSize]           = useState('5x5');
  const [editLat, setEditLat]             = useState('');
  const [editLng, setEditLng]             = useState('');
  const [features, setFeatures]           = useState({});
  const [savingInfo, setSavingInfo]       = useState(false);
  const [editDescription, setEditDescription] = useState('');

  // ── Maçlar ──
  const [matches, setMatches]             = useState([]);
  const [matchModal, setMatchModal]       = useState(null);
  const [matchPlayers, setMatchPlayers]   = useState([]);
  const [goalInputs, setGoalInputs]       = useState({});
  const [assistInputs, setAssistInputs]   = useState({});
  const [savingStats, setSavingStats]     = useState(false);

  // ── Market ──
  const [products, setProducts]           = useState([]);
  const [prodModal, setProdModal]         = useState(false);
  const [editProduct, setEditProduct]     = useState(null);
  const [newName, setNewName]             = useState('');
  const [newEmoji, setNewEmoji]           = useState('📦');
  const [newPrice, setNewPrice]           = useState('');
  const [newStock, setNewStock]           = useState('');
  const [newCategory, setNewCategory]     = useState('İçecek');
  const [newUnit, setNewUnit]             = useState('');
  const [savingProd, setSavingProd]       = useState(false);

  // ── Raporlar ──
  const [report, setReport]               = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => { loadVenues(); }, []);

  useEffect(() => {
    if (!selected) return;
    loadMatches(selected.id);
    loadFeatures(selected.id);
    setEditName(selected.name || '');
    setEditDesc(selected.description || '');
    setEditDescription(selected.description || '');
    setEditPhone(selected.phone || '');
    setEditPrice(String(selected.price_per_hour || ''));
  }, [selected]);

  useEffect(() => {
    if (activeTab === 'market' && selected) loadProducts(selected.id);
    if (activeTab === 'report' && selected) loadReport(selected.id);
  }, [activeTab, selected]);

  // ── Loaders ──
  async function loadVenues() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let q = supabase.from('venues').select('*').order('name');
      if (user) q = q.eq('owner_id', user.id);
      const { data, error } = await q;
      if (error || !data || data.length === 0) {
        setVenues([]);
        setSelected(null);
      } else {
        setVenues(data);
        setSelected(data[0]);
      }
    } catch (err) {
      setVenues([]);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadFeatures(venueId) {
    const { data } = await supabase.from('venue_features').select('*').eq('venue_id', venueId).maybeSingle();
    if (data) {
      setEditHours(data.working_hours || '08:00-24:00');
      setEditGround(data.ground_type || 'Suni Çim');
      setEditSize(data.field_size || '5x5');
      setEditLat(String(data.latitude || ''));
      setEditLng(String(data.longitude || ''));
      const f = {};
      FEATURE_LIST.forEach(fl => { f[fl.key] = !!data[fl.key]; });
      setFeatures(f);
    } else {
      setEditHours('08:00-24:00');
      setEditGround('Suni Çim');
      setEditSize('5x5');
      setEditLat(''); setEditLng('');
      const f = {};
      FEATURE_LIST.forEach(fl => { f[fl.key] = false; });
      setFeatures(f);
    }
  }

  async function loadMatches(venueId) {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('venue_id', venueId)
        .order('match_date', { ascending: false })
        .limit(50);
      if (error) throw error;
      setMatches(data || []);
    } catch (err) {
      Alert.alert('Hata', 'Maçlar yüklenemedi.');
    }
  }

  async function loadMatchPlayers(matchId) {
    try {
      const { data, error } = await supabase
        .from('match_players')
        .select('*, profiles(id, full_name, goals, assists, matches_played)')
        .eq('match_id', matchId);
      if (error) throw error;
      setMatchPlayers(data || []);
      const gi = {}, ai = {};
      (data || []).forEach(p => { gi[p.user_id] = '0'; ai[p.user_id] = '0'; });
      setGoalInputs(gi);
      setAssistInputs(ai);
    } catch (err) {
      Alert.alert('Hata', 'Oyuncu bilgileri yüklenemedi.');
    }
  }

  async function loadProducts(venueId) {
    try {
      const { data, error } = await supabase
        .from('venue_products')
        .select('*')
        .eq('venue_id', venueId)
        .order('name');
      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      Alert.alert('Hata', 'Ürünler yüklenemedi.');
    }
  }

  async function loadReport(venueId) {
    setLoadingReport(true);
    try {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const [{ data: mData, error: mErr }, { data: oData, error: oErr }] = await Promise.all([
        supabase.from('matches').select('format, price, status, match_date').eq('venue_id', venueId).gte('match_date', weekAgo),
        supabase.from('market_orders').select('total, status, created_at').eq('venue_id', venueId).gte('created_at', weekAgo),
      ]);
      if (mErr) throw mErr;
      if (oErr) throw oErr;
      const matches7  = mData  || [];
      const orders7   = oData  || [];
      const revenue   = matches7.reduce((s, m) => s + (m.price ?? selected?.price_per_hour ?? 0), 0);
      const orderRev  = orders7.reduce((s, o) => s + (o.total || 0), 0);
      const formatMap = {};
      matches7.forEach(m => { formatMap[m.format] = (formatMap[m.format] || 0) + 1; });
      setReport({ matches: matches7.length, revenue, orderRev, formatMap, orders: orders7.length });
    } catch (err) {
      Alert.alert('Hata', 'Rapor yüklenemedi.');
    } finally {
      setLoadingReport(false);
    }
  }

  // ── Saha Fotoğrafı Yükle ──
  // NOT: Supabase Dashboard'da 'venue-photos' bucket oluşturmanız gerekiyor.
  // Storage → New Bucket → Name: "venue-photos" → Public: ON → Create
  async function handlePickVenuePhoto() {
    if (Platform.OS === 'web') {
      Alert.alert('Bilgi', 'Fotoğraf yükleme mobil uygulamadan yapılabilir.');
      return;
    }
    try {
      const ImagePicker = require('expo-image-picker');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Fotoğraf yüklemek için galeri izni verin.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      const fileName = `venue-${selected.id}-${Date.now()}.jpg`;
      const filePath = `venue-photos/${fileName}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('venue-photos')
        .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) {
        Alert.alert('Hata', 'Fotoğraf yüklenemedi: ' + uploadError.message);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('venue-photos')
        .getPublicUrl(filePath);

      const photoUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from('venues')
        .update({ photo_url: photoUrl })
        .eq('id', selected.id);

      if (updateError) {
        Alert.alert('Hata', 'Fotoğraf kaydedilemedi.');
        return;
      }

      setVenues(prev => prev.map(v => v.id === selected.id ? { ...v, photo_url: photoUrl } : v));
      setSelected(prev => ({ ...prev, photo_url: photoUrl }));
      haptic('success');
      Alert.alert('Başarılı! 📷', 'Saha fotoğrafı güncellendi.');
    } catch (e) {
      console.error(e);
      Alert.alert('Hata', 'Fotoğraf yüklenirken bir sorun oluştu.');
    }
  }

  // ── Saha Bilgisi Kaydet ──
  async function saveVenueInfo() {
    if (!selected) return;
    setSavingInfo(true);
    const venueUpdate = {};
    if (editName.trim())        venueUpdate.name           = editName.trim();
    if (editDesc.trim())        venueUpdate.description    = editDesc.trim();
    if (editDescription !== undefined) venueUpdate.description = editDescription.trim() || editDesc.trim() || '';
    if (editPhone.trim())       venueUpdate.phone           = editPhone.trim();
    if (editPrice.trim())       venueUpdate.price_per_hour  = parseInt(editPrice, 10) || selected.price_per_hour;

    const { error: vErr } = await supabase.from('venues').update(venueUpdate).eq('id', selected.id);
    if (vErr) { Alert.alert('Hata', vErr.message); setSavingInfo(false); return; }

    const featureRow = {
      venue_id:      selected.id,
      working_hours: editHours,
      ground_type:   editGround,
      field_size:    editSize,
      latitude:      parseFloat(editLat) || null,
      longitude:     parseFloat(editLng) || null,
      ...features,
    };
    const { data: existing } = await supabase
      .from('venue_features').select('id').eq('venue_id', selected.id).maybeSingle();
    const { error: fErr } = existing
      ? await supabase.from('venue_features').update(featureRow).eq('venue_id', selected.id)
      : await supabase.from('venue_features').insert(featureRow);
    if (fErr) { Alert.alert('Hata', fErr.message); setSavingInfo(false); return; }

    setSelected(prev => ({ ...prev, ...venueUpdate }));
    haptic('success');
    Alert.alert('Kaydedildi ✓', 'Saha bilgileri güncellendi.');
    setSavingInfo(false);
  }

  // ── Maç Detay ──
  async function openMatchModal(match) {
    setMatchModal(match);
    await loadMatchPlayers(match.id);
  }

  function getMVP() {
    if (!matchPlayers.length) return null;
    return matchPlayers.reduce((best, p) => {
      const s    = (parseInt(goalInputs[p.user_id]   || 0, 10)) * 2 + parseInt(assistInputs[p.user_id] || 0, 10);
      const bS   = (parseInt(goalInputs[best?.user_id] || 0, 10)) * 2 + parseInt(assistInputs[best?.user_id] || 0, 10);
      return s > bS ? p : best;
    }, matchPlayers[0]);
  }

  async function saveMatchStats() {
    // Check if match is already completed
    const { data: matchCheck } = await supabase
      .from('matches')
      .select('status')
      .eq('id', matchModal.id)
      .single();
    if (matchCheck?.status === 'completed') {
      Alert.alert('Uyarı', 'Bu maç zaten tamamlandı olarak işaretlenmiş.');
      return;
    }

    setSavingStats(true);
    const ops = matchPlayers.map(async p => {
      const uid  = p.user_id;
      const g    = parseInt(goalInputs[uid]   || 0, 10) || 0;
      const a    = parseInt(assistInputs[uid] || 0, 10) || 0;
      const prof = p.profiles || {};
      await supabase.from('profiles').update({
        goals:          (prof.goals   || 0) + g,
        assists:        (prof.assists || 0) + a,
        matches_played: (prof.matches_played || 0) + 1,
      }).eq('id', uid);
    });
    await Promise.all(ops);
    await supabase.from('matches').update({ status: 'completed' }).eq('id', matchModal.id);
    setSavingStats(false);
    setMatchModal(null);
    haptic('success');
    const mvp = getMVP();
    Alert.alert('Maç Tamamlandı! ✓', mvp ? `MVP: ${mvp.profiles?.full_name || 'Oyuncu'} 🏆` : 'İstatistikler kaydedildi.');
    loadMatches(selected.id);
  }

  // ── Market ──
  function openNewProduct() {
    setEditProduct(null);
    setNewName(''); setNewEmoji('📦'); setNewPrice('');
    setNewStock(''); setNewCategory('İçecek'); setNewUnit('');
    setProdModal(true);
  }

  async function saveProduct() {
    if (!newName.trim() || !newPrice) return;
    setSavingProd(true);
    const row = {
      venue_id: selected.id,
      name:     newName.trim(),
      emoji:    newEmoji,
      price:    parseInt(newPrice, 10) || 0,
      stock:    parseInt(newStock, 10) || 0,
      category: newCategory,
      unit:     newUnit,
      is_available: true,
    };
    let err;
    if (editProduct) {
      ({ error: err } = await supabase.from('venue_products').update(row).eq('id', editProduct.id));
    } else {
      ({ error: err } = await supabase.from('venue_products').insert(row));
    }
    if (err) { Alert.alert('Hata', err.message); setSavingProd(false); return; }
    setSavingProd(false);
    setProdModal(false);
    haptic('success');
    loadProducts(selected.id);
  }

  async function updateStock(id, delta) {
    const prod = products.find(p => p.id === id);
    if (!prod) return;
    const newStock = Math.max(0, (prod.stock || 0) + delta);
    await supabase.from('venue_products').update({ stock: newStock }).eq('id', id);
    setProducts(prev => prev.map(p => p.id === id ? { ...p, stock: newStock } : p));
  }

  async function toggleAvailable(id, current) {
    await supabase.from('venue_products').update({ is_available: !current }).eq('id', id);
    setProducts(prev => prev.map(p => p.id === id ? { ...p, is_available: !current } : p));
  }

  async function deleteProduct(id) {
    Alert.alert('Ürünü Sil', 'Bu ürünü silmek istiyor musun?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => {
        await supabase.from('venue_products').delete().eq('id', id);
        loadProducts(selected.id);
      }},
    ]);
  }

  // ── Guards ──
  if (loading) return (
    <View style={styles.container}>
      <Header navigation={navigation} insets={insets} />
      <View style={styles.centered}><ActivityIndicator color="#00D4FF" size="large" /></View>
    </View>
  );

  if (!selected) return (
    <View style={styles.container}>
      <Header navigation={navigation} insets={insets} />
      <View style={styles.centered}>
        <Text style={{ fontSize: 52, marginBottom: 16 }}>🏟️</Text>
        <Text style={styles.noVenueText}>Henüz sahanız yok</Text>
        <Text style={styles.noVenueSub}>Saha eklemek için bizimle iletişime geçin</Text>
      </View>
    </View>
  );

  const todayMatches = matches.filter(m => {
    const d = new Date(m.match_date);
    return d.toDateString() === new Date().toDateString();
  });

  return (
    <View style={styles.container}>
      <Header navigation={navigation} insets={insets} />

      {venues.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.venueSelector}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 10 }}>
          {venues.map(v => (
            <TouchableOpacity key={v.id}
              style={[styles.venuePill, selected?.id === v.id && styles.venuePillActive]}
              onPress={() => setSelected(v)}>
              <Text style={[styles.venuePillText, selected?.id === v.id && styles.venuePillTextActive]}>{v.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={styles.tabs}>
        {[
          { key: 'info',    label: '🏟️ Saha' },
          { key: 'matches', label: '⚽ Maçlar' },
          { key: 'market',  label: '🛒 Market' },
          { key: 'report',  label: '📊 Rapor' },
        ].map(t => (
          <TouchableOpacity key={t.key}
            style={[styles.tabBtn, activeTab === t.key && styles.tabBtnActive]}
            onPress={() => { haptic(); setActiveTab(t.key); }}>
            <Text style={[styles.tabBtnText, activeTab === t.key && styles.tabBtnTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ────────────── SAHA BİLGİSİ ────────────── */}
        {activeTab === 'info' && (
          <>
            {/* Saha Fotoğrafı */}
            <Text style={styles.sectionTitle}>📷 Saha Fotoğrafı</Text>
            <TouchableOpacity style={styles.photoUploadArea} onPress={handlePickVenuePhoto} activeOpacity={0.85}>
              {selected?.photo_url ? (
                <Image source={{ uri: selected.photo_url }} style={styles.venuePhotoPreview} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoPlaceholderEmoji}>📷</Text>
                  <Text style={styles.photoPlaceholderText}>Fotoğraf Yükle</Text>
                  <Text style={styles.photoPlaceholderHint}>Sahayı en iyi gösteren fotoğrafı seç</Text>
                </View>
              )}
              {selected?.photo_url && (
                <View style={styles.photoChangeOverlay}>
                  <Text style={styles.photoChangeText}>Değiştir 📷</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Açıklama */}
            <Text style={styles.sectionTitle}>📝 Açıklama</Text>
            <TextInput
              style={[styles.inputField, { height: 80, textAlignVertical: 'top', marginBottom: 16 }]}
              placeholder="Sahanızı tanıtın..."
              placeholderTextColor="#8B9BB4"
              value={editDescription}
              onChangeText={setEditDescription}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.sectionTitle}>Temel Bilgiler</Text>
            <View style={styles.card}>
              {[
                { label: 'Saha Adı',           val: editName,  set: setEditName,  keyboard: 'default' },
                { label: 'Açıklama',            val: editDesc,  set: setEditDesc,  keyboard: 'default' },
                { label: 'Telefon',             val: editPhone, set: setEditPhone, keyboard: 'phone-pad' },
                { label: 'Saatlik Fiyat (₺)',  val: editPrice, set: setEditPrice, keyboard: 'numeric' },
                { label: 'Çalışma Saatleri',   val: editHours, set: setEditHours, keyboard: 'default' },
                { label: 'Enlem (lat)',         val: editLat,   set: setEditLat,   keyboard: 'numeric' },
                { label: 'Boylam (lng)',        val: editLng,   set: setEditLng,   keyboard: 'numeric' },
              ].map(({ label, val, set, keyboard }) => (
                <View key={label} style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{label}</Text>
                  <TextInput
                    style={styles.inputField}
                    value={val}
                    onChangeText={set}
                    keyboardType={keyboard}
                    placeholderTextColor="#8B9BB4"
                    placeholder={label}
                  />
                </View>
              ))}

              <Text style={styles.inputLabel}>Zemin Türü</Text>
              <View style={styles.chipRow}>
                {GROUND_TYPES.map(g => (
                  <TouchableOpacity key={g} style={[styles.chip, editGround === g && styles.chipActive]} onPress={() => setEditGround(g)}>
                    <Text style={[styles.chipText, editGround === g && styles.chipTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Saha Boyutu</Text>
              <View style={styles.chipRow}>
                {FIELD_SIZES.map(s => (
                  <TouchableOpacity key={s} style={[styles.chip, editSize === s && styles.chipActive]} onPress={() => setEditSize(s)}>
                    <Text style={[styles.chipText, editSize === s && styles.chipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Text style={styles.sectionTitle}>Olanaklar</Text>
            <View style={styles.card}>
              {FEATURE_LIST.map(fl => (
                <View key={fl.key} style={styles.featureRow}>
                  <Text style={styles.featureLabel}>{fl.label}</Text>
                  <Switch
                    value={!!features[fl.key]}
                    onValueChange={v => setFeatures(prev => ({ ...prev, [fl.key]: v }))}
                    trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(0,212,255,0.3)' }}
                    thumbColor={features[fl.key] ? '#00D4FF' : 'rgba(255,255,255,0.6)'}
                  />
                </View>
              ))}
            </View>

            <TouchableOpacity style={[styles.saveFullBtn, savingInfo && { opacity: 0.6 }]} onPress={saveVenueInfo} disabled={savingInfo}>
              <Text style={styles.saveFullBtnText}>{savingInfo ? 'Kaydediliyor…' : 'Kaydet ✓'}</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ────────────── MAÇLAR ────────────── */}
        {activeTab === 'matches' && (
          <>
            {/* Bugünkü maçlar */}
            <View style={styles.matchSummaryRow}>
              <View style={styles.matchSummaryBox}>
                <Text style={styles.matchSummaryNum}>{todayMatches.length}</Text>
                <Text style={styles.matchSummaryLabel}>Bugün</Text>
              </View>
              <View style={styles.matchSummaryBox}>
                <Text style={styles.matchSummaryNum}>{matches.filter(m => m.status === 'open').length}</Text>
                <Text style={styles.matchSummaryLabel}>Açık</Text>
              </View>
              <View style={styles.matchSummaryBox}>
                <Text style={styles.matchSummaryNum}>{matches.filter(m => m.status === 'completed' || m.status === 'played').length}</Text>
                <Text style={styles.matchSummaryLabel}>Bitti</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Tüm Maçlar ({matches.length})</Text>
            {matches.length === 0 ? (
              <View style={styles.emptyBox}><Text style={styles.emptyText}>Henüz maç yok</Text></View>
            ) : (
              matches.map(m => {
                const done = m.status === 'completed' || m.status === 'played';
                return (
                  <TouchableOpacity key={m.id} style={styles.matchRow} onPress={() => openMatchModal(m)}>
                    <View style={styles.matchRowLeft}>
                      <Text style={styles.matchRowFormat}>{m.format}</Text>
                      <Text style={styles.matchRowTime}>{formatShort(m.match_date)}</Text>
                    </View>
                    <View style={styles.matchRowRight}>
                      <Text style={styles.matchRowPlayers}>{m.current_players ?? 0}/{m.max_players}</Text>
                      <View style={[styles.statusBadge, done ? styles.statusDone : styles.statusOpen]}>
                        <Text style={[styles.statusBadgeText, { color: done ? '#00E096' : '#00D4FF' }]}>
                          {done ? 'Bitti' : 'Açık'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}

        {/* ────────────── MARKET ────────────── */}
        {activeTab === 'market' && (
          <>
            <View style={styles.marketHeader}>
              <Text style={styles.sectionTitle}>Market Ürünleri ({products.length})</Text>
              <TouchableOpacity style={styles.addProductBtn} onPress={openNewProduct}>
                <Text style={styles.addProductBtnText}>+ Ekle</Text>
              </TouchableOpacity>
            </View>

            {products.length === 0 ? (
              <View style={styles.emptyBox}><Text style={styles.emptyText}>Henüz ürün yok. + Ekle butonuna bas.</Text></View>
            ) : (
              products.map(prod => (
                <View key={prod.id} style={[styles.productRow, !prod.is_available && { opacity: 0.5 }]}>
                  <View style={styles.productLeft}>
                    <Text style={styles.productEmoji}>{prod.emoji}</Text>
                    <View>
                      <Text style={styles.productName}>{prod.name}</Text>
                      <Text style={styles.productPrice}>{prod.price}₺{prod.unit ? ` ${prod.unit}` : ''}</Text>
                    </View>
                  </View>
                  <View style={styles.productRight}>
                    <TouchableOpacity style={styles.stockBtn} onPress={() => updateStock(prod.id, -1)}>
                      <Text style={styles.stockBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={[styles.stockNum, prod.stock === 0 && { color: '#FF4757' }]}>{prod.stock}</Text>
                    <TouchableOpacity style={styles.stockBtn} onPress={() => updateStock(prod.id, 1)}>
                      <Text style={styles.stockBtnText}>+</Text>
                    </TouchableOpacity>
                    <Switch
                      value={!!prod.is_available}
                      onValueChange={() => toggleAvailable(prod.id, prod.is_available)}
                      trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(0,212,255,0.3)' }}
                      thumbColor={prod.is_available ? '#00D4FF' : 'rgba(255,255,255,0.6)'}
                      style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                    />
                    <TouchableOpacity onPress={() => deleteProduct(prod.id)}>
                      <Text style={{ fontSize: 16 }}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* ────────────── RAPOR ────────────── */}
        {activeTab === 'report' && (
          <>
            <Text style={styles.sectionTitle}>Son 7 Gün</Text>
            {loadingReport ? (
              <View style={styles.centered}><ActivityIndicator color="#00D4FF" /></View>
            ) : report ? (
              <>
                <View style={styles.reportGrid}>
                  <ReportCard icon="⚽" val={report.matches}             label="Maç"          color="#3B82F6" />
                  <ReportCard icon="💰" val={`${report.revenue}₺`}      label="Rezervasyon"  color="#22C55E" />
                  <ReportCard icon="🛒" val={report.orders}              label="Sipariş"      color="#F59E0B" />
                  <ReportCard icon="💳" val={`${report.orderRev}₺`}     label="Market Gelir" color="#8B5CF6" />
                </View>

                {Object.keys(report.formatMap).length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>Format Dağılımı</Text>
                    <View style={styles.card}>
                      {Object.entries(report.formatMap).map(([fmt, cnt]) => (
                        <View key={fmt} style={styles.formatRow}>
                          <Text style={styles.formatLabel}>{fmt}</Text>
                          <View style={styles.formatBarWrap}>
                            <View style={[styles.formatBar, { width: `${Math.min(100, (cnt / report.matches) * 100)}%` }]} />
                          </View>
                          <Text style={styles.formatCount}>{cnt}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </>
            ) : (
              <View style={styles.emptyBox}><Text style={styles.emptyText}>Veri yok</Text></View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ────────────── Maç Detay Modal ────────────── */}
      <Modal visible={!!matchModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setMatchModal(null)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>⚽ Maç Detayı</Text>
            <TouchableOpacity onPress={() => setMatchModal(null)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            {matchModal && (
              <>
                <View style={styles.matchModalInfo}>
                  <Text style={styles.matchModalFormat}>{matchModal.format} · {formatShort(matchModal.match_date)}</Text>
                  <Text style={[styles.matchModalStatus,
                    (matchModal.status === 'completed' || matchModal.status === 'played')
                      ? { color: '#00E096' } : { color: '#00D4FF' }]}>
                    {(matchModal.status === 'completed' || matchModal.status === 'played') ? '✅ Tamamlandı' : '🔴 Devam Ediyor'}
                  </Text>
                </View>

                <Text style={styles.sectionTitle}>Oyuncular ({matchPlayers.length})</Text>

                {matchPlayers.length === 0 ? (
                  <Text style={styles.emptyText}>Bu maçta kayıtlı oyuncu yok</Text>
                ) : (
                  matchPlayers.map(p => (
                    <View key={p.user_id} style={styles.playerStatRow}>
                      <Text style={styles.playerStatName}>{p.profiles?.full_name || 'Oyuncu'}</Text>
                      <View style={styles.playerStatInputs}>
                        <View style={styles.statInputGroup}>
                          <Text style={styles.statInputLabel}>⚽ Gol</Text>
                          <View style={styles.statCounter}>
                            <TouchableOpacity onPress={() => setGoalInputs(prev => ({ ...prev, [p.user_id]: String(Math.max(0, parseInt(prev[p.user_id]||0)-1)) }))}>
                              <Text style={styles.counterBtn}>−</Text>
                            </TouchableOpacity>
                            <Text style={styles.counterNum}>{goalInputs[p.user_id] || '0'}</Text>
                            <TouchableOpacity onPress={() => setGoalInputs(prev => ({ ...prev, [p.user_id]: String(parseInt(prev[p.user_id]||0)+1) }))}>
                              <Text style={styles.counterBtn}>+</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                        <View style={styles.statInputGroup}>
                          <Text style={styles.statInputLabel}>🅰️ Asist</Text>
                          <View style={styles.statCounter}>
                            <TouchableOpacity onPress={() => setAssistInputs(prev => ({ ...prev, [p.user_id]: String(Math.max(0, parseInt(prev[p.user_id]||0)-1)) }))}>
                              <Text style={styles.counterBtn}>−</Text>
                            </TouchableOpacity>
                            <Text style={styles.counterNum}>{assistInputs[p.user_id] || '0'}</Text>
                            <TouchableOpacity onPress={() => setAssistInputs(prev => ({ ...prev, [p.user_id]: String(parseInt(prev[p.user_id]||0)+1) }))}>
                              <Text style={styles.counterBtn}>+</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    </View>
                  ))
                )}

                {matchModal.status !== 'completed' && matchModal.status !== 'played' && (
                  <TouchableOpacity
                    style={[styles.finishMatchBtn, savingStats && { opacity: 0.6 }]}
                    onPress={saveMatchStats}
                    disabled={savingStats}>
                    <Text style={styles.finishMatchBtnText}>
                      {savingStats ? 'Kaydediliyor…' : '✅ Maçı Bitir & İstatistikleri Kaydet'}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ────────────── Yeni Ürün Modal ────────────── */}
      <Modal visible={prodModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setProdModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editProduct ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}</Text>
            <TouchableOpacity onPress={() => setProdModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            {[
              { label: 'Emoji',    val: newEmoji,    set: setNewEmoji,    keyboard: 'default' },
              { label: 'Ürün Adı', val: newName,     set: setNewName,     keyboard: 'default' },
              { label: 'Fiyat ₺', val: newPrice,    set: setNewPrice,    keyboard: 'numeric' },
              { label: 'Stok',    val: newStock,    set: setNewStock,    keyboard: 'numeric' },
              { label: 'Birim (örn. /maç)', val: newUnit, set: setNewUnit, keyboard: 'default' },
            ].map(({ label, val, set, keyboard }) => (
              <View key={label} style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{label}</Text>
                <TextInput
                  style={styles.inputField}
                  value={val}
                  onChangeText={set}
                  keyboardType={keyboard}
                  placeholder={label}
                  placeholderTextColor="#8B9BB4"
                />
              </View>
            ))}

            <Text style={styles.inputLabel}>Kategori</Text>
            <View style={styles.chipRow}>
              {['İçecek', 'Ekipman', 'Aksesuar', 'Diğer'].map(c => (
                <TouchableOpacity key={c} style={[styles.chip, newCategory === c && styles.chipActive]} onPress={() => setNewCategory(c)}>
                  <Text style={[styles.chipText, newCategory === c && styles.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.saveFullBtn, (!newName.trim() || !newPrice || savingProd) && { opacity: 0.5 }]}
              onPress={saveProduct}
              disabled={!newName.trim() || !newPrice || savingProd}>
              <Text style={styles.saveFullBtnText}>{savingProd ? 'Kaydediliyor…' : 'Kaydet'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function Header({ navigation, insets }) {
  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Geri</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Saha Yönetimi 🏟️</Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

function ReportCard({ icon, val, label, color }) {
  return (
    <View style={[styles.reportCard, { borderTopColor: color }]}>
      <Text style={styles.reportCardIcon}>{icon}</Text>
      <Text style={[styles.reportCardVal, { color }]}>{val}</Text>
      <Text style={styles.reportCardLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1628' },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },

  header: { backgroundColor: '#0A1628', paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(0,212,255,0.12)' },
  backText:    { color: 'rgba(255,255,255,0.45)', fontSize: 14 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },

  venueSelector: { backgroundColor: '#0A1628', borderBottomWidth: 1, borderBottomColor: 'rgba(0,212,255,0.08)', maxHeight: 60 },
  venuePill:           { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,212,255,0.2)', backgroundColor: 'rgba(255,255,255,0.04)' },
  venuePillActive:     { backgroundColor: 'rgba(0,212,255,0.12)', borderColor: '#00D4FF' },
  venuePillText:       { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
  venuePillTextActive: { color: '#00D4FF' },

  tabs: { flexDirection: 'row', backgroundColor: '#0A1628', borderBottomWidth: 1, borderBottomColor: 'rgba(0,212,255,0.08)' },
  tabBtn:         { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive:   { borderBottomWidth: 2.5, borderBottomColor: '#00D4FF' },
  tabBtnText:     { fontSize: 11, fontWeight: '600', color: '#8B9BB4' },
  tabBtnTextActive: { color: '#00D4FF' },

  scroll: { padding: 16 },

  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', marginTop: 8, marginBottom: 10 },

  card: { backgroundColor: '#0F1E35', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(0,212,255,0.12)' },

  inputGroup: { marginBottom: 12 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#8B9BB4', marginBottom: 4 },
  inputField: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,212,255,0.15)', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#FFFFFF' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,212,255,0.2)', backgroundColor: 'rgba(255,255,255,0.04)' },
  chipActive:   { backgroundColor: 'rgba(0,212,255,0.12)', borderColor: '#00D4FF' },
  chipText:     { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
  chipTextActive: { color: '#00D4FF' },

  featureRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(0,212,255,0.08)' },
  featureLabel: { fontSize: 14, color: '#FFFFFF', fontWeight: '500' },

  saveFullBtn: { backgroundColor: '#00D4FF', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8, marginBottom: 8 },
  saveFullBtnText: { color: '#0A1628', fontSize: 15, fontWeight: '700' },

  matchSummaryRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  matchSummaryBox: { flex: 1, backgroundColor: '#0F1E35', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,212,255,0.12)' },
  matchSummaryNum:   { fontSize: 26, fontWeight: '900', color: '#FFFFFF' },
  matchSummaryLabel: { fontSize: 11, color: '#8B9BB4', marginTop: 2 },

  matchRow:       { backgroundColor: '#0F1E35', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,212,255,0.1)' },
  matchRowLeft:   { gap: 2 },
  matchRowRight:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  matchRowFormat: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  matchRowTime:   { fontSize: 12, color: '#8B9BB4' },
  matchRowPlayers: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusDone: { backgroundColor: 'rgba(0,224,150,0.12)' },
  statusOpen: { backgroundColor: 'rgba(0,212,255,0.1)' },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  marketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  addProductBtn:    { backgroundColor: '#00D4FF', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  addProductBtnText: { color: '#0A1628', fontSize: 13, fontWeight: '700' },

  productRow:   { backgroundColor: '#0F1E35', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,212,255,0.1)' },
  productLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  productRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  productEmoji: { fontSize: 26 },
  productName:  { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  productPrice: { fontSize: 12, color: '#8B9BB4' },

  stockBtn:     { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },
  stockBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  stockNum:     { fontSize: 14, fontWeight: '800', color: '#FFFFFF', minWidth: 20, textAlign: 'center' },

  reportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  reportCard:      { flex: 1, minWidth: '44%', backgroundColor: '#0F1E35', borderRadius: 14, padding: 14, alignItems: 'center', borderTopWidth: 3, borderWidth: 1, borderColor: 'rgba(0,212,255,0.1)' },
  reportCardIcon:  { fontSize: 24, marginBottom: 4 },
  reportCardVal:   { fontSize: 22, fontWeight: '900', marginBottom: 2 },
  reportCardLabel: { fontSize: 11, color: '#8B9BB4' },

  formatRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  formatLabel:  { fontSize: 13, fontWeight: '600', color: '#FFFFFF', width: 60 },
  formatBarWrap: { flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' },
  formatBar:    { height: 8, backgroundColor: '#00D4FF', borderRadius: 4 },
  formatCount:  { fontSize: 13, fontWeight: '700', color: '#FFFFFF', width: 20, textAlign: 'right' },

  emptyBox:  { backgroundColor: '#0F1E35', borderRadius: 14, padding: 32, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(0,212,255,0.1)' },
  emptyText: { color: '#8B9BB4', fontSize: 14, textAlign: 'center' },

  noVenueText: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 },
  noVenueSub:  { fontSize: 14, color: '#8B9BB4', textAlign: 'center' },

  // Match Modal
  modalContainer: { flex: 1, backgroundColor: '#0A1628' },
  modalHeader:    { backgroundColor: '#0A1628', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(0,212,255,0.12)' },
  modalTitle:     { color: '#fff', fontSize: 18, fontWeight: '800' },
  modalClose:     { color: 'rgba(255,255,255,0.5)', fontSize: 18, fontWeight: '700' },
  modalScroll:    { padding: 16 },

  matchModalInfo:   { backgroundColor: '#0F1E35', borderRadius: 14, padding: 16, marginBottom: 16, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(0,212,255,0.12)' },
  matchModalFormat: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  matchModalStatus: { fontSize: 14, fontWeight: '600' },

  playerStatRow:    { backgroundColor: '#0F1E35', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(0,212,255,0.1)' },
  playerStatName:   { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginBottom: 10 },
  playerStatInputs: { flexDirection: 'row', gap: 20 },
  statInputGroup:   { alignItems: 'center', gap: 6 },
  statInputLabel:   { fontSize: 12, color: '#8B9BB4', fontWeight: '600' },
  statCounter:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  counterBtn:       { fontSize: 20, fontWeight: '700', color: '#00D4FF', width: 30, textAlign: 'center' },
  counterNum:       { fontSize: 18, fontWeight: '900', color: '#FFFFFF', minWidth: 24, textAlign: 'center' },

  finishMatchBtn:     { backgroundColor: '#10B981', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  finishMatchBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Photo upload
  photoUploadArea: {
    backgroundColor: '#0F1E35',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.2)',
    borderStyle: 'dashed',
    overflow: 'hidden',
    marginBottom: 16,
    height: 200,
  },
  venuePhotoPreview: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  photoPlaceholderEmoji: { fontSize: 48 },
  photoPlaceholderText:  { color: '#00D4FF', fontSize: 16, fontWeight: '700' },
  photoPlaceholderHint:  { color: '#8B9BB4', fontSize: 12 },
  photoChangeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  photoChangeText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
