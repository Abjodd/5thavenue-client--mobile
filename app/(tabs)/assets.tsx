import React, { useCallback, useEffect, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Linking,
  StatusBar,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/context/AuthContext";

import {
  getPortalReels,
  PortalReel,
} from "../../src/lib/api";

// ---------------------------------------------
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
  if (value == null || !Number.isFinite(Number(value))) {
    return "—";
  }

  const number = Number(value);

  if (number >= 1000000) {
    return `${(number / 1000000)
      .toFixed(number >= 10000000 ? 0 : 1)
      .replace(/\.0$/, "")}M`;
  }

  if (number >= 100000) {
    return `${(number / 100000)
      .toFixed(number >= 1000000 ? 0 : 2)
      .replace(/\.?0+$/, "")}L`;
  }

  if (number >= 1000) {
    return `${(number / 1000)
      .toFixed(number >= 10000 ? 0 : 1)
      .replace(/\.0$/, "")}K`;
  }

  return Math.round(number).toString();
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

// ---------------------------------------------
// ASSET CARD
// ---------------------------------------------

function AssetCard({
  reel,
  onPress,
}: {
  reel: PortalReel;
  onPress: () => void;
}) {
  const imageUrl = getMediaUrl(reel);

  const creatorName = reel.username
    ? `@${reel.username.replace(/^@/, "")}`
    : "Creator";

  const publishedDate = formatDate(reel.takenAt);

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={styles.assetCard}
    >
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.assetImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons
              name="image-outline"
              size={34}
              color="#FFFFFF"
            />
            <Text style={styles.placeholderText}>
              Preview unavailable
            </Text>
          </View>
        )}

        {/* TRANSPARENT IMAGE OVERLAY */}

        <View style={styles.imageOverlay} />

        {/* TOP: REEL TYPE AND DATE */}

       <View style={styles.overlayTop}>
  <Text style={styles.overlayType}>
    {getReelKind(reel).toUpperCase()}
  </Text>

  {publishedDate ? (
    <Text style={styles.overlayDateText}>
      {publishedDate}
    </Text>
  ) : null}
</View>

        {/* BOTTOM: CREATOR AND METRICS */}

        <View style={styles.overlayBottom}>
          <Text
            style={styles.overlayCreator}
            numberOfLines={1}
          >
            {creatorName}
          </Text>

          <View style={styles.overlayStats}>
  <View style={styles.overlayStat}>
    <Ionicons name="eye-outline" size={17} color="#FFFFFF" />
    <Text style={styles.overlayStatText}>
      {formatNumber(reel.views)}
    </Text>
  </View>

  <View style={styles.overlayStat}>
    <Ionicons name="heart-outline" size={17} color="#FFFFFF" />
    <Text style={styles.overlayStatText}>
      {formatNumber(reel.likes)}
    </Text>
  </View>
</View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------
// ASSET DETAIL MODAL
// ---------------------------------------------

