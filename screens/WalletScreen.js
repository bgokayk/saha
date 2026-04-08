import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Animated
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

const PACKAGES = [
  { amount: 50,  label: '50₺',  bonus: null,     popular: false },
  { amount: 100, label: '100₺', bonus: '+10₺',   popular: true  },
  { amount: 200, label: '200₺', bonus: '+30₺',   popular: false },
  { amount: 500, label: '500₺', bonus: '+100₺',  popular: false },
];

const MOCK_TRANSACTIONS = [
  { id: 1, type: 'in',  icon: '⬆️', desc: 'Bakiye yükleme',      amount: 100, date: '2026-04-04' },
  { id: 2, type: 'out', icon: '⚽', desc: 'Çarşamba 7v7 — Uludağ Saha', amount: -45, date: '2026-04-03' },
  { id: 3, type: 'out', icon: '⚽', desc: 'Pazar 5v5 — Nilüfer Park',   amount: -30, date: '2026-03-30' },
  { id: 4, type: 'in',  icon: '⬆️', desc: 'Bakiye yükleme',      amount: 200, date: '2026-03-28' },
  { id: 5, type: 'out', icon: '⚽', desc: 'Cuma 8v8 — Görükle Saha',    amount: -55, date: '2026-03-25' },
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
  const [balance, setBalance]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [isPremium, setIsPremium] = useState(false);

  const balanceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadWallet();
  }, []);

  async function loadWallet() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from('profiles')
      .select('wallet_balance, is_premium')
      .eq('id', user.id)
      .single();

    const bal = data?.wallet_balance ?? 0;
    setBalance(bal);
    setIsPremium(data?.is_premium ?? false);
    setLoading(false);

    // Bakiye sayaç animasyonu
    Animated.timing(balanceAnim, {
      toValue: bal,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }

  function handleTopUp() {
    if (!selected) {
      Alert.alert('Paket Seç', 'Lütfen bir yükleme paketi seçin.');
      return;
    }
    const pkg = PACKAGES.find(p => p.amount === selected);
    Alert.alert(
      'Ödeme',
      `${pkg.label}${pkg.bonus ? ` (${pkg.bonus} bonus)` : ''} paket için ödeme sayfasına yönlendirileceksin.\n\nBu özellik yakında iyzico entegrasyonu ile aktif olacak.`,
      [{ text: 'Tamam' }]
    );
  }

  function handlePremium() {
    Alert.alert(
      '⭐ Premium Üyelik',
      'Premium üyelik için ödeme sistemi yakında aktif olacak.',
      [{ text: 'Tamam' }]
    );
  }

  const displayBalance = loading ? '—' : `${balance ?? 0}₺`;

  return (
    <View style={styles.container}>
      {/* Header */}
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
          <Text style={styles.balanceLabel}>Mevcut Bakiye</Text>
          {loading
            ? <ActivityIndicator color="#FFFFFF" size="large" style={{ marginVertical: 12 }} />
            : <Text style={styles.balanceAmount}>{displayBalance}</Text>
          }
          <View style={styles.balanceActions}>
            <TouchableOpacity style={styles.balanceActionBtn} onPress={() => setSelected(100)}>
              <Text style={styles.balanceActionIcon}>⬆️</Text>
              <Text style={styles.balanceActionText}>Yükle</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.balanceActionBtn} onPress={() => Alert.alert('Yakında', 'Para gönderme özelliği yakında eklenecek.')}>
              <Text style={styles.balanceActionIcon}>📤</Text>
              <Text style={styles.balanceActionText}>Gönder</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.balanceActionBtn} onPress={() => Alert.alert('İşlem Geçmişi', 'Detaylı geçmiş ekranı yakında gelecek.')}>
              <Text style={styles.balanceActionIcon}>📋</Text>
              <Text style={styles.balanceActionText}>Geçmiş</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bakiye Yükle */}
        <Text style={styles.sectionTitle}>Bakiye Yükle</Text>
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
              <Text style={[styles.pkgAmount, selected === pkg.amount && styles.pkgAmountActive]}>
                {pkg.label}
              </Text>
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
          onPress={handleTopUp}
          disabled={!selected}
        >
          <Text style={styles.topUpBtnText}>
            {selected ? `${selected}₺ Yükle` : 'Paket Seç'}
          </Text>
        </TouchableOpacity>

        {/* Premium Kart */}
        <View style={styles.premiumCard}>
          <View style={styles.premiumLeft}>
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumBadgeText}>PREMIUM</Text>
            </View>
            <Text style={styles.premiumTitle}>Saha Premium</Text>
            <Text style={styles.premiumPrice}>49₺ / ay</Text>
            {PREMIUM_FEATURES.map((f, i) => (
              <Text key={i} style={styles.premiumFeature}>{f}</Text>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.premiumBtn, isPremium && styles.premiumBtnActive]}
            onPress={handlePremium}
          >
            <Text style={styles.premiumBtnText}>
              {isPremium ? '✓ Aktif' : 'Başla'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* İşlem Geçmişi */}
        <Text style={styles.sectionTitle}>Son İşlemler</Text>
        {MOCK_TRANSACTIONS.map(tx => (
          <View key={tx.id} style={styles.txRow}>
            <View style={[styles.txIcon, tx.type === 'in' ? styles.txIconIn : styles.txIconOut]}>
              <Text style={styles.txIconText}>{tx.icon}</Text>
            </View>
            <View style={styles.txInfo}>
              <Text style={styles.txDesc}>{tx.desc}</Text>
              <Text style={styles.txDate}>{tx.date}</Text>
            </View>
            <Text style={[styles.txAmount, tx.type === 'in' ? styles.txAmountIn : styles.txAmountOut]}>
              {tx.amount > 0 ? '+' : ''}{tx.amount}₺
            </Text>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F9' },
  header: { backgroundColor: '#001F5B', paddingTop: 12, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backText: { color: 'rgba(255,255,255,0.55)', fontSize: 14 },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  scroll: { paddingHorizontal: 20, paddingTop: 20 },

  // Bakiye kartı
  balanceCard: { backgroundColor: '#001F5B', borderRadius: 24, padding: 24, marginBottom: 24, overflow: 'hidden', position: 'relative' },
  balanceDecor1: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(0,160,210,0.08)', top: -60, right: -40 },
  balanceDecor2: { position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(201,168,76,0.06)', bottom: -30, left: -20 },
  balanceLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600', letterSpacing: 1, marginBottom: 8 },
  balanceAmount: { color: '#FFFFFF', fontSize: 48, fontWeight: '800', marginBottom: 24, letterSpacing: -1 },
  balanceActions: { flexDirection: 'row', gap: 12 },
  balanceActionBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingVertical: 12, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  balanceActionIcon: { fontSize: 18 },
  balanceActionText: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#001F5B', marginBottom: 14, marginTop: 4 },

  // Paketler
  packagesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  pkgCard: { width: '47%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, alignItems: 'center', borderWidth: 2, borderColor: '#E2E8F0', shadowColor: '#001F5B', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2, position: 'relative', overflow: 'hidden' },
  pkgCardActive: { borderColor: '#00A0D2', backgroundColor: '#E8F4FB' },
  pkgCardPopular: { borderColor: '#C9A84C' },
  popularBadge: { position: 'absolute', top: 0, right: 0, backgroundColor: '#C9A84C', paddingHorizontal: 8, paddingVertical: 3, borderBottomLeftRadius: 10 },
  popularText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  pkgAmount: { fontSize: 26, fontWeight: '800', color: '#001F5B', marginBottom: 6 },
  pkgAmountActive: { color: '#00A0D2' },
  bonusBadge: { backgroundColor: '#D1FAE5', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  bonusText: { color: '#059669', fontSize: 11, fontWeight: '700' },

  topUpBtn: { backgroundColor: '#00A0D2', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginBottom: 24, shadowColor: '#00A0D2', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  topUpBtnDisabled: { backgroundColor: '#94A3B8', shadowOpacity: 0 },
  topUpBtnText: { color: '#001F5B', fontSize: 16, fontWeight: '800' },

  // Premium
  premiumCard: { backgroundColor: '#001F5B', borderRadius: 20, padding: 20, marginBottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderWidth: 1, borderColor: '#C9A84C' },
  premiumLeft: { flex: 1 },
  premiumBadge: { backgroundColor: '#C9A84C', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, marginBottom: 8 },
  premiumBadgeText: { color: '#001F5B', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  premiumTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginBottom: 2 },
  premiumPrice: { color: '#C9A84C', fontSize: 22, fontWeight: '800', marginBottom: 12 },
  premiumFeature: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 4 },
  premiumBtn: { backgroundColor: '#C9A84C', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, marginLeft: 12 },
  premiumBtnActive: { backgroundColor: '#22C55E' },
  premiumBtnText: { color: '#001F5B', fontSize: 14, fontWeight: '800' },

  // İşlemler
  txRow: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 8, shadowColor: '#001F5B', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  txIcon: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  txIconIn: { backgroundColor: '#D1FAE5' },
  txIconOut: { backgroundColor: '#EFF6FF' },
  txIconText: { fontSize: 18 },
  txInfo: { flex: 1 },
  txDesc: { color: '#001F5B', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  txDate: { color: '#94A3B8', fontSize: 11 },
  txAmount: { fontSize: 15, fontWeight: '800' },
  txAmountIn: { color: '#059669' },
  txAmountOut: { color: '#001F5B' },
});
