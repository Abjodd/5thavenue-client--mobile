import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
} from "react-native";

import { useAuth } from "../../src/context/AuthContext";

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

const COLORS = {
  background: "#F8F7F4",
  card: "#FFFFFF",
  text: "#17243A",
  muted: "#7A8290",
  border: "#EAE8E2",
  accent: "#526F9D",
  green: "#39856B",
  red: "#CE6666",
  blue: "#557CB5",
  yellow: "#C49542",
};

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

const QUESTION_FIELDS = [
  {
    key: "whatWorked",
    title: "What Works",
    color: COLORS.green,
    number: "01",
  },
  {
    key: "whatDidntWork",
    title: "What Didn't Work",
    color: COLORS.red,
    number: "02",
  },
  {
    key: "nextActions",
    title: "Next Actions",
    color: COLORS.blue,
    number: "03",
  },
  {
    key: "areasToImprove",
    title: "Areas to Improve",
    color: COLORS.yellow,
    number: "04",
  },
] as const;

function formatNumber(value?: number | null) {
  if (value == null) return "—";
  return Intl.NumberFormat("en-IN", {
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
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

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function SectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? (
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

function LoadingState() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={COLORS.accent} />
      <Text style={styles.loadingText}>Loading Insights...</Text>
    </View>
  );
}

function Metric({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, color ? { color } : null]}>
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

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

  if (loading) return <LoadingState />;

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Insights couldn't load</Text>
        <Text style={styles.errorText}>{error}</Text>

        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => loadInsights()}
        >
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderQuestions = () => {
    const questions = data.questions;

    if (!questions) {
      return <EmptyState message="No questions available yet." />;
    }

    return (
      <View style={styles.contentGap}>
        {QUESTION_FIELDS.map((field) => {
          const answer = questions[field.key];

          return (
            <Card key={field.key}>
              <View style={styles.questionHeader}>
                <View
                  style={[
                    styles.questionNumber,
                    { backgroundColor: `${field.color}18` },
                  ]}
                >
                  <Text
                    style={[
                      styles.questionNumberText,
                      { color: field.color },
                    ]}
                  >
                    {field.number}
                  </Text>
                </View>

                <Text style={styles.questionTitle}>
                  {field.title} {user?.clientName || "Your Brand"}
                </Text>
              </View>

              <Text style={styles.answerText}>
                {answer || "No answer yet — ask the team."}
              </Text>
            </Card>
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
      return (
        <EmptyState message="Audience Voice is not available right now." />
      );
    }

    if (!insight || !totals?.comments) {
      let message =
        "Once your campaign posts are live, audience comments will be summarised here. It updates every week.";

      if (response.status === "running") {
        message =
          "Your campaign comments are being read right now. Check back in a few minutes.";
      } else if (insight?.totals?.posts) {
        message =
          "No comments to read on your campaign posts yet.";
      }

      return <EmptyState message={message} />;
    }

    const sentiment = insight.sentimentPct || {};
    const net = Math.round(
      (sentiment.positive || 0) - (sentiment.negative || 0)
    );

    return (
      <View style={styles.contentGap}>
        <Card>
          <Text style={styles.cardEyebrow}>AUDIENCE OVERVIEW</Text>
          <Text style={styles.audienceHeadline}>
            What your audience is saying
          </Text>

          <View style={styles.metricsGrid}>
            <Metric
              label="Comments"
              value={formatNumber(totals.comments)}
            />
            <Metric
              label="Posts"
              value={formatNumber(totals.posts)}
            />
            <Metric
              label="Positive"
              value={`${sentiment.positive || 0}%`}
              color={COLORS.green}
            />
            <Metric
              label="Negative"
              value={`${sentiment.negative || 0}%`}
              color={COLORS.red}
            />
          </View>

          <View style={styles.netSentiment}>
            <Text style={styles.netSentimentLabel}>
              Net sentiment
            </Text>
            <Text
              style={[
                styles.netSentimentValue,
                { color: net >= 0 ? COLORS.green : COLORS.red },
              ]}
            >
              {net > 0 ? "+" : ""}
              {net}%
            </Text>
          </View>

          <Text style={styles.updatedText}>
            Updated {formatDate(response.generatedAt)}
          </Text>
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Sentiment breakdown</Text>

          {[
            {
              label: "Positive",
              value: sentiment.positive || 0,
              color: COLORS.blue,
            },
            {
              label: "Neutral",
              value: sentiment.neutral || 0,
              color: "#A7A7A7",
            },
            {
              label: "Negative",
              value: sentiment.negative || 0,
              color: COLORS.red,
            },
          ].map((item) => (
            <View key={item.label} style={styles.sentimentRow}>
              <View style={styles.sentimentLabelRow}>
                <Text style={styles.sentimentLabel}>
                  {item.label}
                </Text>
                <Text style={styles.sentimentValue}>
                  {item.value}%
                </Text>
              </View>

              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(
                        100,
                        Math.max(0, item.value)
                      )}%`,
                      backgroundColor: item.color,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </Card>

        {!!insight.themes?.length && (
          <Card>
            <Text style={styles.cardTitle}>Audience topics</Text>

            {insight.themes.map((theme: any, index: number) => {
              const label =
                typeof theme === "string"
                  ? theme
                  : theme.name || theme.theme || theme.label || "Topic";

              return (
                <View key={`${label}-${index}`} style={styles.simpleRow}>
                  <Text style={styles.answerText}>{label}</Text>
                </View>
              );
            })}
          </Card>
        )}

        {!!insight.purchaseQuotes?.length && (
          <Card>
            <Text style={styles.cardTitle}>Buying signals</Text>

            {insight.purchaseQuotes.slice(0, 5).map(
              (item: any, index: number) => (
                <View
                  key={index}
                  style={styles.quoteBox}
                >
                  <Text style={styles.answerText}>
                    “{typeof item === "string"
                      ? item
                      : item.text || item.comment || "—"}”
                  </Text>
                </View>
              )
            )}
          </Card>
        )}

        {!!insight.questions?.length && (
          <Card>
            <Text style={styles.cardTitle}>
              Questions from your audience
            </Text>

            {insight.questions.map(
              (item: any, index: number) => (
                <View key={index} style={styles.simpleRow}>
                  <Text style={styles.answerText}>
                    {typeof item === "string"
                      ? item
                      : item.text || item.question || "—"}
                  </Text>
                </View>
              )
            )}
          </Card>
        )}

        {!!insight.negativeComments?.length && (
          <Card>
            <Text style={styles.cardTitle}>Concerns</Text>

            {insight.negativeComments.map(
              (item: any, index: number) => (
                <View key={index} style={styles.quoteBox}>
                  <Text style={styles.answerText}>
                    {typeof item === "string"
                      ? item
                      : item.text || item.comment || "—"}
                  </Text>
                </View>
              )
            )}
          </Card>
        )}
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

  const renderReel = (
    item: InsightItem & {
      sourceType: "trending" | "market-watch";
    }
  ) => {
    const id = String(item.id || "");

    const favourited = isFavourite(item.sourceType, id);

    return (
      <Card key={`${item.sourceType}-${id}`} style={styles.reelCard}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            const url = item.url || item.media?.video;

            if (url) Linking.openURL(url);
            else Alert.alert("Reel", "No reel link is available.");
          }}
        >
          {item.media?.thumbnail ? (
            <Image
              source={{ uri: item.media.thumbnail }}
              style={styles.reelImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.reelImage, styles.noImage]}>
              <Text style={styles.noImageText}>No snapshot yet</Text>
            </View>
          )}

          <Text style={styles.reelUsername}>
            {item.media?.username
              ? `@${item.media.username}`
              : "Instagram Reel"}
          </Text>

          {!!item.media?.caption && (
            <Text numberOfLines={2} style={styles.reelCaption}>
              {item.media.caption}
            </Text>
          )}

          <View style={styles.reelStats}>
            <Text style={styles.reelStat}>
              Views {formatNumber(item.media?.views)}
            </Text>
            <Text style={styles.reelStat}>
              Likes {formatNumber(item.media?.likes)}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={() =>
            handleFavourite(item.sourceType, id)
          }
        >
          <Text
            style={[
              styles.favoriteIcon,
              favourited && { color: COLORS.yellow },
            ]}
          >
            {favourited ? "★" : "☆"}
          </Text>
        </TouchableOpacity>
      </Card>
    );
  };

  const renderTrending = () => {
    const notes = (data.trending || []).filter(
      (item) => item.kind === "note"
    );

    const activeStats = activeReels.reduce(
      (totals, item) => ({
        views:
          totals.views + (item.media?.views || 0),
        likes:
          totals.likes + (item.media?.likes || 0),
      }),
      { views: 0, likes: 0 }
    );

    return (
      <View style={styles.contentGap}>
        <View style={styles.tabRow}>
          {[
            { key: "general", label: "General" },
            { key: "industry", label: "Industry" },
            { key: "favourite", label: "Favourite" },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setTrendTab(tab.key as any)}
              style={[
                styles.trendTab,
                trendTab === tab.key && styles.trendTabActive,
              ]}
            >
              <Text
                style={[
                  styles.trendTabText,
                  trendTab === tab.key &&
                    styles.trendTabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeReels.length ? (
          <View style={styles.reelGrid}>
            {activeReels.map(renderReel)}
          </View>
        ) : (
          <EmptyState
            message={
              trendTab === "favourite"
                ? "Nothing favourited yet."
                : "No reels available yet."
            }
          />
        )}

        {activeReels.length > 0 && (
          <Card>
            <View style={styles.metricsGrid}>
              <Metric label="Reels" value={activeReels.length} />
              <Metric
                label="Total views"
                value={formatNumber(activeStats.views)}
              />
              <Metric
                label="Total likes"
                value={formatNumber(activeStats.likes)}
              />
            </View>
          </Card>
        )}

        {trendTab === "general" && (
          <>
            <SectionHeading title="Our Insights" />

            {notes.length ? (
              <Card>
                {notes.map((note, index) => (
                  <View
                    key={String(note.id || index)}
                    style={styles.noteItem}
                  >
                    <Text style={styles.answerText}>
                      {note.text || note.title || "—"}
                    </Text>
                  </View>
                ))}
              </Card>
            ) : (
              <EmptyState message="Nothing here yet." />
            )}
          </>
        )}
      </View>
    );
  };

  const renderMarketWatch = () => {
    const notes = (data.marketWatch || []).filter(
      (item) => item.kind === "note"
    );

    return (
      <View style={styles.contentGap}>
        <SectionHeading
          title="Latest News"
          subtitle="Industry updates and headlines"
        />

        {data.news?.length ? (
          data.news.map((item, index) => (
            <TouchableOpacity
              key={String(item.id || item.link || index)}
              activeOpacity={0.85}
              onPress={() => {
                const url = item.link || item.url;

                if (url) Linking.openURL(url);
              }}
            >
              <Card>
                {item.image ? (
                  <Image
                    source={{ uri: item.image }}
                    style={styles.newsImage}
                    resizeMode="cover"
                  />
                ) : null}

                <Text style={styles.newsTitle}>
                  {item.title || "Untitled news"}
                </Text>

                <Text style={styles.newsSource}>
                  {item.source || "Industry news"}
                </Text>
              </Card>
            </TouchableOpacity>
          ))
        ) : (
          <EmptyState message="Nothing in the news feed yet." />
        )}

        <SectionHeading
          title="Our Watch"
          subtitle="Updates curated for your brand"
        />

        {notes.length ? (
          <Card>
            {notes.map((note, index) => (
              <View
                key={String(note.id || index)}
                style={styles.noteItem}
              >
                {!!note.topic && (
                  <Text style={styles.noteTopic}>
                    {note.topic}
                  </Text>
                )}

                <Text style={styles.answerText}>
                  {note.text || "—"}
                </Text>

                {!!note.createdAt && (
                  <Text style={styles.updatedText}>
                    {formatDate(note.createdAt)}
                  </Text>
                )}
              </View>
            ))}
          </Card>
        ) : (
          <EmptyState message="Nothing here yet." />
        )}

        <SectionHeading title="Industry Reels" />

        {industryReels.length ? (
          <View style={styles.reelGrid}>
            {industryReels.map((item) =>
              renderReel({
                ...item,
                sourceType: "market-watch",
              })
            )}
          </View>
        ) : (
          <EmptyState message="No industry reels available yet." />
        )}
      </View>
    );
  };

  const renderNewsletter = () => {
    if (!data.newsletter?.length) {
      return <EmptyState message="No newsletters available yet." />;
    }

    return (
      <View style={styles.contentGap}>
        {data.newsletter.map((item, index) => {
          const id = String(item.id || "");

          return (
            <TouchableOpacity
              key={id || index}
              activeOpacity={0.8}
              onPress={() => {
                if (!scope || !id) return;

                const url = getPortalNewsletterFileUrl(id, scope);

                Linking.openURL(url).catch(() => {
                  Alert.alert(
                    "Unable to open newsletter",
                    "Please try again."
                  );
                });
              }}
            >
              <Card>
                <View style={styles.newsletterRow}>
                  <View style={styles.pdfIcon}>
                    <Text style={styles.pdfIconText}>PDF</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.newsletterTitle}>
                      {item.title || "Newsletter.pdf"}
                    </Text>

                    <Text style={styles.updatedText}>
                      {formatDate(item.uploadedAt)}
                    </Text>
                  </View>

                  <Text style={styles.openIcon}>↗</Text>
                </View>
              </Card>
            </TouchableOpacity>
          );
        })}
      </View>
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
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadInsights(true)}
            tintColor={COLORS.accent}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>FIFTH AVENUE</Text>
          <Text style={styles.title}>Beyond the account.</Text>
          <Text style={styles.subtitle}>
            Your brand's questions, audience voice and market intelligence.
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sectionTabs}
        >
          {SECTIONS.map((section) => (
            <TouchableOpacity
              key={section}
              onPress={() => setActiveSection(section)}
              style={[
                styles.sectionTab,
                activeSection === section &&
                  styles.sectionTabActive,
              ]}
            >
              <Text
                style={[
                  styles.sectionTabText,
                  activeSection === section &&
                    styles.sectionTabTextActive,
                ]}
              >
                {section}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.sectionContent}>
          <SectionHeading title={activeSection} />

          {renderActiveSection()}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Insights · Fifth Avenue
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 22,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2.5,
    color: COLORS.accent,
    marginBottom: 12,
  },

  title: {
    fontSize: 31,
    fontWeight: "800",
    letterSpacing: -1,
    color: COLORS.text,
  },

  subtitle: {
    marginTop: 9,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.muted,
  },

  sectionTabs: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    gap: 8,
  },

  sectionTab: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 30,
    backgroundColor: "#ECEAE4",
  },

  sectionTabActive: {
    backgroundColor: COLORS.text,
  },

  sectionTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.muted,
  },

  sectionTabTextActive: {
    color: "#FFFFFF",
  },

  sectionContent: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 30,
  },

  sectionHeading: {
    marginBottom: 15,
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -0.5,
  },

  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 5,
  },

  contentGap: {
    gap: 13,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 17,
    padding: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },

  questionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },

  questionNumber: {
    width: 37,
    height: 37,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  questionNumberText: {
    fontSize: 12,
    fontWeight: "800",
  },

  questionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },

  answerText: {
    fontSize: 13,
    lineHeight: 21,
    color: "#626B79",
  },

  cardEyebrow: {
    color: COLORS.accent,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
  },

  audienceHeadline: {
    marginTop: 9,
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.text,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 15,
  },

  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 16,
    gap: 12,
  },

  metric: {
    flexGrow: 1,
    flexBasis: "40%",
    paddingVertical: 9,
  },

  metricValue: {
    fontSize: 23,
    fontWeight: "800",
    color: COLORS.text,
  },

  metricLabel: {
    fontSize: 10,
    color: COLORS.muted,
    marginTop: 4,
  },

  netSentiment: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 14,
    paddingTop: 13,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  netSentimentLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "600",
  },

  netSentimentValue: {
    fontSize: 21,
    fontWeight: "800",
  },

  updatedText: {
    fontSize: 10,
    color: COLORS.muted,
    marginTop: 7,
  },

  sentimentRow: {
    marginBottom: 15,
  },

  sentimentLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 7,
  },

  sentimentLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "600",
  },

  sentimentValue: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
  },

  progressTrack: {
    height: 7,
    borderRadius: 10,
    backgroundColor: "#ECEAE4",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 10,
  },

  simpleRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  quoteBox: {
    backgroundColor: "#F7F6F2",
    padding: 12,
    borderRadius: 11,
    marginBottom: 9,
  },

  tabRow: {
    flexDirection: "row",
    backgroundColor: "#ECEAE4",
    borderRadius: 30,
    padding: 4,
    gap: 3,
  },

  trendTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 25,
  },

  trendTabActive: {
    backgroundColor: COLORS.text,
  },

  trendTabText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.muted,
  },

  trendTabTextActive: {
    color: "#FFFFFF",
  },

  reelGrid: {
    gap: 12,
  },

  reelCard: {
    position: "relative",
  },

  reelImage: {
    width: "100%",
    height: 240,
    borderRadius: 12,
    backgroundColor: "#171717",
  },

  noImage: {
    justifyContent: "center",
    alignItems: "center",
  },

  noImageText: {
    color: "#FFFFFF",
    fontSize: 12,
  },

  reelUsername: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 11,
  },

  reelCaption: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 5,
    lineHeight: 17,
  },

  reelStats: {
    flexDirection: "row",
    gap: 15,
    marginTop: 10,
  },

  reelStat: {
    fontSize: 10,
    color: COLORS.muted,
  },

  favoriteButton: {
    position: "absolute",
    top: 20,
    right: 20,
    width: 37,
    height: 37,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },

  favoriteIcon: {
    color: "#FFFFFF",
    fontSize: 23,
  },

  newsImage: {
    height: 155,
    width: "100%",
    borderRadius: 10,
    marginBottom: 12,
  },

  newsTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
  },

  newsSource: {
    fontSize: 10,
    color: COLORS.muted,
    marginTop: 9,
  },

  noteItem: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  noteTopic: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 7,
  },

  newsletterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },

  pdfIcon: {
    width: 43,
    height: 43,
    backgroundColor: "#FCECE9",
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  pdfIconText: {
    fontSize: 11,
    fontWeight: "900",
    color: COLORS.red,
  },

  newsletterTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
  },

  openIcon: {
    fontSize: 21,
    color: COLORS.muted,
  },

  emptyState: {
    minHeight: 125,
    borderRadius: 15,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#D9D6CE",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },

  emptyText: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 20,
    textAlign: "center",
  },

  loading: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 12,
  },

  errorContainer: {
    flex: 1,
    padding: 25,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },

  errorTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: COLORS.text,
  },

  errorText: {
    color: COLORS.muted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 9,
  },

  retryButton: {
    marginTop: 18,
    paddingHorizontal: 23,
    paddingVertical: 12,
    backgroundColor: COLORS.text,
    borderRadius: 10,
  },

  retryText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },

  footer: {
    alignItems: "center",
    paddingBottom: 30,
  },

  footerText: {
    color: COLORS.muted,
    fontSize: 10,
  },
});