import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Pressable,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";

import { useAuth } from "../../src/context/AuthContext";
import {
  getPortalAnalytics,
  getPortalCampaigns,
  PortalAnalytics,
  PortalCampaign,
} from "../../src/lib/api";

// --------------------------------------------------
// THEME
// --------------------------------------------------

const COLORS = {
  background: "#F7F6F2",
  surface: "#FFFFFF",
  navy: "#17243A",
  navyLight: "#263A59",
  muted: "#89909B",
  text: "#303B4D",
  border: "#ECEBE7",
  lavender: "#A9A5D5",
  lavenderLight: "#EFEEF9",
  green: "#239B70",
  greenLight: "#E8F5EF",
  blue: "#6286C5",
  blueLight: "#EAF0FA",
  amber: "#D49A42",
  amberLight: "#FBF2E5",
  red: "#C75B5B",
};

const CARD_RADIUS = 20;

// --------------------------------------------------
// FORMAT HELPERS
// --------------------------------------------------

function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("en-IN", {
    notation: value >= 100000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
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

function CampaignProgressCard({
  progress,
  activeCampaigns,
  totalCampaigns,
  liveCreators,
  totalCreators,
}: {
  progress: number | null;
  activeCampaigns: number;
  totalCampaigns: number;
  liveCreators: number;
  totalCreators: number;
}) {
  const [selectedMetric, setSelectedMetric] = useState("progress");
  const [hoveredMetric, setHoveredMetric] = useState<string | null>(null);
  const { width: windowWidth } = useWindowDimensions();

  const safeProgress =
    progress == null ? 0 : Math.max(0, Math.min(100, progress));
  const activeRatio = totalCampaigns > 0
    ? Math.max(0, Math.min(100, (activeCampaigns / totalCampaigns) * 100))
    : 0;
  const creatorRatio = totalCreators > 0
    ? Math.max(0, Math.min(100, (liveCreators / totalCreators) * 100))
    : 0;

  const metrics = [
    {
      id: "progress",
      label: "Campaign progress",
      value: progress == null ? "—" : `${Math.round(safeProgress)}%`,
      color: "#3155B7",
      tint: "#EAF0FF",
      description: "Average completion across campaigns",
      ratio: safeProgress,
    },
    {
      id: "active",
      label: "Active campaigns",
      value: String(activeCampaigns),
      color: "#16A085",
      tint: "#E6F7F2",
      description: `${Math.max(0, totalCampaigns - activeCampaigns)} completed`,
      ratio: activeRatio,
    },
    {
      id: "creators",
      label: "Creators live",
      value: `${liveCreators}/${totalCreators}`,
      color: "#168F62",
      tint: "#E7F5EE",
      description: "Currently live on the roster",
      ratio: creatorRatio,
    },
  ];

  const selected = metrics.find((item) => item.id === selectedMetric) || metrics[0];
  const ringSize = Math.min(190, Math.max(132, windowWidth * 0.43));
  const ringSpecs = [
    { metric: metrics[0], size: ringSize, stroke: 10 },
    { metric: metrics[1], size: ringSize * 0.76, stroke: 10 },
    { metric: metrics[2], size: ringSize * 0.52, stroke: 10 },
  ];

  return (
    <View style={styles.progressCard}>
      <View style={styles.progressCardHeading}>
        <Text style={styles.progressCardTitle}>Campaign snapshot</Text>
        <Text style={styles.progressCardHint}>Select a ring to highlight</Text>
      </View>

      <View style={styles.progressOverviewRow}>
        {/* Metric list on the LEFT */}
        <View style={styles.progressMetricList}>
          {metrics.map((item) => {
            const active = selectedMetric === item.id;
            const hovered = hoveredMetric === item.id;

            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`${item.label}: ${item.value}`}
                accessibilityState={{ selected: active }}
                onPress={() => setSelectedMetric(item.id)}
                onHoverIn={() => setHoveredMetric(item.id)}
                onHoverOut={() => setHoveredMetric(null)}
                style={[
                  styles.progressMetricRow,
                  (active || hovered) && styles.progressMetricRowActive,
                  (active || hovered) && { borderLeftColor: item.color },
                ]}
              >
                <View style={[styles.progressMetricDot, { backgroundColor: item.color }]} />
                <View style={styles.progressMetricCopy}>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.progressMetricLabel,
                      (active || hovered) && { color: item.color },
                    ]}
                  >
                    {item.label}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.progressMetricValue,
                      (active || hovered) && { color: item.color },
                    ]}
                  >
                    {item.value}
                  </Text>
                  <Text numberOfLines={1} style={styles.progressMetricDescription}>
                    {item.description}
                  </Text>
                </View>
                {(active || hovered) && (
                  <Ionicons name="chevron-forward" size={14} color={item.color} />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Three concentric, individually clickable rings on the RIGHT */}
        <View style={[styles.progressRingsStage, { width: ringSize, height: ringSize }]}>
          {ringSpecs.map(({ metric, size, stroke }) => {
            const active = selectedMetric === metric.id;
            const hovered = hoveredMetric === metric.id;
            const radius = (size - stroke) / 2;
            const circumference = 2 * Math.PI * radius;
            const dash = (metric.ratio / 100) * circumference;

            return (
              <Pressable
                key={metric.id}
                accessibilityRole="button"
                accessibilityLabel={`Highlight ${metric.label}`}
                accessibilityState={{ selected: active }}
                onPress={(event) => {
                  event.stopPropagation();
                  setSelectedMetric(metric.id);
                }}
                onHoverIn={() => setHoveredMetric(metric.id)}
                onHoverOut={() => setHoveredMetric(null)}
                style={[
                  styles.progressRingTouch,
                  {
                    width: size,
                    height: size,
                    left: (ringSize - size) / 2,
                    top: (ringSize - size) / 2,
                    zIndex: metric.id === "creators" ? 3 : metric.id === "active" ? 2 : 1,
                    transform: [{ scale: active || hovered ? 1.025 : 1 }],
                  },
                ]}
              >
                <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                  <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={metric.tint}
                    strokeWidth={stroke}
                    fill="none"
                  />
                  <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={metric.color}
                    strokeWidth={active || hovered ? stroke + 1.5 : stroke}
                    strokeDasharray={`${dash} ${circumference}`}
                    strokeLinecap="round"
                    fill="none"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  />
                </Svg>
                {(active || hovered) && (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.progressRingGlow,
                      { borderColor: metric.color },
                    ]}
                  />
                )}
              </Pressable>
            );
          })}
          <View pointerEvents="none" style={styles.progressRingCenter}>
            <Text style={[styles.progressRingCenterValue, { color: selected.color }]}>
              {selected.value}
            </Text>
            <Text style={styles.progressRingCenterLabel} numberOfLines={1}>
              {selected.id === "progress" ? "PROGRESS" : selected.id === "active" ? "ACTIVE" : "LIVE"}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function PerformanceTile({
  icon,
  label,
  value,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <View style={styles.performanceTile}>
      <View style={styles.performanceTileTop}>
        <Ionicons name={icon} size={18} color={accent} />
        <Text style={styles.performanceTileValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Text style={styles.performanceTileLabel}>{label}</Text>
    </View>
  );
}

// --------------------------------------------------
// SECTION HEADER
// --------------------------------------------------

function SectionHeading({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionHeadingText}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

// --------------------------------------------------
// KPI CARD
// --------------------------------------------------

function MetricCard({
  label,
  value,
  description,
  icon,
  color,
  iconBackground,
}: {
  label: string;
  value: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  iconBackground: string;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricTop}>
        <View
          style={[
            styles.metricIcon,
            { backgroundColor: iconBackground },
          ]}
        >
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Ionicons
          name="ellipsis-horizontal"
          size={18}
          color="#B6BAC1"
        />
      </View>

      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.metricDescription}>{description}</Text>
    </View>
  );
}

// --------------------------------------------------
// AUDIENCE PERFORMANCE CHART
// Uses the analytics endpoint's recorded impressions and engagements.
// The chart is drawn with React Native Views; no chart/Reanimated package.
// --------------------------------------------------

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

  const chartValues = points.slice(-8);
  const maxValue = Math.max(1, ...chartValues.map((point) => point.value));
  const chartPoints = chartValues.map((point, index, list) => ({
    ...point,
    x: list.length <= 1
      ? plotWidth / 2
      : (index / (list.length - 1)) * (plotWidth - 12) + 6,
    y: plotHeight - 10 - (point.value / maxValue) * (plotHeight - 24),
  }));

  return (
    <View style={styles.performanceChartCard}>
      <View style={styles.performanceChartHeader}>
        <Text style={styles.performanceChartTitle}>Audience performance</Text>
        <View style={styles.chartPeriodDropdown}>
          <Text style={styles.chartPeriodDropdownText}>
            {period === "ALL" ? "All time" : `Last ${period === "7D" ? "7 days" : "30 days"}`}
          </Text>
        </View>
      </View>

      <View style={styles.performanceTabs}>
        <TouchableOpacity
          onPress={() => setMetric("views")}
          style={[styles.performanceTab, metric === "views" && styles.performanceTabActive]}
          activeOpacity={0.8}
        >
          <Text style={[styles.performanceTabText, metric === "views" && styles.performanceTabTextActive]}>Views</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setMetric("engagements")}
          style={[styles.performanceTab, metric === "engagements" && styles.performanceTabActive]}
          activeOpacity={0.8}
        >
          <Text style={[styles.performanceTabText, metric === "engagements" && styles.performanceTabTextActive]}>Engagements</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.performanceValueRow}>
        <Text style={styles.performanceChartValue}>
          {formatPerformanceNumber(total)}
        </Text>
        {growth != null && growth !== 0 ? (
          <View style={styles.growthPill}>
            <Ionicons
              name={growth >= 0 ? "trending-up" : "trending-down"}
              size={12}
              color={growth >= 0 ? COLORS.green : COLORS.red}
            />
            <Text style={[styles.growthText, { color: growth >= 0 ? COLORS.green : COLORS.red }]}>
              {growth >= 0 ? "+" : "−"}{formatPerformanceNumber(Math.abs(growth))} in period
            </Text>
          </View>
        ) : null}
      </View>

      {chartPoints.length > 1 ? (
        <View style={[styles.performancePlot, { width: plotWidth, height: plotHeight }]}>
          {[0, 1, 2].map((line) => (
            <View key={line} style={[styles.performanceGridLine, { top: 12 + line * 48, width: plotWidth }]} />
          ))}
          {chartPoints.slice(1).map((point, index) => {
            const previous = chartPoints[index];
            const dx = point.x - previous.x;
            const dy = point.y - previous.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            return (
              <View
                key={`segment-${index}`}
                style={[styles.performanceLineSegment, {
                  left: (previous.x + point.x - length) / 2,
                  top: (previous.y + point.y) / 2 - 1.25,
                  width: length,
                  transform: [{ rotate: `${angle}deg` }],
                }]}
              />
            );
          })}
          {chartPoints.map((point, index) => (
            <View key={`point-${index}`} style={[styles.performancePoint, { left: point.x - 4, top: point.y - 4 }]} />
          ))}
        </View>
      ) : (
        <View style={[styles.performancePlotEmpty, { height: plotHeight }]}>
          <Text style={styles.chartEmptyText}>
            {growthSeries.length === 0
              ? "Growth data appears after at least two recorded reading days."
              : "No readings are available in this selected period."}
          </Text>
        </View>
      )}

      <View style={styles.performanceAxis}>
        <Text style={styles.axisText}>{formatDate(chartPoints[0]?.date)}</Text>
        <Text style={styles.axisText}>{formatDate(chartPoints[chartPoints.length - 1]?.date)}</Text>
      </View>
      <View style={styles.performancePeriodRow}>
        {(["7D", "30D", "ALL"] as const).map((item) => (
          <TouchableOpacity key={item} onPress={() => setPeriod(item)} style={[styles.performancePeriodButton, period === item && styles.performancePeriodButtonActive]}>
            <Text style={[styles.performancePeriodText, period === item && styles.performancePeriodTextActive]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// --------------------------------------------------
// CUSTOM REACH CHART
// Uses actual event reach values.
// --------------------------------------------------

function ReachChart({
  events,
}: {
  events: NonNullable<PortalAnalytics["events"]>;
}) {
  const [period, setPeriod] = useState<"7D" | "30D" | "ALL">("7D");

  const chartEvents = useMemo(() => {
    const sorted = [...events].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    if (period === "ALL") return sorted;
    return sorted.slice(-(period === "7D" ? 7 : 30));
  }, [events, period]);

  const maxValue = Math.max(1, ...chartEvents.map((event) => Number(event.reach) || 0));
  const totalReach = chartEvents.reduce((sum, event) => sum + (Number(event.reach) || 0), 0);
  const barEvents = chartEvents.slice(-7);

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartTopRow}>
        <View>
          <Text style={styles.chartEyebrow}>AUDIENCE REACH</Text>
          <Text style={styles.chartMainValue}>{formatNumber(totalReach)}</Text>
          <Text style={styles.chartDescription}>Recorded reach in selected period</Text>
        </View>
        <View style={styles.chartLegend}>
          <View style={styles.legendDot} />
          <Text style={styles.legendText}>Reach</Text>
        </View>
      </View>

      <View style={styles.periodSelector}>
        {(["7D", "30D", "ALL"] as const).map((item) => (
          <TouchableOpacity key={item} onPress={() => setPeriod(item)} style={[styles.periodButton, period === item && styles.periodButtonActive]} activeOpacity={0.8}>
            <Text style={[styles.periodText, period === item && styles.periodTextActive]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {barEvents.length > 0 ? (
        <>
          <View style={styles.barChart}>
            {barEvents.map((event, index) => {
              const value = Number(event.reach) || 0;
              const height = Math.max(5, (value / maxValue) * 112);
              return (
                <View key={`${event.date}-${index}`} style={styles.barColumn}>
                  <View style={styles.barTrack}>
                    <View style={[styles.reachBar, { height }, index === barEvents.length - 1 && styles.reachBarActive]} />
                  </View>
                </View>
              );
            })}
          </View>
          <View style={styles.chartAxis}>
            <Text style={styles.axisText}>{formatDate(barEvents[0]?.date)}</Text>
            <Text style={styles.axisText}>{formatDate(barEvents[barEvents.length - 1]?.date)}</Text>
          </View>
        </>
      ) : (
        <View style={styles.chartEmpty}>
          <Ionicons name="analytics-outline" size={28} color="#B3B7C0" />
          <Text style={styles.chartEmptyText}>Reach data will appear here when available.</Text>
        </View>
      )}
    </View>
  );
}

// --------------------------------------------------
// SPEND BY SERVICE
// --------------------------------------------------

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
  const colors = ["#5146C8", "#8175E8", "#A69DF1", "#C8C2F7", "#17243A", "#6D83C8"];
  const radius = 39;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const segmentGap = entries.length > 1 ? 3 : 0;
  let accumulatedFraction = 0;

  return (
    <View style={styles.serviceCard}>
      <View style={styles.spendHeader}>
        <View style={styles.spendHeaderText}>
          <Text style={styles.spendTitle}>Spend split</Text>
          <Text style={styles.spendSubtitle}>Recorded spend across services</Text>
        </View>
        <View style={styles.spendHeaderIcon}>
          <Ionicons name="wallet-outline" size={19} color="#5146C8" />
        </View>
      </View>

      {total > 0 ? (
        <View style={styles.spendChartContent}>
          <View style={styles.spendDonutWrap}>
            <Svg width={124} height={124} viewBox="0 0 100 100">
              <Circle
                cx="50"
                cy="50"
                r={radius}
                stroke="#F0EEF8"
                strokeWidth={strokeWidth}
                fill="none"
              />
              {entries.map((item, index) => {
                const fraction = item.value / total;
                const visibleLength = Math.max(
                  0,
                  fraction * circumference - segmentGap
                );
                const dashOffset = -accumulatedFraction * circumference;
                accumulatedFraction += fraction;

                return (
                  <Circle
  key={item.name}
  cx="50"
  cy="50"
  r={radius}
  stroke={colors[index % colors.length]}
  strokeWidth={strokeWidth}
  strokeDasharray={`${visibleLength} ${circumference}`}
  strokeDashoffset={dashOffset}
  strokeLinecap="butt"
  fill="none"
  transform="rotate(-90 50 50)"
/>
                );
              })}
            </Svg>
            <View style={styles.spendDonutCenter}>
              <Text style={styles.spendDonutCaption}>TOTAL</Text>
              <Text style={styles.spendDonutValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatCurrency(total)}
              </Text>
            </View>
          </View>

          <View style={styles.spendLegend}>
            {entries.map((item, index) => {
              const percentage = (item.value / total) * 100;
              return (
                <View key={item.name} style={styles.spendLegendRow}>
                  <View style={styles.spendLegendLabelGroup}>
                    <View
                      style={[
                        styles.spendLegendDot,
                        { backgroundColor: colors[index % colors.length] },
                      ]}
                    />
                    <Text style={styles.spendLegendName} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </View>
                  <Text style={styles.spendLegendPercent}>
                    {percentage.toFixed(percentage % 1 === 0 ? 0 : 1)}%
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : (
        <View style={styles.serviceEmpty}>
          <View style={styles.spendEmptyIcon}>
            <Ionicons name="pie-chart-outline" size={23} color="#8D85D9" />
          </View>
          <Text style={styles.spendEmptyTitle}>No spend recorded yet</Text>
          <Text style={styles.chartEmptyText}>
            Service spending details will appear here when available.
          </Text>
        </View>
      )}
    </View>
  );
}

// --------------------------------------------------
// CAMPAIGN CARD
// --------------------------------------------------

function RecentCampaignCard({
  campaign,
}: {
  campaign: PortalCampaign;
}) {
  const live = isCampaignLive(campaign);

  return (
    <View style={styles.campaignCard}>
      <View style={styles.campaignTopRow}>
        <View style={styles.campaignTitleContainer}>
          <Text style={styles.campaignName} numberOfLines={2}>
            {campaign.name || "Untitled campaign"}
          </Text>

          <Text style={styles.campaignService}>
            {[campaign.service, campaign.region]
              .filter(Boolean)
              .join(" · ") || "Campaign"}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            live ? styles.liveBadge : styles.defaultBadge,
          ]}
        >
          <View
            style={[
              styles.statusDot,
              live ? styles.liveDot : styles.defaultDot,
            ]}
          />
          <Text
            style={[
              styles.statusText,
              live ? styles.liveText : styles.defaultText,
            ]}
          >
            {getCampaignStatus(campaign)}
          </Text>
        </View>
      </View>

      <View style={styles.campaignDivider} />

      <View style={styles.campaignDetailsRow}>
        <View style={styles.campaignDetail}>
          <Text style={styles.campaignDetailLabel}>BUDGET</Text>
          <Text style={styles.campaignDetailValue}>
            {numeric(campaign.budget) == null
              ? "—"
              : formatCurrency(numeric(campaign.budget))}
          </Text>
        </View>

        <View style={styles.campaignDetail}>
          <Text style={styles.campaignDetailLabel}>CREATORS</Text>
          <Text style={styles.campaignDetailValue}>
            {campaign.creators == null ? "—" : campaign.creators.length}
          </Text>
        </View>

        <View style={styles.campaignDetail}>
          <Text style={styles.campaignDetailLabel}>START DATE</Text>
          <Text style={styles.campaignDetailValue}>
            {formatDate(campaign.start)}
          </Text>
        </View>
      </View>
    </View>
  );
}

// --------------------------------------------------
// EMPTY STATE
// --------------------------------------------------

function EmptyState({
  title,
  description,
  icon = "folder-open-outline",
}: {
  title: string;
  description: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={24} color={COLORS.navy} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{description}</Text>
    </View>
  );
}

// --------------------------------------------------
// OVERVIEW SCREEN
// --------------------------------------------------

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
          "Client information is unavailable. Please sign in again."
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

  // -----------------------------------------------
  // LOADING
  // -----------------------------------------------

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.loadingIcon}>
          <ActivityIndicator size="large" color={COLORS.navy} />
        </View>
        <Text style={styles.loadingTitle}>
          Preparing your dashboard
        </Text>
        <Text style={styles.loadingText}>
          Loading your latest campaign data...
        </Text>
      </View>
    );
  }

  // -----------------------------------------------
  // ERROR
  // -----------------------------------------------

  if (error && !analytics) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.errorIcon}>
          <Ionicons
            name="cloud-offline-outline"
            size={30}
            color={COLORS.red}
          />
        </View>

        <Text style={styles.errorTitle}>
          Unable to load overview
        </Text>

        <Text style={styles.errorMessage}>{error}</Text>

        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => loadAnalytics()}
          activeOpacity={0.8}
        >
          <Ionicons
            name="refresh"
            size={17}
            color="#FFFFFF"
          />
          <Text style={styles.retryButtonText}>
            Try again
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // -----------------------------------------------
  // MAIN UI
  // -----------------------------------------------

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        compact && styles.compactContent,
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadAnalytics(true)}
          tintColor={COLORS.navy}
          colors={[COLORS.navy]}
        />
      }
    >
      {/* PERSONALIZED GREETING */}

      <View style={styles.greetingContainer}>
        <View style={styles.greetingTopRow}>
          <View style={styles.greetingEyebrow}>
            <View style={styles.greetingEyebrowDot} />
            <Text style={styles.greetingEyebrowText}>
              FIFTH AVENUE · CLIENT PORTAL
            </Text>
          </View>

          <View style={styles.greetingTimeIcon}>
            <Ionicons
              name={greetingIcon}
              size={20}
              color="#A78355"
            />
          </View>
        </View>

        <Text style={styles.greetingLabel}>
          {greeting}
        </Text>

        <Text style={styles.greetingName} numberOfLines={1}>
          {greetingName}.
        </Text>

        <View style={styles.greetingUnderline} />

        <Text style={styles.greetingDescription}>
          {greetingMessage}
        </Text>

        <View pointerEvents="none" style={styles.greetingOrb} />
      </View>

      {error ? (
        <View style={styles.refreshError}>
          <Ionicons
            name="alert-circle-outline"
            size={16}
            color={COLORS.red}
          />
          <Text style={styles.refreshErrorText}>{error}</Text>
        </View>
      ) : null}

      {/* CAMPAIGN PROGRESS */}

      <CampaignProgressCard
        progress={campaignProgress}
        activeCampaigns={activeCampaigns}
        totalCampaigns={campaigns.length}
        liveCreators={liveCreators}
        totalCreators={totalCreators}
      />

      {/* PERFORMANCE METRICS */}

      <View style={styles.performanceGrid}>
        <PerformanceTile
          icon="eye-outline"
          label="Total views"
          value={allCreators.some((creator) => creator.views != null) ? formatNumber(totalViews) : "—"}
          accent="#6257D9"
        />
        <PerformanceTile
          icon="people-outline"
          label="Reach"
          value={formatNumber(totals.reach)}
          accent="#4D5DCE"
        />
        <PerformanceTile
          icon="trending-up-outline"
          label="Engagement"
          value={engagementRate == null ? "—" : `${engagementRate.toFixed(1)}%`}
          accent="#239B70"
        />
        <PerformanceTile
          icon="layers-outline"
          label="CPV"
          value={cpv === null ? "—" : `₹${cpv.toFixed(4)}`}
          accent="#6D62C7"
        />
      </View>

      <Text style={styles.metricFootnote}>
        {estimatedSavings == null
          ? "Savings vs. industry benchmark: —"
          : `Estimated savings vs. ₹0.30 industry CPV: ${formatCurrency(estimatedSavings)}`}
      </Text>

      <AudiencePerformanceChart campaigns={campaigns} />

     

      

      {/* CAMPAIGN SUMMARY */}

      <SectionHeading
        title="Campaign summary"
        subtitle="A quick look at your activity"
      />

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryIconWrap}>
            <Ionicons
              name="briefcase-outline"
              size={19}
              color={COLORS.navy}
            />
          </View>

          <View style={styles.summaryText}>
            <Text style={styles.summaryLabel}>
              Total campaigns
            </Text>
            <Text style={styles.summaryDescription}>
              Campaigns available in your portal
            </Text>
          </View>

          <Text style={styles.summaryValue}>
            {campaigns.length}
          </Text>
        </View>

        <View style={styles.separator} />

        <View style={styles.summaryRow}>
          <View
            style={[
              styles.summaryIconWrap,
              { backgroundColor: COLORS.greenLight },
            ]}
          >
            <Ionicons
              name="radio-outline"
              size={19}
              color={COLORS.green}
            />
          </View>

          <View style={styles.summaryText}>
            <Text style={styles.summaryLabel}>
              Live campaigns
            </Text>
            <Text style={styles.summaryDescription}>
              Campaigns with at least one live creator
            </Text>
          </View>

          <Text style={styles.summaryValue}>
            {liveCampaigns}
          </Text>
        </View>

        <View style={styles.separator} />

        <View style={styles.summaryRow}>
          <View
            style={[
              styles.summaryIconWrap,
              { backgroundColor: COLORS.lavenderLight },
            ]}
          >
            <Ionicons
              name="trending-up-outline"
              size={19}
              color={COLORS.lavender}
            />
          </View>

          <View style={styles.summaryText}>
            <Text style={styles.summaryLabel}>
              Engagement rate
            </Text>
            <Text style={styles.summaryDescription}>
              Average measured likes + comments per tracked view
            </Text>
          </View>

          <Text style={styles.summaryValue}>
            {engagementRate == null ? "—" : `${engagementRate.toFixed(2)}%`}
          </Text>
        </View>
      </View>

      {/* SPEND BREAKDOWN */}

      <SectionHeading
        title="Spend breakdown"
        subtitle="Recorded spend across services"
      />

      <SpendByService
        spend={analytics?.spendByService ?? {}}
      />

      {/* RECENT CAMPAIGNS */}

      <SectionHeading
        title="Recent campaigns"
        subtitle="Your latest campaign activity"
        right={
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>
              {campaigns.length} total
            </Text>
          </View>
        }
      />

      {recentCampaigns.length > 0 ? (
        recentCampaigns.map((campaign, index) => (
          <RecentCampaignCard
            key={
              campaign.id ||
              campaign._id ||
              `${campaign.name || "campaign"}-${index}`
            }
            campaign={campaign}
          />
        ))
      ) : (
        <EmptyState
          title="No campaigns yet"
          description="Your campaigns will appear here when they are added to your client portal."
        />
      )}

      {/* ANALYTICS EMPTY STATE */}

      {events.length === 0 && (
        <EmptyState
          title="Analytics are not available yet"
          description="Your campaign analytics will appear here when reporting data becomes available."
          icon="analytics-outline"
        />
      )}

      {/* FOOTER */}

      <View style={styles.footer}>
        <View style={styles.footerLine} />
        <Text style={styles.footerText}>
          FIFTH AVENUE
        </Text>
        <Text style={styles.footerCaption}>
          Your client dashboard
        </Text>
      </View>
    </ScrollView>
  );
}

