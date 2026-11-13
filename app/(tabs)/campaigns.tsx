import React, {

  useCallback,

  useEffect,

  useMemo,

  useState,

} from "react";



import {

  ActivityIndicator,

  FlatList,

  Pressable,

  RefreshControl,

  ScrollView,

  StyleSheet,

  Text,

  TextInput,

  View,

} from "react-native";



import { Ionicons } from "@expo/vector-icons";



import { useAuth } from "../../src/context/AuthContext";

import {

  getPortalCampaigns,

  type PortalCampaign,

} from "../../src/lib/api";



// --------------------------------------------------

// TYPES

// --------------------------------------------------



type ViewMode = "grid" | "board";

type ServiceFilter = "all" | "im";



type CampaignStage =

  | "brief"

  | "shortlisting"

  | "production"

  | "live"

  | "completed";



type StageConfig = {

  key: CampaignStage;

  label: string;

  color: string;

  background: string;

  progress: number;

};



// --------------------------------------------------

// CONSTANTS

// --------------------------------------------------



const COLORS = {

  background: "#F7F5F0",

  surface: "#FFFFFF",

  text: "#20242B",

  muted: "#858174",

  border: "#E9E5DC",

  navy: "#172F68",

  gold: "#B47A12",

  green: "#07834B",

  soft: "#F3F2EE",

  red: "#B42318",

};



const STAGES: StageConfig[] = [

  {

    key: "brief",

    label: "Brief & Strategy",

    color: "#777264",

    background: "#F1F0EC",

    progress: 8,

  },

  {

    key: "shortlisting",

    label: "Shortlisting",

    color: "#B47A12",

    background: "#F7EEDC",

    progress: 16,

  },

  {

    key: "production",

    label: "Production",

    color: "#263F83",

    background: "#E9EDF7",

    progress: 55,

  },

  {

    key: "live",

    label: "Live",

    color: "#07834B",

    background: "#E5F4EB",

    progress: 85,

  },

  {

    key: "completed",

    label: "Completed",

    color: "#888477",

    background: "#F0EEE8",

    progress: 100,

  },

];



