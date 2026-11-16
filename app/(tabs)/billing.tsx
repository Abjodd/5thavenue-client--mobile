import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { getPortalCampaigns, type PortalCampaign } from "../../src/lib/api";
import { useAuth } from "../../src/context/AuthContext";
import { useAppTheme } from "../../src/context/ThemeContext";
import {
  Button,
  CountUp,
  EmptyState,
  Hairline,
  Pill,
  Reveal,
  ScreenScroll,
  ScreenSkeleton,
  ScreenTitle,
  SectionTitle,
  T,
  Tap,
  type Tone,
} from "../../src/ui/primitives";
import { cardShadow, midnight, radius, space, springs } from "../../src/ui/theme";

// TYPES
// ---------------------------------------------

type BillingCampaign = PortalCampaign & {
  paidOn?: string | null;
  invoiceRaisedOn?: string | null;
  advanceReceivedOn?: string | null;
  agencyFee?: number | string | null;
};

type BillingLine = {
  key: string;
  label: string;
  handle?: string;
  amount: number;
  share: number | null;
  fee?: boolean;
};

type CampaignBill = {
  id: string;
  name: string;
  start: string | null;
  end: string | null;
  base: number;
  creatorTotal: number;
  fee: number;
  listed: number;
  diff: number;
  gst: number;
  payable: number;
  pending: boolean;
  creators: BillingLine[];
  rosterCount: number;
  itemised: number;
  status: {
    label: string;
    date: string | null;
    tone: "green" | "amber" | "muted";
  };
};

const GST_RATE = 0.18;

// ---------------------------------------------
// HELPERS
// ---------------------------------------------

