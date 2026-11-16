import { useEffect } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { Newsreader_400Regular } from "@expo-google-fonts/newsreader/400Regular";
import { Newsreader_400Regular_Italic } from "@expo-google-fonts/newsreader/400Regular_Italic";
import { Newsreader_500Medium } from "@expo-google-fonts/newsreader/500Medium";
import { Sora_400Regular } from "@expo-google-fonts/sora/400Regular";
import { Sora_500Medium } from "@expo-google-fonts/sora/500Medium";
import { Sora_600SemiBold } from "@expo-google-fonts/sora/600SemiBold";

import { AuthProvider } from "../src/context/AuthContext";
import { ThemeProvider, useAppTheme } from "../src/context/ThemeContext";
import { midnight } from "../src/ui/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

function Shell() {
  const { isThemeReady, colors } = useAppTheme();
  const [fontsLoaded, fontError] = useFonts({
    Newsreader_400Regular,
    Newsreader_400Regular_Italic,
    Newsreader_500Medium,
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
  });

  const ready = (fontsLoaded || !!fontError) && isThemeReady;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: midnight.top }} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade",
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ contentStyle: { backgroundColor: midnight.top } }} />
      <Stack.Screen name="(auth)" options={{ contentStyle: { backgroundColor: midnight.top } }} />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </ThemeProvider>
  );
}