// --------------------------------------------------

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

  if (value >= 1000000) {

    return `${(value / 1000000).toFixed(value >= 10000000 ? 0 : 1).replace(/\.0$/, "")}M`;

  }



  if (value >= 100000) {

    return `${(value / 100000).toFixed(value >= 1000000 ? 0 : 1).replace(/\.0$/, "")}L`;

  }



  if (value >= 1000) {

    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1).replace(/\.0$/, "")}K`;

  }



  return String(value);

}






function isInfluencerMarketing(campaign: PortalCampaign) {

  return (campaign.service || "")

    .toLowerCase()

    .includes("influencer");

}



function getCampaignIdentity(campaign: PortalCampaign, index: number) {

  return campaign.id || campaign._id || `${campaign.name || "campaign"}-${index}`;

}



// --------------------------------------------------

// MAIN SCREEN

// --------------------------------------------------



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

      setError("Client information is unavailable. Please sign in again.");

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



  // ------------------------------------------------

  // HEADER

  // ------------------------------------------------



  const renderPageHeader = () => (

    <View style={styles.pageHeader}>

      <View style={styles.headingLeft}>

        <Text style={styles.eyebrow}>

          CAMPAIGNS · {campaigns.length} TOTAL

        </Text>



        <Text style={styles.pageTitle}>Campaigns</Text>



        <Text style={styles.pageSubtitle}>

          Track your campaigns from brief to completion.

        </Text>

      </View>



      <View style={styles.countSummary}>

        <View style={styles.countItem}>

          <Text style={styles.countNumber}>

            {activeCampaigns.length}

          </Text>

          <Text style={styles.countLabel}>Active</Text>

        </View>



        <View style={styles.countDivider} />



        <View style={styles.countItem}>

          <Text style={styles.countNumber}>

            {completedCampaigns.length}

          </Text>

          <Text style={styles.countLabel}>Done</Text>

        </View>

      </View>

    </View>

  );



  // ------------------------------------------------

  // FILTER BAR

  // ------------------------------------------------



  const renderFilters = () => (

    <View style={styles.filterArea}>

      <View style={styles.searchContainer}>

        <Ionicons

          name="search-outline"

          size={19}

          color={COLORS.muted}

        />



        <TextInput

          value={search}

          onChangeText={setSearch}

          placeholder="Search campaigns..."

          placeholderTextColor="#A09B90"

          style={styles.searchInput}

          returnKeyType="search"

        />



        {!!search && (

          <Pressable onPress={() => setSearch("")}>

            <Ionicons

              name="close-circle"

              size={19}

              color={COLORS.muted}

            />

          </Pressable>

        )}

      </View>



      <View style={styles.filterAndViewRow}>

        <View style={styles.serviceFilters}>

          <Pressable

            onPress={() => setServiceFilter("all")}

            style={[

              styles.filterButton,

              serviceFilter === "all" && styles.filterButtonActive,

            ]}

          >

            <Text

              style={[

                styles.filterText,

                serviceFilter === "all" && styles.filterTextActive,

              ]}

            >

              All

            </Text>

          </Pressable>



          <Pressable

            onPress={() => setServiceFilter("im")}

            style={[

              styles.filterButton,

              serviceFilter === "im" && styles.filterButtonActive,

            ]}

          >

            <Text

              style={[

                styles.filterText,

                serviceFilter === "im" && styles.filterTextActive,

              ]}

            >

              IM

            </Text>

          </Pressable>

        </View>



        <View style={styles.viewToggle}>

          <Pressable

            onPress={() => setViewMode("grid")}

            style={[

              styles.viewButton,

              viewMode === "grid" && styles.viewButtonActive,

            ]}

          >

            <Ionicons

              name="grid-outline"

              size={16}

              color={viewMode === "grid" ? COLORS.navy : COLORS.muted}

            />

            <Text

              style={[

                styles.viewButtonText,

                viewMode === "grid" && styles.viewButtonTextActive,

              ]}

            >

              Grid

            </Text>

          </Pressable>



          <Pressable

            onPress={() => setViewMode("board")}

            style={[

              styles.viewButton,

              viewMode === "board" && styles.viewButtonActive,

            ]}

          >

            <Ionicons

              name="albums-outline"

              size={16}

              color={viewMode === "board" ? COLORS.navy : COLORS.muted}

            />

            <Text

              style={[

                styles.viewButtonText,

                viewMode === "board" && styles.viewButtonTextActive,

              ]}

            >

              Board

            </Text>

          </Pressable>

        </View>

      </View>

    </View>

  );



  // ------------------------------------------------

  // CAMPAIGN CARD

  // ------------------------------------------------



  const renderCampaignCard = (

    campaign: PortalCampaign,

    index: number,

    compact = false

  ) => {

    const stage = getStageConfig(campaign.stage);

    const creatorsLabel = getCreatorCountLabel(campaign);

    const reach = getTrackedViews(campaign);

    const progress = getCampaignProgress(campaign);

    const budget = formatBudget(campaign.budget);



    const isPendingBudget = budget === "To be confirmed";



    return (

      <Pressable

        key={getCampaignIdentity(campaign, index)}

        onPress={() => setSelectedCampaign(campaign)}

        accessibilityRole="button"

        accessibilityLabel={`Open ${campaign.name || "campaign"} details`}

        style={[

          styles.campaignCard,

          compact && styles.compactCampaignCard,

        ]}

      >

        <View style={styles.cardTop}>

          <View style={styles.cardTitleArea}>

            <Text

              style={styles.campaignTitle}

              numberOfLines={2}

            >

              {campaign.name || "Untitled campaign"}

            </Text>



            <Text style={styles.campaignService} numberOfLines={1}>

              {campaign.service || "Campaign"}

              {campaign.region ? ` · ${campaign.region}` : ""}

            </Text>

          </View>



          <View

            style={[

              styles.progressCircle,

              { borderColor: stage.color },

            ]}

          >

            <Text

              style={[

                styles.progressText,

                { color: stage.color },

              ]}

            >

              {progress}%

            </Text>

          </View>

        </View>



        <View style={styles.statusRow}>

          <View

            style={[

              styles.statusPill,

              { backgroundColor: stage.background },

            ]}

          >

            <View

              style={[

                styles.statusDot,

                { backgroundColor: stage.color },

              ]}

            />



            <Text

              style={[

                styles.statusText,

                { color: stage.color },

              ]}

            >

              {stage.label}

            </Text>

          </View>

        </View>



        <View style={styles.metricsContainer}>

          <Metric

            icon="people-outline"

            value={creatorsLabel}

            label="Creators"

          />



          <Metric

            icon="wallet-outline"

            value={budget}

            label="Budget"

            valueColor={isPendingBudget ? COLORS.gold : COLORS.text}

          />



          <Metric

            icon="eye-outline"

            value={reach > 0 ? formatCompact(reach) : "—"}

            label="Est. Reach"

          />

        </View>



        <View style={styles.progressTrack}>

          <View

            style={[

              styles.progressFill,

              {

                width: `${progress}%`,

                backgroundColor: stage.color,

              },

            ]}

          />

        </View>

      </Pressable>

    );

  };



  // ------------------------------------------------

  // --------------------------------------------------
  // CAMPAIGN DETAILS
  // --------------------------------------------------

  if (selectedCampaign) {
    const campaignData = selectedCampaign as PortalCampaign & Record<string, any>;
    const detailCreators = Array.isArray(campaignData.creators) ? campaignData.creators : [];
    const detailStage = getStageConfig(campaignData.stage);
    const detailProgress = getCampaignProgress(selectedCampaign);
    const detailBudget = formatBudget(campaignData.budget);
    const detailReach = getTrackedViews(selectedCampaign);
    const detailCreatorsLabel = getCreatorCountLabel(selectedCampaign);

    const displayValue = (value: unknown) => {
      if (value === null || value === undefined || value === "") return "—";
      if (typeof value === "object") return "—";
      return String(value);
    };

    const creatorName = (creator: any, index: number) =>
      creator?.name || creator?.fullName || creator?.username ||
      creator?.handle || `Creator ${index + 1}`;

    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => setSelectedCampaign(null)} style={styles.detailBackButton}>
            <Ionicons name="arrow-back" size={19} color={COLORS.navy} />
            <Text style={styles.detailBackText}>Back to campaigns</Text>
          </Pressable>

          <View style={styles.detailHero}>
            <Text style={styles.detailEyebrow}>CAMPAIGN DETAILS</Text>
            <Text style={styles.detailTitle}>{selectedCampaign.name || "Untitled campaign"}</Text>
            <Text style={styles.detailSubtitle}>
              {selectedCampaign.service || "Campaign"}
              {selectedCampaign.region ? ` · ${selectedCampaign.region}` : ""}
            </Text>
            <View style={[styles.detailStatusPill, { backgroundColor: detailStage.background }]}>
              <View style={[styles.statusDot, { backgroundColor: detailStage.color }]} />
              <Text style={[styles.statusText, { color: detailStage.color }]}>{detailStage.label}</Text>
            </View>
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Overview</Text>
            <View style={styles.detailGrid}>
              <View style={styles.detailMetric}><Text style={styles.detailLabel}>Budget</Text><Text style={styles.detailValue}>{detailBudget}</Text></View>
              <View style={styles.detailMetric}><Text style={styles.detailLabel}>Creators</Text><Text style={styles.detailValue}>{detailCreatorsLabel}</Text></View>
              <View style={styles.detailMetric}>
                <Text style={styles.detailLabel}>Estimated reach</Text>
                <Text style={styles.detailValue}>{detailReach > 0 ? formatCompact(detailReach) : "—"}</Text>
              </View>
              <View style={styles.detailMetric}><Text style={styles.detailLabel}>Progress</Text><Text style={styles.detailValue}>{detailProgress}%</Text></View>
            </View>
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Campaign information</Text>
            {[
              ["Service", selectedCampaign.service],
              ["Region", selectedCampaign.region],
              ["Stage", selectedCampaign.stage],
              ["Start date", campaignData.start],
              ["End date", campaignData.end],
              ["Budget", detailBudget],
            ].map(([label, value]) => (
              <View key={label} style={styles.detailInfoRow}>
                <Text style={styles.detailLabel}>{label}</Text>
                <Text style={styles.detailInfoValue}>{displayValue(value)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.detailSection}>
            <View style={styles.detailCreatorHeader}>
              <Text style={styles.detailSectionTitle}>Creators</Text>
              <Text style={styles.detailCreatorCount}>{detailCreators.length}</Text>
            </View>
            {detailCreators.length === 0 ? (
              <Text style={styles.detailEmptyText}>No creators added to this campaign yet.</Text>
            ) : detailCreators.map((creator: any, index: number) => (
              <View key={creator?._id || creator?.id || index} style={styles.detailCreatorRow}>
                <View style={styles.detailCreatorAvatar}>
                  <Text style={styles.detailCreatorInitial}>{creatorName(creator, index).charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.detailCreatorInfo}>
                  <Text style={styles.detailCreatorName}>{creatorName(creator, index)}</Text>
                  <Text style={styles.detailCreatorMeta}>
                    {displayValue(creator?.platform)}
                    {creator?.followers !== undefined ? ` · ${displayValue(creator.followers)} followers` : ""}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  // GRID VIEW

  // ------------------------------------------------



  const renderGridView = () => (

    <View>

      <View style={styles.sectionHeading}>

        <Text style={styles.sectionTitle}>Active campaigns</Text>



        <View style={styles.sectionCount}>

          <Text style={styles.sectionCountText}>

            {activeCampaigns.length} campaigns

          </Text>

        </View>

      </View>



      {activeCampaigns.length === 0 ? (

        <EmptySection message="No active campaigns found." />

      ) : (

        activeCampaigns.map((campaign, index) =>

          renderCampaignCard(campaign, index)

        )

      )}



      <View style={styles.completedSection}>

        <Pressable

          onPress={() => setCompletedExpanded((prev) => !prev)}

          style={styles.completedHeader}

        >

          <View style={styles.completedHeaderLeft}>

            <Ionicons

              name={completedExpanded ? "chevron-down" : "chevron-forward"}

              size={20}

              color={COLORS.text}

            />



            <View>

              <Text style={styles.completedTitle}>

                Completed campaigns

              </Text>

              <Text style={styles.completedSubtitle}>

                {completedCampaigns.length} campaigns

              </Text>

            </View>

          </View>



          <Text style={styles.expandLabel}>

            {completedExpanded ? "Hide" : "Show"}

          </Text>

        </Pressable>



        {completedExpanded && (

          <View style={styles.completedContent}>

            {completedCampaigns.length === 0 ? (

              <EmptySection message="No completed campaigns found." />

            ) : (

              completedCampaigns.map((campaign, index) =>

                renderCampaignCard(campaign, index, true)

              )

            )}

          </View>

        )}

      </View>

    </View>

  );



  // ------------------------------------------------

  // BOARD VIEW

  // ------------------------------------------------



  const renderBoardView = () => (

    <View style={styles.boardContainer}>

      <Text style={styles.boardHint}>

        Swipe horizontally to explore campaign stages.

      </Text>



      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.boardScrollView}
        contentContainerStyle={styles.boardScrollContent}
      >

        {stageGroups.map((group) => (

          <View

            key={group.key}

            style={styles.boardColumn}

          >

            <View style={styles.boardColumnHeader}>

              <View style={styles.boardColumnTitleArea}>

                <View

                  style={[

                    styles.boardStageDot,

                    { backgroundColor: group.color },

                  ]}

                />



                <Text

                  style={[

                    styles.boardColumnTitle,

                    { color: group.color },

                  ]}

                >

                  {group.label}

                </Text>

              </View>



              <View style={styles.boardCount}>

                <Text style={styles.boardCountText}>

                  {group.campaigns.length}

                </Text>

              </View>

            </View>



            {group.key === "completed" && group.campaigns.length > 0 && (

              <Text style={styles.boardCompletedNote}>

                Completed campaigns

              </Text>

            )}



            {group.campaigns.map((campaign, index) =>

              renderCampaignCard(campaign, index, true)

            )}

          </View>

        ))}

      </ScrollView>

    </View>

  );



  // ------------------------------------------------

  // LOADING

  // ------------------------------------------------



  if (loading) {

    return (

      <View style={styles.centerState}>

        <ActivityIndicator

          size="large"

          color={COLORS.navy}

        />

        <Text style={styles.stateText}>

          Loading your campaigns...

        </Text>

      </View>

    );

  }



  // ------------------------------------------------

  // MAIN RENDER

  // ------------------------------------------------



  return (

    <View style={styles.screen}>

      <FlatList

        data={[{ key: "campaign-content" }]}

        keyExtractor={(item) => item.key}

        renderItem={() => (

          <View>

            {renderPageHeader()}

            {renderFilters()}



            {error ? (

              <View style={styles.errorContainer}>

                <Ionicons

                  name="alert-circle-outline"

                  size={28}

                  color={COLORS.red}

                />



                <Text style={styles.errorText}>{error}</Text>



                <Pressable

                  style={styles.retryButton}

                  onPress={() => fetchCampaigns()}

                >

                  <Text style={styles.retryText}>Try again</Text>

                </Pressable>

              </View>

            ) : visibleCampaigns.length === 0 ? (

              <View style={styles.emptyContainer}>

                <Ionicons

                  name="file-tray-outline"

                  size={42}

                  color="#AAA59A"

                />



                <Text style={styles.emptyTitle}>

                  No campaigns found

                </Text>



                <Text style={styles.emptyDescription}>

                  {search || serviceFilter !== "all"

                    ? "Try changing your search or filter."

                    : "Your campaigns will appear here when available."}

                </Text>

              </View>

            ) : viewMode === "grid" ? (

              renderGridView()

            ) : (

              renderBoardView()

            )}

          </View>

        )}

        contentContainerStyle={styles.listContent}

        showsVerticalScrollIndicator={false}

        refreshControl={

          <RefreshControl

            refreshing={refreshing}

            onRefresh={() => fetchCampaigns(true)}

            tintColor={COLORS.navy}

            colors={[COLORS.navy]}

          />

        }

      />

    </View>

  );

}



// --------------------------------------------------

// METRIC COMPONENT

// --------------------------------------------------



function Metric({

  icon,

  value,

  label,

  valueColor,

}: {

  icon: React.ComponentProps<typeof Ionicons>["name"];

  value: string;

  label: string;

  valueColor?: string;

}) {

  return (

    <View style={styles.metricItem}>

      <Ionicons

        name={icon}

        size={17}

        color={COLORS.muted}

      />



      <Text

        style={[

          styles.metricValue,

          valueColor ? { color: valueColor } : null,

        ]}

        numberOfLines={1}

        adjustsFontSizeToFit

      >

        {value}

      </Text>



      <Text style={styles.metricLabel}>

        {label}

      </Text>

    </View>

  );

}



// --------------------------------------------------

// EMPTY SECTION

// --------------------------------------------------



function EmptySection({ message }: { message: string }) {

  return (

    <View style={styles.sectionEmpty}>

      <Text style={styles.sectionEmptyText}>{message}</Text>

    </View>

  );

}



// --------------------------------------------------

// STYLES

// --------------------------------------------------



const styles = StyleSheet.create({

  screen: {

    flex: 1,

    backgroundColor: COLORS.background,

  },



  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 38,
  },



  centerState: {

    flex: 1,

    backgroundColor: COLORS.background,

    alignItems: "center",

    justifyContent: "center",

    gap: 12,

  },



  stateText: {

    color: COLORS.muted,

    fontSize: 14,

  },



  // HEADER



  pageHeader: {
    gap: 17,
    backgroundColor: COLORS.navy,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 21,
    marginBottom: 5,
    overflow: "hidden",
  },



  headingLeft: {

    gap: 5,

  },



  eyebrow: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "800",
    color: "#D9C18E",
  },



  pageTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -1.1,
  },



  pageSubtitle: {
    color: "#D5DCEB",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },



  countSummary: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 15,
  },



  countItem: {

    flexDirection: "row",

    alignItems: "center",

    gap: 5,

  },



  countNumber: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },



  countLabel: {
    fontSize: 12,
    color: "#D5DCEB",
  },



  countDivider: {
    height: 19,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.25)",
  },



  // FILTERS



  filterArea: {
    paddingTop: 13,
    paddingBottom: 20,
    gap: 12,
  },



  searchContainer: {
    height: 48,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E5E1D8",
    backgroundColor: COLORS.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    gap: 10,
    shadowColor: "#172F68",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.035,
    shadowRadius: 6,
    elevation: 1,
  },



  searchInput: {

    flex: 1,

    color: COLORS.text,

    fontSize: 14,

    paddingVertical: 0,

  },



  filterAndViewRow: {

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",

  },



  serviceFilters: {

    flexDirection: "row",

    backgroundColor: COLORS.surface,

    borderRadius: 24,

    padding: 3,

    borderWidth: 1,

    borderColor: COLORS.border,

  },



  filterButton: {

    paddingHorizontal: 17,

    paddingVertical: 8,

    borderRadius: 20,

  },



  filterButtonActive: {

    backgroundColor: "#E9EBEF",

  },



  filterText: {

    color: COLORS.muted,

    fontSize: 12,

    fontWeight: "600",

  },



  filterTextActive: {

    color: COLORS.navy,

  },



  viewToggle: {

    flexDirection: "row",

    backgroundColor: COLORS.surface,

    borderRadius: 24,

    padding: 3,

    borderWidth: 1,

    borderColor: COLORS.border,

  },



  viewButton: {

    flexDirection: "row",

    alignItems: "center",

    gap: 4,

    paddingHorizontal: 11,

    paddingVertical: 8,

    borderRadius: 20,

  },



  viewButtonActive: {

    backgroundColor: "#E9EBEF",

  },



  viewButtonText: {

    fontSize: 11,

    color: COLORS.muted,

    fontWeight: "600",

  },



  viewButtonTextActive: {

    color: COLORS.navy,

  },



  // SECTIONS



  sectionHeading: {

    flexDirection: "row",

    alignItems: "center",

    gap: 11,

    marginBottom: 15,

    marginTop: 2,

  },



  sectionTitle: {
    fontSize: 20,
    color: "#1C1B19",
    fontWeight: "800",
    letterSpacing: -0.45,
  },



  sectionCount: {

    backgroundColor: "#EEEFF3",

    borderRadius: 20,

    paddingHorizontal: 11,

    paddingVertical: 6,

  },



  sectionCountText: {

    fontSize: 11,

    color: COLORS.navy,

    fontWeight: "700",

  },



  // CAMPAIGN CARD



  campaignCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EAE6DE",
    padding: 16,
    marginBottom: 14,
    shadowColor: "#1B2B4A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.055,
    shadowRadius: 10,
    elevation: 2,
  },



  compactCampaignCard: {

    padding: 13,

  },



  cardTop: {

    flexDirection: "row",

    alignItems: "flex-start",

    gap: 9,

  },



  cardTitleArea: {

    flex: 1,

    paddingTop: 2,

  },



  campaignTitle: {

    fontSize: 15,

    lineHeight: 21,

    fontWeight: "700",

    color: COLORS.text,

  },



  campaignService: {

    fontSize: 12,

    color: COLORS.muted,

    marginTop: 4,

  },



  progressCircle: {

    height: 47,

    width: 47,

    borderRadius: 24,

    borderWidth: 3,

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: "#FFFFFF",

  },



  progressText: {

    fontSize: 12,

    fontWeight: "800",

  },



  statusRow: {

    marginTop: 12,

    marginBottom: 11,

    flexDirection: "row",

  },



  statusPill: {

    flexDirection: "row",

    alignItems: "center",

    gap: 6,

    borderRadius: 20,

    paddingHorizontal: 10,

    paddingVertical: 6,

  },



  statusDot: {

    height: 6,

    width: 6,

    borderRadius: 4,

  },



  statusText: {

    fontSize: 10,

    fontWeight: "700",

  },



  metricsContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7F6F2",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 5,
    borderWidth: 1,
    borderColor: "#F0EDE6",
  },



  metricItem: {

    flex: 1,

    alignItems: "center",

    justifyContent: "center",

    gap: 4,

    minWidth: 0,

  },



  metricValue: {

    fontSize: 12,

    fontWeight: "800",

    color: COLORS.text,

    maxWidth: "100%",

  },



  metricLabel: {

    fontSize: 10,

    color: COLORS.muted,

  },



  progressTrack: {

    height: 5,

    borderRadius: 5,

    backgroundColor: "#E9E7E1",

    marginTop: 14,

    overflow: "hidden",

  },



  progressFill: {

    height: "100%",

    borderRadius: 5,

  },



  // COMPLETED SECTION



  completedSection: {
    borderWidth: 1,
    borderColor: "#E7E2D8",
    borderRadius: 19,
    backgroundColor: "#F2F0EA",
    padding: 15,
    marginTop: 12,
  },



  completedHeader: {

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",

    minHeight: 43,

  },



  completedHeaderLeft: {

    flexDirection: "row",

    alignItems: "center",

    gap: 10,

    flex: 1,

  },



  completedTitle: {

    fontSize: 18,

    color: "#201F1B",

    fontWeight: "700",

  },



  completedSubtitle: {

    color: COLORS.muted,

    fontSize: 11,

    marginTop: 3,

  },



  expandLabel: {

    color: COLORS.navy,

    fontSize: 12,

    fontWeight: "600",

  },



  completedContent: {

    marginTop: 15,

  },



  // BOARD



  boardContainer: {

    marginTop: 3,

  },



  boardHint: {

    color: COLORS.muted,

    fontSize: 12,

    marginBottom: 14,

  },



  boardScrollView: {
    flexGrow: 0,
    flexShrink: 0,
  },

  boardScrollContent: {
    paddingRight: 15,
    gap: 12,
    alignItems: "flex-start",
  },



  boardColumn: {
    width: 292,
    alignSelf: "flex-start",
    padding: 12,
    borderRadius: 18,
    backgroundColor: "#F0EEE8",
    borderWidth: 1,
    borderColor: "#E5E0D5",
  },



  boardColumnHeader: {

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",

    borderBottomWidth: 1,

    borderBottomColor: "#DEDAD0",

    paddingBottom: 12,

    marginBottom: 12,

  },



  boardColumnTitleArea: {

    flexDirection: "row",

    alignItems: "center",

    gap: 7,

    flex: 1,

  },



  boardStageDot: {

    width: 7,

    height: 7,

    borderRadius: 5,

  },



  boardColumnTitle: {

    fontSize: 12,

    fontWeight: "800",

  },



  boardCount: {

    height: 24,

    minWidth: 24,

    borderRadius: 15,

    backgroundColor: "#FFFFFF",

    alignItems: "center",

    justifyContent: "center",

    paddingHorizontal: 6,

  },



  boardCountText: {

    color: COLORS.text,

    fontSize: 11,

    fontWeight: "700",

  },



  boardCompletedNote: {

    color: COLORS.muted,

    fontSize: 11,

    marginBottom: 10,

  },



  // CAMPAIGN DETAILS
  detailContent: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 40, gap: 16 },
  detailBackButton: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 8, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: COLORS.border },
  detailBackText: { color: COLORS.navy, fontSize: 13, fontWeight: "700" },
  detailHero: { backgroundColor: COLORS.navy, borderRadius: 22, padding: 21, gap: 9 },
  detailEyebrow: { color: "#D9C18E", fontSize: 10, fontWeight: "800", letterSpacing: 1.7 },
  detailTitle: { color: "#FFFFFF", fontSize: 25, lineHeight: 31, fontWeight: "800" },
  detailSubtitle: { color: "#D5DCEB", fontSize: 13 },
  detailStatusPill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 7, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7, marginTop: 5 },
  detailSection: { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, padding: 17, gap: 13 },
  detailSectionTitle: { color: COLORS.text, fontSize: 17, fontWeight: "800" },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  detailMetric: { width: "47%", backgroundColor: COLORS.background, borderRadius: 13, padding: 12, gap: 5 },
  detailLabel: { color: COLORS.muted, fontSize: 11, fontWeight: "600" },
  detailValue: { color: COLORS.text, fontSize: 16, fontWeight: "800" },
  detailInfoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F0EDE6" },
  detailInfoValue: { color: COLORS.text, fontSize: 12, fontWeight: "700", textAlign: "right", flexShrink: 1 },
  detailCreatorHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  detailCreatorCount: { color: COLORS.navy, fontWeight: "800", fontSize: 12, backgroundColor: "#E9EBEF", overflow: "hidden", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
  detailEmptyText: { color: COLORS.muted, fontSize: 13, paddingVertical: 8 },
  detailCreatorRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#F0EDE6" },
  detailCreatorAvatar: { width: 39, height: 39, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#E9EDF7" },
  detailCreatorInitial: { color: COLORS.navy, fontSize: 14, fontWeight: "800" },
  detailCreatorInfo: { flex: 1, gap: 3 },
  detailCreatorName: { color: COLORS.text, fontSize: 13, fontWeight: "700" },
  detailCreatorMeta: { color: COLORS.muted, fontSize: 11 },

  // EMPTY AND ERROR STATES



  sectionEmpty: {

    backgroundColor: COLORS.surface,

    borderWidth: 1,

    borderColor: COLORS.border,

    borderRadius: 14,

    padding: 22,

    marginBottom: 12,

  },



  sectionEmptyText: {

    color: COLORS.muted,

    textAlign: "center",

    fontSize: 13,

  },



  emptyContainer: {

    alignItems: "center",

    justifyContent: "center",

    paddingVertical: 65,

    gap: 12,

  },



  emptyTitle: {

    color: COLORS.text,

    fontSize: 18,

    fontWeight: "700",

  },



  emptyDescription: {

    color: COLORS.muted,

    fontSize: 13,

    textAlign: "center",

    maxWidth: 260,

    lineHeight: 20,

  },



  errorContainer: {

    backgroundColor: "#FFF4F2",

    borderRadius: 15,

    padding: 22,

    alignItems: "center",

    gap: 12,

  },



  errorText: {

    color: COLORS.red,

    textAlign: "center",

    fontSize: 13,

  },



  retryButton: {

    backgroundColor: COLORS.navy,

    paddingHorizontal: 20,

    paddingVertical: 10,

    borderRadius: 20,

  },



  retryText: {

    color: "#FFFFFF",

    fontWeight: "700",

    fontSize: 12,

  },

});