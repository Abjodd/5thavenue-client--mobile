import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useAuth } from "../../src/context/AuthContext";
import { useAppTheme } from "../../src/context/ThemeContext";
import { getPortalCampaigns, type PortalCampaign } from "../../src/lib/api";
import {
  AvatarStack,
  Card,
  EmptyState,
  ErrorState,
  Hairline,
  Pill,
  Reveal,
  ScreenScroll,
  ScreenSkeleton,
  ScreenTitle,
  Segmented,
  Sheet,
  T,
  Tap,
  useTone,
  initialOf,
  type IconName,
  type Tone,
} from "../../src/ui/primitives";
import { compactCount } from "../../src/ui/format";
import { fonts, midnight, radius, space, springs } from "../../src/ui/theme";

type ViewMode = "grid" | "board";
type ServiceFilter = "all" | "im";
type CampaignStage = "brief" | "shortlisting" | "production" | "live" | "completed";

type StageConfig = {
  key: CampaignStage;
  label: string;
  tone: Tone;
  progress: number;
};

const STAGES: StageConfig[] = [
  { key: "brief", label: "Brief & Strategy", tone: "neutral", progress: 8 },
  { key: "shortlisting", label: "Shortlisting", tone: "warning", progress: 16 },
  { key: "production", label: "Production", tone: "accent", progress: 55 },
  { key: "live", label: "Live", tone: "success", progress: 85 },
  { key: "completed", label: "Completed", tone: "neutral", progress: 100 },
];

// HELPERS

// --------------------------------------------------

function normalizeStage(value?: string): CampaignStage {
  const stage = (value || "").toLowerCase().trim();

  // Mirrors STAGE_TO_PHASE in the web portal's src/lib/phases.js.
  if (
    stage === "payment_done" ||
    stage === "completed" ||
    stage === "done" ||
    stage === "paid"
  ) return "completed";

  if (
    stage === "invoice_raised" ||
    stage === "live" ||
    stage === "creator_paid" ||
    stage === "reporting"
  ) return "live";

  if (
    stage === "advance_received" ||
    stage === "advance" ||
    stage === "execution" ||
    stage === "brief_sent" ||
    stage === "concept_submitted" ||
    stage === "concept_approved" ||
    stage === "production" ||
    stage === "video_submitted" ||
    stage === "internal_review" ||
    stage === "client_approved"
  ) return "production";

  if (
    stage === "team_assigned" ||
    stage === "po_raised" ||
    stage === "po" ||
    stage === "creator_shortlist"
  ) return "shortlisting";

  return "brief";
}

function getStageConfig(stage?: string) {
  const key = normalizeStage(stage);
  return STAGES.find((item) => item.key === key) || STAGES[0];
}

// Mirrors progressOf() in the web portal's src/lib/phases.js.
// The stored finance stage is authoritative; old stage names are mapped
// to their equivalent current stage. Stored progress is only a fallback
// for missing or unrecognised stages.
function getCampaignProgress(campaign: PortalCampaign): number {
  const stage = String(campaign.stage || "").toLowerCase().trim();

  const stageProgress: Record<string, number> = {
    draft: 0,
    brief_locked: 8,
    team_assigned: 16,
    po_raised: 35,
    advance_received: 55,
    invoice_raised: 80,
    payment_done: 100,
  };

  const legacyToStage: Record<string, string> = {
    brief_log: "draft",
    creator_shortlist: "draft",
    po: "team_assigned",
    advance: "po_raised",
    execution: "advance_received",
    reporting: "advance_received",
    brief_sent: "advance_received",
    concept_submitted: "advance_received",
    concept_approved: "advance_received",
    production: "advance_received",
    video_submitted: "advance_received",
    internal_review: "advance_received",
    client_approved: "advance_received",
    live: "advance_received",
    creator_paid: "advance_received",
    completed: "payment_done",
  };

  const resolvedStage = stageProgress[stage] != null
    ? stage
    : legacyToStage[stage];

  if (resolvedStage && stageProgress[resolvedStage] != null) {
    return stageProgress[resolvedStage];
  }

  const stored = Number((campaign as any).progress);
  return Number.isFinite(stored)
    ? Math.min(100, Math.max(0, stored))
    : 0;
}

