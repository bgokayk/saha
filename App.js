import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { supabase } from './lib/supabase';
import { CartProvider } from './context/CartContext';

import SplashScreen from './screens/SplashScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import HomeScreen from './screens/HomeScreen';
import CreateMatchScreen from './screens/CreateMatchScreen';
import LineupScreen from './screens/LineupScreen';
import ProfileScreen from './screens/ProfileScreen';
import MatchListScreen from './screens/MatchListScreen';
import DiscoverScreen from './screens/DiscoverScreen';
import WalletScreen from './screens/WalletScreen';
import VenueAdminScreen from './screens/VenueAdminScreen';
import ChatListScreen from './screens/ChatListScreen';
import ChatScreen from './screens/ChatScreen';
import MarketScreen from './screens/MarketScreen';
import MatchRatingScreen from './screens/MatchRatingScreen';
import VenueDetailScreen from './screens/VenueDetailScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  // undefined = henüz kontrol edilmedi (loading)
  // null     = oturum yok
  // object   = aktif oturum
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Auth kontrol edilene kadar splash loader
  if (session === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: '#001F5B', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#00A0D2" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
    <CartProvider>
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{ headerShown: false, animation: 'fade_from_bottom' }}
      >
        {session ? (
          // --- Giriş yapılmış: Ana uygulama ---
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="CreateMatch" component={CreateMatchScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="Lineup" component={LineupScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="MatchList" component={MatchListScreen} />
            <Stack.Screen name="Discover" component={DiscoverScreen} />
            <Stack.Screen name="Wallet" component={WalletScreen} />
            <Stack.Screen name="VenueAdmin" component={VenueAdminScreen} />
            <Stack.Screen name="ChatList" component={ChatListScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="Market" component={MarketScreen} />
            <Stack.Screen name="MatchRating" component={MatchRatingScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="VenueDetail" component={VenueDetailScreen} options={{ animation: 'slide_from_right' }} />
          </>
        ) : (
          // --- Giriş yapılmamış: Auth akışı ---
          <>
            <Stack.Screen name="Splash" component={SplashScreen} options={{ animation: 'none' }} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ animation: 'slide_from_right' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
    </CartProvider>
    </SafeAreaProvider>
  );
}
