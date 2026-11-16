import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  FadeInRight,
  FadeOutUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, type Href } from "expo-router";

import { useAuth } from "../../src/context/AuthContext";
import { useAppTheme } from "../../src/context/ThemeContext";
import {
  getPortalAnalytics,
  getPortalCampaigns,
  getPortalReels,
  PortalAnalytics,
  PortalCampaign,
  PortalReel,
} from "../../src/lib/api";
import { Seal } from "../../src/ui/brand";
import { Donut, Ring, TrendLine } from "../../src/ui/charts";
import {
  Button,
  Card,
  CountUp,
  EmptyState,
  ErrorState,
  Hairline,
  AvatarStack,
  InlineError,
  Meter,
  Pill,
  PulseDot,
  Reveal,
  ScreenScroll,
  ScreenSkeleton,
  SectionTitle,
  Segmented,
  T,
  Tap,
  useTone,
  type IconName,
  type Tone,
} from "../../src/ui/primitives";
import { compactCount, rupees } from "../../src/ui/format";
import { cardShadow, fonts, midnight, radius, space } from "../../src/ui/theme";

function formatNumber(value: number | null | undefined): string {
  return compactCount(value);
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    notation: value >= 100000 ? "compact" : "standard",
  }).format(value);
}

function formatDate(value?: string): string {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getInitials(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

// --------------------------------------------------
// PERSONALIZED GREETING
// --------------------------------------------------

function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning,";
  if (hour >= 12 && hour < 17) return "Good afternoon,";
  if (hour >= 17 && hour < 21) return "Good evening,";
  return "Good night,";
}

function getGreetingMessage({
  campaignCount,
  liveCount,
  totalReach,
  totalImpressions,
  totalSpend,
}: {
  campaignCount: number;
  liveCount: number;
  totalReach: number;
  totalImpressions: number;
  totalSpend: number;
}): string {
  if (campaignCount === 0) {
    return "Your campaign space is ready. Your campaign updates will appear here once campaigns are added.";
  }

  if (liveCount > 0 && totalReach > 0) {
    return "Your campaigns are live and reaching audiences. Here's how your activity is performing.";
  }

  if (liveCount > 0) {
    return "Your campaigns are in motion. Check your latest campaign activity and performance below.";
  }

  if (totalReach > 0 || totalImpressions > 0) {
    return "Your campaign results are coming in. Here's a look at the activity recorded so far.";
  }

  if (totalSpend > 0) {
    return "Your campaign spend is being tracked. Explore the latest details and activity below.";
  }

  return "Here's your campaign overview, with the latest activity and performance details.";
}

// --------------------------------------------------
// SHARED PORTAL METRIC RULES
// Keep these calculations aligned with src/lib/portalMetrics.js,
// src/lib/phases.js and src/lib/delivery.js in the web portal.
// --------------------------------------------------

type CreatorRow = NonNullable<PortalCampaign["creators"]>[number];
type AnyRecord = Record<string, any>;

function numeric(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Supports numeric followers and strings such as 820K / 1.2M. */
function parseFollowers(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string" || !value.trim()) return 0;
  const cleaned = value.trim().replace(/,/g, "").replace(/\s/g, "");
  const match = cleaned.match(/^([\d.]+)([KMB])?$/i);
  if (!match) return 0;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return 0;
  const suffix = (match[2] || "").toUpperCase();
  return amount * (suffix === "K" ? 1_000 : suffix === "M" ? 1_000_000 : suffix === "B" ? 1_000_000_000 : 1);
}

/** Client-facing phase map from src/lib/phases.js. */
const STAGE_TO_PHASE: Record<string, string> = {
  draft: "brief", brief_locked: "brief",
  team_assigned: "shortlist", po_raised: "shortlist",
  advance_received: "production", invoice_raised: "live",
  payment_done: "completed",
  brief_log: "brief", creator_shortlist: "shortlist", po: "shortlist",
  advance: "shortlist", execution: "production", brief_sent: "production",
  concept_submitted: "production", concept_approved: "production",
  production: "production", video_submitted: "production",
  internal_review: "production", client_approved: "production",
  live: "live", creator_paid: "live", reporting: "live", completed: "completed",
};

function campaignPhase(campaign: PortalCampaign): string {
  return STAGE_TO_PHASE[String(campaign.stage || "")] || "brief";
}

// This mirrors progressOf(): derive current pipeline progress from the stage;
// only use the stored progress field when the stage is unknown.
const STAGE_PROGRESS: Record<string, number> = {
  draft: 0, brief_locked: 8, team_assigned: 16, po_raised: 35,
  advance_received: 55, invoice_raised: 80, payment_done: 100,
};
const LEGACY_TO_STAGE: Record<string, string> = {
  brief_log: "draft", creator_shortlist: "draft", po: "team_assigned",
  advance: "po_raised", execution: "advance_received", reporting: "advance_received",
  brief_sent: "advance_received", concept_submitted: "advance_received",
  concept_approved: "advance_received", production: "advance_received",
  video_submitted: "advance_received", internal_review: "advance_received",
  client_approved: "advance_received", live: "advance_received",
  creator_paid: "advance_received", completed: "payment_done",
};

function campaignProgressOf(campaign: PortalCampaign): number {
  const stage = String(campaign.stage || "");
  const derived = STAGE_PROGRESS[stage] ?? STAGE_PROGRESS[LEGACY_TO_STAGE[stage]];
  if (derived != null) return derived;
  const stored = numeric((campaign as AnyRecord).progress);
  return stored == null ? 0 : Math.min(100, Math.max(0, stored));
}

function isCreatorLive(creator: CreatorRow): boolean {
  const live = (creator as AnyRecord).live;
  return Boolean(live?.postUrl);
}

function isCampaignLive(campaign: PortalCampaign): boolean {
  return (campaign.creators ?? []).some((creator) => {
    const live = (creator as AnyRecord).live;
    return Boolean(live?.postUrl || live?.postUrls?.length);
  });
}

// Exact portalMetrics.js eligibility rule: include campaigns whose finance
// phase is live/completed, or whose posts are live AND whose budget and at
// least one client-billed creator cost are present.
function countsInMetrics(campaign: PortalCampaign): boolean {
  const stage = String(campaign.stage || "");
  const normalizedStage = stage in STAGE_PROGRESS ? stage : (LEGACY_TO_STAGE[stage] || "draft");
  const phase = STAGE_TO_PHASE[normalizedStage] || "brief";
  const priced = numeric(campaign.budget) != null && numeric(campaign.budget)! > 0 &&
    (campaign.creators ?? []).some((creator) => numeric((creator as AnyRecord).cost) != null && numeric((creator as AnyRecord).cost)! > 0);
  return phase === "live" || phase === "completed" || (isCampaignLive(campaign) && priced);
}

function getCampaignStatus(campaign: PortalCampaign): string {
  const phase = campaignPhase(campaign);
  const labels: Record<string, string> = {
    brief: "Brief & Strategy", shortlist: "Shortlisting",
    production: "Production", live: "Live", completed: "Completed",
  };
  return labels[phase] || "Brief & Strategy";
}

function isCampaignActive(campaign: PortalCampaign): boolean {
  return campaignPhase(campaign) !== "completed";
}

/** The portal's measured ER: (likes + comments) / tracked views. */
function measuredEngagementRate(creator: CreatorRow): number | null {
  const tracking = (creator as AnyRecord).tracking || {};
  const views = numeric(tracking.views);
  const likes = numeric(tracking.likes);
  const comments = numeric(tracking.comments);
  return views != null && views > 0 && (likes != null || comments != null)
    ? (((likes || 0) + (comments || 0)) / views) * 100
    : null;
}

function trackedViews(creator: CreatorRow): number | null {
  return numeric((creator as AnyRecord).tracking?.views);
}

function cpvOf(spend: number, views: number): number | null {
  return spend > 0 && views > 0 ? spend / views : null;
}

function savedVsIndustryOf(spend: number, views: number): number | null {
  // Matches portalMetrics.js INDUSTRY_CPV = ₹0.30; this is an estimate.
  return spend > 0 && views > 0 ? views * 0.3 - spend : null;
}

// ---------------------------------------------------------------------------
// Where things stand: three gauges, then the campaigns counted by phase
// ---------------------------------------------------------------------------

function Gauge({
  value,
  label,
  ratio,
  color,
  delay,
}: {
  value: string;
  label: string;
  ratio: number;
  color: string;
  delay: number;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.gauge} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.gaugeRing}>
        <Ring size={78} stroke={7} value={ratio} color={color} track={colors.well} delay={delay} />
        <T
          numberOfLines={1}
          adjustsFontSizeToFit
          style={styles.gaugeValue}
          color={value === "—" ? colors.muted : colors.text}
        >
          {value}
        </T>
      </View>
      <T v="caption" tone="muted" style={{ textAlign: "center" }} numberOfLines={2}>
        {label}
      </T>
    </View>
  );
}

