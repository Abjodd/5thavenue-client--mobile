import React, { useEffect } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { Redirect, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../src/context/AuthContext";
import { Aurora, Seal, TAGLINE } from "../src/ui/brand";
import { Tap, thud } from "../src/ui/primitives";
import { fonts, midnight, radius } from "../src/ui/theme";

const ease = Easing.out(Easing.cubic);

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();

  // The halo behind the seal breathes slowly.
  const breath = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 3200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [reduced, breath]);
  const halo = useAnimatedStyle(() => ({
    opacity: 0.15 + breath.value * 0.5,
    transform: [{ scale: 1 + breath.value * 0.1 }],
  }));

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/overview" />;
  }

  const sealSize = Math.min(190, Math.round(width * 0.46));

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Aurora width={width} height={height} />
      <View pointerEvents="none" style={styles.veil} />

      <View style={[styles.page, { paddingTop: insets.top + 22, paddingBottom: Math.max(insets.bottom, 20) + 14 }]}>
        <Animated.Text entering={FadeIn.duration(900)} style={styles.wordmark}>
          Fifth Avenue
        </Animated.Text>

        <View style={styles.middle}>
          <Animated.View entering={FadeIn.delay(200).duration(1200)} style={styles.sealWrap}>
            <Animated.View
              style={[
                styles.halo,
                { width: sealSize * 1.28, height: sealSize * 1.28, borderRadius: sealSize },
                halo,
              ]}
            />
            <Seal size={sealSize} />
          </Animated.View>

          <Animated.Text
            entering={FadeInDown.delay(550).duration(800).easing(ease)}
            style={styles.headline}
            accessibilityRole="header"
          >
            Every campaign,{"\n"}as it happens.
          </Animated.Text>

          <Animated.View entering={FadeIn.delay(1000).duration(700)} style={styles.rule} />

          <Animated.Text entering={FadeIn.delay(1150).duration(800)} style={styles.tagline}>
            {TAGLINE.join(". ")}.
          </Animated.Text>
        </View>

        <Animated.View entering={FadeInUp.delay(1400).duration(700).easing(ease)}>
          <Tap
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            haptic={false}
            onPress={() => {
              thud();
              router.push("/(auth)/login");
            }}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>Sign in</Text>
            <View style={styles.ctaArrow}>
              <Ionicons name="arrow-forward" size={18} color={midnight.text} />
            </View>
          </Tap>
          <Text style={styles.footnote}>
            No account yet? Your Fifth Avenue account manager can set one up.
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: midnight.top },
  veil: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,28,0.42)" },
  page: {
    flex: 1,
    paddingHorizontal: 26,
    maxWidth: 560,
    width: "100%",
    alignSelf: "center",
  },
  wordmark: {
    fontFamily: fonts.serifMedium,
    fontSize: 20,
    letterSpacing: 0.3,
    color: midnight.text,
    textAlign: "center",
  },
  middle: { flex: 1, alignItems: "center", justifyContent: "center" },
  sealWrap: { alignItems: "center", justifyContent: "center", marginBottom: 34 },
  halo: { position: "absolute", borderWidth: 1, borderColor: "rgba(244,194,107,0.5)" },
  headline: {
    fontFamily: fonts.serif,
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: -1.1,
    color: midnight.text,
    textAlign: "center",
  },
  rule: { width: 44, height: 1.5, backgroundColor: midnight.lamp, marginTop: 22, marginBottom: 16 },
  tagline: {
    fontFamily: fonts.serifItalic,
    fontSize: 18,
    lineHeight: 24,
    color: midnight.muted,
    textAlign: "center",
  },
  cta: {
    height: 62,
    borderRadius: radius.pill,
    backgroundColor: midnight.text,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 28,
    paddingRight: 9,
  },
  ctaText: { fontFamily: fonts.sansSemi, fontSize: 16, color: "#0A0F3A" },
  ctaArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0A0F3A",
    alignItems: "center",
    justifyContent: "center",
  },
  footnote: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: midnight.faint,
    textAlign: "center",
    marginTop: 14,
  },
});
