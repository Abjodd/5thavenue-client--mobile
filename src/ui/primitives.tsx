import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "../context/ThemeContext";
import { cardShadow, fonts, radius, space, springs } from "./theme";

export type IconName = keyof typeof Ionicons.glyphMap;

// ---------------------------------------------------------------------------
// Haptics
// ---------------------------------------------------------------------------

export function tick() {
  if (Platform.OS === "web") return;
  Haptics.selectionAsync().catch(() => {});
}

export function thud() {
  if (Platform.OS === "web") return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function notify(kind: "success" | "error") {
  if (Platform.OS === "web") return;
  Haptics.notificationAsync(
    kind === "success"
      ? Haptics.NotificationFeedbackType.Success
      : Haptics.NotificationFeedbackType.Error
  ).catch(() => {});
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

const TYPE = {
  display: { fontFamily: fonts.serif, fontSize: 40, lineHeight: 44, letterSpacing: -0.9 },
  title: { fontFamily: fonts.serifMedium, fontSize: 30, lineHeight: 35, letterSpacing: -0.5 },
  heading: { fontFamily: fonts.serifMedium, fontSize: 21, lineHeight: 27, letterSpacing: -0.2 },
  figure: { fontFamily: fonts.serifMedium, fontSize: 34, lineHeight: 39, letterSpacing: -0.6 },
  figureSm: { fontFamily: fonts.serifMedium, fontSize: 23, lineHeight: 28, letterSpacing: -0.3 },
  subhead: { fontFamily: fonts.sansSemi, fontSize: 15, lineHeight: 21 },
  body: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.sansMedium, fontSize: 14, lineHeight: 22 },
  label: { fontFamily: fonts.sansMedium, fontSize: 12.5, lineHeight: 17 },
  caption: { fontFamily: fonts.sans, fontSize: 11.5, lineHeight: 16 },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof TYPE;

export function T({
  v = "body",
  color,
  tone,
  style,
  ...rest
}: TextProps & {
  v?: TypeVariant;
  color?: string;
  tone?: "default" | "muted" | "faint" | "accent" | "danger" | "success";
}) {
  const { colors } = useAppTheme();
  const toneColor =
    tone === "muted"
      ? colors.text2
      : tone === "faint"
        ? colors.muted
        : tone === "accent"
          ? colors.accent
          : tone === "danger"
            ? colors.danger
            : tone === "success"
              ? colors.success
              : colors.text;
  return <Text {...rest} style={[TYPE[v], { color: color ?? toneColor }, style]} />;
}

// ---------------------------------------------------------------------------
// Tap: pressable with a spring and a haptic tick
// ---------------------------------------------------------------------------

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Tap({
  children,
  style,
  onPress,
  scaleTo = 0.97,
  haptic = true,
  disabled,
  ...rest
}: Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: boolean;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={() => {
        scale.value = withSpring(scaleTo, springs.press);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, springs.press);
      }}
      onPress={(event: GestureResponderEvent) => {
        if (haptic) tick();
        onPress?.(event);
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}

// ---------------------------------------------------------------------------
// Reveal: one staggered entrance per screen load
// ---------------------------------------------------------------------------

export function Reveal({
  index = 0,
  children,
  style,
}: {
  index?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 55)
        .duration(460)
        .easing(Easing.out(Easing.cubic))}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export function Card({
  children,
  style,
  flat,
  pad = space.lg,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  flat?: boolean;
  pad?: number;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: pad,
        },
        !flat && cardShadow(colors),
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Hairline({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong },
        style,
      ]}
    />
  );
}

export function SectionTitle({
  title,
  note,
  right,
}: {
  title: string;
  note?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionTitle}>
      <View style={{ flex: 1 }}>
        <T v="heading">{title}</T>
        {note ? (
          <T v="caption" tone="faint" style={{ marginTop: 2 }}>
            {note}
          </T>
        ) : null}
      </View>
      {right}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Pills and badges
// ---------------------------------------------------------------------------

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "purple";

export function useTone(tone: Tone) {
  const { colors } = useAppTheme();
  switch (tone) {
    case "accent":
      return { fg: colors.accent, bg: colors.accentMuted };
    case "success":
      return { fg: colors.success, bg: colors.successMuted };
    case "warning":
      return { fg: colors.warning, bg: colors.warningMuted };
    case "danger":
      return { fg: colors.danger, bg: colors.dangerMuted };
    case "purple":
      return { fg: colors.purple, bg: colors.accentMuted };
    default:
      return { fg: colors.text2, bg: colors.well };
  }
}

export function PulseDot({ color, size = 7 }: { color: string; size?: number }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }),
      -1,
      false
    );
  }, [pulse]);
  const halo = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 1.8 }],
  }));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={[
          { position: "absolute", width: size, height: size, borderRadius: size, backgroundColor: color },
          halo,
        ]}
      />
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}

