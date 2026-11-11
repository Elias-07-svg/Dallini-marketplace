import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { CustomerFavoritesProvider } from '@/context/customer-favorites';
import { DemoSessionProvider } from '@/context/demo-session';
import { SupabaseAuthProvider } from '@/context/supabase-auth';
import {
  isPasswordRecoveryLink,
  publishPasswordRecoveryLink,
} from '@/lib/pending-password-recovery-link';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    let isMounted = true;
    const captureRecoveryUrl = (url: string | null) => {
      if (isMounted && url && isPasswordRecoveryLink(url)) {
        publishPasswordRecoveryLink(url);
      }
    };

    const subscription = Linking.addEventListener('url', ({ url }) => {
      captureRecoveryUrl(url);
    });
    void Linking.getInitialURL().then(captureRecoveryUrl).catch(() => undefined);

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SupabaseAuthProvider>
        <CustomerFavoritesProvider>
          <DemoSessionProvider>
            <AnimatedSplashOverlay />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#F6F8F7' },
              }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="auth" />
              <Stack.Screen name="reset-password" />
              <Stack.Screen name="request" />
              <Stack.Screen name="review" />
              <Stack.Screen name="owner" />
              <Stack.Screen name="customer" />
            </Stack>
          </DemoSessionProvider>
        </CustomerFavoritesProvider>
      </SupabaseAuthProvider>
    </ThemeProvider>
  );
}
