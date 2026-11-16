import React from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

// A pane of "liquid glass": blurred backdrop, a soft sheen across the top,
// a bright rim, and a shadow that lifts it off the page.
export function Glass({
  children,
  radius = 28,
  dark,
  style,
  contentStyle,
  strength = 0.4,
}: {
  children?: React.ReactNode;
  radius?: number;
  /** True when the glass sits over dark content. */
  dark?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** 0..1, how frosted the pane is. */
  strength?: number;
}) {
  const fill = dark
    ? `rgba(28,30,48,${0.2 + 0.4 * strength})`
    : `rgba(255,255,255,${0.14 + 0.46 * strength})`;
  // Android's blur is costly and uneven, so it gets a more opaque fill instead.
  const androidFill = dark ? "rgba(28,30,48,0.92)" : "rgba(252,250,245,0.94)";

  return (
    <View
      style={[
        {
          borderRadius: radius,
          shadowColor: dark ? "#000000" : "#191611",
          shadowOpacity: dark ? 0.45 : 0.14,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 12 },
          elevation: 12,
        },
        style,
      ]}
    >
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }]}>
        {Platform.OS === "android" ? null : (
          <BlurView intensity={70} tint={dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        )}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: Platform.OS === "android" ? androidFill : fill },
          ]}
        />
        <LinearGradient
          pointerEvents="none"
          colors={
            dark
              ? ["rgba(255,255,255,0.16)", "rgba(255,255,255,0.02)", "rgba(255,255,255,0.06)"]
              : ["rgba(255,255,255,0.6)", "rgba(255,255,255,0.04)", "rgba(255,255,255,0.28)"]
          }
          locations={[0, 0.45, 1]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: radius,
              borderWidth: 1,
              borderColor: dark ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.9)",
            },
          ]}
        />
      </View>
      <View style={contentStyle}>{children}</View>
    </View>
  );
}
