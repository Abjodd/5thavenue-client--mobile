import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Linking, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useAuth } from "../../src/context/AuthContext";
import { useAppTheme } from "../../src/context/ThemeContext";
import { getPortalReels, PortalReel } from "../../src/lib/api";
import {
  Button,
  EmptyState,
  ErrorState,
  InlineError,
  Pill,
  Reveal,
  ScreenScroll,
  ScreenSkeleton,
  ScreenTitle,
  Segmented,
  Sheet,
  T,
  Tap,
  type IconName,
} from "../../src/ui/primitives";
import { compactCount } from "../../src/ui/format";
import { radius, space } from "../../src/ui/theme";

// HELPERS
// ---------------------------------------------

function getText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getMediaUrl(reel: PortalReel): string {
  return (
    getText(reel.thumbnail) ||
    getText(reel.poster) ||
    getText(reel.image) ||
    getText(reel.display_url) ||
    getText(reel.thumbnail_url) ||
    ""
  );
}

function getPostUrl(reel: PortalReel): string {
  return getText(reel.permalink) || getText(reel.url);
}

function formatNumber(value?: number | null): string {
  return compactCount(value);
}

function formatDate(value?: string): string {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).toUpperCase();
}

function getReelKind(reel: PortalReel): string {
  return reel.kind?.toLowerCase() === "post" ? "Post" : "Reel";
}

type SortMode = "latest" | "views" | "likes";

function handleOf(reel: PortalReel): string {
  return reel.username ? `@${reel.username.replace(/^@/, "")}` : "Creator";
}

// ---------------------------------------------------------------------------
// Poster card
// ---------------------------------------------------------------------------

function AssetCard({ reel, onPress }: { reel: PortalReel; onPress: () => void }) {
  const { colors } = useAppTheme();
  const imageUrl = getMediaUrl(reel);
  const publishedDate = formatDate(reel.takenAt);

  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={`${getReelKind(reel)} by ${handleOf(reel)}. Open details.`}
      onPress={onPress}
      scaleTo={0.97}
      style={[styles.poster, { backgroundColor: colors.surfaceSecondary }]}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.posterBlank]}>
          <Ionicons name="image-outline" size={28} color={colors.faint} />
          <T v="caption" tone="faint">
            No preview
          </T>
        </View>
      )}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(0,0,28,0.5)", "rgba(0,0,28,0)", "rgba(0,0,28,0.9)"]}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.posterTop}>
        <View style={styles.posterKind}>
          <Ionicons
            name={getReelKind(reel) === "Post" ? "image" : "play"}
            size={10}
            color="#FFFFFF"
          />
          <T v="caption" color="#FFFFFF">
            {getReelKind(reel)}
          </T>
        </View>
      </View>
      <View style={styles.posterBottom}>
        <T v="label" color="#FFFFFF" numberOfLines={1}>
          {handleOf(reel)}
        </T>
        {publishedDate ? (
          <T v="caption" color="rgba(255,255,255,0.7)">
            {publishedDate}
          </T>
        ) : null}
        <View style={styles.posterStats}>
          <Ionicons name="eye-outline" size={13} color="#FFFFFF" />
          <T v="caption" color="#FFFFFF">
            {formatNumber(reel.views)}
          </T>
          <Ionicons name="heart-outline" size={13} color="#FFFFFF" style={{ marginLeft: 8 }} />
          <T v="caption" color="#FFFFFF">
            {formatNumber(reel.likes)}
          </T>
        </View>
      </View>
    </Tap>
  );
}

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