// --------------------------------------------------
// STYLES
// --------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 58,
    paddingBottom: 42,
  },

  compactContent: {
    paddingHorizontal: 16,
  },

  centerContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
  },

  loadingIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },

  loadingTitle: {
    color: COLORS.navy,
    fontSize: 17,
    fontWeight: "700",
    marginTop: 20,
  },

  loadingText: {
    marginTop: 8,
    color: COLORS.muted,
    fontSize: 13,
  },

  greetingContainer: {
    position: "relative",
    minHeight: 205,
    backgroundColor: "#FDF9F3",
    borderRadius: 24,
    paddingHorizontal: 21,
    paddingTop: 19,
    paddingBottom: 21,
    marginBottom: 29,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F1E8DC",
  },

  greetingTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
  },

  greetingEyebrow: {
    flexDirection: "row",
    alignItems: "center",
  },

  greetingEyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.green,
    marginRight: 7,
  },

  greetingEyebrowText: {
    color: "#8B8175",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.25,
  },

  greetingTimeIcon: {
    width: 37,
    height: 37,
    borderRadius: 13,
    backgroundColor: "#F4EBDD",
    alignItems: "center",
    justifyContent: "center",
  },

  greetingLabel: {
    color: COLORS.navy,
    fontFamily: "serif",
    fontSize: 19,
    fontStyle: "italic",
    fontWeight: "600",
  },

  greetingName: {
    color: COLORS.navy,
    fontFamily: "serif",
    fontSize: 39,
    fontStyle: "italic",
    fontWeight: "700",
    letterSpacing: -1.2,
    marginTop: 1,
    maxWidth: "100%",
  },

  greetingUnderline: {
    width: 91,
    height: 3,
    borderRadius: 5,
    backgroundColor: "#C9A46D",
    marginTop: 9,
    marginBottom: 14,
    transform: [{ rotate: "-3deg" }],
  },

  greetingDescription: {
    color: COLORS.navyLight,
    fontSize: 12,
    lineHeight: 19,
    fontWeight: "500",
    maxWidth: "88%",
    zIndex: 1,
  },

  greetingOrb: {
    position: "absolute",
    width: 145,
    height: 145,
    borderRadius: 73,
    right: -76,
    top: 66,
    backgroundColor: "#F4EBDD",
    opacity: 0.75,
  },

  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
    marginTop: 7,
  },

  sectionHeadingText: {
    flex: 1,
  },

  sectionTitle: {
    color: COLORS.navy,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },

  sectionSubtitle: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 5,
  },

  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 25,
  },

  metricCard: {
    width: "48.2%",
    minHeight: 151,
    backgroundColor: COLORS.surface,
    borderRadius: CARD_RADIUS,
    padding: 15,
    marginBottom: 11,
    borderWidth: 1,
    borderColor: "#F0EFEB",
  },

  metricTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 13,
  },

  metricIcon: {
    width: 35,
    height: 35,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  metricLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "600",
  },

  metricValue: {
    color: COLORS.navy,
    fontSize: 24,
    fontWeight: "800",
    marginTop: 7,
    letterSpacing: -0.6,
  },

  metricDescription: {
    color: "#A3A8B0",
    fontSize: 10,
    marginTop: 5,
  },

  progressCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 15,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#ECEEF4",
    shadowColor: "#1C2940",
    shadowOpacity: 0.055,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  progressCardHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  progressCardTitle: {
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: -0.2,
  },

  progressCardHint: {
    color: "#9A9EAA",
    fontSize: 9,
    fontWeight: "500",
  },

  progressOverviewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 154,
  },

  progressMetricList: {
    flex: 1,
    minWidth: 0,
    gap: 7,
  },

  progressMetricRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 7,
    paddingHorizontal: 7,
    borderRadius: 11,
    borderLeftWidth: 3,
    borderLeftColor: "transparent",
    backgroundColor: "transparent",
  },

  progressMetricRowActive: {
    backgroundColor: "#F8F8FC",
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },

  progressMetricDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },

  progressMetricCopy: {
    flex: 1,
    minWidth: 0,
  },

  progressMetricLabel: {
    color: "#667085",
    fontSize: 9,
    fontWeight: "700",
  },

  progressMetricValue: {
    color: COLORS.navy,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
  },

  progressMetricDescription: {
    color: "#A3A8B0",
    fontSize: 8,
    marginTop: 1,
  },

  progressRingsStage: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  progressRingTouch: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },

  progressRingGlow: {
    position: "absolute",
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderWidth: 1,
    borderRadius: 999,
    opacity: 0.22,
  },

  progressRingCenter: {
    position: "absolute",
    width: "31%",
    height: "31%",
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  progressRingCenterValue: {
    fontSize: 11,
    fontWeight: "800",
  },

  progressRingCenterLabel: {
    color: "#9298A5",
    fontSize: 6,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginTop: 2,
  },

  performanceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
  },

  performanceTile: {
    width: "48.5%",
    minHeight: 68,
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 9,
    borderWidth: 1,
    borderColor: "#F0EFEB",
    shadowColor: "#1C2940",
    shadowOpacity: 0.035,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },

  performanceTileTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },

  performanceTileValue: {
    color: COLORS.navy,
    fontSize: 17,
    fontWeight: "800",
    flexShrink: 1,
  },

  performanceTileLabel: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: "600",
    marginTop: 6,
  },

  metricFootnote: {
    color: COLORS.muted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: -14,
    marginBottom: 25,
    paddingHorizontal: 3,
  },

  performanceChartCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 17,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: "#F0EEF7",
    shadowColor: "#25204A",
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  performanceChartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  performanceChartTitle: {
    color: COLORS.navy,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.25,
  },
  chartPeriodDropdown: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "#F7F6FA",
  },
  chartPeriodDropdownText: { color: COLORS.navy, fontSize: 10, fontWeight: "700" },
  performanceTabs: {
    flexDirection: "row",
    alignSelf: "flex-start",
    padding: 3,
    borderRadius: 20,
    backgroundColor: "#F4F2F8",
    marginBottom: 12,
  },
  performanceTab: { paddingHorizontal: 15, paddingVertical: 7, borderRadius: 16 },
  performanceTabActive: { backgroundColor: "#242E73" },
  performanceTabText: { color: COLORS.muted, fontSize: 10, fontWeight: "700" },
  performanceTabTextActive: { color: "#FFFFFF" },
  performanceValueRow: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 8 },
  performanceChartValue: { color: COLORS.navy, fontSize: 29, fontWeight: "800", letterSpacing: -0.8 },
  growthPill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 12, backgroundColor: "#EAF7F0" },
  growthText: { fontSize: 10, fontWeight: "800" },
  performancePlot: { alignSelf: "center", position: "relative", marginTop: 2, marginBottom: 4 },
  performanceGridLine: { position: "absolute", height: 1, backgroundColor: "#F0EFF5" },
  performanceLineSegment: { position: "absolute", height: 2.5, backgroundColor: "#6257D9", borderRadius: 3 },
  performancePoint: { position: "absolute", width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: "#6257D9" },
  performancePlotEmpty: { alignItems: "center", justifyContent: "center" },
  performanceAxis: { flexDirection: "row", justifyContent: "space-between", marginTop: 7 },
  performancePeriodRow: { flexDirection: "row", alignSelf: "flex-end", gap: 5, marginTop: 12 },
  performancePeriodButton: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  performancePeriodButtonActive: { backgroundColor: "#242E73" },
  performancePeriodText: { color: COLORS.muted, fontSize: 9, fontWeight: "700" },
  performancePeriodTextActive: { color: "#FFFFFF" },

  chartCard: {
    backgroundColor: COLORS.surface,
    borderRadius: CARD_RADIUS,
    padding: 18,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: "#F0EFEB",
  },

  chartTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  chartEyebrow: {
    color: COLORS.muted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.3,
  },

  chartMainValue: {
    color: COLORS.navy,
    fontSize: 27,
    fontWeight: "800",
    marginTop: 7,
  },

  chartDescription: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 3,
  },

  chartLegend: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },

  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.lavender,
    marginRight: 6,
  },

  legendText: {
    color: COLORS.muted,
    fontSize: 10,
  },

  periodSelector: {
    flexDirection: "row",
    alignSelf: "flex-start",
    backgroundColor: "#F4F3F0",
    borderRadius: 10,
    padding: 3,
    marginTop: 19,
    marginBottom: 18,
  },

  periodButton: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 8,
  },

  periodButtonActive: {
    backgroundColor: COLORS.navy,
  },

  periodText: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: "700",
  },

  periodTextActive: {
    color: "#FFFFFF",
  },

  barChart: {
    height: 126,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    paddingHorizontal: 2,
  },

  barColumn: {
    flex: 1,
    height: 118,
    alignItems: "center",
    justifyContent: "flex-end",
    marginHorizontal: 3,
  },

  barTrack: {
    height: 112,
    width: "72%",
    justifyContent: "flex-end",
    alignItems: "center",
    backgroundColor: "#F5F4F8",
    borderRadius: 7,
    overflow: "hidden",
  },

  reachBar: {
    width: "100%",
    backgroundColor: "#C9C5E5",
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },

  reachBarActive: {
    backgroundColor: COLORS.navy,
  },

  chartAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },

  axisText: {
    color: "#A0A5AE",
    fontSize: 9,
  },

  chartEmpty: {
    minHeight: 130,
    alignItems: "center",
    justifyContent: "center",
  },

  chartEmptyText: {
    color: COLORS.muted,
    fontSize: 11,
    textAlign: "center",
    marginTop: 9,
    lineHeight: 17,
  },

  summaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 16,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: "#F0EFEB",
  },

  summaryRow: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
  },

  summaryIconWrap: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: "#F0F1F5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  summaryText: {
    flex: 1,
  },

  summaryLabel: {
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: "700",
  },

  summaryDescription: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 4,
    maxWidth: 190,
  },

  summaryValue: {
    color: COLORS.navy,
    fontSize: 18,
    fontWeight: "800",
    marginLeft: 8,
  },

  separator: {
    height: 1,
    backgroundColor: COLORS.border,
  },

  serviceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: "#EFEDF5",
    shadowColor: "#25204A",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },

  spendHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  spendHeaderText: {
    flex: 1,
  },
  spendTitle: {
    color: COLORS.navy,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  spendSubtitle: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 4,
  },
  spendHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "#F0EEFC",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  spendChartContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 132,
  },
  spendDonutWrap: {
    width: 124,
    height: 124,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  spendDonutCenter: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 17,
  },
  spendDonutCaption: {
    color: "#9290A5",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
  },
  spendDonutValue: {
    color: COLORS.navy,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 4,
    maxWidth: "100%",
  },
  spendLegend: {
    flex: 1,
    minWidth: 0,
    gap: 14,
    paddingVertical: 5,
  },
  spendLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  spendLegendLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  spendLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  spendLegendName: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: "600",
    flexShrink: 1,
  },
  spendLegendPercent: {
    color: COLORS.navy,
    fontSize: 10,
    fontWeight: "800",
    minWidth: 35,
    textAlign: "right",
  },
  serviceEmpty: {
    paddingVertical: 22,
    alignItems: "center",
  },
  spendEmptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#F0EEFC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  spendEmptyTitle: {
    color: COLORS.navy,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 1,
  },

  countPill: {
    backgroundColor: "#ECEEF3",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  countPillText: {
    color: COLORS.navy,
    fontSize: 10,
    fontWeight: "700",
  },

  campaignCard: {
    backgroundColor: COLORS.surface,
    borderRadius: CARD_RADIUS,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F0EFEB",
  },

  campaignTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  campaignTitleContainer: {
    flex: 1,
    marginRight: 8,
  },

  campaignName: {
    color: COLORS.navy,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },

  campaignService: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 5,
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
  },

  liveBadge: {
    backgroundColor: COLORS.greenLight,
  },

  defaultBadge: {
    backgroundColor: "#F1F2F4",
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },

  liveDot: {
    backgroundColor: COLORS.green,
  },

  defaultDot: {
    backgroundColor: "#8A8F98",
  },

  statusText: {
    fontSize: 9,
    fontWeight: "700",
  },

  liveText: {
    color: "#18794E",
  },

  defaultText: {
    color: "#667085",
  },

  campaignDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 14,
  },

  campaignDetailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  campaignDetail: {
    flex: 1,
  },

  campaignDetailLabel: {
    color: "#A0A5AE",
    fontSize: 9,
    fontWeight: "700",
    marginBottom: 6,
    letterSpacing: 0.5,
  },

  campaignDetailValue: {
    color: COLORS.navy,
    fontSize: 11,
    fontWeight: "700",
  },

  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: CARD_RADIUS,
    padding: 22,
    alignItems: "center",
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#F0EFEB",
  },

  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.lavenderLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },

  emptyTitle: {
    color: COLORS.navy,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },

  emptyMessage: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 7,
    textAlign: "center",
  },

  errorIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: "#FBECEC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  errorTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: COLORS.navy,
    marginBottom: 8,
  },

  errorMessage: {
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 21,
    fontSize: 13,
  },

  retryButton: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 23,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },

  refreshError: {
    backgroundColor: "#FCEDEC",
    borderRadius: 12,
    padding: 11,
    marginBottom: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  refreshErrorText: {
    color: COLORS.red,
    fontSize: 11,
    flex: 1,
  },

  footer: {
    alignItems: "center",
    marginTop: 27,
  },

  footerLine: {
    width: 35,
    height: 3,
    borderRadius: 3,
    backgroundColor: COLORS.lavender,
    marginBottom: 13,
  },

  footerText: {
    color: COLORS.navy,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },

  footerCaption: {
    color: "#A0A5AE",
    fontSize: 9,
    marginTop: 5,
  },
});