function AssetDetailModal({
  reel,
  visible,
  onClose,
}: {
  reel: PortalReel | null;
  visible: boolean;
  onClose: () => void;
}) {
  if (!reel) return null;

  const imageUrl = getMediaUrl(reel);
  const postUrl = getPostUrl(reel);

  const openOriginalPost = async () => {
    if (!postUrl) return;

    try {
      await Linking.openURL(postUrl);
    } catch {
      // Keep the modal open if the link cannot be opened.
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="dark-content" />

      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <View>
            <Text style={styles.modalEyebrow}>
              CONTENT RECORD
            </Text>

            <Text style={styles.modalTitle}>
              Asset details
            </Text>
          </View>

          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
          >
            <Ionicons
              name="close"
              size={22}
              color="#17243A"
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.modalContent}
        >
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.modalImagePlaceholder}>
              <Ionicons
                name="image-outline"
                size={42}
                color="#A0A5AE"
              />

              <Text style={styles.modalPlaceholderText}>
                Preview unavailable
              </Text>
            </View>
          )}

          <View style={styles.detailHeading}>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailCreator}>
                {reel.username
                  ? `@${reel.username.replace(/^@/, "")}`
                  : "Creator"}
              </Text>

              <Text style={styles.detailSubtext}>
                {reel.platform || "Platform unavailable"}
                {reel.takenAt
                  ? ` · ${formatDate(reel.takenAt)}`
                  : ""}
              </Text>
            </View>

            <View style={styles.detailKindBadge}>
              <Text style={styles.detailKindText}>
                {getReelKind(reel)}
              </Text>
            </View>
          </View>

          <Text style={styles.detailSectionTitle}>
            Performance
          </Text>

          <View style={styles.detailStats}>
            <View style={styles.detailStat}>
              <Ionicons
                name="eye-outline"
                size={20}
                color="#747B88"
              />

              <Text style={styles.detailStatValue}>
                {formatNumber(reel.views)}
              </Text>

              <Text style={styles.detailStatLabel}>
                Views
              </Text>
            </View>

            <View style={styles.detailStat}>
              <Ionicons
                name="heart-outline"
                size={20}
                color="#747B88"
              />

              <Text style={styles.detailStatValue}>
                {formatNumber(reel.likes)}
              </Text>

              <Text style={styles.detailStatLabel}>
                Likes
              </Text>
            </View>

            <View style={styles.detailStat}>
              <Ionicons
                name="chatbubble-outline"
                size={20}
                color="#747B88"
              />

              <Text style={styles.detailStatValue}>
                {formatNumber(reel.comments)}
              </Text>

              <Text style={styles.detailStatLabel}>
                Comments
              </Text>
            </View>
          </View>

          {reel.caption ? (
            <>
              <Text style={styles.detailSectionTitle}>
                Caption
              </Text>

              <Text style={styles.captionText}>
                {reel.caption}
              </Text>
            </>
          ) : null}

          {postUrl ? (
            <TouchableOpacity
              style={styles.originalButton}
              onPress={openOriginalPost}
              activeOpacity={0.85}
            >
              <Ionicons
                name="open-outline"
                size={18}
                color="#FFFFFF"
              />

              <Text style={styles.originalButtonText}>
                Open original post
              </Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ---------------------------------------------
// ASSETS SCREEN
// ---------------------------------------------

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

  // ---------------------------------------------
  // LOADING STATE
  // ---------------------------------------------

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator
          size="large"
          color="#17243A"
        />

        <Text style={styles.loadingText}>
          Loading your assets...
        </Text>
      </View>
    );
  }

  // ---------------------------------------------
  // ERROR STATE
  // ---------------------------------------------

  if (error && reels.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons
          name="cloud-offline-outline"
          size={38}
          color="#9297A1"
        />

        <Text style={styles.errorTitle}>
          Unable to load assets
        </Text>

        <Text style={styles.errorMessage}>
          {error}
        </Text>

        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => loadAssets()}
        >
          <Text style={styles.retryButtonText}>
            Try again
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---------------------------------------------
  // MAIN UI
  // ---------------------------------------------

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadAssets(true)}
            tintColor="#17243A"
          />
        }
      >
        {/* HEADER */}

        <View style={styles.header}>
          <Text style={styles.eyebrow}>
            CONTENT
          </Text>

          <Text style={styles.title}>
            Everything that{"\n"}went live
          </Text>

          <View style={styles.countRow}>
            <View style={styles.countBadge}>
              <Text style={styles.countNumber}>
                {reels.length}
              </Text>

              <Text style={styles.countLabel}>
                posts on file
              </Text>
            </View>

            <Text style={styles.headerDescription}>
              Select one to open the full record.
            </Text>
          </View>
        </View>

        {error ? (
          <Text style={styles.refreshError}>
            {error}
          </Text>
        ) : null}

        {/* ASSET GRID */}

        {reels.length > 0 ? (
          <View style={styles.grid}>
            {reels.map((reel, index) => (
              <View
                key={
                  reel.id ||
                  reel.code ||
                  `${reel.username || "asset"}-${index}`
                }
                style={styles.gridItem}
              >
                <AssetCard
                  reel={reel}
                  onPress={() => setSelectedReel(reel)}
                />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="images-outline"
                size={30}
                color="#858B96"
              />
            </View>

            <Text style={styles.emptyTitle}>
              Nothing on file yet
            </Text>

            <Text style={styles.emptyMessage}>
              New posts will appear here as creators
              publish content for your campaigns.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* DETAIL MODAL */}

      <AssetDetailModal
        reel={selectedReel}
        visible={!!selectedReel}
        onClose={() => setSelectedReel(null)}
      />
    </View>
  );
}

// ---------------------------------------------
// STYLES
// ---------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F7F4",
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 58,
    paddingBottom: 40,
  },

  centerContainer: {
    flex: 1,
    backgroundColor: "#F8F7F4",
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
  },

  loadingText: {
    marginTop: 14,
    color: "#667085",
    fontSize: 14,
  },

  // HEADER

  header: {
    marginBottom: 29,
  },

  eyebrow: {
    color: "#858B96",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2.5,
    marginBottom: 12,
  },

  title: {
    color: "#171717",
    fontSize: 35,
    fontWeight: "800",
    fontStyle: "italic",
    lineHeight: 42,
    letterSpacing: -1.4,
  },

  countRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 20,
    gap: 10,
  },

  countBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E9E6DF",
    borderRadius: 30,
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 5,
  },

  countNumber: {
    color: "#171717",
    fontSize: 14,
    fontWeight: "800",
  },

  countLabel: {
    color: "#777367",
    fontSize: 12,
  },

  headerDescription: {
    color: "#777367",
    fontSize: 12,
    lineHeight: 18,
    flexShrink: 1,
  },

  // GRID

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  gridItem: {
    width: "48.3%",
    marginBottom: 22,
  },

  // IMAGE CARD

  assetCard: {
    width: "100%",
    borderRadius: 17,
    overflow: "hidden",
    backgroundColor: "#D9D5CD",
  },

  imageContainer: {
    width: "100%",
    aspectRatio: 0.60,
    backgroundColor: "#D9D5CD",
    position: "relative",
    overflow: "hidden",
  },

  assetImage: {
    width: "100%",
    height: "100%",
  },

  imagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#8B8B8B",
    gap: 8,
  },

  placeholderText: {
    color: "#FFFFFF",
    fontSize: 11,
  },

  // TRANSPARENT OVERLAY

  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },

  // TOP CONTENT

  overlayTop: {
    position: "absolute",
    top: 13,
    left: 13,
    right: 13,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  overlayType: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    textShadowColor: "rgba(0,0,0,0.85)",
    textShadowOffset: {
      width: 0,
      height: 1,
    },
    textShadowRadius: 5,
  },

  overlayDate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  overlayDateText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.85)",
    textShadowOffset: {
      width: 0,
      height: 1,
    },
    textShadowRadius: 5,
  },

  // BOTTOM CONTENT

  overlayBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 15,
    backgroundColor: "transparent",
  },

  overlayCreator: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 12,
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: {
      width: 0,
      height: 1,
    },
    textShadowRadius: 6,
  },

  overlayStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    flexWrap: "nowrap",
    gap: 10,
  },

  overlayStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    flexShrink: 1,
  },

  overlayStatText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    flexShrink: 1,
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: {
      width: 0,
      height: 1,
    },
    textShadowRadius: 5,
  },

  // EMPTY STATE

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 25,
    alignItems: "center",
    marginTop: 12,
  },

  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#F1F0EC",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },

  emptyTitle: {
    color: "#17243A",
    fontSize: 16,
    fontWeight: "700",
  },

  emptyMessage: {
    color: "#858B96",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 19,
    marginTop: 8,
  },

  // ERROR STATES

  errorTitle: {
    color: "#17243A",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 15,
  },

  errorMessage: {
    color: "#7B8190",
    textAlign: "center",
    lineHeight: 21,
    marginTop: 8,
  },

  retryButton: {
    backgroundColor: "#17243A",
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 20,
  },

  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },

  refreshError: {
    color: "#B42318",
    fontSize: 12,
    marginBottom: 14,
  },

  // DETAIL MODAL

  modalContainer: {
    flex: 1,
    backgroundColor: "#F8F7F4",
  },

  modalHeader: {
    paddingHorizontal: 21,
    paddingTop: 20,
    paddingBottom: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#EAE7E0",
  },

  modalEyebrow: {
    color: "#8A8F98",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
  },

  modalTitle: {
    color: "#17243A",
    fontSize: 21,
    fontWeight: "700",
    marginTop: 4,
  },

  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },

  modalContent: {
    padding: 20,
    paddingBottom: 40,
  },

  modalImage: {
    width: "100%",
    height: 380,
    borderRadius: 15,
    backgroundColor: "#E8E5DF",
  },

  modalImagePlaceholder: {
    height: 250,
    borderRadius: 15,
    backgroundColor: "#E8E5DF",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },

  modalPlaceholderText: {
    color: "#858B96",
    fontSize: 12,
  },

  detailHeading: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 22,
  },

  detailCreator: {
    color: "#17243A",
    fontSize: 19,
    fontWeight: "700",
  },

  detailSubtext: {
    color: "#858B96",
    fontSize: 12,
    marginTop: 5,
  },

  detailKindBadge: {
    backgroundColor: "#EAEAF0",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },

  detailKindText: {
    color: "#172F68",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },

  detailSectionTitle: {
    color: "#17243A",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 12,
  },

  detailStats: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 17,
    marginBottom: 24,
  },

  detailStat: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },

  detailStatValue: {
    color: "#17243A",
    fontSize: 16,
    fontWeight: "700",
  },

  detailStatLabel: {
    color: "#858B96",
    fontSize: 11,
  },

  captionText: {
    color: "#596170",
    fontSize: 13,
    lineHeight: 21,
    marginBottom: 22,
  },

  originalButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
    backgroundColor: "#172F68",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },

  originalButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});