function getCreatorCountLabel(campaign: PortalCampaign): string {
  const creators = Array.isArray(campaign.creators) ? campaign.creators : [];
  if (!creators.length) return "—";

  const numReq = Number((campaign as any).numReq) || null;
  if (!numReq) return String(creators.length);

  // Web mapping uses isLocked(creator), whose portal roster lock state is
  // represented by status === "locked".
  const lockedCount = creators.filter(
    (creator: any) => creator?.status === "locked"
  ).length;

  return `${lockedCount}/${numReq}`;
}

// The web campaign card's "Est. Reach" is actually the sum of tracked
// post views, not creator follower counts. For a missing current reading,
// use the newest history entry carrying that metric (same rule as mapping.js).
function getTrackedViews(campaign: PortalCampaign): number {
  const creators = Array.isArray(campaign.creators) ? campaign.creators : [];

  return creators.reduce((total, creator: any) => {
    const tracking = creator?.tracking || {};
    let value = tracking.views;

    if (value == null) {
      const history = Array.isArray(tracking.history)
        ? [...tracking.history].sort((a: any, b: any) =>
            String(b?.at || "").localeCompare(String(a?.at || ""))
          )
        : [];
      const latestWithViews = history.find(
        (entry: any) => entry?.views != null
      );
      value = latestWithViews?.views;
    }

    const parsed = Number(value);
    return total + (Number.isFinite(parsed) ? parsed : 0);
  }, 0);
}

function getCreatorCount(campaign: PortalCampaign) {
  return Array.isArray(campaign.creators) ? campaign.creators.length : 0;
}

function formatBudget(value?: number | string | null) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return "To be confirmed";
  }

  return `₹${amount.toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

function formatCompact(value: number) {
  return compactCount(value);
}

function isInfluencerMarketing(campaign: PortalCampaign) {

  return (campaign.service || "")

    .toLowerCase()

    .includes("influencer");

}

function getCampaignIdentity(campaign: PortalCampaign, index: number) {

  return campaign.id || campaign._id || `${campaign.name || "campaign"}-${index}`;

}

function formatDay(value: unknown, withYear = true): string {
  if (value === null || value === undefined || value === "" || typeof value === "object") return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : null),
  });
}

function dateRange(campaign: PortalCampaign): string {
  if (campaign.start && campaign.end) {
    return `${formatDay(campaign.start, false)} to ${formatDay(campaign.end)}`;
  }
  if (campaign.start) return `From ${formatDay(campaign.start)}`;
  return "";
}

function shortRupees(value: number): string {
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(1).replace(/\.0$/, "")}Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(1).replace(/\.0$/, "")}L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return `₹${Math.round(value)}`;
}

function creatorNames(campaign: PortalCampaign): string[] {
  return (Array.isArray(campaign.creators) ? campaign.creators : [])
    .map((creator: any) => String(creator?.name || creator?.handle || "").trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Campaign card
// ---------------------------------------------------------------------------

function Fact({ value, label, warn }: { value: string; label: string; warn?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flex: 1 }}>
      <T v="caption" tone="faint">
        {label}
      </T>
      <T
        v="bodyStrong"
        color={warn ? colors.warning : colors.text}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </T>
    </View>
  );
}

/** The five phases as a strip, filled up to the current one. */
function PhaseStrip({ stage, color, track }: { stage: CampaignStage; color: string; track: string }) {
  const current = STAGES.findIndex((item) => item.key === stage);
  return (
    <View style={{ flexDirection: "row", gap: 4, flex: 1 }}>
      {STAGES.map((item, index) => (
        <View
          key={item.key}
          style={{
            flex: 1,
            height: 5,
            borderRadius: 3,
            backgroundColor: index <= current ? color : track,
          }}
        />
      ))}
    </View>
  );
}

function CampaignCard({
  campaign,
  onOpen,
}: {
  campaign: PortalCampaign;
  onOpen: (campaign: PortalCampaign) => void;
}) {
  const { colors } = useAppTheme();
  const stage = getStageConfig(campaign.stage);
  const { fg } = useTone(stage.tone);
  const creatorsLabel = getCreatorCountLabel(campaign);
  const reach = getTrackedViews(campaign);
  const progress = getCampaignProgress(campaign);
  const budget = formatBudget(campaign.budget);
  const isPendingBudget = budget === "To be confirmed";
  const names = creatorNames(campaign);
  const dates = dateRange(campaign);

  return (
    <Tap
      onPress={() => onOpen(campaign)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${campaign.name || "campaign"} details`}
      scaleTo={0.98}
    >
      <Card style={{ gap: space.md }}>
        <View style={styles.rowBetween}>
          <Pill label={stage.label} tone={stage.tone} live={stage.key === "live"} />
          {dates ? (
            <T v="caption" tone="faint" numberOfLines={1}>
              {dates}
            </T>
          ) : null}
        </View>

        <View>
          <T v="heading" numberOfLines={2}>
            {campaign.name || "Untitled campaign"}
          </T>
          <T v="caption" tone="faint" numberOfLines={1}>
            {[campaign.service || "Campaign", campaign.region].filter(Boolean).join(", ")}
          </T>
        </View>

        <View style={styles.progressRow}>
          <PhaseStrip stage={stage.key} color={fg} track={colors.well} />
          <T v="label" color={fg} style={{ fontFamily: fonts.sansSemi, minWidth: 38, textAlign: "right" }}>
            {progress}%
          </T>
        </View>

        <View style={[styles.facts, { backgroundColor: colors.well }]}>
          <Fact value={creatorsLabel} label="Creators" />
          <Fact value={isPendingBudget ? "To confirm" : budget} label="Budget" warn={isPendingBudget} />
          <Fact value={reach > 0 ? formatCompact(reach) : "—"} label="Views" />
        </View>

        <View style={styles.rowBetween}>
          {names.length > 0 ? (
            <AvatarStack names={names} max={4} size={30} />
          ) : (
            <T v="caption" tone="faint">
              No creators added yet
            </T>
          )}
          <View style={styles.more}>
            <T v="label" tone="accent">
              View details
            </T>
            <Ionicons name="chevron-forward" size={14} color={colors.accent} />
          </View>
        </View>
      </Card>
    </Tap>
  );
}

