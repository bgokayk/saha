import { View, Text, StyleSheet, TouchableOpacity, Animated, Image } from 'react-native';
import { useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SplashScreen({ navigation }) {
  const inset       = useSafeAreaInsets();
  const scaleAnim   = useRef(new Animated.Value(0.6)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }).start();
    Animated.timing(opacityAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(contentAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={[styles.container, { paddingBottom: inset.bottom + 20 }]}>
      {/* Dekor daireler */}
      <View style={styles.circle1} />
      <View style={styles.circle2} />

      <View style={styles.hero}>
        <Animated.View style={[styles.logoWrap, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
          <Image
            source={require('../assets/logo-dark.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.logoBy}>by LumenCo.</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.bottomSection, { opacity: contentAnim }]}>
        <TouchableOpacity style={styles.loginBtn} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.loginBtnText}>Giriş Yap</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.registerBtn} onPress={() => navigation.navigate('Register')}>
          <Text style={styles.registerBtnText}>Hesap Oluştur</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.venueBtn} onPress={() => navigation.navigate('Login', { venueAdmin: true })}>
          <Text style={styles.venueBtnText}>Saha Sahibi Girişi →</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0A1628', justifyContent: 'space-between', paddingHorizontal: 24 },

  circle1: {
    position: 'absolute', width: 400, height: 400, borderRadius: 200,
    backgroundColor: 'rgba(0,212,255,0.04)', top: -100, right: -100,
  },
  circle2: {
    position: 'absolute', width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(255,184,0,0.03)', bottom: 80, left: -80,
  },

  hero:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  logoWrap:     { alignItems: 'center', gap: 8 },
  logoImage:    { width: 240, height: 90 },
  logoBy:       { color: '#00D4FF', fontSize: 12, letterSpacing: 4, marginTop: 12 },

  bottomSection:{ gap: 12, paddingBottom: 12 },

  loginBtn:     { backgroundColor: '#00D4FF', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  loginBtnText: { color: '#0A1628', fontSize: 16, fontWeight: '800' },

  registerBtn:  { borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(0,212,255,0.4)' },
  registerBtnText:{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  venueBtn:    { alignItems: 'center', paddingVertical: 8 },
  venueBtnText:{ color: 'rgba(255,255,255,0.4)', fontSize: 13 },
});
