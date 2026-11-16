import React, { useEffect, useMemo, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { useAppTheme } from "../context/ThemeContext";
import { T, tick } from "./primitives";
import { fonts } from "./theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ---------------------------------------------------------------------------
// Ring: a single arc that draws itself in
// ---------------------------------------------------------------------------

export function Ring({
  size,
  stroke = 10,
  value,
  color,
  track,
  delay = 0,
}: {
  size: number;
  stroke?: number;
  value: number; // 0..100
  color: string;
  track: string;
  delay?: number;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(clamped / 100, { duration: 1100, easing: Easing.out(Easing.cubic) })
    );
  }, [clamped, delay, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      <AnimatedCircle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={`${circumference} ${circumference}`}
        strokeLinecap="round"
        fill="none"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Donut: segments sweep in one after another
// ---------------------------------------------------------------------------

function DonutSegment({
  sweep,
  start,
  length,
  circumference,
  color,
  r,
  stroke,
}: {
  sweep: SharedValue<number>;
  start: number; // 0..1
  length: number; // 0..1
  circumference: number;
  color: string;
  r: number;
  stroke: number;
}) {
  const animatedProps = useAnimatedProps(() => {
    const visible = Math.max(0, Math.min(length, sweep.value - start));
    return {
      strokeDasharray: [Math.max(0, visible * circumference - 2.5), circumference],
    };
  });
  return (
    <AnimatedCircle
      cx={50}
      cy={50}
      r={r}
      stroke={color}
      strokeWidth={stroke}
      strokeDashoffset={-start * circumference}
      strokeLinecap="butt"
      fill="none"
      transform="rotate(-90 50 50)"
      animatedProps={animatedProps}
    />
  );
}

export function Donut({
  size = 132,
  values,
  colors,
  track,
  children,
}: {
  size?: number;
  values: number[];
  colors: string[];
  track: string;
  children?: React.ReactNode;
}) {
  const r = 40;
  const stroke = 11;
  const circumference = 2 * Math.PI * r;
  const total = values.reduce((sum, value) => sum + value, 0);
  const sweep = useSharedValue(0);

  useEffect(() => {
    sweep.value = 0;
    sweep.value = withDelay(200, withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) }));
  }, [total, sweep]);

  let cursor = 0;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute" }}>
        <Circle cx={50} cy={50} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        {total > 0
          ? values.map((value, index) => {
              const length = value / total;
              const start = cursor;
              cursor += length;
              return (
                <DonutSegment
                  key={index}
                  sweep={sweep}
                  start={start}
                  length={length}
                  circumference={circumference}
                  color={colors[index % colors.length]}
                  r={r}
                  stroke={stroke}
                />
              );
            })
          : null}
      </Svg>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// TrendLine: smooth area chart that wipes in and can be scrubbed by touch
// ---------------------------------------------------------------------------

function smoothPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    const midX = (current.x + next.x) / 2;
    d += ` C ${midX} ${current.y}, ${midX} ${next.y}, ${next.x} ${next.y}`;
  }
  return d;
}

export function TrendLine({
  data,
  height = 150,
  color,
  onMidnight,
  formatValue,
  formatLabel,
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  onMidnight?: boolean;
  formatValue: (value: number) => string;
  formatLabel: (label: string) => string;
}) {
  const { colors } = useAppTheme();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const stroke = color ?? (onMidnight ? "#F4C26B" : colors.accent);
  const textColor = onMidnight ? "rgba(246,244,238,0.66)" : colors.muted;
  const gridColor = onMidnight ? "rgba(246,244,238,0.12)" : colors.border;

  const padTop = 28;
  const padBottom = 8;

  const points = useMemo(() => {
    if (width <= 0 || data.length === 0) return [];
    const max = Math.max(1, ...data.map((item) => item.value));
    const min = Math.min(...data.map((item) => item.value));
    const floor = min === max ? 0 : Math.max(0, min - (max - min) * 0.25);
    const span = Math.max(1, max - floor);
    return data.map((item, index) => ({
      x: data.length === 1 ? width / 2 : (index / (data.length - 1)) * (width - 16) + 8,
      y: padTop + (1 - (item.value - floor) / span) * (height - padTop - padBottom),
    }));
  }, [data, width, height]);

  const reveal = useSharedValue(0);
  const signature = `${data.length}:${data[0]?.label}:${data[data.length - 1]?.value}:${width}`;
  useEffect(() => {
    if (width <= 0) return;
    reveal.value = 0;
    reveal.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) });
  }, [signature, reveal, width]);

  const wipe = useAnimatedStyle(() => ({ width: reveal.value * width }));

  const line = smoothPath(points);
  const area =
    points.length > 1
      ? `${line} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`
      : "";

  const scrub = (x: number) => {
    if (points.length === 0) return;
    let nearest = 0;
    let best = Infinity;
    points.forEach((point, index) => {
      const distance = Math.abs(point.x - x);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    setActive((previous) => {
      if (previous !== nearest) tick();
      return nearest;
    });
  };

  const shown = active != null && points[active] ? active : points.length - 1;
  const marker = points[shown];

  return (
    <View
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      style={{ height }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(event) => scrub(event.nativeEvent.locationX)}
      onResponderMove={(event) => scrub(event.nativeEvent.locationX)}
      onResponderRelease={() => setActive(null)}
      onResponderTerminate={() => setActive(null)}
      accessibilityLabel="Trend chart. Touch and drag to read values."
    >
      {[0.33, 0.66, 1].map((fraction) => (
        <View
          key={fraction}
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: padTop + (height - padTop - padBottom) * fraction,
            height: 1,
            backgroundColor: gridColor,
          }}
        />
      ))}

      {width > 0 && points.length > 1 ? (
        <Animated.View pointerEvents="none" style={[{ height, overflow: "hidden" }, wipe]}>
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={stroke} stopOpacity={0.32} />
                <Stop offset="1" stopColor={stroke} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={area} fill="url(#trendFill)" />
            <Path d={line} stroke={stroke} strokeWidth={2.5} fill="none" strokeLinecap="round" />
          </Svg>
        </Animated.View>
      ) : null}

      {marker && data[shown] ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
          {active != null ? (
            <View
              style={{
                position: "absolute",
                left: marker.x - 0.5,
                top: padTop - 6,
                bottom: 0,
                width: 1,
                backgroundColor: stroke,
                opacity: 0.45,
              }}
            />
          ) : null}
          <View
            style={{
              position: "absolute",
              left: marker.x - 6,
              top: marker.y - 6,
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: stroke,
              borderWidth: 2.5,
              borderColor: onMidnight ? "#0A0F3A" : colors.surface,
            }}
          />
          {active != null ? (
            <View
              style={{
                position: "absolute",
                top: 0,
                left: Math.max(0, Math.min(width - 150, marker.x - 75)),
                width: 150,
                alignItems: "center",
              }}
            >
              <T v="caption" color={textColor} style={{ fontFamily: fonts.sansMedium }} numberOfLines={1}>
                {formatLabel(data[shown].label)}: {formatValue(data[shown].value)}
              </T>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
