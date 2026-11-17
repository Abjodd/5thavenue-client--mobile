import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeOut,
  LinearTransition,
  ZoomIn,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
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
// Questions: story mode (WhatsApp-status style)
// ---------------------------------------------------------------------------

/** How long each question stays before moving on. */
const STORY_DURATION = 2000;
/** A press longer than this is a "hold" (pause), not a tap. */
const HOLD_DELAY = 250;
/** Short answers get the big serif treatment; long ones use body text. */
const BIG_ANSWER_LIMIT = 110;

function StoryBar({
  index,
  active,
  progress,
  fill,
  track,
}: {
  index: number;
  active: number;
  progress: SharedValue<number>;
  fill: string;
  track: string;
}) {
  const style = useAnimatedStyle(() => {
    const amount = index < active ? 1 : index === active ? progress.value : 0;
    return { width: `${Math.min(1, Math.max(0, amount)) * 100}%` };
  }, [index, active]);

  return (
    <View style={[styles.storyBar, { backgroundColor: track }]}>
      <Animated.View style={[styles.storyBarFill, { backgroundColor: fill }, style]} />
    </View>
  );
}

function QuestionStory({
  questions,
  clientName,
}: {
  questions: PortalQuestionAnswers;
  clientName: string;
}) {
  const { colors } = useAppTheme();
  const count = QUESTION_FIELDS.length;

  const [index, setIndex] = useState(0);
  const [run, setRun] = useState(0); // bumps to restart the timer on the same index
  const [paused, setPaused] = useState(false);
  const [ended, setEnded] = useState(false);

  const progress = useSharedValue(0);
  const press = useSharedValue(1);

  const indexRef = useRef(0);
  const endedRef = useRef(false);
  const pausedRef = useRef(false);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(count - 1, next));
      endedRef.current = false;
      setEnded(false);
      setIndex(clamped);
      setRun((r) => r + 1);
    },
    [count]
  );

  const finish = useCallback(() => {
    cancelAnimation(progress);
    progress.value = 1;
    endedRef.current = true;
    setEnded(true);
  }, [progress]);

  const handleDone = useCallback(() => {
    if (indexRef.current < count - 1) goTo(indexRef.current + 1);
    else finish();
  }, [count, goTo, finish]);

  const play = useCallback(
    (from: number) => {
      cancelAnimation(progress);
      progress.value = from;
      progress.value = withTiming(
        1,
        { duration: Math.max(0, STORY_DURATION * (1 - from)), easing: Easing.linear },
        (finished) => {
          if (finished) runOnJS(handleDone)();
        }
      );
    },
    [progress, handleDone]
  );

  // Start the timer whenever the question changes (or is restarted).
  useEffect(() => {
    play(0);
    return () => cancelAnimation(progress);
  }, [index, run, play, progress]);

  const hold = useCallback(() => cancelAnimation(progress), [progress]);
  const release = useCallback(() => {
    if (!endedRef.current) play(progress.value);
  }, [play, progress]);

  // Pause when the app goes to the background, resume when it comes back.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") hold();
      else if (!pausedRef.current) release();
    });
    return () => sub.remove();
  }, [hold, release]);

  const onPressIn = () => {
    pausedRef.current = true;
    setPaused(true);
    press.value = withSpring(0.975, springs.press);
    hold();
  };

  const onPressOut = () => {
    pausedRef.current = false;
    setPaused(false);
    press.value = withSpring(1, springs.press);
    release();
  };

  // onPress only fires for a quick tap: with onLongPress set, a hold skips it.
  const tapPrev = () => goTo(indexRef.current - 1);
  const tapNext = () => (endedRef.current ? goTo(0) : indexRef.current < count - 1 ? goTo(indexRef.current + 1) : finish());

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));

  const field = QUESTION_FIELDS[index];
  const answer = questions[field.key];
  const isBig = !!answer && String(answer).length <= BIG_ANSWER_LIMIT;

  const nextLabel = ended
    ? "Start again"
    : index < count - 1
    ? `Next: ${QUESTION_FIELDS[index + 1].title}`
    : "Finish";

  return (
    <View style={{ gap: space.md }}>
      <View style={styles.rowBetween}>
        <T v="label" numberOfLines={1} style={{ flex: 1 }}>
          {clientName}
          <T v="label" tone="faint">
            {"  ·  Team review"}
          </T>
        </T>
        <View style={styles.storyMeta}>
          {paused ? (
            <Animated.View
              entering={FadeIn.duration(150)}
              exiting={FadeOut.duration(150)}
              style={[styles.pausedChip, { backgroundColor: colors.accent }]}
            >
              <Ionicons name="pause" size={10} color={colors.onAccent} />
              <T v="caption" color={colors.onAccent}>
                Paused
              </T>
            </Animated.View>
          ) : null}
          <T v="label" tone="accent" accessibilityLiveRegion="polite">
            {index + 1} of {count}
          </T>
        </View>
      </View>

      <View style={styles.storyBars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {QUESTION_FIELDS.map((item, i) => (
          <StoryBar
            key={item.key}
            index={i}
            active={index}
            progress={progress}
            fill={colors.accent}
            track={colors.borderStrong}
          />
        ))}
      </View>

      {/* Card height follows its content: LinearTransition animates grow/shrink. */}
      <Animated.View
        layout={LinearTransition.springify().damping(20).stiffness(180)}
        style={[styles.storyShell, cardStyle]}
      >
        <Card>
          <View style={styles.storyContent}>
            <Animated.View
              key={`${field.key}-${run}`}
              entering={FadeInRight.duration(320)}
              exiting={FadeOut.duration(140)}
            >
              <View style={styles.questionHead}>
                <Animated.View entering={ZoomIn.springify().damping(13).delay(60)}>
                  <IconBadge icon={field.icon} tone={field.tone} />
                </Animated.View>
                <View style={{ flex: 1 }}>
                  <T v="heading">{field.title}</T>
                  <T v="caption" tone="faint" numberOfLines={1}>
                    {clientName}
                  </T>
                </View>
              </View>

              <Animated.View entering={FadeInDown.duration(380).delay(120)}>
                {answer ? (
                  <T
                    style={[
                      { marginTop: space.md },
                      isBig && { fontFamily: fonts.serif, fontSize: 22, lineHeight: 29 },
                    ]}
                  >
                    {answer}
                  </T>
                ) : (
                  <T tone="muted" style={{ marginTop: space.md }}>
                    Not answered yet. Your account team can fill this in.
                  </T>
                )}
              </Animated.View>
            </Animated.View>

            {/* Tap zones: left third goes back, the rest goes forward, hold pauses. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous question"
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              onLongPress={() => {}}
              delayLongPress={HOLD_DELAY}
              onPress={tapPrev}
              style={styles.zoneLeft}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next question"
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              onLongPress={() => {}}
              delayLongPress={HOLD_DELAY}
              onPress={tapNext}
              style={styles.zoneRight}
            />
          </View>

          <Hairline style={{ marginTop: space.md }} />

          <View style={styles.storyControls}>
            <Tap
              accessibilityRole="button"
              accessibilityLabel="Previous question"
              disabled={index === 0 && !ended}
              onPress={tapPrev}
              style={[
                styles.storyPrev,
                { borderColor: colors.borderStrong, opacity: index === 0 && !ended ? 0.4 : 1 },
              ]}
            >
              <Ionicons name="chevron-back" size={18} color={colors.text2} />
            </Tap>

            <Tap
              accessibilityRole="button"
              accessibilityLabel={nextLabel}
              onPress={tapNext}
              style={[styles.storyNext, { backgroundColor: colors.accent }]}
            >
              <T v="label" color={colors.onAccent} numberOfLines={1}>
                {nextLabel}
              </T>
              <View style={styles.storyNextIcon}>
                <Ionicons
                  name={ended ? "refresh" : "chevron-forward"}
                  size={16}
                  color={colors.onAccent}
                />
              </View>
            </Tap>
          </View>
        </Card>
      </Animated.View>

      <Animated.View layout={LinearTransition.springify().damping(20).stiffness(180)}>
        <T v="caption" tone="faint" style={{ textAlign: "center" }}>
          Tap right for next · left to go back · hold to pause
        </T>
      </Animated.View>
    </View>
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
      <Reveal>
        <QuestionStory questions={questions} clientName={user?.clientName || "Your brand"} />
      </Reveal>
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
  storyMeta: { flexDirection: "row", alignItems: "center", gap: space.sm, marginLeft: space.sm },
  pausedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
  },
  storyBars: { flexDirection: "row", gap: 6 },
  storyBar: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  storyBarFill: { height: "100%", borderRadius: 2 },
  storyShell: { borderRadius: radius.xl, overflow: "hidden" },
  // No fixed height: the card is exactly as tall as its text.
  storyContent: { position: "relative" },
  zoneLeft: { position: "absolute", top: 0, bottom: 0, left: 0, width: "32%" },
  zoneRight: { position: "absolute", top: 0, bottom: 0, left: "32%", right: 0 },
  storyControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space.sm,
  },
  storyPrev: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  storyNext: {
    height: 44,
    maxWidth: "78%",
    paddingLeft: 18,
    paddingRight: 7,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  storyNextIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
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