import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Image, Linking, ScrollView, StyleSheet, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useAuth } from "../../src/context/AuthContext";
import { useAppTheme } from "../../src/context/ThemeContext";
import {
  type PortalScope,
  type InsightItem,
  type InsightFavourite,
  type PortalCommentInsights,
  type PortalQuestionAnswers,
  getPortalTrending,
  getPortalQuestions,
  getPortalCommentInsights,
  getPortalMarketWatch,
  getPortalNews,
  getPortalNewsletter,
  getPortalFavourites,
  getPortalNewsletterFileUrl,
  togglePortalFavourite,
} from "../../src/lib/api";
import {
  Card,
  EmptyState,
  ErrorState,
  Hairline,
  IconBadge,
  Meter,
  Reveal,
  ScreenScroll,
  ScreenSkeleton,
  ScreenTitle,
  SectionTitle,
  Segmented,
  T,
  Tap,
  thud,
  type IconName,
  type Tone,
} from "../../src/ui/primitives";
import { compactCount } from "../../src/ui/format";
import { fonts, midnight, radius, space, springs } from "../../src/ui/theme";

const SECTIONS = [
  "Questions",
  "Audience Voice",
  "Trending",
  "Market Watch",
  "Newsletter",
] as const;

type Section = (typeof SECTIONS)[number];

type InsightsData = {
  questions: PortalQuestionAnswers | null;
  audience: PortalCommentInsights | null;
  trending: InsightItem[] | null;
  marketWatch: InsightItem[] | null;
  news: InsightItem[] | null;
  newsletter: InsightItem[] | null;
  favourites: InsightFavourite[] | null;
};

const EMPTY_DATA: InsightsData = {
  questions: null,
  audience: null,
  trending: null,
  marketWatch: null,
  news: null,
  newsletter: null,
  favourites: null,
};

const QUESTION_FIELDS: {
  key: "whatWorked" | "whatDidntWork" | "nextActions" | "areasToImprove";
  title: string;
  icon: IconName;
  tone: Tone;
}[] = [
  { key: "whatWorked", title: "What worked", icon: "checkmark-circle-outline", tone: "success" },
  { key: "whatDidntWork", title: "What didn't work", icon: "close-circle-outline", tone: "danger" },
  { key: "nextActions", title: "Next actions", icon: "arrow-forward-circle-outline", tone: "accent" },
  { key: "areasToImprove", title: "Areas to improve", icon: "construct-outline", tone: "warning" },
];

function formatNumber(value?: number | null) {
  return compactCount(value);
}

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type ReelItem = InsightItem & { sourceType: "trending" | "market-watch" };

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function Figure({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <T v="figureSm" color={color} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </T>
      <T v="caption" tone="faint">
        {label}
      </T>
    </View>
  );
}

function ListCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <T v="heading" style={{ marginBottom: space.sm }}>
        {title}
      </T>
      {children}
    </Card>
  );
}

function Quote({ text, tone }: { text: string; tone: "success" | "danger" }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.quote,
        { borderLeftColor: tone === "success" ? colors.success : colors.danger },
      ]}
    >
      <T style={{ fontFamily: fonts.serifItalic, fontSize: 16, lineHeight: 23 }}>{text}</T>
    </View>
  );
}

