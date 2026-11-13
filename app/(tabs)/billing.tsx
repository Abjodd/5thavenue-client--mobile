import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";

import {
  getPortalCampaigns,
  type PortalCampaign,
} from "../../src/lib/api";

import { useAuth } from "../../src/context/AuthContext";

// ---------------------------------------------
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

// ---------------------------------------------
// COLORS
// ---------------------------------------------

const COLORS = {
  background: "#F8F7F4",
  white: "#FFFFFF",
  ink: "#17243A",
  sub: "#65738A",
  muted: "#929BA9",
  border: "#E9E8E4",
  well: "#F1F1EE",
  blue: "#4368A8",
  green: "#16845B",
  greenBg: "#E8F5EE",
  amber: "#B7791F",
  amberBg: "#FFF5DF",
  red: "#D34D4D",
  redBg: "#FDECEC",
  teal: "#269A91",
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
// SMALL COMPONENTS
// ---------------------------------------------

function MetricCard({
  label,
  value,
  subtitle,
  color,
}: {
  label: string;
  value: string;
  subtitle: string;
  color?: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, color ? { color } : null]}>
        {value}
      </Text>
      <Text style={styles.metricSubtitle}>{subtitle}</Text>
    </View>
  );
}

function StatusBadge({
  status,
}: {
  status: CampaignBill["status"];
}) {
  const background =
    status.tone === "green"
      ? COLORS.greenBg
      : status.tone === "amber"
      ? COLORS.amberBg
      : COLORS.well;

  const color =
    status.tone === "green"
      ? COLORS.green
      : status.tone === "amber"
      ? COLORS.amber
      : COLORS.sub;

  return (
    <View style={[styles.statusBadge, { backgroundColor: background }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[styles.statusText, { color }]}>
        {status.label}
      </Text>
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
  return (
    <View style={styles.billingRow}>
      <View style={styles.billingRowLeft}>
        <Text
          style={[
            styles.billingRowLabel,
            muted && { color: COLORS.sub },
            strong && { fontWeight: "800" },
            color ? { color } : null,
          ]}
        >
          {label}
        </Text>

        {sub ? (
          <Text style={styles.billingRowSub}>{sub}</Text>
        ) : null}
      </View>

      <View style={styles.billingRowRight}>
        {share != null ? (
          <Text style={styles.shareText}>
            {`${Math.round(share)}%`}
          </Text>
        ) : null}

        <Text
          style={[
            styles.billingAmount,
            strong && styles.billingAmountStrong,
            color ? { color } : null,
          ]}
        >
          {formatINR(amount)}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------
// ALLOCATION BAR
// ---------------------------------------------

function AllocationBar({
  creatorTotal,
  fee,
  base,
  listed,
  pending,
}: {
  creatorTotal: number;
  fee: number;
  base: number;
  listed: number;
  pending: boolean;
}) {
  const scale = Math.max(base, listed);

  if (scale <= 0) return null;

  const creatorWidth = (creatorTotal / scale) * 100;
  const feeWidth = (fee / scale) * 100;
  const over = !pending && listed > base;

  return (
    <View style={styles.allocationContainer}>
      <View style={styles.allocationTrack}>
        {creatorTotal > 0 ? (
          <View
            style={[
              styles.creatorBar,
              { width: `${creatorWidth}%` },
            ]}
          />
        ) : null}

        {fee > 0 ? (
          <View
            style={[
              styles.feeBar,
              { width: `${feeWidth}%` },
            ]}
          />
        ) : null}
      </View>

      <View style={styles.legendContainer}>
        {creatorTotal > 0 ? (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.blue }]} />
            <Text style={styles.legendText}>
              Creators {formatINR(creatorTotal)}
            </Text>
          </View>
        ) : null}

        {fee > 0 ? (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.teal }]} />
            <Text style={styles.legendText}>
              Agency fee {formatINR(fee)}
            </Text>
          </View>
        ) : null}

        {!pending && listed < base ? (
          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                {
                  backgroundColor: COLORS.white,
                  borderWidth: 1,
                  borderColor: COLORS.muted,
                },
              ]}
            />
            <Text style={styles.legendText}>
              Unallocated {formatINR(base - listed)}
            </Text>
          </View>
        ) : null}

        {over ? (
          <Text style={styles.overBudgetText}>
            Over budget by {formatINR(listed - base)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------
// CAMPAIGN BILL
// ---------------------------------------------

function CampaignBillCard({
  campaign,
}: {
  campaign: CampaignBill;
}) {
  const [expanded, setExpanded] = useState(true);

  const unpriced = campaign.rosterCount - campaign.itemised;
  const feeLine = campaign.fee > 0;

  const showDiff =
    !campaign.pending && Math.abs(campaign.diff) >= 1;

  const feeShare = campaign.fee > 0
    ? (campaign.fee / campaign.base) * 100
    : null;

  return (
    <View style={styles.campaignCard}>
      {/* CAMPAIGN HEADER */}

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setExpanded(!expanded)}
        style={styles.campaignHeader}
      >
        <View style={styles.campaignHeaderLeft}>
          <Text style={styles.campaignName}>
            {campaign.name}
          </Text>

          {campaign.start && campaign.end ? (
            <Text style={styles.campaignDate}>
              {prettyDate(campaign.start)} — {prettyDate(campaign.end)}
            </Text>
          ) : null}

          <StatusBadge status={campaign.status} />
        </View>

        <View style={styles.campaignHeaderRight}>
          <Text style={styles.campaignBudgetLabel}>
            Campaign budget
          </Text>

          {campaign.pending ? (
            <Text style={styles.pendingText}>
              To be confirmed
            </Text>
          ) : (
            <>
              <Text style={styles.campaignBudget}>
                {formatINR(campaign.base)}
              </Text>
              <Text style={styles.inclusiveGST}>
                {formatINR(campaign.payable)} incl. GST
              </Text>
            </>
          )}

          <Text style={styles.expandText}>
            {expanded ? "Hide details ▲" : "View details ▼"}
          </Text>
        </View>
      </TouchableOpacity>

      {expanded ? (
        <>
          <View style={styles.separator} />

          {/* ALLOCATION */}

          <AllocationBar
            creatorTotal={campaign.creatorTotal}
            fee={campaign.fee}
            base={campaign.base}
            listed={campaign.listed}
            pending={campaign.pending}
          />

          {/* CREATORS */}

          <View style={styles.blockHeader}>
            <Text style={styles.blockTitle}>CREATORS</Text>

            {unpriced > 0 ? (
              <Text style={styles.blockNote}>
                {campaign.itemised} of {campaign.rosterCount} priced
              </Text>
            ) : null}
          </View>

          {campaign.creators.length > 0 ? (
            campaign.creators.map((creator, index) => (
              <BillingRow
                key={`${creator.key}-${index}`}
                label={creator.label}
                sub={
                  creator.handle
                    ? `@${creator.handle.replace(/^@/, "")}`
                    : undefined
                }
                amount={creator.amount}
                share={campaign.pending ? null : creator.share}
              />
            ))
          ) : (
            <Text style={styles.emptyLine}>
              No creator costs agreed on this campaign yet.
            </Text>
          )}

          {/* AGENCY FEE */}

          {feeLine ? (
            <BillingRow
              label="Agency fee"
              sub="Charged on top of creator costs"
              amount={campaign.fee}
              share={campaign.pending ? null : feeShare}
              muted
            />
          ) : (
            <Text style={styles.emptyLine}>
              No agency fee on this campaign.
            </Text>
          )}

          {/* TOTAL */}

          <View style={styles.totalSection}>
            <BillingRow
              label="Total"
              amount={campaign.listed}
              strong
            />

            {showDiff ? (
              <View style={styles.diffSection}>
                {campaign.diff > 0 ? (
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
                    color={COLORS.red}
                  />
                )}
              </View>
            ) : null}
          </View>

          {/* GST AND PAYABLE */}

          {!campaign.pending ? (
            <View style={styles.payableSection}>
              <Text style={styles.blockTitle}>TO PAY</Text>

              <BillingRow
                label="GST @ 18%"
                sub={`On the ${formatINR(campaign.base)} campaign budget`}
                amount={campaign.gst}
                muted
              />

              <View style={styles.payableTotal}>
                <BillingRow
                  label="Total payable"
                  sub="Inclusive of GST"
                  amount={campaign.payable}
                  strong
                />
              </View>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

// ---------------------------------------------
// MAIN BILLING SCREEN
// ---------------------------------------------

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

  // ---------------------------------------------
  // LOADING
  // ---------------------------------------------

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.blue} />
        <Text style={styles.loadingText}>
          Loading billing information...
        </Text>
      </View>
    );
  }

  // ---------------------------------------------
  // MAIN UI
  // ---------------------------------------------

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadBilling();
          }}
          tintColor={COLORS.blue}
        />
      }
    >
      {/* PAGE HEADER */}

      <View style={styles.pageHeader}>
        <Text style={styles.eyebrow}>
          COMMERCIALS / {user?.clientName || "YOUR BRAND"}
        </Text>

        <Text style={styles.pageTitle}>Billing</Text>

        <Text style={styles.pageSubtitle}>
          Every campaign budget broken down — what each creator was charged,
          and the agency fee, stated separately.
        </Text>
      </View>

      {/* ERROR */}

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>
            Unable to load billing
          </Text>

          <Text style={styles.errorMessage}>{error}</Text>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setLoading(true);
              loadBilling();
            }}
          >
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* EMPTY STATE */}

      {!error && campaigns?.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>₹</Text>
          <Text style={styles.emptyTitle}>Nothing billed yet</Text>
          <Text style={styles.emptyMessage}>
            Campaign costs appear here as soon as a budget is agreed and
            the roster is priced.
          </Text>
        </View>
      ) : null}

      {/* SUMMARY */}

      {campaigns && campaigns.length > 0 ? (
        <>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryHeading}>
              BILLING SUMMARY
            </Text>

            <View style={styles.metricsGrid}>
              <MetricCard
                label="Total"
                value={formatINR(totals.all)}
                subtitle="Every campaign, incl. GST"
              />

              <MetricCard
                label="Paid"
                value={formatINR(totals.settled)}
                subtitle="Already settled"
                color={COLORS.green}
              />

              <MetricCard
                label="Yet to pay"
                value={formatINR(totals.due)}
                subtitle="Invoiced, not yet settled"
                color={COLORS.amber}
              />

              <MetricCard
                label="Campaigns"
                value={String(campaigns.length)}
                subtitle="With costs to show"
              />
            </View>

            {/* SETTLEMENT BAR */}

            {totals.settled + totals.due > 0 ? (
              <View style={styles.settlementSection}>
                <Text style={styles.settlementHeading}>
                  PAYMENT STATUS
                </Text>

                <View style={styles.settlementTrack}>
                  {totals.settled > 0 ? (
                    <View
                      style={[
                        styles.settledBar,
                        {
                          width: `${
                            (totals.settled /
                              (totals.settled + totals.due)) *
                            100
                          }%`,
                        },
                      ]}
                    />
                  ) : null}

                  {totals.due > 0 ? (
                    <View
                      style={[
                        styles.dueBar,
                        {
                          width: `${
                            (totals.due /
                              (totals.settled + totals.due)) *
                            100
                          }%`,
                        },
                      ]}
                    />
                  ) : null}
                </View>

                <View style={styles.settlementLegend}>
                  <Text style={styles.settledLegend}>
                    ● Settled {formatINR(totals.settled)}
                  </Text>

                  <Text style={styles.dueLegend}>
                    ● Yet to pay {formatINR(totals.due)}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* CAMPAIGN STATEMENTS */}

          <View style={styles.statementsHeader}>
            <Text style={styles.statementsEyebrow}>
              STATEMENTS
            </Text>

            <Text style={styles.statementsTitle}>
              Every campaign, line by line
            </Text>

            <Text style={styles.statementsSubtitle}>
              What each creator was charged, the agency fee, and what the
              campaign comes to with tax.
            </Text>
          </View>

          {campaigns.map((campaign) => (
            <CampaignBillCard
              key={campaign.id}
              campaign={campaign}
            />
          ))}

          {/* FOOTNOTE */}

          <View style={styles.footnote}>
            <Text style={styles.footnoteText}>
              Figures are the agreed cost per creator and the agency fee
              for each campaign. GST is charged at 18% on the agreed
              campaign budget and is stated separately. All other figures
              are exclusive of tax. A campaign whose budget is still to
              be confirmed carries no GST figure yet.
            </Text>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

// ---------------------------------------------
// STYLES
// ---------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 26,
    paddingBottom: 50,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
    gap: 12,
  },

  loadingText: {
    color: COLORS.sub,
    fontSize: 13,
  },

  pageHeader: {
    marginBottom: 24,
  },

  eyebrow: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 12,
  },

  pageTitle: {
    color: COLORS.ink,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1,
  },

  pageSubtitle: {
    color: COLORS.sub,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 10,
  },

  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 30,
  },

  summaryHeading: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.3,
    marginBottom: 14,
  },

  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  metricCard: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: COLORS.background,
    borderRadius: 13,
    padding: 13,
    minHeight: 105,
  },

  metricLabel: {
    color: COLORS.sub,
    fontSize: 11,
    fontWeight: "600",
  },

  metricValue: {
    color: COLORS.ink,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 9,
  },

  metricSubtitle: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 5,
    lineHeight: 14,
  },

  settlementSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 17,
    paddingTop: 15,
  },

  settlementHeading: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 11,
  },

  settlementTrack: {
    height: 7,
    backgroundColor: COLORS.well,
    borderRadius: 10,
    overflow: "hidden",
    flexDirection: "row",
  },

  settledBar: {
    height: "100%",
    backgroundColor: COLORS.green,
  },

  dueBar: {
    height: "100%",
    backgroundColor: COLORS.amber,
  },

  settlementLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 10,
    gap: 8,
  },

  settledLegend: {
    color: COLORS.green,
    fontSize: 10,
    fontWeight: "600",
  },

  dueLegend: {
    color: COLORS.amber,
    fontSize: 10,
    fontWeight: "600",
  },

  statementsHeader: {
    marginBottom: 16,
  },

  statementsEyebrow: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  statementsTitle: {
    color: COLORS.ink,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 8,
  },

  statementsSubtitle: {
    color: COLORS.sub,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 6,
  },

  campaignCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 17,
    marginBottom: 17,
    overflow: "hidden",
    paddingHorizontal: 15,
    paddingTop: 16,
  },

  campaignHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    paddingBottom: 14,
  },

  campaignHeaderLeft: {
    flex: 1,
    gap: 7,
  },

  campaignHeaderRight: {
    alignItems: "flex-end",
    flexShrink: 0,
  },

  campaignName: {
    color: COLORS.ink,
    fontSize: 17,
    fontWeight: "800",
  },

  campaignDate: {
    color: COLORS.muted,
    fontSize: 10,
  },

  campaignBudgetLabel: {
    color: COLORS.muted,
    fontSize: 9,
    fontWeight: "700",
  },

  campaignBudget: {
    color: COLORS.ink,
    fontSize: 19,
    fontWeight: "800",
    marginTop: 5,
  },

  inclusiveGST: {
    color: COLORS.sub,
    fontSize: 10,
    marginTop: 4,
  },

  pendingText: {
    color: COLORS.amber,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },

  expandText: {
    color: COLORS.blue,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 9,
  },

  statusBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  statusDot: {
    height: 6,
    width: 6,
    borderRadius: 5,
  },

  statusText: {
    fontSize: 10,
    fontWeight: "700",
  },

  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 14,
  },

  allocationContainer: {
    paddingBottom: 15,
  },

  allocationTrack: {
    flexDirection: "row",
    height: 7,
    backgroundColor: COLORS.well,
    borderRadius: 10,
    overflow: "hidden",
  },

  creatorBar: {
    height: "100%",
    backgroundColor: COLORS.blue,
  },

  feeBar: {
    height: "100%",
    backgroundColor: COLORS.teal,
  },

  legendContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 9,
  },

  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  legendDot: {
    height: 7,
    width: 7,
    borderRadius: 2,
  },

  legendText: {
    color: COLORS.sub,
    fontSize: 9,
  },

  overBudgetText: {
    color: COLORS.red,
    fontSize: 10,
    fontWeight: "700",
  },

  blockHeader: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 13,
    paddingBottom: 7,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  blockTitle: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },

  blockNote: {
    color: COLORS.muted,
    fontSize: 10,
  },

  billingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },

  billingRowLeft: {
    flex: 1,
  },

  billingRowLabel: {
    color: COLORS.ink,
    fontSize: 12,
    fontWeight: "600",
  },

  billingRowSub: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 4,
    lineHeight: 14,
  },

  billingRowRight: {
    alignItems: "flex-end",
    gap: 3,
  },

  billingAmount: {
    color: COLORS.ink,
    fontSize: 12,
    fontWeight: "700",
  },

  billingAmountStrong: {
    fontSize: 15,
    fontWeight: "800",
  },

  shareText: {
    color: COLORS.muted,
    fontSize: 9,
  },

  emptyLine: {
    color: COLORS.muted,
    fontSize: 11,
    paddingVertical: 13,
  },

  totalSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.ink,
    marginTop: 3,
  },

  diffSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  payableSection: {
    backgroundColor: COLORS.well,
    marginHorizontal: -15,
    marginTop: 13,
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 12,
  },

  payableTotal: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 2,
  },

  errorCard: {
    backgroundColor: COLORS.redBg,
    borderRadius: 14,
    padding: 17,
    marginBottom: 20,
  },

  errorTitle: {
    color: COLORS.red,
    fontSize: 15,
    fontWeight: "800",
  },

  errorMessage: {
    color: COLORS.sub,
    fontSize: 12,
    marginTop: 7,
    lineHeight: 18,
  },

  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.white,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 9,
    marginTop: 13,
  },

  retryText: {
    color: COLORS.blue,
    fontSize: 12,
    fontWeight: "700",
  },

  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  emptyIcon: {
    color: COLORS.blue,
    fontSize: 36,
    fontWeight: "800",
  },

  emptyTitle: {
    color: COLORS.ink,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 12,
  },

  emptyMessage: {
    color: COLORS.sub,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 19,
    marginTop: 8,
  },

  footnote: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 18,
    paddingTop: 16,
  },

  footnoteText: {
    color: COLORS.muted,
    fontSize: 10,
    lineHeight: 17,
  },
});