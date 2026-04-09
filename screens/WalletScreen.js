import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Animated
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

const PACKAGES = [
  { amount: 50,  label: '50₺',  bonus: null,    popular: false },
  { amount: 100, label: '100₺', bonus: '+10₺',  popular: true  },
  { amount: 200, label: '200₺', bonus: '+30₺',  popular: false },
  { amount: 500, label: '500₺', bonus: '+100₺', popular: false },
];

const PREMIUM_FEATURES = [
  '✓ Maçlara öncelikli katılım',
  '✓ Sınırsız kadro oluşturma',
  '✓ Detaylı performans analizi',
  '✓ Özel profil rozeti',
  '✓ Reklamsız deneyim',
];

export default function WalletScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [balance, setBalance]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState(null);
  const [isPremium, setIsPremium]   = useState(false);
  const [orders, setOrders]         = useState([]);
  const balanceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { loadWallet(); }, []);

  async function loadWallet() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { return; }

      const [{ data: prof }, { data: orderData }] = await Promise.all([
        supabase.from('profiles').select('wallet_balance, is_premium').eq('id', user.id).single(),
        supabase.from('market_orders')
          .select('id, total, status, created_at, items')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      const bal = prof?.wallet_balance ?? 0;
      setBalance(bal);
      setIsPremium(prof?.is_premium ?? false);
      setOrders(orderData || []);

      Animated.timing(balanceAnim, { toValue: bal, duration: 900, useNativeDriver: false }).start();
    } catch (e) {
      console.error('loadWallet error:', e);
    } finally {
      setLoading(false);
    }
  }

  function handleTopUp() {
    if (!selected) { Alert.alert('Paket Seç', 'Lütfen bir yükleme paketi seçin.'); return; }
    const pkg = PACKAGES.find(p => p.amount === selected);
    Alert.alert('Ödeme', `${pkg.label}${pkg.bonus ? ` (${pkg.bonus} bonus)` : ''} paketi için ödeme sistemi yakında iyzico entegrasyonu ile aktif olacak.`, [{ text: 'Tamam' }]);
  }

  function handlePremium() {
    Alert.alert('⭐ Premium Üyelik', 'Premium üyelik için ödeme sistemi yakında aktif olacak.', [{ text: 'Tamam' }]);
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cüzdan</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Bakiye Kartı */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceDecor1} />
          <View style={styles.balanceDecor2} />
          <Text style={styles.balanceLabel}>SAHA CÜZDANı</Text>
          {loading
            ? <ActivityIndicator color="#00D4FF" size="large" style={{ marginVertical: 12 }} />
            : <Text style={styles.balanceAmount}>{balance ?? 0}₺</Text>
          }
          <View style={styles.balanceActions}>
            <TouchableOpacity style={styles.balanceActionBtn} onPress={() => setSelected(100)}>
              <Text style={styles.balanceActionIcon}>⬆️</Text>
              <Text style={styles.balanceActionText}>Yükle</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.balanceActionBtn} onPress={() => Alert.alert('Yakında', 'Para gönderme yakında eklenecek.')}>
              <Text style={styles.balanceActionIcon}>📤</Text>
              <Text style={styles.balanceActionText}>Gönder</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.balanceActionBtn} onPress={() => Alert.alert('Yakında', 'İşlem geçmişi yakında eklenecek.')}>
              <Text style={styles.balanceActionIcon}>📋</Text>
              <Text style={styles.balanceActionText}>Geçmiş</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bakiye Yükle */}
        <Text style={styles.sectionTitle}>BAKİYE YÜKLE</Text>
        <View style={styles.packagesGrid}>
          {PACKAGES.map(pkg => (
            <TouchableOpacity
              key={pkg.amount}
              style={[styles.pkgCard, selected === pkg.amount && styles.pkgCardActive, pkg.popular && styles.pkgCardPopular]}
              onPress={() => setSelected(pkg.amount)}
            >
              {pkg.popular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>Popüler</Text>
                </View>
              )}
              <Text style={[styles.pkgAmount, selected === pkg.amount && styles.pkgAmountActive]}>{pkg.label}</Text>
              {pkg.bonus && (
                <View style={styles.bonusBadge}>
                  <Text style={styles.bonusText}>{pkg.bonus} bonus</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.topUpBtn, !selected && styles.topUpBtnDisabled]}
          onPress={handleTopUp} disabled={!selected}>
          <Text style={styles.topUpBtnText}>{selected ? `${selected}₺ Yükle` : 'Paket Seç'}</Text>
        </TouchableOpacity>

        {/* Premium Kart */}
        <View style={styles.premiumCard}>
          <View style={styles.premiumLeft}>
            <Text style={styles.premiumTitle}>SAHA PRO ✨</Text>
            <Text style={styles.premiumPrice}>49₺/ay</Text>
            {PREMIUM_FEATURES.map((f, i) => (
              <Text key={i} style={styles.premiumFeature}>{f}</Text>
            ))}
          </View>
          <TouchableOpacity style={[styles.premiumBtn, isPremium && styles.premiumBtnActive]} onPress={handlePremium}>
            <Text style={styles.premiumBtnText}>{isPremium ? '✓ Aktif' : 'Premium Ol'}</Text>
          </TouchableOpacity>
        </View>

        {/* İşlem Geçmişi */}
        <Text style={styles.sectionTitle}>SON İŞLEMLER</Text>
        {loading ? (
          <ActivityIndicator color="#00D4FF" />
        ) : orders.length === 0 ? (
          <View style={styles.emptyTx}>
            <Text style={styles.emptyTxText}>Henüz işlem yok</Text>
          </View>
        ) : (
          orders.map(order => (
            <View key={order.id} style={styles.txRow}>
              <View style={styles.txIcon}>
                <Text style={styles.txIconText}>🛒</Text>
              </View>
              <View style={styles.txInfo}>
                <Text style={styles.txDesc} numberOfLines={1}>Market Siparişi · {(order.items || []).length} ürün</Text>
                <Text style={styles.txDate}>{new Date(order.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
              </View>
              <Text style={styles.txAmountOut}>-{order.total}₺</Text>
            </View>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
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
  backText:    { color: 'rgba(255,255,255,0.45)', fontSize: 14 },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  scroll: { paddingHorizontal: 20, paddingTop: 20 },

  balanceCard: {
    backgroundColor: '#0F1E35', borderRadius: 20, padding: 24, marginBottom: 24,
    overflow: 'hidden', position: 'relative',
    borderWidth: 1, borderColor: 'rgba(0,212,255,0.2)',
  },
  balanceDecor1: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(0,212,255,0.04)', top: -60, right: -40 },
  balanceDecor2: { position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(255,184,0,0.03)', bottom: -30, left: -20 },
  balanceLabel:  { color: '#00D4FF', fontSize: 10, fontWeight: '600', letterSpacing: 3, marginBottom: 8 },
  balanceAmount: { color: '#FFFFFF', fontSize: 52, fontWeight: '900', marginBottom: 20, letterSpacing: -1 },
  balanceActions:   { flexDirection: 'row', gap: 10 },
  balanceActionBtn: { flex: 1, backgroundColor: 'rgba(0,212,255,0.08)', borderRadius: 12, paddingVertical: 12, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: 'rgba(0,212,255,0.2)' },
  balanceActionIcon:{ fontSize: 18 },
  balanceActionText:{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' },

  sectionTitle: { fontSize: 10, fontWeight: '700', color: '#00D4FF', marginBottom: 12, marginTop: 4, letterSpacing: 2 },

  packagesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  pkgCard: {
    width: '47%', backgroundColor: '#0F1E35', borderRadius: 14, padding: 18, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(0,212,255,0.15)', position: 'relative', overflow: 'hidden',
  },
  pkgCardActive:   { borderColor: '#00D4FF', backgroundColor: 'rgba(0,212,255,0.1)' },
  pkgCardPopular:  { borderColor: '#FFB800' },
  popularBadge:    { position: 'absolute', top: 0, right: 0, backgroundColor: '#FFB800', paddingHorizontal: 8, paddingVertical: 3, borderBottomLeftRadius: 10 },
  popularText:     { color: '#0A1628', fontSize: 9, fontWeight: '800' },
  pkgAmount:       { fontSize: 26, fontWeight: '900', color: '#FFFFFF', marginBottom: 6 },
  pkgAmountActive: { color: '#00D4FF' },
  bonusBadge:      { backgroundColor: 'rgba(0,224,150,0.15)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  bonusText:       { color: '#00E096', fontSize: 11, fontWeight: '700' },

  topUpBtn:         { backgroundColor: '#00D4FF', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginBottom: 24 },
  topUpBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.1)' },
  topUpBtnText:     { color: '#0A1628', fontSize: 16, fontWeight: '800' },

  premiumCard: {
    backgroundColor: '#0F1E35', borderRadius: 18, padding: 20, marginBottom: 24,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    borderWidth: 1, borderColor: '#FFB800',
  },
  premiumLeft:     { flex: 1 },
  premiumTitle:    { color: '#FFB800', fontSize: 16, fontWeight: '800', marginBottom: 4 },
  premiumPrice:    { color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginBottom: 12 },
  premiumFeature:  { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 3 },
  premiumBtn:      { backgroundColor: '#FFB800', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginLeft: 12 },
  premiumBtnActive:{ backgroundColor: '#00E096' },
  premiumBtnText:  { color: '#0A1628', fontSize: 12, fontWeight: '800' },

  txRow:      { backgroundColor: '#0F1E35', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(0,212,255,0.08)' },
  txIcon:     { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,212,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  txIconText: { fontSize: 18 },
  txInfo:     { flex: 1 },
  txDesc:     { color: '#FFFFFF', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  txDate:     { color: 'rgba(255,255,255,0.35)', fontSize: 11 },
  txAmountOut:{ fontSize: 14, fontWeight: '800', color: '#FF4757' },

  emptyTx:     { paddingVertical: 24, alignItems: 'center' },
  emptyTxText: { color: 'rgba(255,255,255,0.3)', fontSize: 13 },
});
