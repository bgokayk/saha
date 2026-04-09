import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, Animated
} from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

export default function LoginScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const isVenueAdmin = route?.params?.venueAdmin === true;
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Eksik Bilgi', 'Email ve şifre zorunlu.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        const msg =
          error?.message?.includes('Invalid login credentials')
            ? 'Email veya şifre hatalı.'
            : error?.message?.includes('Email not confirmed')
            ? 'Email adresin henüz doğrulanmadı. Gelen kutunu kontrol et.'
            : error?.message;
        Alert.alert('Giriş Başarısız', msg);
      }
      // Başarılı girişte App.js onAuthStateChange tetiklenir → otomatik Home'a geçer
      // Saha sahibi girişiyse VenueAdmin'e yönlendir
      if (isVenueAdmin && !error) {
        navigation.navigate('VenueAdmin');
      }
    } catch (err) {
      Alert.alert('Hata', 'Beklenmeyen bir hata oluştu. Lütfen tekrar dene.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset() {
    if (!email.trim()) {
      Alert.alert('Email Gir', 'Lütfen önce email adresini gir.');
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
      if (error) Alert.alert('Hata', error?.message);
      else Alert.alert('Gönderildi ✉️', 'Şifre sıfırlama bağlantısı emailine gönderildi.');
    } catch (err) {
      Alert.alert('Hata', 'Şifre sıfırlama isteği gönderilemedi.');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Geri */}
        <TouchableOpacity style={[styles.back, { marginTop: insets.top }]} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>

        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {/* Başlık */}
          <View style={styles.header}>
            <View style={styles.logoMini}>
              <Text style={styles.logoMiniText}>⚽</Text>
            </View>
            <Text style={styles.title}>Tekrar hoş geldin</Text>
            <Text style={styles.subtitle}>Sahaya devam et</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.label}>E-posta</Text>
            <TextInput
              style={styles.input}
              placeholder="ornek@mail.com"
              placeholderTextColor="rgba(255,255,255,0.25)"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />

            <Text style={styles.label}>Şifre</Text>
            <View style={styles.passWrap}>
              <TextInput
                style={styles.passInput}
                placeholder="••••••••"
                placeholderTextColor="rgba(255,255,255,0.25)"
                secureTextEntry={!showPass}
                autoComplete="password"
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={handleLogin}
                returnKeyType="go"
              />
              <TouchableOpacity onPress={() => setShowPass(v => !v)} style={styles.eyeBtn}>
                <Text style={styles.eyeText}>{showPass ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.forgotWrap} onPress={handlePasswordReset}>
              <Text style={styles.forgotText}>Şifremi unuttum →</Text>
            </TouchableOpacity>
          </View>

          {/* Giriş butonu */}
          <TouchableOpacity
            style={[styles.btnPrimary, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#001F5B" size="small" />
              : <Text style={styles.btnPrimaryText}>Giriş Yap</Text>
            }
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>veya</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Sosyal giriş */}
          <TouchableOpacity style={styles.btnSocial} disabled>
            <Text style={styles.btnSocialText}>🔵  Google ile giriş yap</Text>
            <View style={styles.comingSoon}>
              <Text style={styles.comingSoonText}>Yakında</Text>
            </View>
          </TouchableOpacity>

          {/* Kayıt */}
          <TouchableOpacity
            style={styles.registerWrap}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.registerText}>
              Hesabın yok mu?{'  '}
              <Text style={styles.registerLink}>Kayıt ol</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#001F5B' },
  scroll: { paddingHorizontal: 28, paddingTop: 20, paddingBottom: 40 },
  back: { marginBottom: 28 },
  backText: { color: 'rgba(255,255,255,0.4)', fontSize: 15 },

  header: { alignItems: 'center', marginBottom: 36 },
  logoMini: { width: 56, height: 56, backgroundColor: 'rgba(0,160,210,0.15)', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(0,160,210,0.3)' },
  logoMiniText: { fontSize: 28 },
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '700', marginBottom: 6 },
  subtitle: { color: 'rgba(255,255,255,0.4)', fontSize: 15 },

  form: { marginBottom: 24 },
  label: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 18, letterSpacing: 0.5 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  passWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  passInput: { flex: 1, paddingVertical: 15, paddingHorizontal: 16, color: '#FFFFFF', fontSize: 15 },
  eyeBtn: { paddingHorizontal: 14, paddingVertical: 14 },
  eyeText: { fontSize: 16 },
  forgotWrap: { alignItems: 'flex-end', marginTop: 10 },
  forgotText: { color: '#00A0D2', fontSize: 13 },

  btnPrimary: { backgroundColor: '#00A0D2', paddingVertical: 17, borderRadius: 14, alignItems: 'center', marginBottom: 20, shadowColor: '#00A0D2', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  btnDisabled: { opacity: 0.6 },
  btnPrimaryText: { color: '#001F5B', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerText: { color: 'rgba(255,255,255,0.25)', fontSize: 12 },

  btnSocial: { backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: 15, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 8, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  btnSocialText: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  comingSoon: { backgroundColor: 'rgba(0,160,210,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  comingSoonText: { color: '#00A0D2', fontSize: 10, fontWeight: '700' },

  registerWrap: { marginTop: 24, alignItems: 'center' },
  registerText: { color: 'rgba(255,255,255,0.35)', fontSize: 14 },
  registerLink: { color: '#00A0D2', fontWeight: '700' },
});
