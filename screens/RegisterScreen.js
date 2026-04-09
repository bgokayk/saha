import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

export default function RegisterScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [position, setPosition] = useState('');
  const [loading, setLoading] = useState(false);
  const positions = ['Kaleci', 'Defans', 'Orta Saha', 'Forvet'];

  async function handleRegister() {
    if (!email || !password || !fullName) {
      Alert.alert('Hata', 'Ad, email ve şifre zorunlu.');
      return;
    }
    if (fullName.trim().length < 2) {
      Alert.alert('Hata', 'Ad Soyad en az 2 karakter olmalı.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Hata', 'Geçerli bir email adresi gir.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Hata', 'Şifre en az 6 karakter olmalı.');
      return;
    }

    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signUp({ email: normalizedEmail, password });

      if (error) {
        Alert.alert('Kayıt Hatası', error.message);
        return;
      }

      if (data.user) {
        // Trigger zaten boş profil oluşturuyor, upsert ile güncelle
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: fullName,
          phone: phone || null,
          position: position || null,
        }, { onConflict: 'id', ignoreDuplicates: false });

        if (profileError) {
        }
      }

      Alert.alert('Başarılı! 🎉', 'Hesabın oluşturuldu. Giriş yapabilirsin.', [
        { text: 'Tamam', onPress: () => navigation.navigate('Login') }
      ]);
    } catch (err) {
      Alert.alert('Hata', 'Beklenmeyen bir hata oluştu. Lütfen tekrar dene.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={[styles.back, { marginTop: insets.top }]} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Geri</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>Hesap Oluştur</Text>
        <Text style={styles.subtitle}>Sahaya hoş geldin ⚽</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Ad Soyad</Text>
        <TextInput style={styles.input} placeholder="Gökay Küpeli" placeholderTextColor="rgba(255,255,255,0.3)" value={fullName} onChangeText={setFullName} />

        <Text style={styles.label}>Telefon</Text>
        <TextInput style={styles.input} placeholder="0555 000 00 00" placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />

        <Text style={styles.label}>E-posta</Text>
        <TextInput style={styles.input} placeholder="ornek@mail.com" placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />

        <Text style={styles.label}>Şifre</Text>
        <TextInput style={styles.input} placeholder="••••••••" placeholderTextColor="rgba(255,255,255,0.3)" secureTextEntry value={password} onChangeText={setPassword} />

        <Text style={styles.label}>Pozisyonun</Text>
        <View style={styles.positionRow}>
          {positions.map(pos => (
            <TouchableOpacity
              key={pos}
              style={[styles.posBtn, position === pos && styles.posBtnActive]}
              onPress={() => setPosition(pos)}
            >
              <Text style={[styles.posBtnText, position === pos && styles.posBtnTextActive]}>
                {pos}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity style={[styles.btnPrimary, loading && { opacity: 0.6 }]} onPress={handleRegister} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#0A1628" />
          : <Text style={styles.btnPrimaryText}>Kayıt Ol</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.loginText}>
          Zaten hesabın var mı? <Text style={{ color: '#00D4FF' }}>Giriş yap</Text>
        </Text>
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1628', paddingHorizontal: 28, paddingTop: 20 },
  back: { marginBottom: 32 },
  backText: { color: 'rgba(255,255,255,0.5)', fontSize: 15 },
  header: { marginBottom: 32 },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 16 },
  form: { gap: 4, marginBottom: 28 },
  label: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, color: '#FFFFFF', fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  positionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  posBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.06)' },
  posBtnActive: { backgroundColor: '#00D4FF', borderColor: '#00D4FF' },
  posBtnText: { color: '#FFFFFF', fontSize: 13 },
  posBtnTextActive: { fontWeight: '700' },
  btnPrimary: { backgroundColor: '#00D4FF', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  btnPrimaryText: { color: '#0A1628', fontSize: 16, fontWeight: '700' },
  loginText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center' },
});
