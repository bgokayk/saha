import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SplashScreen({ navigation }) {
  const logoScale  = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // Logo beliriyor
      Animated.parallel([
        Animated.spring(logoScale,   { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      // İçerik beliriyor
      Animated.timing(contentOpacity, { toValue: 1, duration: 400, delay: 100, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Arka plan desen */}
      <View style={styles.bgPattern}>
        <View style={styles.bgCircle1} />
        <View style={styles.bgCircle2} />
      </View>

      {/* Logo */}
      <Animated.View style={[styles.logoArea, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <View style={styles.logoMark}>
          <View style={styles.logoMarkInner}>
            <Text style={styles.logoIcon}>⚽</Text>
          </View>
        </View>
        <Text style={styles.logoText}>SAHA</Text>
        <Text style={styles.logoSub}>by ScopeGoal</Text>
      </Animated.View>

      {/* Tagline */}
      <Animated.View style={[styles.taglineArea, { opacity: contentOpacity }]}>
        <Text style={styles.tagline}>Halı sahanın{'\n'}sosyal ağı.</Text>
        <Text style={styles.taglineSub}>Maç kur. Oyuncu bul. İstatistiklerini takip et.</Text>
      </Animated.View>

      {/* Butonlar */}
      <Animated.View style={[styles.buttonArea, { opacity: contentOpacity }]}>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.btnPrimaryText}>Giriş Yap</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={styles.btnSecondaryText}>Hesap Oluştur</Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>veya</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={styles.btnVenue}
          onPress={() => navigation.navigate('Login', { venueAdmin: true })}
        >
          <Text style={styles.btnVenueText}>🏟️  Saha Sahibi Girişi</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.venueLinkWrap}
          onPress={() => navigation.navigate('Login', { venueAdmin: true })}
        >
          <Text style={styles.venueLink}>Saha sahibi misiniz? →</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#001F5B', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 72, paddingHorizontal: 28 },

  // Arka plan desen
  bgPattern: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  bgCircle1: { position: 'absolute', width: 340, height: 340, borderRadius: 170, borderWidth: 1, borderColor: 'rgba(0,160,210,0.08)', top: -60, right: -80 },
  bgCircle2: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 1, borderColor: 'rgba(0,160,210,0.06)', bottom: 80, left: -60 },

  // Logo
  logoArea: { alignItems: 'center' },
  logoMark: { width: 88, height: 88, borderRadius: 22, backgroundColor: 'rgba(0,160,210,0.12)', borderWidth: 1, borderColor: 'rgba(0,160,210,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  logoMarkInner: { width: 72, height: 72, borderRadius: 18, backgroundColor: '#00A0D2', alignItems: 'center', justifyContent: 'center', shadowColor: '#00A0D2', shadowOpacity: 0.6, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 12 },
  logoIcon: { fontSize: 36 },
  logoText: { color: '#FFFFFF', fontSize: 46, fontWeight: '800', letterSpacing: 8 },
  logoSub: { color: '#00A0D2', fontSize: 12, letterSpacing: 4, marginTop: 6, fontWeight: '600' },

  // Tagline
  taglineArea: { alignItems: 'center' },
  tagline: { color: '#FFFFFF', fontSize: 26, fontWeight: '700', textAlign: 'center', lineHeight: 34, marginBottom: 14 },
  taglineSub: { color: 'rgba(255,255,255,0.45)', fontSize: 15, textAlign: 'center', lineHeight: 22 },

  // Butonlar
  buttonArea: { width: '100%', gap: 10 },
  btnPrimary: { backgroundColor: '#00A0D2', paddingVertical: 17, borderRadius: 14, alignItems: 'center', shadowColor: '#00A0D2', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, elevation: 8 },
  btnPrimaryText: { color: '#001F5B', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  btnSecondary: { backgroundColor: 'rgba(255,255,255,0.07)', paddingVertical: 17, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  btnSecondaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '500' },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerText: { color: 'rgba(255,255,255,0.25)', fontSize: 12 },

  btnVenue: { backgroundColor: 'rgba(201,168,76,0.08)', paddingVertical: 15, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)', flexDirection: 'row', justifyContent: 'center', gap: 10 },
  btnVenueText: { color: '#C9A84C', fontSize: 14, fontWeight: '600' },
  comingSoon: { backgroundColor: 'rgba(201,168,76,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  comingSoonText: { color: '#C9A84C', fontSize: 10, fontWeight: '700' },
  venueLinkWrap: { paddingVertical: 10, alignItems: 'center' },
  venueLink: { color: 'rgba(201,168,76,0.55)', fontSize: 13, fontWeight: '500' },
});