export function Pill({
  label,
  tone = "neutral",
  icon,
  live,
  style,
}: {
  label: string;
  tone?: Tone;
  icon?: IconName;
  live?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { fg, bg } = useTone(tone);
  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      {live ? <PulseDot color={fg} /> : icon ? <Ionicons name={icon} size={12} color={fg} /> : null}
      <T v="caption" color={fg} style={{ fontFamily: fonts.sansMedium }} numberOfLines={1}>
        {label}
      </T>
    </View>
  );
}

export function IconBadge({
  icon,
  tone = "accent",
  size = 38,
}: {
  icon: IconName;
  tone?: Tone;
  size?: number;
}) {
  const { fg, bg } = useTone(tone);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.34,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={icon} size={size * 0.47} color={fg} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Avatars
// ---------------------------------------------------------------------------

/** First letter or digit of a name, skipping symbols and emoji. */
export function initialOf(name: string): string {
  const match = name.match(/[\p{L}\p{N}]/u);
  return (match ? match[0] : "?").toUpperCase();
}

const AVATAR_FILLS = ["#1B2A5C", "#B8862B", "#2C3E7E", "#178E80", "#6C55CE"];

export function AvatarStack({
  names,
  max = 4,
  size = 32,
  ring,
}: {
  names: string[];
  max?: number;
  size?: number;
  /** Colour of the gap between overlapping avatars; use the card's background. */
  ring?: string;
}) {
  const { colors } = useAppTheme();
  const edge = ring ?? colors.surface;
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  const circle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 2,
    borderColor: edge,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };
  if (names.length === 0) return null;
  return (
    <View
      accessible
      accessibilityLabel={`${names.length} creator${names.length === 1 ? "" : "s"}`}
      style={{ flexDirection: "row", alignItems: "center" }}
    >
      {shown.map((name, index) => (
        <View
          key={`${name}-${index}`}
          style={[
            circle,
            {
              backgroundColor: AVATAR_FILLS[index % AVATAR_FILLS.length],
              marginLeft: index === 0 ? 0 : -size * 0.3,
            },
          ]}
        >
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: size * 0.38, color: "#FFFFFF" }}>
            {initialOf(name)}
          </Text>
        </View>
      ))}
      {extra > 0 ? (
        <View style={[circle, { backgroundColor: colors.surfaceSecondary, marginLeft: -size * 0.3, width: undefined, minWidth: size, paddingHorizontal: 6 }]}>
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: size * 0.34, color: colors.text }}>
            +{extra}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

export function Button({
  label,
  onPress,
  icon,
  kind = "primary",
  loading,
  disabled,
  style,
  small,
}: {
  label: string;
  onPress?: () => void;
  icon?: IconName;
  kind?: "primary" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const { colors } = useAppTheme();
  const bg =
    kind === "primary" ? colors.accent : kind === "danger" ? colors.dangerMuted : colors.well;
  const fg =
    kind === "primary" ? colors.onAccent : kind === "danger" ? colors.danger : colors.text;
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.5 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={small ? 15 : 17} color={fg} /> : null}
          <T v={small ? "label" : "subhead"} color={fg}>
            {label}
          </T>
        </>
      )}
    </Tap>
  );
}

// ---------------------------------------------------------------------------
// Segmented control with a sliding thumb
// ---------------------------------------------------------------------------