function ReelCard({
  item,
  favourited,
  onFavourite,
}: {
  item: ReelItem;
  favourited: boolean;
  onFavourite: () => void;
}) {
  const { colors } = useAppTheme();
  const pop = useSharedValue(1);
  const star = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const open = () => {
    const url = item.url || item.media?.video;
    if (url) Linking.openURL(url);
    else Alert.alert("Reel", "No reel link is available.");
  };

  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={`Open reel${item.media?.username ? ` by ${item.media.username}` : ""}`}
      onPress={open}
      scaleTo={0.97}
      style={[styles.reel, { backgroundColor: colors.surfaceSecondary }]}
    >
      {item.media?.thumbnail ? (
        <Image source={{ uri: item.media.thumbnail }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.reelBlank]}>
          <Ionicons name="film-outline" size={26} color={colors.faint} />
          <T v="caption" tone="faint">
            No preview yet
          </T>
        </View>
      )}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(0,0,28,0)", "rgba(0,0,28,0.88)"]}
        style={styles.reelShade}
      />

      <Tap
        accessibilityRole="button"
        accessibilityLabel={favourited ? "Remove from favourites" : "Add to favourites"}
        accessibilityState={{ selected: favourited }}
        haptic={false}
        onPress={() => {
          thud();
          pop.value = withSequence(withSpring(1.4, springs.press), withSpring(1, springs.press));
          onFavourite();
        }}
        hitSlop={8}
        style={styles.reelStar}
      >
        <Animated.View style={star}>
          <Ionicons
            name={favourited ? "star" : "star-outline"}
            size={17}
            color={favourited ? midnight.lamp : "#FFFFFF"}
          />
        </Animated.View>
      </Tap>

      <View style={styles.reelText}>
        <T v="label" color="#FFFFFF" numberOfLines={1}>
          {item.media?.username ? `@${item.media.username}` : "Instagram reel"}
        </T>
        {item.media?.caption ? (
          <T v="caption" color="rgba(255,255,255,0.78)" numberOfLines={2}>
            {item.media.caption}
          </T>
        ) : null}
        <View style={styles.reelStats}>
          <Ionicons name="eye-outline" size={12} color="#FFFFFF" />
          <T v="caption" color="#FFFFFF">
            {formatNumber(item.media?.views)}
          </T>
          <Ionicons name="heart-outline" size={12} color="#FFFFFF" style={{ marginLeft: 8 }} />
          <T v="caption" color="#FFFFFF">
            {formatNumber(item.media?.likes)}
          </T>
        </View>
      </View>
    </Tap>
  );
}