function num(value: unknown): number {
  const parsed = Number(
    String(value ?? "").replace(/[₹,\s]/g, "")
  );

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatINR(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function prettyDate(value?: string | null): string {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function gstOn(amount: number): number {
  return Math.round(amount * GST_RATE);
}

// ---------------------------------------------
// CAMPAIGN FILTERING
// Mirrors the web portal billing inclusion rule.
// ---------------------------------------------

function countsInMetrics(campaign: BillingCampaign): boolean {
  const stage = (campaign.stage || "").toLowerCase();

  const countedStages = [
    "live",
    "creator_paid",
    "reporting",
    "completed",
    "invoice_raised",
    "payment_done",
  ];

  const creators = campaign.creators || [];

  const isPriced =
    num(campaign.budget) > 0 &&
    creators.some((creator) => num(creator.cost) > 0);

  const isLive = creators.some(
    (creator) =>
      Boolean(creator.live?.postUrl) ||
      (creator.live?.postUrls?.length ?? 0) > 0
  );

  return countedStages.includes(stage) || (isLive && isPriced);
}

// ---------------------------------------------
// BILLING CALCULATION
// Mirrors budgetLines() from portalMetrics.js.
// ---------------------------------------------

function calculateCampaignBill(
  campaign: BillingCampaign
): CampaignBill {
  const creators = campaign.creators || [];

  const creatorRows: BillingLine[] = creators
    .map((creator) => ({
      key: creator.handle || creator.name || "",
      label: creator.name || "—",
      handle: creator.handle || "",
      amount: num(creator.cost),
      share: null,
    }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const creatorTotal = creatorRows.reduce(
    (sum, row) => sum + row.amount,
    0
  );

  const fee = num(campaign.agencyFee);

  const rows = [...creatorRows];

  if (fee > 0) {
    rows.push({
      key: "__fee",
      label: "Agency fee",
      amount: fee,
      share: null,
      fee: true,
    });
  }

  const listed = creatorTotal + fee;
  const budget = num(campaign.budget);
  const base = budget > 0 ? budget : listed;

  const pending = !(budget > 0);

  const finalRows = rows.map((row) => ({
    ...row,
    share: base > 0 ? (row.amount / base) * 100 : null,
  }));

  const gst = pending ? 0 : gstOn(base);

  // Finance milestone priority follows the web portal.
  const status = campaign.paidOn
    ? {
        label: "Settled",
        date: campaign.paidOn,
        tone: "green" as const,
      }
    : campaign.invoiceRaisedOn
    ? {
        label: "Invoiced",
        date: campaign.invoiceRaisedOn,
        tone: "amber" as const,
      }
    : campaign.advanceReceivedOn
    ? {
        label: "Advance received",
        date: campaign.advanceReceivedOn,
        tone: "amber" as const,
      }
    : {
        label: "Not yet invoiced",
        date: null,
        tone: "muted" as const,
      };

  return {
    id: campaign.id || campaign._id || campaign.name || Math.random().toString(),
    name: campaign.name || "Unnamed campaign",
    start: campaign.start || null,
    end: campaign.end || null,
    base,
    creatorTotal,
    fee,
    listed,
    diff: base - listed,
    gst,
    payable: pending ? 0 : base + gst,
    pending,
    creators: finalRows.filter((row) => !row.fee),
    rosterCount: creators.length,
    itemised: creatorRows.length,
    status,
  };
}

// ---------------------------------------------

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function BarPart({ share, color, delay }: { share: number; color: string; delay: number }) {
  const width = useSharedValue(0);
  const target = Math.max(0, Math.min(100, share));
  useEffect(() => {
    width.value = withDelay(delay, withTiming(target, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [target, delay, width]);
  const style = useAnimatedStyle(() => ({ width: `${width.value}%` }));
  return <Animated.View style={[{ height: "100%", backgroundColor: color }, style]} />;
}

/** A track split into coloured parts that grow in from the left. */
function SplitBar({
  parts,
  track,
  height = 10,
}: {
  parts: { share: number; color: string }[];
  track: string;
  height?: number;
}) {
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track, overflow: "hidden", flexDirection: "row" }}>
      {parts
        .filter((part) => part.share > 0)
        .map((part, index) => (
          <BarPart key={index} share={part.share} color={part.color} delay={200 + index * 180} />
        ))}
    </View>
  );
}

function Legend({ color, label, hollow }: { color: string; label: string; hollow?: boolean }) {
  return (
    <View style={styles.legend}>
      <View
        style={[
          styles.legendDot,
          hollow ? { borderWidth: 1, borderColor: color } : { backgroundColor: color },
        ]}
      />
      <T v="caption" tone="muted">
        {label}
      </T>
    </View>
  );
}

function BillingRow({
  label,
  sub,
  amount,
  share,
  muted,
  strong,
  color,
}: {
  label: string;
  sub?: string;
  amount: number;
  share?: number | null;
  muted?: boolean;
  strong?: boolean;
  color?: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.billingRow}>
      <View style={{ flex: 1 }}>
        <T
          v={strong ? "subhead" : "bodyStrong"}
          color={color ?? (muted ? colors.text2 : colors.text)}
          numberOfLines={2}
        >
          {label}
        </T>
        {sub ? (
          <T v="caption" tone="faint">
            {sub}
          </T>
        ) : null}
      </View>
      {share != null ? (
        <T v="caption" tone="faint">{`${Math.round(share)}%`}</T>
      ) : null}
      <T
        v={strong ? "figureSm" : "bodyStrong"}
        color={color ?? colors.text}
        style={{ minWidth: 84, textAlign: "right" }}
      >
        {formatINR(amount)}
      </T>
    </View>
  );
}

function BlockLabel({ title, note }: { title: string; note?: string }) {
  return (
    <View style={[styles.rowBetween, { marginTop: space.lg, marginBottom: 2 }]}>
      <T v="label" tone="muted">
        {title}
      </T>
      {note ? (
        <T v="caption" tone="faint">
          {note}
        </T>
      ) : null}
    </View>
  );
}

const STATUS_TONE: Record<CampaignBill["status"]["tone"], Tone> = {
  green: "success",
  amber: "warning",
  muted: "neutral",
};

// ---------------------------------------------------------------------------
// One campaign's statement
// ---------------------------------------------------------------------------

function CampaignBillCard({
  campaign,
  defaultOpen,
}: {
  campaign: CampaignBill;
  defaultOpen: boolean;
}) {
  const { colors } = useAppTheme();
  const [expanded, setExpanded] = useState(defaultOpen);

  const turn = useSharedValue(defaultOpen ? 1 : 0);
  useEffect(() => {
    turn.value = withSpring(expanded ? 1 : 0, springs.snappy);
  }, [expanded, turn]);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));

  const unpriced = campaign.rosterCount - campaign.itemised;
  const feeLine = campaign.fee > 0;
  const showDiff = !campaign.pending && Math.abs(campaign.diff) >= 1;
  const feeShare = campaign.fee > 0 ? (campaign.fee / campaign.base) * 100 : null;

  const scale = Math.max(campaign.base, campaign.listed);
  const over = !campaign.pending && campaign.listed > campaign.base;

  return (
    <Animated.View
      layout={LinearTransition.duration(260)}
      style={[
        styles.bill,
        cardShadow(colors),
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Tap
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${campaign.name} statement`}
        onPress={() => setExpanded(!expanded)}
        scaleTo={0.99}
        style={styles.billHead}
      >
        <View style={{ flex: 1, gap: 6 }}>
          <Pill
            label={
              campaign.status.date
                ? `${campaign.status.label}, ${prettyDate(campaign.status.date)}`
                : campaign.status.label
            }
            tone={STATUS_TONE[campaign.status.tone]}
          />
          <T v="heading" numberOfLines={2}>
            {campaign.name}
          </T>
          {campaign.start && campaign.end ? (
            <T v="caption" tone="faint">
              {prettyDate(campaign.start)} to {prettyDate(campaign.end)}
            </T>
          ) : null}
        </View>
        <View style={{ alignItems: "flex-end", gap: 2 }}>
          {campaign.pending ? (
            <T v="bodyStrong" color={colors.warning}>
              To be confirmed
            </T>
          ) : (
            <>
              <T v="figureSm">{formatINR(campaign.base)}</T>
              <T v="caption" tone="faint">
                {formatINR(campaign.payable)} with GST
              </T>
            </>
          )}
          <Animated.View style={[{ marginTop: 6 }, chevron]}>
            <Ionicons name="chevron-down" size={18} color={colors.muted} />
          </Animated.View>
        </View>
      </Tap>

      {expanded ? (
        <Animated.View entering={FadeIn.duration(260)} style={styles.billBody}>
          <Hairline />

          {scale > 0 ? (
            <View style={{ marginTop: space.lg, gap: 10 }}>
              <SplitBar
                track={colors.well}
                parts={[
                  { share: (campaign.creatorTotal / scale) * 100, color: colors.accent },
                  { share: (campaign.fee / scale) * 100, color: colors.teal },
                ]}
              />
              <View style={styles.legends}>
                {campaign.creatorTotal > 0 ? (
                  <Legend color={colors.accent} label={`Creators ${formatINR(campaign.creatorTotal)}`} />
                ) : null}
                {campaign.fee > 0 ? (
                  <Legend color={colors.teal} label={`Agency fee ${formatINR(campaign.fee)}`} />
                ) : null}
                {!campaign.pending && campaign.listed < campaign.base ? (
                  <Legend
                    hollow
                    color={colors.muted}
                    label={`Unallocated ${formatINR(campaign.base - campaign.listed)}`}
                  />
                ) : null}
              </View>
              {over ? (
                <T v="caption" tone="danger">
                  Over budget by {formatINR(campaign.listed - campaign.base)}
                </T>
              ) : null}
            </View>
          ) : null}

          <BlockLabel
            title="Creators"
            note={unpriced > 0 ? `${campaign.itemised} of ${campaign.rosterCount} priced` : undefined}
          />
          {campaign.creators.length > 0 ? (
            campaign.creators.map((creator, index) => (
              <BillingRow
                key={`${creator.key}-${index}`}
                label={creator.label}
                sub={creator.handle ? `@${creator.handle.replace(/^@/, "")}` : undefined}
                amount={creator.amount}
                share={campaign.pending ? null : creator.share}
              />
            ))
          ) : (
            <T v="caption" tone="faint" style={{ paddingVertical: space.sm }}>
              No creator costs agreed on this campaign yet.
            </T>
          )}

          {feeLine ? (
            <BillingRow
              label="Agency fee"
              sub="Charged on top of creator costs"
              amount={campaign.fee}
              share={campaign.pending ? null : feeShare}
              muted
            />
          ) : (
            <T v="caption" tone="faint" style={{ paddingVertical: space.sm }}>
              No agency fee on this campaign.
            </T>
          )}

          <Hairline style={{ marginTop: space.sm }} />
          <BillingRow label="Total" amount={campaign.listed} strong />

          {showDiff ? (
            campaign.diff > 0 ? (
              <BillingRow
                label="Not yet allocated"
                sub={
                  unpriced > 0
                    ? `${unpriced} creator${unpriced === 1 ? "" : "s"} without an agreed cost`
                    : "Still to be assigned against this budget"
                }
                amount={campaign.diff}
                muted
              />
            ) : (
              <BillingRow
                label="Over the agreed budget"
                sub="Creator costs and fee exceed the campaign budget"
                amount={Math.abs(campaign.diff)}
                color={colors.danger}
              />
            )
          ) : null}

          {!campaign.pending ? (
            <View style={[styles.payable, { backgroundColor: colors.well }]}>
              <BillingRow
                label="GST at 18%"
                sub={`On the ${formatINR(campaign.base)} campaign budget`}
                amount={campaign.gst}
                muted
              />
              <Hairline />
              <BillingRow
                label="Total payable"
                sub="Including GST"
                amount={campaign.payable}
                strong
              />
            </View>
          ) : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function OverviewScreen() {
  const { user } = useAuth();

  const [campaigns, setCampaigns] = useState<CampaignBill[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadBilling = useCallback(async () => {
    if (!user?.brandId) {
      setError("Brand account information is unavailable.");
      setCampaigns(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setError("");

      const data = await getPortalCampaigns({
        brandId: user.brandId,
        clientName: user.clientName,
      });

      const billingCampaigns = (data as BillingCampaign[])
        .filter(countsInMetrics)
        .map(calculateCampaignBill)
        .filter((campaign) => campaign.base > 0);

      setCampaigns(billingCampaigns);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load billing information."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.brandId, user?.clientName]);

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  const totals = useMemo(() => {
    const list = campaigns || [];

    let dueBase = 0;
    let dueGst = 0;
    let settledBase = 0;
    let settledGst = 0;
    let allBase = 0;
    let allGst = 0;

    for (const campaign of list) {
      if (campaign.pending) continue;

      allBase += campaign.base;
      allGst += campaign.gst;

      if (campaign.status.label === "Settled") {
        settledBase += campaign.base;
        settledGst += campaign.gst;
      } else if (
        campaign.status.label === "Invoiced" ||
        campaign.status.label === "Advance received"
      ) {
        dueBase += campaign.base;
        dueGst += campaign.gst;
      }
    }

    return {
      all: allBase + allGst,
      settled: settledBase + settledGst,
      due: dueBase + dueGst,
      settledBase,
      settledGst,
      dueBase,
      dueGst,
    };
  }, [campaigns]);

  if (loading) {
    return <ScreenSkeleton />;
  }

  const paidOrDue = totals.settled + totals.due;

  return (
    <ScreenScroll
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        loadBilling();
      }}
    >
      <ScreenTitle
        title="Billing"
        note={`Every campaign budget for ${user?.clientName || "your brand"}, broken down by creator, with the agency fee shown separately.`}
      />

      {error ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Billing did not load"
          message={error}
          action={
            <Button
              label="Try again"
              icon="refresh"
              style={{ marginTop: space.sm }}
              onPress={() => {
                setLoading(true);
                loadBilling();
              }}
            />
          }
        />
      ) : null}

      {!error && campaigns?.length === 0 ? (
        <EmptyState
          icon="receipt-outline"
          title="Nothing billed yet"
          message="Campaign costs appear here as soon as a budget is agreed and the roster is priced."
        />
      ) : null}

      {campaigns && campaigns.length > 0 ? (
        <>
          <Reveal index={1}>
            <View style={styles.hero}>
              <LinearGradient
                colors={[midnight.top, midnight.mid, midnight.bottom]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <T v="label" color={midnight.muted}>
                Yet to pay
              </T>
              <CountUp
                value={totals.due}
                format={formatINR}
                color={midnight.lamp}
                style={styles.heroFigure}
                numberOfLines={1}
                adjustsFontSizeToFit
              />
              <T v="caption" color={midnight.muted}>
                Invoiced and not yet settled, including GST
              </T>

              {paidOrDue > 0 ? (
                <View style={{ marginTop: space.xl, gap: 10 }}>
                  <SplitBar
                    track={midnight.line}
                    parts={[
                      { share: (totals.settled / paidOrDue) * 100, color: "#6FD3A3" },
                      { share: (totals.due / paidOrDue) * 100, color: midnight.lamp },
                    ]}
                  />
                  <View style={styles.rowBetween}>
                    <View style={styles.legend}>
                      <View style={[styles.legendDot, { backgroundColor: "#6FD3A3" }]} />
                      <T v="caption" color={midnight.text}>
                        Paid {formatINR(totals.settled)}
                      </T>
                    </View>
                    <View style={styles.legend}>
                      <View style={[styles.legendDot, { backgroundColor: midnight.lamp }]} />
                      <T v="caption" color={midnight.text}>
                        To pay {formatINR(totals.due)}
                      </T>
                    </View>
                  </View>
                </View>
              ) : null}

              <View style={styles.heroGrid}>
                <View style={{ flex: 1.4 }}>
                  <T v="caption" color={midnight.muted}>
                    All campaigns, with GST
                  </T>
                  <T v="figureSm" color={midnight.text} numberOfLines={1} adjustsFontSizeToFit>
                    {formatINR(totals.all)}
                  </T>
                </View>
                <View style={{ flex: 1 }}>
                  <T v="caption" color={midnight.muted}>
                    Campaigns
                  </T>
                  <T v="figureSm" color={midnight.text}>
                    {campaigns.length}
                  </T>
                </View>
              </View>
            </View>
          </Reveal>

          <Reveal index={2}>
            <SectionTitle
              title="Statements"
              note="What each creator was charged, the agency fee, and the total with tax"
            />
          </Reveal>

          {campaigns.map((campaign, index) => (
            <Reveal key={campaign.id} index={3 + index}>
              <CampaignBillCard campaign={campaign} defaultOpen={index === 0} />
            </Reveal>
          ))}

          <T v="caption" tone="faint" style={{ marginTop: space.sm }}>
            Figures are the agreed cost per creator and the agency fee for each campaign. GST is
            charged at 18% on the agreed campaign budget and shown separately; all other figures
            exclude tax. A campaign whose budget is still to be confirmed has no GST figure yet.
          </T>
        </>
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
  hero: { borderRadius: radius.xl, overflow: "hidden", padding: 22 },
  heroFigure: {
    fontFamily: "Newsreader_400Regular",
    fontSize: 52,
    lineHeight: 60,
    letterSpacing: -1.5,
    marginTop: 2,
  },
  heroGrid: {
    flexDirection: "row",
    gap: space.lg,
    marginTop: space.xl,
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: midnight.line,
  },
  legends: { flexDirection: "row", flexWrap: "wrap", columnGap: space.lg, rowGap: 6 },
  legend: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  bill: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  billHead: { flexDirection: "row", gap: space.md, padding: space.lg },
  billBody: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  billingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: 10,
  },
  payable: {
    marginTop: space.md,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 2,
  },
});
