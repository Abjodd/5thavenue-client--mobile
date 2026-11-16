import React, { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, Path, RadialGradient, Stop, Text as SvgText, TextPath } from "react-native-svg";

import { useAppTheme } from "../context/ThemeContext";
import { fonts, midnight } from "./theme";

export const TAGLINE = ["Creative", "Connected", "Influential"] as const;

// ---------------------------------------------------------------------------
// Seal: the VA monogram inside a slowly turning ring of lettering
// ---------------------------------------------------------------------------

export function Seal({
  size = 72,
  color = midnight.text,
  accent = midnight.lamp,
  spin = true,
}: {
  size?: number;
  color?: string;
  accent?: string;
  spin?: boolean;
}) {
  const reduced = useReducedMotion();
  const turn = useSharedValue(0);

  useEffect(() => {
    if (!spin || reduced) return;
    turn.value = withRepeat(withTiming(1, { duration: 22000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(turn);
  }, [spin, reduced, turn]);

  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));

  // Lettering sits on a circle drawn in a 100 x 100 box.
  const r = 41;
  const d = `M 50 50 m -${r} 0 a ${r} ${r} 0 1 1 ${r * 2} 0 a ${r} ${r} 0 1 1 -${r * 2} 0`;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Fifth Avenue"
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      <Animated.View style={[StyleSheet.absoluteFill, ring]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <Path id="sealRing" d={d} />
          </Defs>
          <Circle cx={50} cy={50} r={49} stroke={accent} strokeWidth={0.6} fill="none" opacity={0.7} />
          <Circle cx={50} cy={50} r={32} stroke={accent} strokeWidth={0.6} fill="none" opacity={0.45} />
          <SvgText fill={color} fontSize={8} fontFamily={fonts.sansSemi} letterSpacing={4.2}>
            <TextPath href="#sealRing" startOffset="0%">
              FIFTH AVENUE ✦ FIFTH AVENUE ✦
            </TextPath>
          </SvgText>
        </Svg>
      </Animated.View>
      <Image
        source={require("../../assets/images/va-logo.png")}
        style={{ width: size * 0.5, height: size * 0.5 }}
        tintColor={color}
        resizeMode="contain"
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Marquee: a band of words that never stops moving
// ---------------------------------------------------------------------------

export function Marquee({
  words = ["Fifth Avenue", ...TAGLINE],
  color = "#0A0F3A",
  background = midnight.lamp,
  speed = 38,
  tilt = 0,
  textStyle,
  style,
}: {
  words?: readonly string[];
  color?: string;
  background?: string;
  /** Pixels per second. */
  speed?: number;
  tilt?: number;
  textStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const [runWidth, setRunWidth] = useState(0);
  const x = useSharedValue(0);

  useEffect(() => {
    if (runWidth <= 0 || reduced) return;
    x.value = 0;
    x.value = withRepeat(
      withTiming(-runWidth, { duration: (runWidth / speed) * 1000, easing: Easing.linear }),
      -1,
      false
    );
    return () => cancelAnimation(x);
  }, [runWidth, speed, reduced, x]);

  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const run = (key: string, measure?: boolean) => (
    <View
      key={key}
      style={styles.marqueeRun}
      onLayout={measure ? (event) => setRunWidth(event.nativeEvent.layout.width) : undefined}
    >
      {words.map((word, index) => (
        <View key={`${word}-${index}`} style={styles.marqueeItem}>
          <Text style={[styles.marqueeText, { color }, textStyle]}>{word}</Text>
          <View style={[styles.marqueeGem, { backgroundColor: color }]} />
        </View>
      ))}
    </View>
  );

  return (
    <View
      accessible
      accessibilityLabel={words.join(", ")}
      style={[
        styles.marquee,
        { backgroundColor: background, transform: [{ rotate: `${tilt}deg` }] },
        style,
      ]}
    >
      <Animated.View style={[{ flexDirection: "row" }, slide]}>
        {run("a", true)}
        {run("b")}
        {run("c")}
        {run("d")}
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// RollingNumber: each digit spins into place like a departure board
// ---------------------------------------------------------------------------

const DIGITS = Array.from({ length: 20 }, (_, index) => index % 10);

function RollingDigit({
  digit,
  height,
  delay,
  textStyle,
}: {
  digit: number;
  height: number;
  delay: number;
  textStyle: StyleProp<TextStyle>;
}) {
  const reduced = useReducedMotion();
  const y = useSharedValue(0);

  useEffect(() => {
    const target = -(10 + digit) * height;
    y.value = reduced
      ? target
      : withDelay(delay, withTiming(target, { duration: 1700, easing: Easing.out(Easing.exp) }));
  }, [digit, height, delay, reduced, y]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <View style={{ height, overflow: "hidden" }}>
      <Animated.View style={style}>
        {DIGITS.map((value, index) => (
          <Text key={index} style={[textStyle, { height, lineHeight: height, textAlign: "center" }]}>
            {value}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

export function RollingNumber({
  text,
  fontSize,
  color,
  fontFamily = fonts.serif,
  style,
}: {
  text: string;
  fontSize: number;
  color: string;
  fontFamily?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const height = Math.round(fontSize * 1.08);
  const textStyle: TextStyle = {
    fontFamily,
    fontSize,
    color,
    letterSpacing: -fontSize * 0.035,
    fontVariant: ["tabular-nums"],
  };
  const chars = text.split("");
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={text}
      style={[{ flexDirection: "row", alignItems: "flex-end" }, style]}
    >
      {chars.map((char, index) =>
        /\d/.test(char) ? (
          <RollingDigit
            key={`${index}-d`}
            digit={Number(char)}
            height={height}
            delay={index * 110}
            textStyle={textStyle}
          />
        ) : (
          <Text key={`${index}-${char}`} style={[textStyle, { height, lineHeight: height }]}>
            {char}
          </Text>
        )
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Aurora: slow drifting light on a midnight ground
// ---------------------------------------------------------------------------

function Orb({
  id,
  color,
  size,
  left,
  top,
  drift,
  duration,
  opacity,
}: {
  id: string;
  color: string;
  size: number;
  left: number;
  top: number;
  drift: number;
  duration: number;
  opacity: number;
}) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    return () => cancelAnimation(t);
  }, [duration, reduced, t]);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: (t.value - 0.5) * drift },
      { translateY: (0.5 - t.value) * drift * 0.7 },
      { scale: 0.9 + t.value * 0.25 },
    ],
  }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", left, top }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

export function Aurora({ width, height }: { width: number; height: number }) {
  const big = Math.max(width, 320);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[midnight.top, "#070B33", "#141F5A"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Orb id="orbGold" color="#F4C26B" size={big * 0.95} left={width * 0.38} top={-big * 0.42} drift={70} duration={7000} opacity={0.55} />
      <Orb id="orbBlue" color="#4F7DF0" size={big * 1.05} left={-big * 0.5} top={height * 0.18} drift={90} duration={9000} opacity={0.5} />
      <Orb id="orbRose" color="#2F49B8" size={big * 0.8} left={width * 0.3} top={height * 0.55} drift={80} duration={11000} opacity={0.38} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Loader and footer
// ---------------------------------------------------------------------------

export function BrandLoader() {
  const { colors } = useAppTheme();
  const pulse = useSharedValue(0.45);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(pulse);
  }, [pulse]);
  const fade = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={[styles.loader, { backgroundColor: colors.background }]}
    >
      <Seal size={104} color={colors.text} accent={colors.gold} />
      <Animated.Text style={[styles.loaderText, { color: colors.text2 }, fade]}>
        One moment
      </Animated.Text>
    </View>
  );
}

export function BrandFooter() {
  const { colors } = useAppTheme();
  return (
    <View style={styles.footer}>
      <Seal size={58} color={colors.text2} accent={colors.gold} />
      <Text style={[styles.footerMark, { color: colors.text }]}>Fifth Avenue</Text>
      <Text style={[styles.footerLine, { color: colors.muted }]}>{TAGLINE.join(". ")}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  marquee: { overflow: "hidden", paddingVertical: 9 },
  marqueeRun: { flexDirection: "row" },
  marqueeItem: { flexDirection: "row", alignItems: "center" },
  marqueeText: { fontFamily: fonts.serifItalic, fontSize: 17, lineHeight: 22 },
  marqueeGem: {
    width: 6,
    height: 6,
    marginHorizontal: 14,
    transform: [{ rotate: "45deg" }],
    opacity: 0.75,
  },
  loader: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18 },
  loaderText: { fontFamily: fonts.serifItalic, fontSize: 16 },
  footer: { alignItems: "center", gap: 6, paddingTop: 28, paddingBottom: 4 },
  footerMark: { fontFamily: fonts.serifMedium, fontSize: 18, marginTop: 4 },
  footerLine: { fontFamily: fonts.serifItalic, fontSize: 14 },
});