function Notes({ notes, dated }: { notes: InsightItem[]; dated?: boolean }) {
  return (
    <Card pad={0}>
      {notes.map((note, index) => (
        <View key={String(note.id || index)}>
          {index > 0 ? <Hairline style={{ marginLeft: space.lg }} /> : null}
          <View style={{ padding: space.lg, gap: 4 }}>
            {dated && note.topic ? (
              <T v="label" tone="accent">
                {note.topic}
              </T>
            ) : null}
            <T>{note.text || note.title || "—"}</T>
            {dated && note.createdAt ? (
              <T v="caption" tone="faint">
                {formatDate(note.createdAt)}
              </T>
            ) : null}
          </View>
        </View>
      ))}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function OverviewScreen() {
  const { user } = useAuth();

  const [activeSection, setActiveSection] =
    useState<Section>("Questions");

  const [data, setData] = useState<InsightsData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [trendTab, setTrendTab] = useState<
    "general" | "industry" | "favourite"
  >("general");

  const scope = useMemo<PortalScope | null>(() => {
    if (!user?.brandId) return null;

    return {
      brandId: user.brandId,
      clientName: user.clientName,
    };
  }, [user?.brandId, user?.clientName]);

  const loadInsights = useCallback(
    async (isRefresh = false) => {
      if (!scope) {
        setLoading(false);
        setError("Your brand account could not be identified.");
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const [
          questions,
          audience,
          trending,
          marketWatch,
          news,
          newsletter,
          favourites,
        ] = await Promise.all([
          getPortalQuestions(scope),
          getPortalCommentInsights(scope),
          getPortalTrending(),
          getPortalMarketWatch(scope),
          getPortalNews(),
          getPortalNewsletter(scope),
          getPortalFavourites(scope),
        ]);

        setData({
          questions,
          audience,
          trending,
          marketWatch,
          news,
          newsletter,
          favourites,
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load Insights."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [scope]
  );

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  const favouriteKeys = useMemo(() => {
    return new Set(
      (data.favourites || []).map(
        (item) => `${item.itemType}:${item.itemId}`
      )
    );
  }, [data.favourites]);

  const isFavourite = (
    itemType: "trending" | "market-watch",
    id: string
  ) => favouriteKeys.has(`${itemType}:${id}`);

  const handleFavourite = async (
    itemType: "trending" | "market-watch",
    id: string
  ) => {
    if (!scope) return;

    const key = `${itemType}:${id}`;
    const already = favouriteKeys.has(key);

    const previous = data.favourites || [];

    const updated = already
      ? previous.filter(
          (item) => `${item.itemType}:${item.itemId}` !== key
        )
      : [...previous, { itemType, itemId: id }];

    setData((current) => ({
      ...current,
      favourites: updated,
    }));

    try {
      await togglePortalFavourite(scope, id, itemType);
    } catch {
      setData((current) => ({
        ...current,
        favourites: previous,
      }));

      Alert.alert(
        "Unable to update favourite",
        "Please try again."
      );
    }
  };

  const { colors } = useAppTheme();

  if (loading) return <ScreenSkeleton hero={false} />;

  if (error) {
    return (
      <ErrorState title="Insights did not load" message={error} onRetry={() => loadInsights()} />
    );
  }

  const renderQuestions = () => {
    const questions = data.questions;

    if (!questions) {
      return <EmptyState icon="help-circle-outline" title="No answers yet" message="Your account team's review appears here after each campaign cycle." />;
    }

    return (
      <View style={styles.gap}>
        {QUESTION_FIELDS.map((field, index) => {
          const answer = questions[field.key];
          return (
            <Reveal key={field.key} index={index}>
              <Card>
                <View style={styles.questionHead}>
                  <IconBadge icon={field.icon} tone={field.tone} />
                  <View style={{ flex: 1 }}>
                    <T v="heading">{field.title}</T>
                    <T v="caption" tone="faint" numberOfLines={1}>
                      {user?.clientName || "Your brand"}
                    </T>
                  </View>
                </View>
                <T tone={answer ? "default" : "muted"} style={{ marginTop: space.md }}>
                  {answer || "Not answered yet. Your account team can fill this in."}
                </T>
              </Card>
            </Reveal>
          );
        })}
      </View>
    );
  };

  const renderAudienceVoice = () => {
    const response = data.audience;
    const insight = response?.insight;
    const totals = insight?.totals;

    if (!response) {
      return <EmptyState icon="chatbubbles-outline" title="Audience voice is unavailable" message="Pull down to try again." />;
    }

    if (!insight || !totals?.comments) {
      let message =
        "Once your campaign posts are live, the comments on them are summarised here every week.";

      if (response.status === "running") {
        message = "Your campaign comments are being read right now. Check back in a few minutes.";
      } else if (insight?.totals?.posts) {
        message = "Your campaign posts have no comments to read yet.";
      }

      return <EmptyState icon="chatbubbles-outline" title="Nothing to summarise yet" message={message} />;
    }

    const sentiment = insight.sentimentPct || {};
    const net = Math.round((sentiment.positive || 0) - (sentiment.negative || 0));
    const text = (item: any, ...keys: string[]) =>
      typeof item === "string" ? item : keys.map((key) => item?.[key]).find(Boolean) || "—";

    return (
      <View style={styles.gap}>
        <Reveal>
          <View style={styles.voiceHero}>
            <LinearGradient
              colors={[midnight.top, midnight.mid, midnight.bottom]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <T v="label" color={midnight.muted}>
              Net sentiment
            </T>
            <T
              color={net >= 0 ? midnight.lamp : "#F0A0A0"}
              style={{ fontFamily: fonts.serif, fontSize: 64, lineHeight: 70, letterSpacing: -2 }}
            >
              {net > 0 ? "+" : ""}
              {net}%
            </T>
            <T color={midnight.muted}>
              Positive comments minus negative ones, across {formatNumber(totals.comments)} comments
              on {formatNumber(totals.posts)} posts.
            </T>
            <View style={styles.voiceGrid}>
              <Figure label="Comments" value={formatNumber(totals.comments)} color={midnight.text} />
              <Figure label="Posts" value={formatNumber(totals.posts)} color={midnight.text} />
              <Figure label="Positive" value={`${sentiment.positive || 0}%`} color={midnight.text} />
              <Figure label="Negative" value={`${sentiment.negative || 0}%`} color={midnight.text} />
            </View>
            <T v="caption" color={midnight.faint} style={{ marginTop: space.md }}>
              Updated {formatDate(response.generatedAt)}
            </T>
          </View>
        </Reveal>

        <Reveal index={1}>
          <ListCard title="Sentiment breakdown">
            {[
              { label: "Positive", value: sentiment.positive || 0, color: colors.success },
              { label: "Neutral", value: sentiment.neutral || 0, color: colors.faint },
              { label: "Negative", value: sentiment.negative || 0, color: colors.danger },
            ].map((item, index) => (
              <View key={item.label} style={{ gap: 6, marginTop: index ? space.md : 4 }}>
                <View style={styles.rowBetween}>
                  <T v="label">{item.label}</T>
                  <T v="label" tone="muted">
                    {item.value}%
                  </T>
                </View>
                <Meter value={item.value} color={item.color} height={8} delay={200 + index * 120} />
              </View>
            ))}
          </ListCard>
        </Reveal>

        {insight.themes?.length ? (
          <ListCard title="What they talk about">
            <View style={styles.chips}>
              {insight.themes.map((theme: any, index: number) => {
                const label = text(theme, "name", "theme", "label");
                return (
                  <View
                    key={`${label}-${index}`}
                    style={[styles.chip, { backgroundColor: colors.well }]}
                  >
                    <T v="label">{label === "—" ? "Topic" : label}</T>
                  </View>
                );
              })}
            </View>
          </ListCard>
        ) : null}

        {insight.purchaseQuotes?.length ? (
          <ListCard title="Buying signals">
            <View style={{ gap: space.md }}>
              {insight.purchaseQuotes.slice(0, 5).map((item: any, index: number) => (
                <Quote key={index} tone="success" text={`“${text(item, "text", "comment")}”`} />
              ))}
            </View>
          </ListCard>
        ) : null}

        {insight.questions?.length ? (
          <ListCard title="Questions from your audience">
            {insight.questions.map((item: any, index: number) => (
              <View key={index}>
                {index > 0 ? <Hairline /> : null}
                <View style={styles.askRow}>
                  <Ionicons name="help-circle-outline" size={17} color={colors.accent} />
                  <T style={{ flex: 1 }}>{text(item, "text", "question")}</T>
                </View>
              </View>
            ))}
          </ListCard>
        ) : null}

        {insight.negativeComments?.length ? (
          <ListCard title="Concerns">
            <View style={{ gap: space.md }}>
              {insight.negativeComments.map((item: any, index: number) => (
                <Quote key={index} tone="danger" text={text(item, "text", "comment")} />
              ))}
            </View>
          </ListCard>
        ) : null}
      </View>
    );
  };

  const generalReels = (data.trending || []).filter(
    (item) => item.kind === "reel"
  );

  const industryReels = (data.marketWatch || []).filter(
    (item) => item.kind === "reel"
  );

  const favouriteReels = [
    ...generalReels
      .filter((item) =>
        isFavourite("trending", String(item.id))
      )
      .map((item) => ({
        ...item,
        sourceType: "trending" as const,
      })),

    ...industryReels
      .filter((item) =>
        isFavourite("market-watch", String(item.id))
      )
      .map((item) => ({
        ...item,
        sourceType: "market-watch" as const,
      })),
  ];

  const activeReels =
    trendTab === "general"
      ? generalReels.map((item) => ({
          ...item,
          sourceType: "trending" as const,
        }))
      : trendTab === "industry"
      ? industryReels.map((item) => ({
          ...item,
          sourceType: "market-watch" as const,
        }))
      : favouriteReels;

  const reelGrid = (reels: ReelItem[]) => (
    <View style={styles.reelGrid}>
      {reels.map((item) => {
        const id = String(item.id || "");
        return (
          <ReelCard
            key={`${item.sourceType}-${id}`}
            item={item}
            favourited={isFavourite(item.sourceType, id)}
            onFavourite={() => handleFavourite(item.sourceType, id)}
          />
        );
      })}
    </View>
  );

  const renderTrending = () => {
    const notes = (data.trending || []).filter((item) => item.kind === "note");

    const activeStats = activeReels.reduce(
      (totals, item) => ({
        views: totals.views + (item.media?.views || 0),
        likes: totals.likes + (item.media?.likes || 0),
      }),
      { views: 0, likes: 0 }
    );

    return (
      <View style={styles.gap}>
        <Segmented
          value={trendTab}
          onChange={setTrendTab}
          options={[
            { value: "general", label: "General" },
            { value: "industry", label: "Industry" },
            { value: "favourite", label: "Favourites" },
          ]}
        />

        {activeReels.length ? (
          <>
            <View style={[styles.statStrip, { borderColor: colors.borderStrong }]}>
              <Figure label="Reels" value={activeReels.length} />
              <Figure label="Total views" value={formatNumber(activeStats.views)} />
              <Figure label="Total likes" value={formatNumber(activeStats.likes)} />
            </View>
            <Animated.View key={trendTab} entering={FadeIn.duration(280)}>
              {reelGrid(activeReels)}
            </Animated.View>
          </>
        ) : (
          <EmptyState
            icon={trendTab === "favourite" ? "star-outline" : "film-outline"}
            title={trendTab === "favourite" ? "No favourites yet" : "No reels yet"}
            message={
              trendTab === "favourite"
                ? "Tap the star on any reel to keep it here."
                : "Trending reels appear here as the team adds them."
            }
          />
        )}

        {trendTab === "general" ? (
          <>
            <SectionTitle title="Our insights" note="Notes from the Fifth Avenue team" />
            {notes.length ? (
              <Notes notes={notes} />
            ) : (
              <T tone="muted">No notes yet.</T>
            )}
          </>
        ) : null}
      </View>
    );
  };

  const renderMarketWatch = () => {
    const notes = (data.marketWatch || []).filter((item) => item.kind === "note");

    return (
      <View style={styles.gap}>
        <SectionTitle title="Latest news" note="Industry updates and headlines" />

        {data.news?.length ? (
          data.news.map((item, index) => (
            <Reveal key={String(item.id || item.link || index)} index={index}>
              <Tap
                accessibilityRole="link"
                scaleTo={0.98}
                onPress={() => {
                  const url = item.link || item.url;
                  if (url) Linking.openURL(url);
                }}
              >
                <Card pad={0} style={{ overflow: "hidden" }}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.newsImage} resizeMode="cover" />
                  ) : null}
                  <View style={styles.newsBody}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <T v="subhead">{item.title || "Untitled story"}</T>
                      <T v="caption" tone="faint">
                        {item.source || "Industry news"}
                      </T>
                    </View>
                    <Ionicons name="open-outline" size={16} color={colors.muted} />
                  </View>
                </Card>
              </Tap>
            </Reveal>
          ))
        ) : (
          <T tone="muted">The news feed is empty right now.</T>
        )}

        <SectionTitle title="Our watch" note="Updates picked for your brand" />
        {notes.length ? <Notes notes={notes} dated /> : <T tone="muted">No updates yet.</T>}

        <SectionTitle title="Industry reels" />
        {industryReels.length ? (
          reelGrid(industryReels.map((item) => ({ ...item, sourceType: "market-watch" as const })))
        ) : (
          <T tone="muted">No industry reels yet.</T>
        )}
      </View>
    );
  };

  const renderNewsletter = () => {
    if (!data.newsletter?.length) {
      return <EmptyState icon="newspaper-outline" title="No newsletters yet" message="Each issue appears here as a PDF when it is published." />;
    }

    return (
      <Card pad={0}>
        {data.newsletter.map((item, index) => {
          const id = String(item.id || "");
          return (
            <View key={id || index}>
              {index > 0 ? <Hairline style={{ marginLeft: 70 }} /> : null}
              <Tap
                accessibilityRole="link"
                accessibilityLabel={`Open ${item.title || "newsletter"}`}
                scaleTo={0.985}
                onPress={() => {
                  if (!scope || !id) return;
                  const url = getPortalNewsletterFileUrl(id, scope);
                  Linking.openURL(url).catch(() => {
                    Alert.alert("Unable to open newsletter", "Please try again.");
                  });
                }}
                style={styles.letterRow}
              >
                <IconBadge icon="document-text-outline" tone="danger" />
                <View style={{ flex: 1 }}>
                  <T v="bodyStrong" numberOfLines={2}>
                    {item.title || "Newsletter.pdf"}
                  </T>
                  <T v="caption" tone="faint">
                    {formatDate(item.uploadedAt)}
                  </T>
                </View>
                <Ionicons name="arrow-up-outline" size={17} color={colors.muted} style={{ transform: [{ rotate: "45deg" }] }} />
              </Tap>
            </View>
          );
        })}
      </Card>
    );
  };

  const renderActiveSection = () => {
    switch (activeSection) {
      case "Questions":
        return renderQuestions();
      case "Audience Voice":
        return renderAudienceVoice();
      case "Trending":
        return renderTrending();
      case "Market Watch":
        return renderMarketWatch();
      case "Newsletter":
        return renderNewsletter();
      default:
        return null;
    }
  };

  return (
    <ScreenScroll refreshing={refreshing} onRefresh={() => loadInsights(true)}>
      <ScreenTitle
        title="Beyond the account."
        note="Your team's review, what your audience says, and what the market is doing."
      />

      <Reveal index={1} style={{ marginHorizontal: -space.xl }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.sm }}
        >
          {SECTIONS.map((section) => {
            const active = activeSection === section;
            return (
              <Tap
                key={section}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setActiveSection(section)}
                style={[
                  styles.sectionChip,
                  {
                    backgroundColor: active ? colors.accent : "transparent",
                    borderColor: active ? colors.accent : colors.borderStrong,
                  },
                ]}
              >
                <T v="label" color={active ? colors.onAccent : colors.text2}>
                  {section}
                </T>
              </Tap>
            );
          })}
        </ScrollView>
      </Reveal>

      <Animated.View key={activeSection} entering={FadeIn.duration(260)}>
        {renderActiveSection()}
      </Animated.View>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.lg },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionChip: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  questionHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  voiceHero: { borderRadius: radius.xl, overflow: "hidden", padding: 22 },
  voiceGrid: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.lg,
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: midnight.line,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: radius.pill },
  quote: { borderLeftWidth: 2, paddingLeft: space.md },
  askRow: { flexDirection: "row", gap: 10, paddingVertical: space.md, alignItems: "flex-start" },
  statStrip: {
    flexDirection: "row",
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reelGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  reel: {
    flexGrow: 1,
    flexBasis: "45%",
    maxWidth: "48.5%",
    aspectRatio: 9 / 14,
    borderRadius: radius.lg,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  reelBlank: { alignItems: "center", justifyContent: "center", gap: 6 },
  reelShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "62%" },
  reelStar: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,28,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  reelText: { padding: 12, gap: 3 },
  reelStats: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  newsImage: { width: "100%", height: 160 },
  newsBody: { flexDirection: "row", alignItems: "flex-start", gap: space.md, padding: space.lg },
  letterRow: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg },
});