function AssetDetails({ reel }: { reel: PortalReel }) {
  const { colors } = useAppTheme();
  const imageUrl = getMediaUrl(reel);
  const postUrl = getPostUrl(reel);

  const openOriginalPost = async () => {
    if (!postUrl) return;
    try {
      await Linking.openURL(postUrl);
    } catch {
      // Keep the sheet open if the link cannot be opened.
    }
  };

  const stats: { icon: IconName; label: string; value: string }[] = [
    { icon: "eye-outline", label: "Views", value: formatNumber(reel.views) },
    { icon: "heart-outline", label: "Likes", value: formatNumber(reel.likes) },
    { icon: "chatbubble-outline", label: "Comments", value: formatNumber(reel.comments) },
  ];

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: space.xl, paddingTop: 4, gap: space.lg }}
    >
      <Animated.View
        entering={FadeIn.duration(350)}
        style={[styles.detailMedia, { backgroundColor: colors.surfaceSecondary }]}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode="contain" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.posterBlank]}>
            <Ionicons name="image-outline" size={36} color={colors.faint} />
            <T tone="faint">No preview available</T>
          </View>
        )}
      </Animated.View>

      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <T v="heading" numberOfLines={1}>
            {handleOf(reel)}
          </T>
          <T v="caption" tone="faint">
            {[reel.platform || "Platform unknown", reel.takenAt ? formatDate(reel.takenAt) : ""]
              .filter(Boolean)
              .join(", ")}
          </T>
        </View>
        <Pill label={getReelKind(reel)} tone="accent" />
      </View>

      <View style={{ flexDirection: "row", gap: space.md }}>
        {stats.map((stat, index) => (
          <Animated.View
            key={stat.label}
            entering={FadeInDown.delay(120 + index * 60).duration(360)}
            style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons name={stat.icon} size={17} color={colors.muted} />
            <T v="figureSm" numberOfLines={1} adjustsFontSizeToFit>
              {stat.value}
            </T>
            <T v="caption" tone="faint">
              {stat.label}
            </T>
          </Animated.View>
        ))}
      </View>

      {reel.caption ? (
        <View style={{ gap: 6 }}>
          <T v="label" tone="muted">
            Caption
          </T>
          <T>{reel.caption}</T>
        </View>
      ) : null}

      {postUrl ? (
        <Button label="Open original post" icon="open-outline" onPress={openOriginalPost} />
      ) : null}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function AssetsScreen() {
  const { user } = useAuth();

  const [reels, setReels] = useState<PortalReel[]>([]);
  const [selectedReel, setSelectedReel] =
    useState<PortalReel | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const brandId = user?.brandId;
  const clientName = user?.clientName;

  // ---------------------------------------------
  // FETCH ASSETS
  // ---------------------------------------------

  const loadAssets = useCallback(
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

      try {
        const result = await getPortalReels({
          brandId,
          clientName,
        });

        setReels(result);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load your assets."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [brandId, clientName]
  );

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const [sort, setSort] = useState<SortMode>("latest");

  const sortedReels = useMemo(() => {
    if (sort === "latest") return reels;
    const key = sort === "views" ? "views" : "likes";
    return [...reels].sort((a, b) => (Number(b[key]) || 0) - (Number(a[key]) || 0));
  }, [reels, sort]);

  const totals = useMemo(
    () =>
      reels.reduce<{ views: number; likes: number }>(
        (sum, reel) => ({
          views: sum.views + (Number(reel.views) || 0),
          likes: sum.likes + (Number(reel.likes) || 0),
        }),
        { views: 0, likes: 0 }
      ),
    [reels]
  );

  const { colors } = useAppTheme();

  if (loading) {
    return <ScreenSkeleton hero={false} />;
  }

  if (error && reels.length === 0) {
    return <ErrorState title="Assets did not load" message={error} onRetry={() => loadAssets()} />;
  }

  return (
    <>
      <ScreenScroll refreshing={refreshing} onRefresh={() => loadAssets(true)}>
        <ScreenTitle
          title="Everything that went live"
          note={
            reels.length === 1
              ? "1 post on file. Tap it for the full record."
              : `${reels.length} posts on file. Tap one for the full record.`
          }
        />

        {error ? <InlineError message={error} /> : null}

        {reels.length > 0 ? (
          <>
            <Reveal index={1} style={[styles.strip, { borderColor: colors.borderStrong }]}>
              {(
                [
                  ["Posts", String(reels.length)],
                  ["Views", formatNumber(totals.views)],
                  ["Likes", formatNumber(totals.likes)],
                ] as const
              ).map(([label, value]) => (
                <View key={label} style={{ flex: 1 }}>
                  <T v="figureSm">{value}</T>
                  <T v="caption" tone="faint">
                    {label}
                  </T>
                </View>
              ))}
            </Reveal>

            <Reveal index={2}>
              <Segmented
                value={sort}
                onChange={setSort}
                options={[
                  { value: "latest", label: "Latest" },
                  { value: "views", label: "Most viewed" },
                  { value: "likes", label: "Most liked" },
                ]}
              />
            </Reveal>

            <Animated.View key={sort} entering={FadeIn.duration(280)} style={styles.grid}>
              {sortedReels.map((reel, index) => (
                <Animated.View
                  key={reel.id || reel.code || `${reel.username || "asset"}-${index}`}
                  entering={FadeInDown.delay(Math.min(index, 8) * 45).duration(380)}
                  style={styles.gridItem}
                >
                  <AssetCard reel={reel} onPress={() => setSelectedReel(reel)} />
                </Animated.View>
              ))}
            </Animated.View>
          </>
        ) : (
          <EmptyState
            icon="images-outline"
            title="Nothing on file yet"
            message="Posts appear here as creators publish content for your campaigns."
          />
        )}
      </ScreenScroll>

      <Sheet full visible={!!selectedReel} onClose={() => setSelectedReel(null)} title="Post details">
        {selectedReel ? <AssetDetails reel={selectedReel} /> : null}
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
  strip: {
    flexDirection: "row",
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  gridItem: { flexGrow: 1, flexBasis: "45%", maxWidth: "48.5%" },
  poster: {
    aspectRatio: 9 / 14,
    borderRadius: radius.lg,
    overflow: "hidden",
    justifyContent: "space-between",
  },
  posterBlank: { alignItems: "center", justifyContent: "center", gap: 6 },
  posterTop: { padding: 10, flexDirection: "row" },
  posterKind: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,28,0.45)",
  },
  posterBottom: { padding: 12, gap: 2 },
  posterStats: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  detailMedia: { height: 380, borderRadius: radius.xl, overflow: "hidden" },
  stat: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.md,
    gap: 3,
  },
});
