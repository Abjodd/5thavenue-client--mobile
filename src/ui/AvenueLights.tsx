import React, { useEffect } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

import { midnight } from "./theme";

// The brand's signature backdrop: an avenue at night, seen down its length.
// Streaks of light leave a vanishing point and speed up as they approach,
// the way traffic does in a long exposure.

const STREAKS = [
  { angle: 24, color: "#9FB8FF", delay: 0, duration: 2600, thickness: 2 },
  { angle: 41, color: "#F4C26B", delay: 700, duration: 2200, thickness: 3 },
  { angle: 58, color: "#9FB8FF", delay: 1500, duration: 2900, thickness: 2 },
  { angle: 74, color: "#F4C26B", delay: 300, duration: 2000, thickness: 3 },
  { angle: 86, color: "#FFFFFF", delay: 1900, duration: 2400, thickness: 2 },
  { angle: 96, color: "#F4C26B", delay: 1100, duration: 2100, thickness: 3 },
  { angle: 108, color: "#9FB8FF", delay: 500, duration: 2700, thickness: 2 },
  { angle: 124, color: "#F4C26B", delay: 1700, duration: 2300, thickness: 3 },
  { angle: 140, color: "#FFFFFF", delay: 900, duration: 3000, thickness: 2 },
  { angle: 157, color: "#9FB8FF", delay: 2200, duration: 2500, thickness: 2 },
  { angle: -14, color: "#9FB8FF", delay: 1300, duration: 3400, thickness: 1.5 },
  { angle: 194, color: "#F4C26B", delay: 2600, duration: 3600, thickness: 1.5 },
];

function Streak({
  angle,
  color,
  delay,
  duration,
  thickness,
  reach,
  still,
}: (typeof STREAKS)[number] & { reach: number; still: boolean }) {
  const travel = useSharedValue(still ? 0.55 : 0);

  useEffect(() => {
    if (still) return;
    travel.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.in(Easing.quad) }), -1, false)
    );
  }, [delay, duration, still, travel]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(travel.value, [0, 0.12, 0.75, 1], [0, 0.95, 0.9, 0]),
    transform: [
      { translateX: travel.value * reach },
      { scaleX: 0.25 + travel.value * 2.2 },
    ],
  }));

  return (
    <View style={[styles.origin, { transform: [{ rotate: `${angle}deg` }] }]}>
      <Animated.View style={[{ width: 64, height: thickness, marginTop: -thickness / 2 }, style]}>
        <LinearGradient
          colors={["transparent", color]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1, borderRadius: thickness }}
        />
      </Animated.View>
    </View>
  );
}

export function AvenueLights({
  horizon = 0.36,
  intensity = 1,
  size,
}: {
  /** Vertical position of the vanishing point, as a fraction of the height. */
  horizon?: number;
  intensity?: number;
  /** Size of the panel to fill. Defaults to the whole window. */
  size?: { width: number; height: number };
}) {
  const window = useWindowDimensions();
  const width = size?.width ?? window.width;
  const height = size?.height ?? window.height;
  const reduced = useReducedMotion();
  const reach = Math.max(width, height) * 0.62;
  const glow = Math.min(width, 520) * 1.25;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[midnight.top, midnight.mid, midnight.bottom]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={{
          position: "absolute",
          left: width / 2 - glow / 2,
          top: height * horizon - glow / 2,
          opacity: intensity,
        }}
      >
        <Svg width={glow} height={glow}>
          <Defs>
            <RadialGradient id="avenueGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#F4C26B" stopOpacity={0.42} />
              <Stop offset="0.35" stopColor="#5E8FE0" stopOpacity={0.16} />
              <Stop offset="1" stopColor="#00001C" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={glow / 2} cy={glow / 2} r={glow / 2} fill="url(#avenueGlow)" />
        </Svg>
      </View>
      <View
        style={{
          position: "absolute",
          left: width / 2,
          top: height * horizon,
          opacity: intensity,
        }}
      >
        {STREAKS.map((streak) => (
          <Streak key={streak.angle} {...streak} reach={reach} still={reduced} />
        ))}
      </View>
    </View>
  );
}

/** A soft lamp glow for the corner of a midnight panel. */
export function LampGlow({ size = 300 }: { size?: number }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", right: -size * 0.4, top: -size * 0.45 }}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="lampGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#F4C26B" stopOpacity={0.34} />
            <Stop offset="0.45" stopColor="#5E8FE0" stopOpacity={0.14} />
            <Stop offset="1" stopColor="#0A0F3A" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#lampGlow)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  origin: { position: "absolute", left: 0, top: 0, width: 0, height: 0 },
});