const PHASE_LABELS: Record<string, string> = {
  brief: "Brief",
  shortlist: "Shortlist",
  production: "Production",
  live: "Live",
  completed: "Done",
};

function CampaignSnapshot({
  progress,
  activeCampaigns,
  totalCampaigns,
  liveCreators,
  totalCreators,
  campaigns,
}: {
  progress: number | null;
  activeCampaigns: number;
  totalCampaigns: number;
  liveCreators: number;
  totalCreators: number;
  campaigns: PortalCampaign[];
}) {
  const { colors } = useAppTheme();

  const safeProgress = progress == null ? 0 : Math.max(0, Math.min(100, progress));
  const activeRatio =
    totalCampaigns > 0 ? Math.max(0, Math.min(100, (activeCampaigns / totalCampaigns) * 100)) : 0;
  const creatorRatio =
    totalCreators > 0 ? Math.max(0, Math.min(100, (liveCreators / totalCreators) * 100)) : 0;

  const phaseColor: Record<string, string> = {
    brief: colors.text2,
    shortlist: colors.warning,
    production: colors.accent,
    live: colors.success,
    completed: colors.gold,
  };
  const counts = PHASES.map((phase) => ({
    phase,
    count: campaigns.filter((campaign) => campaignPhase(campaign) === phase).length,
  }));

  return (
    <Card style={{ gap: space.lg }}>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Gauge
          label="Average progress"
          value={progress == null ? "—" : `${Math.round(safeProgress)}%`}
          ratio={safeProgress}
          color={colors.accent}
          delay={200}
        />
        <Gauge
          label="Active campaigns"
          value={`${activeCampaigns}/${totalCampaigns}`}
          ratio={activeRatio}
          color={colors.gold}
          delay={340}
        />
        <Gauge
          label="Creators posted"
          value={`${liveCreators}/${totalCreators}`}
          ratio={creatorRatio}
          color={colors.success}
          delay={480}
        />
      </View>

      <Hairline />

      {/* Campaigns counted by the phase they are in, in order */}
      <View>
        <T v="label" tone="muted" style={{ marginBottom: space.md }}>
          Campaigns by phase
        </T>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {counts.map(({ phase, count }) => (
            <View key={phase} style={{ flex: 1, gap: 6 }}>
              <T v="figureSm" color={count > 0 ? colors.text : colors.faint}>
                {count}
              </T>
              <View
                style={{
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: count > 0 ? phaseColor[phase] : colors.well,
                }}
              />
              <T
                numberOfLines={1}
                adjustsFontSizeToFit
                color={count > 0 ? colors.text2 : colors.faint}
                style={{ fontFamily: fonts.sansMedium, fontSize: 9.5, lineHeight: 14, letterSpacing: -0.2 }}
              >
                {PHASE_LABELS[phase]}
              </T>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}

function thin<P>(points: P[], max: number): P[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, index) => points[Math.round(index * step)]);
}

function formatPerformanceNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: value >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

// --------------------------------------------------
// AUDIENCE PERFORMANCE CHART
// Mirrors the web portal's growthAcross() calculation:
// creator tracking.history values are cumulative snapshots, not daily events.
// --------------------------------------------------

function AudiencePerformanceChart({
  campaigns,
}: {
  campaigns: PortalCampaign[];
}) {
  const [metric, setMetric] = useState<"views" | "engagements">("views");
  const [period, setPeriod] = useState<"7D" | "30D" | "ALL">("ALL");
  const { width: windowWidth } = useWindowDimensions();
  const plotWidth = Math.max(220, Math.min(windowWidth - 100, 520));
  const plotHeight = 132;

  // Carry each creator's last known cumulative values forward day by day,
  // then aggregate creators. This is the same order of operations as web.
  const growthSeries = useMemo(() => {
    const creators = campaigns.flatMap((campaign) =>
      (campaign.creators ?? []).map((creator, index) => {
        const raw = creator as AnyRecord;
        return {
          name: raw.name || raw.handle || `Creator ${index + 1}`,
          history: Array.isArray(raw.tracking?.history)
            ? raw.tracking.history
            : [],
        };
      })
    ).filter((creator) => creator.history.length > 0);

    if (!creators.length) return [] as Array<{
      date: string;
      views: number;
      engagements: number;
    }>;

    const fields = ["views", "likes", "comments", "forwards"] as const;
    const byCreatorDay = creators.map((creator) => {
      const readingsByDay = new Map<string, AnyRecord>();
      let running: AnyRecord | null = null;

      [...creator.history]
        .filter((reading: AnyRecord) => reading?.at)
        .sort((a: AnyRecord, b: AnyRecord) =>
          String(a.at).localeCompare(String(b.at))
        )
        .forEach((reading: AnyRecord) => {
          running = Object.fromEntries(
            fields.map((field) => [field, reading?.[field] ?? running?.[field] ?? null])
          );
          const day = String(reading.at).slice(0, 10);
          const timestamp = Date.parse(`${day}T00:00:00Z`);
          if (Number.isFinite(timestamp)) readingsByDay.set(day, { ...running });
        });

      return readingsByDay;
    });

    const observedDays = [...new Set(
      byCreatorDay.flatMap((readings) => [...readings.keys()])
    )].sort();

    // The web growth chart requires at least two distinct days of readings.
    if (observedDays.length < 2) return [];

    const startTime = Date.parse(`${observedDays[0]}T00:00:00Z`);
    const endTime = Date.parse(`${observedDays[observedDays.length - 1]}T00:00:00Z`);
    const spanDays = Math.floor((endTime - startTime) / 86_400_000);
    // Guard against corrupt dates creating an enormous chart range.
    const days = spanDays >= 0 && spanDays <= 370
      ? Array.from({ length: spanDays + 1 }, (_, index) =>
          new Date(startTime + index * 86_400_000).toISOString().slice(0, 10)
        )
      : observedDays;

    const carried: Array<AnyRecord | null> = byCreatorDay.map(() => null);

    return days.map((date) => {
      let views = 0;
      let engagements = 0;

      byCreatorDay.forEach((readings, index) => {
        if (readings.has(date)) carried[index] = readings.get(date)!;
        const snapshot = carried[index];
        if (!snapshot) return;

        const likes = Number(snapshot.likes) || 0;
        const comments = Number(snapshot.comments) || 0;
        const forwards = Number(snapshot.forwards) || 0;
        views += Number(snapshot.views) || 0;
        engagements += likes + comments + forwards;
      });

      return { date, views, engagements };
    });
  }, [campaigns]);

  const selectedPoints = useMemo(() => {
    if (!growthSeries.length) return [];
    if (period === "ALL") return growthSeries;

    const latestTime = Date.parse(
      `${growthSeries[growthSeries.length - 1].date}T00:00:00Z`
    );
    const days = period === "7D" ? 7 : 30;
    const fromTime = latestTime - (days - 1) * 86_400_000;

    return growthSeries.filter((point) => {
      const pointTime = Date.parse(`${point.date}T00:00:00Z`);
      return pointTime >= fromTime && pointTime <= latestTime;
    });
  }, [growthSeries, period]);

  const points = selectedPoints.map((point) => ({
    date: point.date,
    value: point[metric],
  }));
  // Snapshot values are cumulative. The latest point is the total; never sum
  // historical snapshots together (that would count the same views repeatedly).
  const total = points.length ? points[points.length - 1].value : null;
  const firstValue = points.length ? points[0].value : null;
  const growth = total != null && firstValue != null
    ? total - firstValue
    : null;

  const { colors } = useAppTheme();
  const tone = growth != null && growth < 0 ? colors.danger : colors.success;

  return (
    <Card>
      <View style={styles.rowBetween}>
        <T v="heading">Audience growth</T>
        <T v="caption" tone="faint">
          {period === "ALL" ? "All time" : period === "7D" ? "Last 7 days" : "Last 30 days"}
        </T>
      </View>

      <Segmented
        style={{ marginTop: space.md }}
        value={metric}
        onChange={setMetric}
        options={[
          { value: "views", label: "Views" },
          { value: "engagements", label: "Engagements" },
        ]}
      />

      <View style={[styles.rowBetween, { marginTop: space.lg, alignItems: "flex-end" }]}>
        <CountUp
          v="figure"
          value={total}
          format={(value) => formatNumber(Math.round(value))}
        />
        {growth != null && growth !== 0 ? (
          <View style={[styles.growth, { backgroundColor: growth < 0 ? colors.dangerMuted : colors.successMuted }]}>
            <Ionicons name={growth >= 0 ? "trending-up" : "trending-down"} size={13} color={tone} />
            <T v="caption" color={tone} style={{ fontFamily: fonts.sansMedium }}>
              {growth >= 0 ? "+" : "−"}
              {formatNumber(Math.abs(growth))} in period
            </T>
          </View>
        ) : null}
      </View>

      {points.length > 1 ? (
        <>
          <TrendLine
            data={thin(points, 48).map((point) => ({ label: point.date, value: point.value }))}
            formatValue={formatNumber}
            formatLabel={formatDate}
          />
          <View style={[styles.rowBetween, { marginTop: 6 }]}>
            <T v="caption" tone="faint">
              {formatDate(points[0]?.date)}
            </T>
            <T v="caption" tone="faint">
              {formatDate(points[points.length - 1]?.date)}
            </T>
          </View>
        </>
      ) : (
        <View style={styles.chartEmpty}>
          <Ionicons name="pulse-outline" size={22} color={colors.faint} />
          <T v="caption" tone="faint" style={{ textAlign: "center", maxWidth: 260 }}>
            {growthSeries.length === 0
              ? "The growth line appears once readings exist for two or more days."
              : "No readings fall inside this period."}
          </T>
        </View>
      )}

      <Segmented
        style={{ marginTop: space.md }}
        value={period}
        onChange={setPeriod}
        options={[
          { value: "7D", label: "7 days" },
          { value: "30D", label: "30 days" },
          { value: "ALL", label: "All time" },
        ]}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Spend by service
// ---------------------------------------------------------------------------

function SpendByService({
  spend,
}: {
  spend: Record<string, number>;
}) {
  const entries = Object.entries(spend || {})
    .map(([name, value]) => ({
      name,
      value: Number(value) || 0,
    }))
    .filter((item) => Number.isFinite(item.value) && item.value > 0)
    .sort((a, b) => b.value - a.value);

  const total = entries.reduce((sum, item) => sum + item.value, 0);
  const { colors } = useAppTheme();

  if (total <= 0) {
    return (
      <Card>
        <EmptyState
          icon="pie-chart-outline"
          title="No spend recorded yet"
          message="The split across services shows up here once spend is logged."
        />
      </Card>
    );
  }

  return (
    <Card style={{ gap: space.lg }}>
      <View style={[styles.rowBetween, { alignItems: "flex-end" }]}>
        <View>
          <T v="caption" tone="faint">
            Total recorded
          </T>
          <CountUp
            v="figure"
            value={total}
            format={(value) => formatCurrency(Math.round(value))}
          />
        </View>
        <T v="caption" tone="faint" style={{ marginBottom: 8 }}>
          {entries.length} service{entries.length === 1 ? "" : "s"}
        </T>
      </View>

      <View style={styles.stack}>
        {entries.map((item, index) => (
          <View
            key={item.name}
            style={{ flex: item.value, backgroundColor: colors.viz[index % colors.viz.length] }}
          />
        ))}
      </View>

      <View>
        {entries.map((item, index) => {
          const percentage = (item.value / total) * 100;
          return (
            <View key={item.name}>
              {index > 0 ? <Hairline /> : null}
              <View style={styles.spendLine}>
                <View
                  style={[styles.legendDot, { backgroundColor: colors.viz[index % colors.viz.length] }]}
                />
                <T v="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                  {item.name}
                </T>
                <T v="bodyStrong">{formatCurrency(item.value)}</T>
                <View style={[styles.percent, { backgroundColor: colors.well }]}>
                  <T v="caption" tone="muted" style={{ fontFamily: fonts.sansMedium }}>
                    {percentage.toFixed(percentage % 1 === 0 ? 0 : 1)}%
                  </T>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Hero pieces: a soft pastel panel, a headline with gradient words, three
// framed posts, then a dark card and a light card.
// ---------------------------------------------------------------------------

const HERO = {
  light: {
    ground: ["#F3EBDD", "#ECEAF4", "#DDE2F6"] as const,
    ink: "#191611",
    sub: "rgba(25,22,17,0.62)",
    chip: "rgba(255,255,255,0.74)",
    words: ["#1B2A5C", "#B8862B"] as const,
    card: "#FFFFFF",
  },
  dark: {
    ground: ["#1B2347", "#141A3C", "#231F2E"] as const,
    ink: "#F6F4EE",
    sub: "rgba(246,244,238,0.66)",
    chip: "rgba(255,255,255,0.09)",
    words: ["#9DB7FF", "#F4C26B"] as const,
    card: "#1B1A21",
  },
};

// Navy, with one gold frame in the middle.
const FRAME_FILLS: (readonly [string, string])[] = [
  ["#1B2A5C", "#5E78D0"],
  ["#0A0F3A", "#D9A441"],
  ["#2C3E7E", "#8FA5E8"],
];

function mix(from: string, to: string, t: number): string {
  const a = parseInt(from.slice(1), 16);
  const b = parseInt(to.slice(1), 16);
  const channel = (shift: number) => {
    const x = (a >> shift) & 255;
    const y = (b >> shift) & 255;
    return Math.round(x + (y - x) * t);
  };
  return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
}

/** Text whose colour runs from one hue to another, letter by letter. */
function GradientWords({ text, from, to }: { text: string; from: string; to: string }) {
  const letters = Array.from(text);
  return (
    <>
      {letters.map((letter, index) => (
        <Text
          key={index}
          style={{ color: mix(from, to, letters.length < 2 ? 0 : index / (letters.length - 1)) }}
        >
          {letter}
        </Text>
      ))}
    </>
  );
}

function reelImage(reel: PortalReel): string {
  const pick = (value: unknown) => (typeof value === "string" ? value : "");
  return (
    pick(reel.thumbnail) ||
    pick(reel.poster) ||
    pick(reel.image) ||
    pick(reel.display_url) ||
    pick(reel.thumbnail_url)
  );
}

function Frame({
  reel,
  icon,
  width,
  height,
  round,
  fill,
  order,
}: {
  reel?: PortalReel;
  icon: IconName;
  width: number;
  height: number;
  round: number;
  fill: readonly [string, string];
  order: number;
}) {
  const reduced = useReducedMotion();
  const image = reel ? reelImage(reel) : "";

  // A slow float, each frame slightly out of step with the next.
  const float = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    float.value = withDelay(
      order * 500,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );
  }, [order, reduced, float]);
  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -float.value * 5 }] }));

  return (
    <Animated.View
      entering={FadeInDown.delay(250 + order * 110).duration(600).easing(Easing.out(Easing.cubic))}
    >
      <Animated.View style={floatStyle}>
        <Tap
          accessibilityRole="button"
          accessibilityLabel={
            reel
              ? `Post by ${reel.username || "a creator"}, ${formatNumber(numeric(reel.views))} views. Open assets.`
              : "Open assets"
          }
          onPress={() => router.navigate("/(tabs)/assets")}
          scaleTo={0.95}
          style={{ width, height, borderRadius: round, overflow: "hidden" }}
        >
          <LinearGradient
            colors={[fill[0], fill[1]]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {image ? (
            <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
              <Ionicons name={icon} size={width * 0.32} color="rgba(255,255,255,0.92)" />
            </View>
          )}
          {reel && numeric(reel.views) != null ? (
            <View style={styles.frameChip}>
              <Ionicons name="eye" size={10} color="#16131F" />
              <Text style={styles.frameChipText}>{formatNumber(numeric(reel.views))}</Text>
            </View>
          ) : null}
        </Tap>
      </Animated.View>
    </Animated.View>
  );
}

function HeroChip({ label, value, ink, sub, bg }: { label: string; value: string; ink: string; sub: string; bg: string }) {
  return (
    <View style={[styles.heroChip, { backgroundColor: bg }]}>
      <Text style={[styles.heroChipValue, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.heroChipLabel, { color: sub }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** One line about the account that changes every few seconds. */
function Ticker({ lines, color }: { lines: string[]; color: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (lines.length < 2) return;
    const id = setInterval(() => setIndex((value) => value + 1), 3800);
    return () => clearInterval(id);
  }, [lines.length]);

  if (lines.length === 0) return null;
  const line = lines[index % lines.length];

  return (
    <View style={styles.tickerWindow} accessibilityLiveRegion="polite">
      <Animated.Text
        key={line}
        entering={FadeInDown.duration(420).easing(Easing.out(Easing.cubic))}
        exiting={FadeOutUp.duration(260)}
        numberOfLines={1}
        style={[styles.tickerText, { color }]}
      >
        {line}
      </Animated.Text>
    </View>
  );
}

// The savings estimate is the web portal's: tracked views at the ₹0.30
// industry cost per view, less the campaign budgets.
const INDUSTRY_RATE = 0.3;

function SavingsCard({ spend, views }: { spend: number; views: number }) {
  const saved = savedVsIndustryOf(spend, views);
  const cpv = cpvOf(spend, views);
  const industryCost = views * INDUSTRY_RATE;
  const percent = saved != null && industryCost > 0 ? Math.round((saved / industryCost) * 100) : 0;

  const state = saved == null || cpv == null ? "none" : saved > 0 ? "saved" : "over";

  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel="Savings. Open billing."
      onPress={() => router.navigate("/(tabs)/billing")}
      scaleTo={0.98}
      style={styles.darkCard}
    >
      <LinearGradient
        colors={[midnight.top, midnight.mid, "#18266A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.cardDot, { backgroundColor: midnight.lamp }]} />

      {state === "saved" ? (
        <>
          <Text style={styles.darkLabel}>You saved</Text>
          <CountUp
            value={saved}
            duration={1600}
            format={rupees}
            color={midnight.lamp}
            style={styles.darkFigure}
            numberOfLines={1}
            adjustsFontSizeToFit
          />
          <Text style={styles.darkBody}>
            {formatNumber(views)} views would cost {rupees(industryCost)} at the ₹0.30 industry
            rate. You paid {rupees(spend)}.
          </Text>
        </>
      ) : state === "over" ? (
        <>
          <Text style={styles.darkLabel}>Cost per view so far</Text>
          <Text style={styles.darkFigure}>₹{(cpv as number).toFixed(2)}</Text>
          <Text style={styles.darkBody}>
            The industry rate is ₹0.30. Savings show here once your cost per view drops below it.
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.darkLabel}>Your savings</Text>
          <Text style={[styles.darkFigure, { fontSize: 24, lineHeight: 30 }]}>Coming soon</Text>
          <Text style={styles.darkBody}>
            Once your posts have tracked views, this shows what you saved against the ₹0.30
            industry cost per view.
          </Text>
        </>
      )}

      <View style={styles.darkFoot}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <LinearGradient
            colors={["#FBDA8E", "#E9A441"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.square}
          >
            <Ionicons name="trending-down" size={18} color="#0A0F3A" />
          </LinearGradient>
          {state === "saved" ? (
            <View style={styles.percentChip}>
              <Text style={styles.squareText} numberOfLines={1}>
                {percent}% less
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.whiteButton}>
          <Ionicons name="receipt-outline" size={14} color="#0A0F3A" />
          <Text style={styles.whiteButtonText}>See billing</Text>
        </View>
      </View>
    </Tap>
  );
}

function MotionCard({
  title,
  lines,
  names,
  progress,
}: {
  title: string;
  lines: string[];
  names: string[];
  progress: number | null;
}) {
  const { colors, isDark } = useAppTheme();
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={`${title}. Open campaigns.`}
      onPress={() => router.navigate("/(tabs)/campaigns")}
      scaleTo={0.98}
      style={[
        styles.lightCard,
        cardShadow(colors),
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {/* A faint wash of the brand colours in the corner */}
      <LinearGradient
        pointerEvents="none"
        colors={
          isDark
            ? ["rgba(94,143,224,0.20)", "rgba(94,143,224,0)"]
            : ["rgba(184,134,43,0.16)", "rgba(27,42,92,0)"]
        }
        start={{ x: 1, y: 0 }}
        end={{ x: 0.35, y: 0.8 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <T v="heading" style={{ fontSize: 25, lineHeight: 31 }} numberOfLines={2}>
            {title}
          </T>
        </View>
        <View style={[styles.go, { backgroundColor: colors.accent }]}>
          <Ionicons name="arrow-forward" size={17} color={colors.onAccent} />
        </View>
      </View>

      {lines.length > 0 ? (
        <View style={[styles.news, { backgroundColor: colors.well }]}>
          <PulseDot color={colors.success} />
          <View style={{ flex: 1 }}>
            <Ticker lines={lines} color={colors.text} />
          </View>
        </View>
      ) : null}

      {progress != null ? (
        <View style={{ gap: 6, marginTop: space.lg }}>
          <View style={styles.rowBetween}>
            <T v="caption" tone="faint">
              Average progress
            </T>
            <T v="caption" tone="accent" style={{ fontFamily: fonts.sansSemi }}>
              {progress}%
            </T>
          </View>
          <Meter value={progress} height={6} />
        </View>
      ) : null}

      {names.length > 0 ? (
        <View style={[styles.rowBetween, { marginTop: space.lg }]}>
          <AvatarStack names={names} max={5} size={34} ring={colors.surface} />
          <T v="caption" tone="muted">
            {names.length} creator{names.length === 1 ? "" : "s"} on your campaigns
          </T>
        </View>
      ) : null}
    </Tap>
  );
}

// ---------------------------------------------------------------------------
// Highlights: the best-performing posts, playing through like a reel
// ---------------------------------------------------------------------------

const HIGHLIGHT_SECONDS = 4.5;

function HighlightCard({
  reel,
  rank,
  width,
  playing,
}: {
  reel: PortalReel;
  rank: number;
  width: number;
  playing: boolean;
}) {
  const { colors } = useAppTheme();
  const reduced = useReducedMotion();
  const image = reelImage(reel);

  // A slow push-in on the card that is playing, so a still image feels alive.
  const zoom = useSharedValue(1);
  useEffect(() => {
    zoom.value =
      playing && !reduced
        ? withTiming(1.14, { duration: HIGHLIGHT_SECONDS * 1000, easing: Easing.linear })
        : withTiming(1, { duration: 500 });
  }, [playing, reduced, zoom]);
  const zoomStyle = useAnimatedStyle(() => ({ transform: [{ scale: zoom.value }] }));

  const focus = useSharedValue(playing ? 1 : 0);
  useEffect(() => {
    focus.value = withTiming(playing ? 1 : 0, { duration: 420, easing: Easing.out(Easing.cubic) });
  }, [playing, focus]);
  const cardStyle = useAnimatedStyle(() => ({
    opacity: 0.6 + focus.value * 0.4,
    transform: [{ scale: 0.93 + focus.value * 0.07 }],
  }));

  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={`Number ${rank}: post by ${reel.username || "a creator"} with ${formatNumber(
        numeric(reel.views)
      )} views. Open assets.`}
      onPress={() => router.navigate("/(tabs)/assets")}
      scaleTo={0.97}
    >
      <Animated.View
        style={[
          styles.highlight,
          { width, height: width * 1.42, backgroundColor: colors.surfaceSecondary },
          cardStyle,
        ]}
      >
        {image ? (
          <Animated.View style={[StyleSheet.absoluteFill, zoomStyle]}>
            <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          </Animated.View>
        ) : (
          <LinearGradient
            colors={[midnight.bottom, midnight.mid, midnight.top]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(0,0,28,0.55)", "rgba(0,0,28,0)", "rgba(0,0,28,0.92)"]}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.highlightTop}>
          <T color="#FFFFFF" style={styles.rank}>
            {rank}
          </T>
          <View style={styles.kind}>
            <Ionicons
              name={reel.kind?.toLowerCase() === "post" ? "image" : "play"}
              size={10}
              color="#FFFFFF"
            />
            <T v="caption" color="#FFFFFF">
              {reel.kind?.toLowerCase() === "post" ? "Post" : "Reel"}
            </T>
          </View>
        </View>

        <View style={{ padding: 14, gap: 2 }}>
          <T style={styles.highlightViews} color="#FFFFFF" numberOfLines={1}>
            {formatNumber(numeric(reel.views))}
          </T>
          <T v="caption" color="rgba(255,255,255,0.75)">
            views
          </T>
          <T v="label" color="#FFFFFF" numberOfLines={1} style={{ marginTop: 6 }}>
            {reel.username ? `@${reel.username.replace(/^@/, "")}` : "Creator"}
          </T>
        </View>
      </Animated.View>
    </Tap>
  );
}

/** A segment that fills while its card is on screen, like a story bar. */
function PlayBar({ state }: { state: "done" | "playing" | "waiting" }) {
  const { colors } = useAppTheme();
  const fill = useSharedValue(state === "done" ? 100 : 0);
  useEffect(() => {
    if (state === "playing") {
      fill.value = 0;
      fill.value = withTiming(100, { duration: HIGHLIGHT_SECONDS * 1000, easing: Easing.linear });
    } else {
      fill.value = withTiming(state === "done" ? 100 : 0, { duration: 200 });
    }
  }, [state, fill]);
  const style = useAnimatedStyle(() => ({ width: `${fill.value}%` }));
  return (
    <View style={[styles.playBar, { backgroundColor: colors.well }]}>
      <Animated.View style={[{ height: "100%", backgroundColor: colors.accent }, style]} />
    </View>
  );
}

function Highlights({ reels }: { reels: PortalReel[] }) {
  const { width: screen } = useWindowDimensions();
  const cardWidth = Math.min(250, Math.round(screen * 0.6));
  const step = cardWidth + space.md;

  const top = useMemo(
    () =>
      [...reels]
        .sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0))
        .slice(0, 6),
    [reels]
  );

  const [active, setActive] = useState(0);
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const lastTouch = useRef(0);

  // Plays through the cards on its own, and waits a while after a touch.
  useEffect(() => {
    if (top.length < 2) return;
    const id = setInterval(() => {
      if (Date.now() - lastTouch.current < 7000) return;
      setActive((current) => {
        const next = (current + 1) % top.length;
        scroller.current?.scrollTo({ x: next * step, animated: true });
        return next;
      });
    }, HIGHLIGHT_SECONDS * 1000);
    return () => clearInterval(id);
  }, [top.length, step]);

  if (top.length === 0) return null;

  return (
    <View style={{ gap: space.md }}>
      <SectionTitle
        title="Your top posts"
        note="Ranked by views, playing in order"
        right={
          <Button
            small
            kind="ghost"
            label="All posts"
            onPress={() => router.navigate("/(tabs)/assets")}
          />
        }
      />
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={step}
        snapToAlignment="start"
        scrollEventThrottle={32}
        onScrollBeginDrag={() => {
          lastTouch.current = Date.now();
        }}
        onScroll={(event) => {
          const next = Math.max(
            0,
            Math.min(top.length - 1, Math.round(event.nativeEvent.contentOffset.x / step))
          );
          if (Date.now() - lastTouch.current < 7000) setActive(next);
        }}
        style={{ marginHorizontal: -space.xl }}
        contentContainerStyle={{
          paddingHorizontal: space.xl,
          paddingRight: Math.max(space.xl, screen - cardWidth - space.xl),
          gap: space.md,
        }}
      >
        {top.map((reel, index) => (
          <Animated.View
            key={reel.id || reel.code || `${reel.username || "post"}-${index}`}
            entering={FadeInRight.delay(200 + index * 90).duration(480).easing(Easing.out(Easing.cubic))}
          >
            <HighlightCard
              reel={reel}
              rank={index + 1}
              width={cardWidth}
              playing={index === active}
            />
          </Animated.View>
        ))}
      </ScrollView>
      {top.length > 1 ? (
        <View style={{ flexDirection: "row", gap: 5 }}>
          {top.map((_, index) => (
            <PlayBar
              key={index}
              state={index < active ? "done" : index === active ? "playing" : "waiting"}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Shortcuts into the rest of the app
// ---------------------------------------------------------------------------

function Shortcut({
  icon,
  label,
  note,
  tone,
  href,
  order,
}: {
  icon: IconName;
  label: string;
  note: string;
  tone: Tone;
  href: Href;
  order: number;
}) {
  const { colors } = useAppTheme();
  const { fg, bg } = useTone(tone);
  const reduced = useReducedMotion();

  // Each icon bobs gently, out of step with its neighbours.
  const bob = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    bob.value = withDelay(
      order * 420,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        false
      )
    );
  }, [order, reduced, bob]);
  const bobStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -bob.value * 4 }, { rotate: `${(bob.value - 0.5) * 6}deg` }],
  }));

  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${note}`}
      onPress={() => router.navigate(href)}
      scaleTo={0.96}
      style={[
        styles.shortcut,
        cardShadow(colors),
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={[styles.shortcutIcon, { backgroundColor: bg }]}>
        <Animated.View style={bobStyle}>
          <Ionicons name={icon} size={22} color={fg} />
        </Animated.View>
      </View>
      <View style={{ gap: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <T v="subhead">{label}</T>
          <Ionicons name="chevron-forward" size={13} color={colors.muted} />
        </View>
        <T v="caption" tone="faint" numberOfLines={1}>
          {note}
        </T>
      </View>
    </Tap>
  );
}

// ---------------------------------------------------------------------------
// Campaign journey card
// ---------------------------------------------------------------------------

const PHASES = ["brief", "shortlist", "production", "live", "completed"] as const;

function JourneyCard({ campaign, width }: { campaign: PortalCampaign; width: number }) {
  const { colors } = useAppTheme();
  const live = isCampaignLive(campaign);
  const phase = campaignPhase(campaign);
  const phaseIndex = Math.max(0, PHASES.indexOf(phase as (typeof PHASES)[number]));
  const tone: Tone =
    live || phase === "live"
      ? "success"
      : phase === "completed"
        ? "neutral"
        : phase === "production"
          ? "accent"
          : "warning";
  const { fg } = useTone(tone);

  const facts: [string, string][] = [
    ["Budget", numeric(campaign.budget) == null ? "—" : formatCurrency(numeric(campaign.budget))],
    ["Creators", campaign.creators == null ? "—" : String(campaign.creators.length)],
    ["Starts", campaign.start ? formatDate(campaign.start) : "—"],
  ];

  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={`${campaign.name || "Untitled campaign"}, ${getCampaignStatus(campaign)}. Open campaigns.`}
      onPress={() => router.navigate("/(tabs)/campaigns")}
      scaleTo={0.97}
      style={{ width }}
    >
      <Card>
        <Pill label={getCampaignStatus(campaign)} tone={tone} live={live} />
        <T v="heading" numberOfLines={1} style={{ marginTop: 8 }}>
          {campaign.name || "Untitled campaign"}
        </T>
        <T v="caption" tone="faint" numberOfLines={1}>
          {[campaign.service, campaign.region].filter(Boolean).join(", ") || "Campaign"}
        </T>

        {/* The five phases in order; filled up to where this campaign is */}
        <View style={styles.phaseStrip}>
          {PHASES.map((key, index) => (
            <View
              key={key}
              style={[
                styles.phaseDash,
                { backgroundColor: index <= phaseIndex ? fg : colors.well },
              ]}
            />
          ))}
        </View>
        <T v="caption" color={fg} style={{ marginTop: 6, fontFamily: fonts.sansMedium }}>
          {campaignProgressOf(campaign)}% through
        </T>

        <View style={{ flexDirection: "row", marginTop: space.md }}>
          {facts.map(([label, value]) => (
            <View key={label} style={{ flex: 1 }}>
              <T v="caption" tone="faint">
                {label}
              </T>
              <T v="label" numberOfLines={1} adjustsFontSizeToFit>
                {value}
              </T>
            </View>
          ))}
        </View>
      </Card>
    </Tap>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function OverviewScreen() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();

  const [analytics, setAnalytics] =
    useState<PortalAnalytics | null>(null);

  const [campaigns, setCampaigns] =
    useState<PortalCampaign[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Keep the greeting in sync with the user's local time.
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTime(new Date());
    }, 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);

  const brandId = user?.brandId;
  const clientName = user?.clientName;

  const compact = width < 380;

  // -----------------------------------------------
  // FETCH DATA
  // -----------------------------------------------

  const loadAnalytics = useCallback(
    async (isRefresh = false) => {
      if (!brandId) {
        setError(
          "Your account details are unavailable. Please sign in again."
        );
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const scope = {
        brandId,
        clientName,
      };

      try {
        const [analyticsResult, campaignsResult] =
          await Promise.all([
            getPortalAnalytics(scope),
            getPortalCampaigns(scope),
          ]);

        setAnalytics(analyticsResult);
        setCampaigns(campaignsResult);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong while loading your overview."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [brandId, clientName]
  );

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // -----------------------------------------------
  // CALCULATIONS
  // -----------------------------------------------

  const events = analytics?.events ?? [];

  // Reach is supplied by the analytics endpoint. Views, audience, live
  // creators, engagement and budget follow the web portal's campaign metrics.
  const totals = useMemo(
    () => events.reduce(
      (result, event) => ({
        reach: result.reach + (Number(event.reach) || 0),
        impressions: result.impressions + (Number(event.impressions) || 0),
        engagements: result.engagements + (Number(event.engagements) || 0),
        clicks: result.clicks + (Number(event.clicks) || 0),
      }),
      { reach: 0, impressions: 0, engagements: 0, clicks: 0 }
    ),
    [events]
  );

  const spendByService = analytics?.spendByService ?? {};
  const totalSpend = Object.values(spendByService).reduce(
    (total, amount) => total + (Number(amount) || 0), 0
  );

  // Match web Overview.jsx: drafts/unpriced campaigns are excluded once, then
  // every creator KPI is flattened from that same eligible campaign list.
  const metricCampaigns = useMemo(
    () => campaigns.filter(countsInMetrics),
    [campaigns]
  );
  const allCreators = useMemo(
    () => metricCampaigns.flatMap((campaign) =>
      (campaign.creators ?? []).map((creator, index) => {
        const raw = creator as AnyRecord;
        const tracking = raw.tracking || {};
        const views = numeric(tracking.views);
        const likes = numeric(tracking.likes);
        const comments = numeric(tracking.comments);
        const measuredER = views != null && views > 0 && (likes != null || comments != null)
          ? (((likes || 0) + (comments || 0)) / views) * 100
          : null;
        return {
          key: `${campaign.id || campaign._id || campaign.name || "campaign"}:${raw.handle || raw.name || index}`,
          followers: parseFollowers(raw.followers),
          views,
          er: measuredER ?? numeric(raw.avgER),
          erMeasured: measuredER != null,
          live: raw.live?.postUrl ? { url: raw.live.postUrl } : null,
        };
      })
    ),
    [metricCampaigns]
  );

  // This is the same summarise(list, allCreators) call used by the web
  // Overview's mobile KPI strip. Campaign totals use metricCampaigns; creator
  // totals use the flattened roster above.
  const totalCreators = allCreators.length;
  const liveCreators = allCreators.filter((creator) => creator.live).length;
  const combinedAudience = allCreators.reduce((sum, creator) => sum + creator.followers, 0);
  const totalViews = allCreators.reduce((sum, creator) => sum + (creator.views || 0), 0);
  const measuredRates = allCreators
    .filter((creator) => creator.erMeasured && (creator.er || 0) > 0)
    .map((creator) => creator.er as number);
  const engagementRate = measuredRates.length
    ? measuredRates.reduce((sum, value) => sum + value, 0) / measuredRates.length
    : null;

  const activeCampaigns = metricCampaigns.filter(
    (campaign) => campaignPhase(campaign) !== "completed"
  ).length;
  const liveCampaigns = campaigns.filter(
    (campaign) => campaignPhase(campaign) === "live"
  ).length;

  // Exact healthScore(list): average progressOf() over campaigns not completed.
  // This is finance-stage progress (e.g. team_assigned = 16%), NOT deliveryStats.
  const inFlightCampaigns = metricCampaigns.filter(
    (campaign) => campaignPhase(campaign) !== "completed"
  );
  const campaignProgress = inFlightCampaigns.length
    ? Math.round(inFlightCampaigns.reduce(
        (sum, campaign) => sum + campaignProgressOf(campaign), 0
      ) / inFlightCampaigns.length)
    : null;

  // Exact web portal CPV basis: counted campaign budget / measured creator views.
  const totalBudget = metricCampaigns.reduce(
    (sum, campaign) => sum + (numeric(campaign.budget) || 0), 0
  );
  const cpv = cpvOf(totalBudget, totalViews);
  const estimatedSavings = savedVsIndustryOf(totalBudget, totalViews);

  const recentCampaigns = useMemo(
    () =>
      [...campaigns]
        .sort((a, b) => {
          const dateA = a.start
            ? new Date(a.start).getTime()
            : 0;

          const dateB = b.start
            ? new Date(b.start).getTime()
            : 0;

          return dateB - dateA;
        })
        .slice(0, 3),
    [campaigns]
  );

  const displayName = user?.name || "Client";

  const greeting = getGreeting(currentTime.getHours());
  const greetingMessage = getGreetingMessage({
    campaignCount: campaigns.length,
    liveCount: liveCampaigns,
    totalReach: totals.reach,
    totalImpressions: totalViews,
    totalSpend: totalBudget,
  });
  const greetingName =
    displayName === "Client" ? "there" : displayName;
  const greetingIcon =
    currentTime.getHours() >= 5 && currentTime.getHours() < 17
      ? "sunny-outline"
      : "moon-outline";

  const { colors } = useAppTheme();

  // Top posts for the highlights reel. The overview still works without them.
  const [reels, setReels] = useState<PortalReel[]>([]);
  const loadReels = useCallback(() => {
    if (!brandId) return;
    getPortalReels({ brandId, clientName })
      .then(setReels)
      .catch(() => setReels([]));
  }, [brandId, clientName]);
  useEffect(() => {
    loadReels();
  }, [loadReels]);

  const { isDark } = useAppTheme();
  const hero = isDark ? HERO.dark : HERO.light;

  const topReels = useMemo(
    () => [...reels].sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0)).slice(0, 3),
    [reels]
  );

  const creatorNames = useMemo(() => {
    const seen = new Set<string>();
    campaigns.forEach((campaign) =>
      (campaign.creators ?? []).forEach((creator) => {
        const name = String((creator as AnyRecord).name || (creator as AnyRecord).handle || "").trim();
        if (name) seen.add(name);
      })
    );
    return [...seen];
  }, [campaigns]);

  const tickerLines = useMemo(() => {
    const lines: string[] = [];
    let best: { name: string; views: number } | null = null;
    metricCampaigns.forEach((campaign) =>
      (campaign.creators ?? []).forEach((creator) => {
        const raw = creator as AnyRecord;
        const views = numeric(raw.tracking?.views);
        if (views != null && views > 0 && (!best || views > best.views)) {
          best = { name: String(raw.name || raw.handle || "A creator"), views };
        }
      })
    );
    const top = best as { name: string; views: number } | null;
    if (top) lines.push(`${top.name}'s post is at ${formatNumber(top.views)} views`);
    if (totalCreators > 0) lines.push(`${liveCreators} of ${totalCreators} creators have posted`);
    if (liveCampaigns > 0) {
      lines.push(`${liveCampaigns} campaign${liveCampaigns === 1 ? " is" : "s are"} live right now`);
    }
    if (engagementRate != null) lines.push(`Engagement is running at ${engagementRate.toFixed(1)}%`);
    if (campaignProgress != null) lines.push(`Campaigns in flight are ${campaignProgress}% through`);
    return lines;
  }, [metricCampaigns, totalCreators, liveCreators, liveCampaigns, engagementRate, campaignProgress]);

  if (loading) {
    return <ScreenSkeleton />;
  }

  if (error && !analytics) {
    return (
      <ErrorState
        title="The overview did not load"
        message={error}
        onRetry={() => loadAnalytics()}
      />
    );
  }

  const hasViews = allCreators.some((creator) => creator.views != null);
  const journeyWidth = Math.min(300, width - 84);
  const inMotion = campaigns.filter(isCampaignActive).length;
  const frameUnit = Math.min(118, Math.round((width - 40 - 44 - 28) / 3.2));

  return (
    <ScreenScroll
      refreshing={refreshing}
      onRefresh={() => {
        loadAnalytics(true);
        loadReels();
      }}
    >
      {/* HERO: soft panel, headline, three framed posts, key figures */}
      <Reveal>
        <View style={styles.hero}>
          <LinearGradient
            colors={[hero.ground[0], hero.ground[1], hero.ground[2]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.rowBetween}>
            <View style={{ flex: 1, gap: 8, alignItems: "flex-start" }}>
              <Text style={[styles.heroHello, { color: hero.sub }]} numberOfLines={1}>
                {greeting} {greetingName}
              </Text>
              {liveCampaigns > 0 ? (
                <View style={[styles.liveChip, { backgroundColor: hero.chip }]}>
                  <PulseDot color="#22C55E" />
                  <Text style={[styles.liveChipText, { color: hero.ink }]}>
                    {liveCampaigns} live now
                  </Text>
                </View>
              ) : null}
            </View>
            <Seal size={62} color={hero.ink} accent={hero.words[1]} />
          </View>

          <Text style={[styles.headline, { color: hero.ink }]}>
            {hasViews ? (
              <>
                Your campaigns reached{" "}
                <GradientWords
                  text={`${compactCount(totalViews, 2)} views`}
                  from={hero.words[0]}
                  to={hero.words[1]}
                />
              </>
            ) : campaigns.length > 0 ? (
              <>
                Your campaigns are{" "}
                <GradientWords text="getting ready" from={hero.words[0]} to={hero.words[1]} /> to go
                live
              </>
            ) : (
              <>
                Your space is <GradientWords text="ready" from={hero.words[0]} to={hero.words[1]} />
              </>
            )}
          </Text>

          <View style={styles.frames}>
            <Frame
              order={0}
              reel={topReels[1]}
              icon="megaphone"
              width={frameUnit}
              height={frameUnit * 1.32}
              round={frameUnit / 2}
              fill={FRAME_FILLS[0]}
            />
            <Frame
              order={1}
              reel={topReels[0]}
              icon="play"
              width={frameUnit * 1.2}
              height={frameUnit * 1.5}
              round={30}
              fill={FRAME_FILLS[1]}
            />
            <Frame
              order={2}
              reel={topReels[2]}
              icon="heart"
              width={frameUnit}
              height={frameUnit * 1.32}
              round={frameUnit / 2}
              fill={FRAME_FILLS[2]}
            />
          </View>

          <View style={styles.heroChips}>
            <HeroChip label="Reach" value={formatNumber(totals.reach)} ink={hero.ink} sub={hero.sub} bg={hero.chip} />
            <HeroChip
              label="Engagement"
              value={engagementRate == null ? "—" : `${engagementRate.toFixed(1)}%`}
              ink={hero.ink}
              sub={hero.sub}
              bg={hero.chip}
            />
            <HeroChip
              label="Cost per view"
              value={cpv === null ? "—" : `₹${cpv.toFixed(2)}`}
              ink={hero.ink}
              sub={hero.sub}
              bg={hero.chip}
            />
          </View>
        </View>
      </Reveal>

      <Reveal index={1}>
        <MotionCard
          title={
            campaigns.length === 0
              ? "No campaigns yet"
              : `${inMotion} campaign${inMotion === 1 ? "" : "s"} in motion`
          }
          lines={tickerLines}
          names={creatorNames}
          progress={campaignProgress}
        />
      </Reveal>

      {error ? <InlineError message={error} /> : null}

      <Reveal index={3}>
        <Highlights reels={reels} />
      </Reveal>

      <Reveal index={4}>
        <SavingsCard spend={totalBudget} views={totalViews} />
      </Reveal>

      <Reveal index={3} style={styles.shortcuts}>
        <Shortcut
          order={0}
          icon="megaphone-outline"
          tone="accent"
          label="Campaigns"
          note={
            campaigns.length === 0
              ? "None yet"
              : `${campaigns.filter(isCampaignActive).length} active, ${campaigns.length} in all`
          }
          href="/(tabs)/campaigns"
        />
        <Shortcut
          order={1}
          icon="chatbubbles-outline"
          tone="purple"
          label="Insights"
          note="Audience and trends"
          href="/(tabs)/insights"
        />
        <Shortcut
          order={2}
          icon="play-circle-outline"
          tone="success"
          label="Assets"
          note={reels.length > 0 ? `${reels.length} posts on file` : "What went live"}
          href="/(tabs)/assets"
        />
        <Shortcut
          order={3}
          icon="receipt-outline"
          tone="warning"
          label="Billing"
          note="Your statements"
          href="/(tabs)/billing"
        />
      </Reveal>

      <Reveal index={4}>
        <AudiencePerformanceChart campaigns={campaigns} />
      </Reveal>

      <SectionTitle
        title="Campaigns"
        note={`${campaigns.length} in total, ${liveCampaigns} live`}
        right={
          campaigns.length > 0 ? (
            <Button
              small
              kind="ghost"
              label="See all"
              onPress={() => router.navigate("/(tabs)/campaigns")}
            />
          ) : undefined
        }
      />

      {recentCampaigns.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={journeyWidth + space.md}
          snapToAlignment="start"
          style={{ marginHorizontal: -space.xl }}
          contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.md, paddingBottom: 6 }}
        >
          {recentCampaigns.map((campaign, index) => (
            <JourneyCard
              key={campaign.id || campaign._id || `${campaign.name || "campaign"}-${index}`}
              campaign={campaign}
              width={journeyWidth}
            />
          ))}
        </ScrollView>
      ) : (
        <EmptyState
          title="No campaigns yet"
          message="Campaigns show up here as soon as your account manager adds them."
        />
      )}

      <SectionTitle title="Where things stand" note="Progress, activity and phases at a glance" />
      <CampaignSnapshot
        progress={campaignProgress}
        activeCampaigns={activeCampaigns}
        totalCampaigns={campaigns.length}
        liveCreators={liveCreators}
        totalCreators={totalCreators}
        campaigns={campaigns}
      />

      <SectionTitle title="Spend split" note="Recorded spend across services" />
      <SpendByService spend={analytics?.spendByService ?? {}} />

      {events.length === 0 ? (
        <EmptyState
          icon="analytics-outline"
          title="Analytics are on the way"
          message="Reach and engagement appear here once reporting data comes in."
        />
      ) : null}

    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
  },
  hero: { borderRadius: 30, overflow: "hidden", padding: 22, paddingBottom: 20 },
  heroHello: { fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 18 },
  liveChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    height: 30,
    borderRadius: radius.pill,
  },
  liveChipText: { fontFamily: fonts.sansMedium, fontSize: 12 },
  headline: {
    fontFamily: fonts.serifMedium,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.9,
    textAlign: "center",
    marginTop: 14,
  },
  frames: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    marginTop: 22,
  },
  frameChip: {
    position: "absolute",
    bottom: 10,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  frameChipText: { fontFamily: fonts.sansSemi, fontSize: 10.5, color: "#16131F" },
  heroChips: { flexDirection: "row", gap: 8, marginTop: 22 },
  heroChip: { flex: 1, borderRadius: 18, paddingVertical: 11, paddingHorizontal: 8, alignItems: "center" },
  heroChipValue: { fontFamily: fonts.sansSemi, fontSize: 17, lineHeight: 22, letterSpacing: -0.3 },
  heroChipLabel: { fontFamily: fonts.sans, fontSize: 10.5, lineHeight: 15 },
  tickerWindow: { height: 22, overflow: "hidden", justifyContent: "center" },
  tickerText: {
    position: "absolute",
    left: 0,
    right: 0,
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    lineHeight: 22,
  },
  darkCard: { borderRadius: 24, padding: 22, overflow: "hidden" },
  cardDot: { position: "absolute", top: 16, right: 16, width: 8, height: 8, borderRadius: 4 },
  darkLabel: { fontFamily: fonts.sansMedium, fontSize: 14, color: "rgba(255,255,255,0.7)" },
  darkFigure: {
    fontFamily: fonts.serifMedium,
    fontSize: 46,
    lineHeight: 54,
    letterSpacing: -1.4,
    color: "#FFFFFF",
    marginTop: 2,
  },
  darkBody: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    lineHeight: 20,
    color: "rgba(255,255,255,0.62)",
    marginTop: 6,
  },
  darkFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
  },
  square: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  percentChip: {
    height: 38,
    borderRadius: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  squareText: { fontFamily: fonts.sansSemi, fontSize: 13, color: "#FFFFFF" },
  whiteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  whiteButtonText: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: "#0D0B14" },
  lightCard: {
    borderRadius: 24,
    padding: 22,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  go: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  news: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: space.md,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: radius.pill,
  },
  gauge: { flex: 1, alignItems: "center", gap: 8 },
  gaugeRing: { width: 78, height: 78, alignItems: "center", justifyContent: "center" },
  gaugeValue: {
    position: "absolute",
    maxWidth: 54,
    fontFamily: fonts.serifMedium,
    fontSize: 19,
    lineHeight: 24,
    textAlign: "center",
  },
  stack: { flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden", gap: 2 },
  spendLine: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11 },
  percent: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, minWidth: 46, alignItems: "center" },
  lightTitle: { fontFamily: fonts.serifMedium, fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
  highlight: { borderRadius: radius.xl, overflow: "hidden", justifyContent: "space-between" },
  highlightTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: 14,
  },
  rank: { fontFamily: fonts.serifItalic, fontSize: 44, lineHeight: 46, opacity: 0.9 },
  kind: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,28,0.45)",
  },
  highlightViews: { fontFamily: fonts.serifMedium, fontSize: 34, lineHeight: 38, letterSpacing: -0.8 },
  playBar: { flex: 1, height: 3, borderRadius: 2, overflow: "hidden" },
  shortcuts: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  shortcut: {
    flexGrow: 1,
    flexBasis: "45%",
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.lg,
    gap: space.md,
  },
  shortcutIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  phaseStrip: { flexDirection: "row", gap: 4, marginTop: space.md },
  phaseDash: { flex: 1, height: 4, borderRadius: 2 },
  growth: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginBottom: 6,
  },
  chartEmpty: { height: 130, alignItems: "center", justifyContent: "center", gap: 8 },
  snapshotRow: { flexDirection: "row", alignItems: "center", gap: space.lg },
  snapshotItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.md,
  },
  snapshotDot: { width: 8, height: 8, borderRadius: 4 },
  spendRow: { flexDirection: "row", alignItems: "center", gap: space.xl },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
});
