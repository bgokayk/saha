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

const FALLBACK_PRODUCTS = [
  { id: 'f1', emoji: '🧃', name: 'Kutu içecek',    price: 15, category: '💧 İçecek',   stock: 10, is_available: true },
  { id: 'f2', emoji: '💧', name: 'Şişe su',         price: 10, category: '💧 İçecek',   stock: 20, is_available: true },
  { id: 'f3', emoji: '🥤', name: 'Enerji içeceği',  price: 25, category: '💧 İçecek',   stock: 5,  is_available: true },
  { id: 'f4', emoji: '👟', name: 'Kiralık krampon',  price: 50, category: '👟 Ekipman',  stock: 3,  is_available: true, unit: '/maç' },
  { id: 'f5', emoji: '⚽', name: 'Maç topu',        price: 40, category: '👟 Ekipman',  stock: 4,  is_available: true, unit: '/maç' },
  { id: 'f6', emoji: '🧤', name: 'Kaleci eldiveni', price: 30, category: '👟 Ekipman',  stock: 2,  is_available: true, unit: '/maç' },
  { id: 'f7', emoji: '🩴', name: 'Havlu',           price: 20, category: '🎽 Aksesuar', stock: 8,  is_available: true },
  { id: 'f8', emoji: '🧦', name: 'Çorap',           price: 25, category: '🎽 Aksesuar', stock: 6,  is_available: true },
];

const EMOJI_BG = {
  '💧 İçecek':   '#DBEAFE',
  '👟 Ekipman':  '#D1FAE5',
  '🎽 Aksesuar': '#FEF3C7',
};

export default function MarketScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { items, addItem, removeItem, clearCart, cartCount, total, cartList } = useCart();
  const [showCart, setShowCart] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [cat, setCat]           = useState('Tümü');
  const [categories, setCategories] = useState(['Tümü']);

  const venueId = route?.params?.venue_id;
  const matchId = route?.params?.match_id;

  useEffect(() => {
    loadProducts();
  }, [venueId]);

  async function loadProducts() {
    setLoading(true);
    if (venueId) {
      const { data, error } = await supabase
        .from('venue_products')
        .select('*')
        .eq('venue_id', venueId)
        .eq('is_available', true)
        .order('category')
        .order('name');
      if (!error && data && data.length > 0) {
        setProducts(data);
        const cats = ['Tümü', ...new Set(data.map(p => p.category))];
        setCategories(cats);
        setLoading(false);
        return;
      }
    }
    // Fallback: statik ürünler
    setProducts(FALLBACK_PRODUCTS);
    setCategories(['Tümü', '💧 İçecek', '👟 Ekipman', '🎽 Aksesuar']);
    setLoading(false);
  }

  function handleAdd(product) {
    if (!product.is_available) return;
    haptic();
    addItem(product);
  }

  async function checkout() {
    if (cartCount === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    Alert.alert(
      'Sipariş Ver 🛒',
      `Toplam: ${total}₺\nGörevli 5 dk içinde getirecek.`,
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Onayla', onPress: async () => {
          if (user && venueId) {
            await supabase.from('market_orders').insert({
              venue_id: venueId,
              user_id: user.id,
              match_id: matchId || null,
              items: cartList.map(({ product: p, qty }) => ({ id: p.id, name: p.name, qty, price: p.price })),
              total,
              status: 'pending',
            });
          }
          clearCart();
          Alert.alert('Sipariş Alındı! 🎉', 'Görevli 5 dk içinde getirecek. 🏃');
        }},
      ]
    );
  }

  const filtered = cat === 'Tümü' ? products : products.filter(p => p.category === cat);

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

      {/* Uyarı: venue_id yoksa */}
      {!venueId && (
        <View style={styles.warningBar}>
          <Text style={styles.warningText}>⚠️ Saha bağlantısı yok — sipariş kaydedilmeyecek.</Text>
        </View>
      )}

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
        <View style={styles.loadingWrap}><ActivityIndicator color="#00A0D2" size="large" /></View>
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
                <View style={[styles.productEmojiWrap, { backgroundColor: EMOJI_BG[item.category] || '#F1F5F9' }]}>
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
  container: { flex: 1, backgroundColor: '#F4F6F9' },

  header: { backgroundColor: '#001F5B', paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backText: { color: 'rgba(255,255,255,0.55)', fontSize: 14 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  cartBtn: { position: 'relative', width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  cartIcon: { fontSize: 22 },
  cartBadge: { position: 'absolute', top: -2, right: -4, backgroundColor: '#EF4444', width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  cartBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  warningBar: { backgroundColor: '#FEF3C7', paddingHorizontal: 16, paddingVertical: 8 },
  warningText: { fontSize: 12, color: '#92400E', fontWeight: '600', textAlign: 'center' },

  cartPanel: { backgroundColor: '#fff', margin: 16, borderRadius: 16, padding: 16, shadowColor: '#001F5B', shadowOpacity: 0.08, shadowRadius: 10, elevation: 4 },
  cartRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  cartRowText: { fontSize: 13, color: '#001F5B' },
  cartRowRight: { fontSize: 13, fontWeight: '700', color: '#001F5B' },
  cartTotal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, marginBottom: 14 },
  cartTotalLabel: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  cartTotalPrice: { fontSize: 18, fontWeight: '900', color: '#001F5B' },
  checkoutBtn: { backgroundColor: '#001F5B', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  checkoutBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  catBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  catScroll: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  catChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#fff' },
  catChipActive: { backgroundColor: '#001F5B', borderColor: '#001F5B' },
  catChipText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  catChipTextActive: { color: '#fff' },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  grid: { padding: 12 },
  gridRow: { gap: 12 },
  productCard: { flex: 1, backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 12, alignItems: 'center', gap: 8, shadowColor: '#001F5B', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  productCardOut: { opacity: 0.6 },
  productEmojiWrap: { width: 60, height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  productEmoji: { fontSize: 30 },
  productName: { fontSize: 13, fontWeight: '700', color: '#001F5B', textAlign: 'center' },
  productPrice: { fontSize: 15, fontWeight: '800', color: '#00A0D2' },
  stockText: { fontSize: 11, fontWeight: '600' },
  stockIn: { color: '#10B981' },
  stockOut: { color: '#EF4444' },
  addBtn: { backgroundColor: '#001F5B', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, width: '100%', alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  addBtnDisabled: { backgroundColor: '#E2E8F0', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, width: '100%', alignItems: 'center' },
  addBtnDisabledText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  qtyBtnAdd: { backgroundColor: '#001F5B' },
  qtyBtnText: { fontSize: 16, fontWeight: '700', color: '#001F5B' },
  qtyNum: { fontSize: 16, fontWeight: '800', color: '#001F5B', minWidth: 20, textAlign: 'center' },
});
