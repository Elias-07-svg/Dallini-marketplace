import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { DemoSessionProvider } from '@/context/demo-session';
import { SupabaseAuthProvider } from '@/context/supabase-auth';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SupabaseAuthProvider>
        <DemoSessionProvider>
          <AnimatedSplashOverlay />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#F6F8F7' },
            }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="auth" />
            <Stack.Screen name="request" />
            <Stack.Screen name="review" />
            <Stack.Screen name="owner" />
            <Stack.Screen name="customer" />
          </Stack>
        </DemoSessionProvider>
      </SupabaseAuthProvider>
    </ThemeProvider>
  );
}