// ---------------------------------------------------------------------------
// Campaign details (opens as a sheet)
// ---------------------------------------------------------------------------

function CampaignDetails({ campaign }: { campaign: PortalCampaign }) {
  const { colors } = useAppTheme();
  const campaignData = campaign as PortalCampaign & Record<string, any>;
  const detailCreators = Array.isArray(campaignData.creators) ? campaignData.creators : [];
  const detailStage = getStageConfig(campaignData.stage);
  const detailProgress = getCampaignProgress(campaign);
  const detailBudget = formatBudget(campaignData.budget);
  const detailReach = getTrackedViews(campaign);
  const detailCreatorsLabel = getCreatorCountLabel(campaign);
  const stageIndex = STAGES.findIndex((stage) => stage.key === detailStage.key);

  const displayValue = (value: unknown) => {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "object") return "—";
    return String(value);
  };

  const creatorName = (creator: any, index: number) =>
    creator?.name || creator?.fullName || creator?.username || creator?.handle || `Creator ${index + 1}`;

  const figures: [string, string][] = [
    ["Budget", detailBudget],
    ["Creators", detailCreatorsLabel],
    ["Tracked views", detailReach > 0 ? formatCompact(detailReach) : "—"],
    ["Progress", `${detailProgress}%`],
  ];

  const info: [string, string][] = [
    ["Service", displayValue(campaign.service)],
    ["Region", displayValue(campaign.region)],
    ["Starts", formatDay(campaignData.start)],
    ["Ends", formatDay(campaignData.end)],
  ];

  const brief = campaign.brief;
  const briefRows: [string, string][] = brief
    ? ([
        ["Objective", brief.objective],
        ["Audience", brief.audience],
        ["Key messages", brief.messages],
        ["Deliverables", Array.isArray(brief.deliverables) ? brief.deliverables.join(", ") : ""],
        ["Timeline", brief.timeline],
      ].filter(([, value]) => typeof value === "string" && value.trim()) as [string, string][])
    : [];

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: space.xl, paddingTop: 4, gap: space.lg }}
    >
      <Animated.View entering={FadeInDown.delay(120).duration(420)} style={styles.detailHero}>
        <LinearGradient
          colors={[midnight.top, midnight.mid, midnight.bottom]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <T v="caption" color={midnight.muted}>
          {[campaign.service || "Campaign", campaign.region].filter(Boolean).join(", ")}
        </T>
        <T v="title" color={midnight.text} style={{ marginTop: 4 }}>
          {campaign.name || "Untitled campaign"}
        </T>

        {/* The five phases every campaign moves through, in order */}
        <View style={styles.phases}>
          {STAGES.map((stage, index) => {
            const done = index < stageIndex;
            const current = index === stageIndex;
            return (
              <View key={stage.key} style={styles.phase}>
                <View
                  style={[
                    styles.phaseBar,
                    {
                      backgroundColor: done || current ? midnight.lamp : midnight.line,
                      opacity: done ? 0.55 : 1,
                    },
                  ]}
                />
                <T
                  numberOfLines={1}
                  color={current ? midnight.text : midnight.faint}
                  style={{ fontFamily: current ? fonts.sansSemi : fonts.sans, fontSize: 9.5, lineHeight: 13 }}
                >
                  {stage.label.split(" ")[0]}
                </T>
              </View>
            );
          })}
        </View>
      </Animated.View>

      <View style={styles.figureGrid}>
        {figures.map(([label, value], index) => (
          <Animated.View
            key={label}
            entering={FadeInDown.delay(180 + index * 50).duration(380)}
            style={[styles.figureCell, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <T v="caption" tone="faint">
              {label}
            </T>
            <T v="figureSm" numberOfLines={1} adjustsFontSizeToFit>
              {value}
            </T>
          </Animated.View>
        ))}
      </View>

      <Card pad={0}>
        {info.map(([label, value], index) => (
          <View key={label}>
            {index > 0 ? <Hairline style={{ marginLeft: space.lg }} /> : null}
            <View style={styles.infoRow}>
              <T tone="muted">{label}</T>
              <T v="bodyStrong" style={{ flex: 1, textAlign: "right" }} numberOfLines={2}>
                {value}
              </T>
            </View>
          </View>
        ))}
      </Card>

      {briefRows.length > 0 ? (
        <>
          <T v="heading">The brief</T>
          <Card style={{ gap: space.md }}>
            {briefRows.map(([label, value]) => (
              <View key={label} style={{ gap: 2 }}>
                <T v="label" tone="muted">
                  {label}
                </T>
                <T>{value}</T>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <View style={styles.rowBetween}>
        <T v="heading">Creators</T>
        <T v="label" tone="faint">
          {detailCreators.length}
        </T>
      </View>

      {detailCreators.length === 0 ? (
        <T tone="muted">No creators have been added to this campaign yet.</T>
      ) : (
        <Card pad={0}>
          {detailCreators.map((creator: any, index: number) => {
            const name = creatorName(creator, index);
            const postUrl: string | undefined =
              creator?.live?.postUrl || creator?.live?.postUrls?.[0] || undefined;
            const views = Number(creator?.tracking?.views);
            const row = (
              <View style={styles.creatorRow}>
                <View style={[styles.creatorAvatar, { backgroundColor: colors.accentMuted }]}>
                  <T v="subhead" tone="accent">
                    {initialOf(name)}
                  </T>
                </View>
                <View style={{ flex: 1 }}>
                  <T v="bodyStrong" numberOfLines={1}>
                    {name}
                  </T>
                  <T v="caption" tone="faint" numberOfLines={1}>
                    {displayValue(creator?.platform)}
                    {creator?.followers !== undefined
                      ? `, ${displayValue(creator.followers)} followers`
                      : ""}
                  </T>
                </View>
                {postUrl ? (
                  <View style={{ alignItems: "flex-end", gap: 2 }}>
                    <Pill label="Live" tone="success" live />
                    {Number.isFinite(views) && views > 0 ? (
                      <T v="caption" tone="muted">
                        {formatCompact(views)} views
                      </T>
                    ) : null}
                  </View>
                ) : null}
                {postUrl ? <Ionicons name="open-outline" size={16} color={colors.muted} /> : null}
              </View>
            );
            return (
              <View key={creator?._id || creator?.id || index}>
                {index > 0 ? <Hairline style={{ marginLeft: 68 }} /> : null}
                {postUrl ? (
                  <Tap
                    accessibilityRole="link"
                    accessibilityLabel={`Open ${name}'s post`}
                    scaleTo={0.985}
                    onPress={() => Linking.openURL(postUrl).catch(() => {})}
                  >
                    {row}
                  </Tap>
                ) : (
                  row
                )}
              </View>
            );
          })}
        </Card>
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Completed section toggle
// ---------------------------------------------------------------------------

function Disclosure({
  title,
  note,
  open,
  onToggle,
}: {
  title: string;
  note: string;
  open: boolean;
  onToggle: () => void;
}) {
  const { colors } = useAppTheme();
  const turn = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    turn.value = withSpring(open ? 1 : 0, springs.snappy);
  }, [open, turn]);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 90}deg` }] }));
  return (
    <Tap
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      onPress={onToggle}
      scaleTo={0.985}
      style={[styles.disclosure, { borderColor: colors.borderStrong }]}
    >
      <Animated.View style={chevron}>
        <Ionicons name="chevron-forward" size={18} color={colors.text} />
      </Animated.View>
      <View style={{ flex: 1 }}>
        <T v="subhead">{title}</T>
        <T v="caption" tone="faint">
          {note}
        </T>
      </View>
      <T v="label" tone="accent">
        {open ? "Hide" : "Show"}
      </T>
    </Tap>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function CampaignsScreen() {

  const { user } = useAuth();

  const [campaigns, setCampaigns] = useState<PortalCampaign[]>([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const [serviceFilter, setServiceFilter] =

    useState<ServiceFilter>("all");

  const [search, setSearch] = useState("");

  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<PortalCampaign | null>(null);

  // ------------------------------------------------

  // FETCH CAMPAIGNS

  // ------------------------------------------------

  const fetchCampaigns = useCallback(async (isRefresh = false) => {

    if (!user?.brandId) {

      setCampaigns([]);

      setLoading(false);

      setError("Your account details are unavailable. Please sign in again.");

      return;

    }

    if (isRefresh) {

      setRefreshing(true);

    } else {

      setLoading(true);

    }

    setError("");

    try {

      const result = await getPortalCampaigns({

        brandId: user.brandId,

        clientName: user.clientName,

      });

      setCampaigns(Array.isArray(result) ? result : []);

    } catch (err) {

      setError(

        err instanceof Error

          ? err.message

          : "Unable to load campaigns."

      );

    } finally {

      setLoading(false);

      setRefreshing(false);

    }

  }, [user?.brandId, user?.clientName]);

  useEffect(() => {

    fetchCampaigns();

  }, [fetchCampaigns]);

  // ------------------------------------------------

  // FILTER AND SEARCH

  // ------------------------------------------------

  const visibleCampaigns = useMemo(() => {

    const query = search.trim().toLowerCase();

    return campaigns.filter((campaign) => {

      const matchesService =

        serviceFilter === "all" ||

        isInfluencerMarketing(campaign);

      const matchesSearch =

        !query ||

        (campaign.name || "").toLowerCase().includes(query) ||

        (campaign.service || "").toLowerCase().includes(query) ||

        (campaign.region || "").toLowerCase().includes(query);

      return matchesService && matchesSearch;

    });

  }, [campaigns, search, serviceFilter]);

  // ------------------------------------------------

  // GROUP CAMPAIGNS

  // ------------------------------------------------

  const completedCampaigns = useMemo(

    () =>

      visibleCampaigns.filter(

        (campaign) => normalizeStage(campaign.stage) === "completed"

      ),

    [visibleCampaigns]

  );

  const activeCampaigns = useMemo(

    () =>

      visibleCampaigns.filter(

        (campaign) => normalizeStage(campaign.stage) !== "completed"

      ),

    [visibleCampaigns]

  );

  const stageGroups = useMemo(() => {

    return STAGES.map((stage) => ({

      ...stage,

      campaigns: visibleCampaigns.filter(

        (campaign) => normalizeStage(campaign.stage) === stage.key

      ),

    }));

  }, [visibleCampaigns]);

  const { colors } = useAppTheme();

  // One simple filter: the phase a campaign is in.
  const [phase, setPhase] = useState<"all" | CampaignStage>("all");

  const summary = useMemo(
    () => ({
      active: campaigns.filter((campaign) => normalizeStage(campaign.stage) !== "completed").length,
      budget: campaigns.reduce((sum, campaign) => {
        const amount = Number(campaign.budget);
        return sum + (Number.isFinite(amount) && amount > 0 ? amount : 0);
      }, 0),
      views: campaigns.reduce((sum, campaign) => sum + getTrackedViews(campaign), 0),
    }),
    [campaigns]
  );

  if (loading) {
    return <ScreenSkeleton hero={false} />;
  }

  if (error && campaigns.length === 0) {
    return (
      <ErrorState
        title="Campaigns did not load"
        message={error}
        onRetry={() => fetchCampaigns()}
      />
    );
  }

  const plural = (count: number) => `${count} campaign${count === 1 ? "" : "s"}`;

  const chips: { key: "all" | CampaignStage; label: string; count: number }[] = [
    { key: "all", label: "All", count: visibleCampaigns.length },
    ...stageGroups
      .filter((group) => group.campaigns.length > 0)
      .map((group) => ({
        key: group.key,
        label: group.label.split(" ")[0],
        count: group.campaigns.length,
      })),
  ];
  const activePhase = chips.some((chip) => chip.key === phase) ? phase : "all";
  const phaseList =
    activePhase === "all"
      ? []
      : visibleCampaigns.filter((campaign) => normalizeStage(campaign.stage) === activePhase);

  return (
    <>
      <ScreenScroll refreshing={refreshing} onRefresh={() => fetchCampaigns(true)}>
        <ScreenTitle title="Campaigns" note="Tap any campaign to see its creators, brief and numbers." />

        {campaigns.length > 0 ? (
          <Reveal index={1}>
            <View style={styles.summary}>
              <LinearGradient
                colors={[midnight.top, midnight.mid, midnight.bottom]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {(
                [
                  ["Active", String(summary.active)],
                  ["Total budget", summary.budget > 0 ? shortRupees(summary.budget) : "—"],
                  ["Tracked views", summary.views > 0 ? formatCompact(summary.views) : "—"],
                ] as const
              ).map(([label, value], index) => (
                <View
                  key={label}
                  style={[
                    styles.summaryCell,
                    index > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: midnight.line },
                  ]}
                >
                  <T v="figureSm" color={index === 0 ? midnight.lamp : midnight.text} numberOfLines={1} adjustsFontSizeToFit>
                    {value}
                  </T>
                  <T v="caption" color={midnight.muted}>
                    {label}
                  </T>
                </View>
              ))}
            </View>
          </Reveal>
        ) : null}

        <Reveal index={2} style={{ gap: space.md }}>
          <View
            style={[
              styles.search,
              { backgroundColor: colors.input, borderColor: colors.borderStrong },
            ]}
          >
            <Ionicons name="search-outline" size={18} color={colors.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search campaigns"
              placeholderTextColor={colors.faint}
              selectionColor={colors.accent}
              accessibilityLabel="Search campaigns"
              style={[styles.searchInput, { color: colors.text }]}
              returnKeyType="search"
            />
            {search ? (
              <Tap accessibilityLabel="Clear search" onPress={() => setSearch("")} hitSlop={10}>
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Tap>
            ) : null}
          </View>

          {chips.length > 2 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -space.xl }}
              contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.sm }}
            >
              {chips.map((chip) => {
                const selected = chip.key === activePhase;
                return (
                  <Tap
                    key={chip.key}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${chip.label}, ${plural(chip.count)}`}
                    onPress={() => setPhase(chip.key)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected ? colors.accent : "transparent",
                        borderColor: selected ? colors.accent : colors.borderStrong,
                      },
                    ]}
                  >
                    <T v="label" color={selected ? colors.onAccent : colors.text}>
                      {chip.label}
                    </T>
                    <View
                      style={[
                        styles.chipCount,
                        { backgroundColor: selected ? "rgba(255,255,255,0.2)" : colors.well },
                      ]}
                    >
                      <T v="caption" color={selected ? colors.onAccent : colors.text2} style={{ fontFamily: fonts.sansSemi }}>
                        {chip.count}
                      </T>
                    </View>
                  </Tap>
                );
              })}
            </ScrollView>
          ) : null}
        </Reveal>

        {visibleCampaigns.length === 0 ? (
          <EmptyState
            icon="file-tray-outline"
            title="No campaigns found"
            message={
              search
                ? "Nothing matches that search. Try a different word."
                : "Campaigns show up here as soon as your account manager adds them."
            }
          />
        ) : activePhase !== "all" ? (
          <Animated.View key={activePhase} entering={FadeIn.duration(240)} style={{ gap: space.lg }}>
            {phaseList.map((campaign, index) => (
              <Animated.View
                key={getCampaignIdentity(campaign, index)}
                entering={FadeInDown.delay(index * 50).duration(320)}
              >
                <CampaignCard campaign={campaign} onOpen={setSelectedCampaign} />
              </Animated.View>
            ))}
          </Animated.View>
        ) : (
          <Animated.View key="all" entering={FadeIn.duration(240)} style={{ gap: space.lg }}>
            {activeCampaigns.length === 0 ? (
              <T tone="muted">No active campaigns right now.</T>
            ) : (
              activeCampaigns.map((campaign, index) => (
                <Reveal key={getCampaignIdentity(campaign, index)} index={3 + index}>
                  <CampaignCard campaign={campaign} onOpen={setSelectedCampaign} />
                </Reveal>
              ))
            )}

            {completedCampaigns.length > 0 ? (
              <Disclosure
                title="Completed"
                note={plural(completedCampaigns.length)}
                open={completedExpanded}
                onToggle={() => setCompletedExpanded((previous) => !previous)}
              />
            ) : null}

            {completedExpanded
              ? completedCampaigns.map((campaign, index) => (
                  <Animated.View
                    key={getCampaignIdentity(campaign, index)}
                    entering={FadeInDown.delay(index * 50).duration(320)}
                  >
                    <CampaignCard campaign={campaign} onOpen={setSelectedCampaign} />
                  </Animated.View>
                ))
              : null}
          </Animated.View>
        )}
      </ScreenScroll>

      <Sheet
        full
        visible={!!selectedCampaign}
        onClose={() => setSelectedCampaign(null)}
        title="Campaign details"
      >
        {selectedCampaign ? <CampaignDetails campaign={selectedCampaign} /> : null}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
  },
  summary: { flexDirection: "row", borderRadius: radius.xl, overflow: "hidden", paddingVertical: 18 },
  summaryCell: { flex: 1, alignItems: "center", paddingHorizontal: 8, gap: 2 },
  search: {
    height: 52,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    fontFamily: fonts.sans,
    fontSize: 14.5,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null),
  },
  chip: {
    height: 40,
    paddingLeft: 16,
    paddingRight: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chipCount: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  progressRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  facts: { flexDirection: "row", gap: space.sm, borderRadius: radius.md, padding: space.md },
  more: { flexDirection: "row", alignItems: "center", gap: 2 },
  disclosure: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailHero: { borderRadius: radius.xl, overflow: "hidden", padding: 22 },
  phases: { flexDirection: "row", gap: 6, marginTop: 22 },
  phase: { flex: 1, gap: 6 },
  phaseBar: { height: 4, borderRadius: 2 },
  figureGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  figureCell: {
    flexGrow: 1,
    flexBasis: "45%",
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.lg,
    gap: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    padding: space.lg,
  },
  creatorRow: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg },
  creatorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