export function Segmented<V extends string>({
  options,
  value,
  onChange,
  style,
  onMidnight,
}: {
  options: readonly { value: V; label: string }[];
  value: V;
  onChange: (value: V) => void;
  style?: StyleProp<ViewStyle>;
  onMidnight?: boolean;
}) {
  const { colors } = useAppTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const segment = width > 0 ? (width - 6) / options.length : 0;
  const x = useSharedValue(0);

  useEffect(() => {
    x.value = withSpring(index * segment, springs.snappy);
  }, [index, segment, x]);

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      style={[
        styles.segmented,
        { backgroundColor: onMidnight ? "rgba(255,255,255,0.10)" : colors.well },
        style,
      ]}
    >
      {segment > 0 ? (
        <Animated.View
          style={[
            styles.segmentedThumb,
            {
              width: segment,
              backgroundColor: onMidnight ? "rgba(255,255,255,0.92)" : colors.surface,
            },
            !onMidnight && cardShadow(colors),
            thumb,
          ]}
        />
      ) : null}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (!active) {
                tick();
                onChange(option.value);
              }
            }}
            style={styles.segmentedItem}
          >
            <T
              v="label"
              numberOfLines={1}
              color={
                onMidnight
                  ? active
                    ? "#0A0F3A"
                    : "rgba(246,244,238,0.72)"
                  : active
                    ? colors.text
                    : colors.muted
              }
            >
              {option.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Animated meter and count-up number
// ---------------------------------------------------------------------------

export function Meter({
  value,
  color,
  track,
  height = 6,
  delay = 150,
}: {
  value: number; // 0..100
  color?: string;
  track?: string;
  height?: number;
  delay?: number;
}) {
  const { colors } = useAppTheme();
  const progress = useSharedValue(0);
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(clamped, { duration: 900, easing: Easing.out(Easing.cubic) })
    );
  }, [clamped, delay, progress]);
  const fill = useAnimatedStyle(() => ({ width: `${progress.value}%` }));
  return (
    <View
      style={{
        height,
        borderRadius: height,
        backgroundColor: track ?? colors.well,
        overflow: "hidden",
      }}
    >
      <Animated.View
        style={[{ height, borderRadius: height, backgroundColor: color ?? colors.accent }, fill]}
      />
    </View>
  );
}

/** Counts up to `value`, then renders the exact formatted figure. */
export function CountUp({
  value,
  format,
  duration = 900,
  ...text
}: Omit<React.ComponentProps<typeof T>, "children"> & {
  value: number | null | undefined;
  format: (value: number) => string;
  duration?: number;
}) {
  const valid = value != null && Number.isFinite(value);
  const [shown, setShown] = useState<number>(0);
  const from = useRef(0);

  useEffect(() => {
    if (!valid) return;
    const target = value as number;
    const start = from.current;
    const startedAt = Date.now();
    let frame = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - startedAt) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = start + (target - start) * eased;
      setShown(t >= 1 ? target : next);
      if (t < 1) frame = requestAnimationFrame(step);
      else from.current = target;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, valid, duration]);

  return <T {...text}>{valid ? format(shown) : "—"}</T>;
}

// ---------------------------------------------------------------------------
// Loading, empty and error states
// ---------------------------------------------------------------------------

export function Skeleton({
  height = 16,
  width = "100%",
  round = radius.sm,
  style,
}: {
  height?: number;
  width?: number | `${number}%`;
  round?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();
  const pulse = useSharedValue(0.45);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 850, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [pulse]);
  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View
      style={[{ height, width, borderRadius: round, backgroundColor: colors.well }, animated, style]}
    />
  );
}

/** Full-screen loading state: the Fifth Avenue seal, turning. */
export function ScreenSkeleton(_props: { hero?: boolean }) {
  const { BrandLoader } = require("./brand") as typeof import("./brand");
  return <BrandLoader />;
}

export function EmptyState({
  icon = "folder-open-outline",
  title,
  message,
  action,
}: {
  icon?: IconName;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <Animated.View entering={FadeIn.duration(350)} style={styles.empty}>
      <View style={[styles.emptyIcon, { borderColor: colors.borderStrong }]}>
        <Ionicons name={icon} size={22} color={colors.text2} />
      </View>
      <T v="heading" style={{ textAlign: "center" }}>
        {title}
      </T>
      {message ? (
        <T tone="muted" style={{ textAlign: "center", maxWidth: 300 }}>
          {message}
        </T>
      ) : null}
      {action}
    </Animated.View>
  );
}

