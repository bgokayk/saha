import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, FlatList, Platform, ActivityIndicator
} from 'react-native';
import { useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '../context/CartContext';
import { supabase } from '../lib/supabase';

function haptic() {
  if (Platform.OS === 'web') return;
  try { require('expo-haptics').impactAsync(require('expo-haptics').ImpactFeedbackStyle.Light); } catch (_) {}
}

const EMOJI_BG = {
  '💧 İçecek':   'rgba(59,130,246,0.15)',
  '👟 Ekipman':  'rgba(16,185,129,0.15)',
  '🎽 Aksesuar': 'rgba(245,158,11,0.15)',
};

export default function MarketScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { items, addItem, removeItem, clearCart, cartCount, total, cartList } = useCart();
  const [showCart, setShowCart] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [cat, setCat]           = useState('Tümü');
  const [categories, setCategories] = useState(['Tümü']);

  const venueId = route?.params?.venueId ?? route?.params?.venue_id ?? null;
  const matchId = route?.params?.matchId ?? route?.params?.match_id ?? null;

  useEffect(() => {
    if (venueId) loadProducts();
    else setLoading(false);
  }, [venueId]);

  async function loadProducts() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('venue_products')
        .select('*')
        .eq('venue_id', venueId)
        .eq('is_available', true)
        .order('category')
        .order('name');
      if (error) throw error;
      setProducts(data || []);
      const cats = ['Tümü', ...new Set((data || []).map(p => p.category))];
      setCategories(cats);
    } catch (e) {
      Alert.alert('Hata', 'Ürünler yüklenirken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  }

  function handleAdd(product) {
    if (!product.is_available) return;
    haptic();
    addItem(product);
  }

  async function checkout() {
    if (cartCount === 0) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('wallet_balance')
          .eq('id', user.id)
          .single();
        const balance = prof?.wallet_balance ?? 0;
        if (balance < total) {
          Alert.alert('Yetersiz Bakiye', `Cüzdanınızda ${balance}₺ var, sipariş tutarı ${total}₺.`);
          return;
        }
      }
      Alert.alert(
        'Sipariş Ver 🛒',
        `Toplam: ${total}₺\nGörevli 5 dk içinde getirecek.`,
        [
          { text: 'İptal', style: 'cancel' },
          { text: 'Onayla', onPress: async () => {
            try {
              if (user && venueId) {
                const { error } = await supabase.from('market_orders').insert({
                  venue_id: venueId,
                  user_id: user.id,
                  match_id: matchId || null,
                  items: cartList.map(({ product: p, qty }) => ({ id: p.id, name: p.name, qty, price: p.price })),
                  total,
                  status: 'pending',
                });
                if (error) { Alert.alert('Hata', 'Sipariş kaydedilemedi: ' + error.message); return; }
              }
              clearCart();
              Alert.alert('Sipariş Alındı! 🎉', 'Görevli 5 dk içinde getirecek. 🏃');
            } catch (e) {
              Alert.alert('Hata', 'Sipariş sırasında bir sorun oluştu.');
            }
          }},
        ]
      );
    } catch (e) {
      Alert.alert('Hata', 'İşlem sırasında bir sorun oluştu.');
    }
  }

  const filtered = cat === 'Tümü' ? products : products.filter(p => p.category === cat);

  // Tam ekran engel: venueId yoksa market açılamaz
  if (!venueId) {
    return (
      <View style={[styles.container, styles.noVenueContainer]}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Geri</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Market 🛒</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.noVenueBody}>
          <Text style={styles.noVenueEmoji}>🛒</Text>
          <Text style={styles.noVenueTitle}>Market Kapalı</Text>
          <Text style={styles.noVenueSub}>Market sadece aktif bir maçtan açılabilir 🛒</Text>
          <TouchableOpacity style={styles.noVenueBtn} onPress={() => navigation.navigate('MatchList')}>
            <Text style={styles.noVenueBtnText}>Maç Bul →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Market 🛒</Text>
        <TouchableOpacity style={styles.cartBtn} onPress={() => setShowCart(!showCart)}>
          <Text style={styles.cartIcon}>🛒</Text>
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Sepet paneli */}
      {showCart && cartCount > 0 && (
        <View style={styles.cartPanel}>
          {cartList.map(({ product: p, qty }) => (
            <View key={p.id} style={styles.cartRow}>
              <Text style={styles.cartRowText}>{p.emoji} {p.name}</Text>
              <Text style={styles.cartRowRight}>x{qty}  {p.price * qty}₺</Text>
            </View>
          ))}
          <View style={styles.cartTotal}>
            <Text style={styles.cartTotalLabel}>Toplam</Text>
            <Text style={styles.cartTotalPrice}>{total}₺</Text>
          </View>
          <TouchableOpacity style={styles.checkoutBtn} onPress={checkout}>
            <Text style={styles.checkoutBtnText}>Cüzdandan Öde & Saha Görevlisine Bildir</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Kategori filtre */}
      <View style={styles.catBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScroll}>
          {categories.map(c => (
            <TouchableOpacity
              key={c}
              style={[styles.catChip, cat === c && styles.catChipActive]}
              onPress={() => setCat(c)}
            >
              <Text style={[styles.catChipText, cat === c && styles.catChipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}><ActivityIndicator color="#00D4FF" size="large" /></View>
      ) : products.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>🏪</Text>
          <Text style={styles.emptyTitle}>Market Yok</Text>
          <Text style={styles.emptySub}>Bu sahada henüz market kurulmamış</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => {
            const qty = items[item.id]?.qty || 0;
            const inStock = item.is_available && (item.stock === undefined || item.stock > 0);
            return (
              <View style={[styles.productCard, !inStock && styles.productCardOut]}>
                <View style={[styles.productEmojiWrap, { backgroundColor: EMOJI_BG[item.category] || 'rgba(255,255,255,0.06)' }]}>
                  <Text style={styles.productEmoji}>{item.emoji || '📦'}</Text>
                </View>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.productPrice}>{item.price}₺{item.unit || ''}</Text>
                {item.stock !== undefined && (
                  <Text style={[styles.stockText, inStock ? styles.stockIn : styles.stockOut]}>
                    {inStock ? `Stok: ${item.stock} ✓` : 'Tükendi ✗'}
                  </Text>
                )}
                {inStock ? (
                  qty > 0 ? (
                    <View style={styles.qtyRow}>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => removeItem(item.id)}>
                        <Text style={styles.qtyBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyNum}>{qty}</Text>
                      <TouchableOpacity style={[styles.qtyBtn, styles.qtyBtnAdd]} onPress={() => handleAdd(item)}>
                        <Text style={[styles.qtyBtnText, { color: '#fff' }]}>+</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.addBtn} onPress={() => handleAdd(item)}>
                      <Text style={styles.addBtnText}>Sepete Ekle</Text>
                    </TouchableOpacity>
                  )
                ) : (
                  <View style={styles.addBtnDisabled}>
                    <Text style={styles.addBtnDisabledText}>Tükendi</Text>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1628' },

  header: { backgroundColor: '#0A1628', paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(0,212,255,0.12)' },
  backText: { color: 'rgba(255,255,255,0.45)', fontSize: 14 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  cartBtn: { position: 'relative', width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  cartIcon: { fontSize: 22 },
  cartBadge: { position: 'absolute', top: -2, right: -4, backgroundColor: '#FF4757', width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  cartBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  noVenueContainer: { flex: 1, backgroundColor: '#0A1628' },
  noVenueBody:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  noVenueEmoji:     { fontSize: 64, marginBottom: 20 },
  noVenueTitle:     { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 10 },
  noVenueSub:       { fontSize: 15, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 28, lineHeight: 22 },
  noVenueBtn:       { backgroundColor: '#00D4FF', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  noVenueBtnText:   { color: '#0A1628', fontSize: 15, fontWeight: '800' },

  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  emptySub:   { fontSize: 14, color: '#8B9BB4', textAlign: 'center' },

  cartPanel: { backgroundColor: '#0F1E35', margin: 16, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(0,212,255,0.15)' },
  cartRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(0,212,255,0.08)' },
  cartRowText: { fontSize: 13, color: '#FFFFFF' },
  cartRowRight: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  cartTotal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, marginBottom: 14 },
  cartTotalLabel: { fontSize: 14, fontWeight: '700', color: '#8B9BB4' },
  cartTotalPrice: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  checkoutBtn: { backgroundColor: '#00D4FF', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  checkoutBtnText: { color: '#0A1628', fontSize: 13, fontWeight: '700' },

  catBar: { backgroundColor: '#0A1628', borderBottomWidth: 1, borderBottomColor: 'rgba(0,212,255,0.08)' },
  catScroll: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  catChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(0,212,255,0.2)', backgroundColor: 'rgba(255,255,255,0.04)' },
  catChipActive: { backgroundColor: 'rgba(0,212,255,0.12)', borderColor: '#00D4FF' },
  catChipText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
  catChipTextActive: { color: '#00D4FF' },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  grid: { padding: 12 },
  gridRow: { gap: 12 },
  productCard: { flex: 1, backgroundColor: '#0F1E35', borderRadius: 18, padding: 14, marginBottom: 12, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(0,212,255,0.12)' },
  productCardOut: { opacity: 0.5 },
  productEmojiWrap: { width: 60, height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  productEmoji: { fontSize: 30 },
  productName: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  productPrice: { fontSize: 15, fontWeight: '800', color: '#00D4FF' },
  stockText: { fontSize: 11, fontWeight: '600' },
  stockIn: { color: '#00E096' },
  stockOut: { color: '#FF4757' },
  addBtn: { backgroundColor: '#00D4FF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, width: '100%', alignItems: 'center' },
  addBtnText: { color: '#0A1628', fontSize: 12, fontWeight: '700' },
  addBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, width: '100%', alignItems: 'center' },
  addBtnDisabledText: { color: '#8B9BB4', fontSize: 12, fontWeight: '600' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },
  qtyBtnAdd: { backgroundColor: '#00D4FF' },
  qtyBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  qtyNum: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', minWidth: 20, textAlign: 'center' },
});