export function ErrorState({
  title,
  message,
  onRetry,
}: {
  title: string;
  message?: string;
  onRetry?: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <EmptyState
        icon="cloud-offline-outline"
        title={title}
        message={message}
        action={
          onRetry ? (
            <Button label="Try again" icon="refresh" onPress={onRetry} style={{ marginTop: space.sm }} />
          ) : undefined
        }
      />
    </View>
  );
}

export function InlineError({ message }: { message: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.inlineError, { backgroundColor: colors.dangerMuted }]}>
      <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
      <T v="label" color={colors.danger} style={{ flex: 1 }}>
        {message}
      </T>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen scaffold
// ---------------------------------------------------------------------------

/** Space the floating tab bar needs at the bottom of a scroll view. */
export function useTabBarSpace() {
  const insets = useSafeAreaInsets();
  return 86 + Math.max(insets.bottom, 12);
}

/** Space the floating glass header covers at the top of a screen. */
export function useHeaderSpace() {
  const insets = useSafeAreaInsets();
  return insets.top + 8 + 58;
}

export function ScreenScroll({
  children,
  refreshing,
  onRefresh,
  contentStyle,
  scrollRef,
  footer = true,
  ...rest
}: Omit<React.ComponentProps<typeof Animated.ScrollView>, "children" | "ref"> & {
  footer?: boolean;
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  scrollRef?: React.Ref<Animated.ScrollView>;
}) {
  const { colors } = useAppTheme();
  const bottom = useTabBarSpace();
  const top = useHeaderSpace();
  return (
    <Animated.ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        { padding: space.xl, paddingTop: top + space.md, paddingBottom: bottom + space.lg, gap: space.lg },
        contentStyle,
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressViewOffset={top}
          />
        ) : undefined
      }
      {...rest}
    >
      {children}
      {footer ? <ScreenFooter /> : null}
    </Animated.ScrollView>
  );
}

function ScreenFooter() {
  const { BrandFooter } = require("./brand") as typeof import("./brand");
  return <BrandFooter />;
}

export function ScreenTitle({ title, note }: { title: string; note?: string }) {
  return (
    <Reveal>
      <T v="title">{title}</T>
      {note ? (
        <T tone="muted" style={{ marginTop: 4 }}>
          {note}
        </T>
      ) : null}
    </Reveal>
  );
}

// ---------------------------------------------------------------------------
// Bottom sheet
// ---------------------------------------------------------------------------

export function Sheet({
  visible,
  onClose,
  title,
  children,
  full,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.sheetRoot, { backgroundColor: colors.overlay }]}>
        <Pressable
          accessibilityLabel="Close"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <Animated.View
          entering={SlideInDown.duration(380).easing(Easing.out(Easing.cubic))}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              paddingBottom: Math.max(insets.bottom, 16),
              maxHeight: full ? "94%" : "86%",
            },
            full && { height: "94%" },
          ]}
        >
          <View style={[styles.sheetGrip, { backgroundColor: colors.borderStrong }]} />
          <View style={styles.sheetHeader}>
            <T v="heading" style={{ flex: 1 }} numberOfLines={2}>
              {title ?? ""}
            </T>
            <Tap
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={[styles.sheetClose, { backgroundColor: colors.well }]}
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </Tap>
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.md,
    marginTop: space.sm,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  button: {
    minHeight: 52,
    paddingHorizontal: 22,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonSmall: { minHeight: 38, paddingHorizontal: 16 },
  segmented: {
    flexDirection: "row",
    borderRadius: radius.pill,
    padding: 3,
    height: 40,
  },
  segmentedThumb: {
    position: "absolute",
    left: 3,
    top: 3,
    bottom: 3,
    borderRadius: radius.pill,
  },
  segmentedItem: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  empty: { alignItems: "center", gap: space.sm, paddingVertical: space.xxl, paddingHorizontal: space.lg },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.xs,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
  inlineError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: space.md,
    borderRadius: radius.md,
  },
  sheetRoot: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: 10,
  },
  sheetGrip: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, marginBottom: 6 },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  sheetClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
});
