import React, { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Redirect, Tabs, router, usePathname, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../src/context/AuthContext";
import { useAppTheme } from "../../src/context/ThemeContext";
import { getPortalAvatarUrl } from "../../src/lib/api";
import { Glass } from "../../src/ui/Glass";
import { Hairline, T, Tap, tick, type IconName } from "../../src/ui/primitives";
import { fonts, radius, springs } from "../../src/ui/theme";

type BottomTabBarProps = Parameters<
  NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>
>[0];

// ---------------------------------------------------------------------------
// Header: a floating pane of glass that the page scrolls beneath
// ---------------------------------------------------------------------------

function AppHeader() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { colors, isDark, setTheme } = useAppTheme();
  const { user, signOut } = useAuth();

  const [menuVisible, setMenuVisible] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  // Close the menu whenever the route changes.
  useEffect(() => {
    setMenuVisible(false);
  }, [pathname]);

  const userName = user?.name || user?.email?.split("@")[0] || "You";

  const avatar =
    user?.id && user.hasAvatar === true
      ? getPortalAvatarUrl(user.id, user.avatarUpdatedAt)
      : typeof user?.avatar === "string"
        ? user.avatar
        : null;

  const showAvatar = !!avatar && !avatarFailed;

  const openSettings = () => {
    setMenuVisible(false);
    router.push({ pathname: "/settings", params: { section: "profile" } });
  };

  const handleSignOut = () => {
    setMenuVisible(false);
    signOut();
    router.replace("/");
  };

  const menuItems: { icon: IconName; label: string; onPress: () => void; danger?: boolean }[] = [
    { icon: "person-outline", label: "Profile and settings", onPress: openSettings },
    {
      icon: isDark ? "sunny-outline" : "moon-outline",
      label: isDark ? "Switch to light" : "Switch to dark",
      onPress: () => {
        setTheme(isDark ? "light" : "dark");
        setMenuVisible(false);
      },
    },
    { icon: "log-out-outline", label: "Sign out", onPress: handleSignOut, danger: true },
  ];

  return (
    <View pointerEvents="box-none" style={{ zIndex: 20 }}>
      <View pointerEvents="box-none" style={[styles.headerWrap, { paddingTop: insets.top + 8 }]}>
        <Glass dark={isDark} radius={29} style={styles.headerGlass} contentStyle={styles.header}>
          <Tap
            accessibilityRole="button"
            accessibilityLabel="Fifth Avenue, go to overview"
            onPress={() => {
              setMenuVisible(false);
              router.navigate("/(tabs)/overview");
            }}
            style={styles.brand}
          >
            <Image
              source={require("../../assets/images/va-logo.png")}
              style={{ width: 30, height: 30 }}
              tintColor={colors.text}
              resizeMode="contain"
            />
            <T style={{ fontFamily: fonts.serifMedium, fontSize: 19, lineHeight: 24 }}>
              Fifth Avenue
            </T>
          </Tap>

          <Tap
            accessibilityRole="button"
            accessibilityLabel={`Account menu for ${userName}`}
            accessibilityState={{ expanded: menuVisible }}
            onPress={() => setMenuVisible((previous) => !previous)}
            style={[styles.avatarButton, { borderColor: colors.gold }]}
          >
            {showAvatar ? (
              <Image
                source={{ uri: avatar! }}
                style={styles.avatar}
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.accent }]}>
                <T v="label" color={colors.onAccent}>
                  {userName.charAt(0).toUpperCase()}
                </T>
              </View>
            )}
          </Tap>
        </Glass>
      </View>

      {menuVisible ? (
        <>
          <Pressable
            accessibilityLabel="Close menu"
            style={styles.menuBackdrop}
            onPress={() => setMenuVisible(false)}
          />
          <Animated.View
            entering={FadeInUp.duration(220).easing(Easing.out(Easing.cubic))}
            exiting={FadeOut.duration(120)}
            style={[styles.menu, { top: insets.top + 74 }]}
          >
            <Glass dark={isDark} radius={radius.lg} strength={0.9} contentStyle={{ paddingVertical: 6 }}>
              <View style={styles.menuWho}>
                <T v="subhead" numberOfLines={1}>
                  {userName}
                </T>
                <T v="caption" tone="faint" numberOfLines={1}>
                  {typeof user?.title === "string" && user.title
                    ? user.title
                    : user?.clientName || user?.email || ""}
                </T>
              </View>
              <Hairline />
              {menuItems.map((item) => (
                <Tap
                  key={item.label}
                  accessibilityRole="menuitem"
                  onPress={item.onPress}
                  scaleTo={0.98}
                  style={styles.menuItem}
                >
                  <Ionicons
                    name={item.icon}
                    size={18}
                    color={item.danger ? colors.danger : colors.text2}
                  />
                  <T v="bodyStrong" color={item.danger ? colors.danger : colors.text}>
                    {item.label}
                  </T>
                </Tap>
              ))}
            </Glass>
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tab bar: a glass capsule with a lens that slides to the chosen tab
// ---------------------------------------------------------------------------

const TAB_ICONS: Record<string, { on: IconName; off: IconName }> = {
  overview: { on: "home", off: "home-outline" },
  campaigns: { on: "megaphone", off: "megaphone-outline" },
  insights: { on: "analytics", off: "analytics-outline" },
  assets: { on: "play-circle", off: "play-circle-outline" },
  billing: { on: "wallet", off: "wallet-outline" },
};

function TabItem({
  label,
  routeName,
  focused,
  onPress,
}: {
  label: string;
  routeName: string;
  focused: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const lift = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    lift.value = withSpring(focused ? 1 : 0, springs.snappy);
  }, [focused, lift]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -lift.value * 1.5 }, { scale: 1 + lift.value * 0.1 }],
  }));

  const icons = TAB_ICONS[routeName] ?? { on: "ellipse", off: "ellipse-outline" };
  const color = focused ? colors.accent : colors.text2;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.tabItem}
    >
      <Animated.View style={iconStyle}>
        <Ionicons name={focused ? icons.on : icons.off} size={21} color={color} />
      </Animated.View>
      <T
        numberOfLines={1}
        color={color}
        style={{
          fontFamily: focused ? fonts.sansSemi : fonts.sansMedium,
          fontSize: 9.5,
          lineHeight: 13,
          letterSpacing: -0.1,
        }}
      >
        {label}
      </T>
    </Pressable>
  );
}

function GlassTabBar({ state, descriptors }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { isDark } = useAppTheme();
  const [barWidth, setBarWidth] = useState(0);

  // Settings is reached from the account menu, not the tab bar.
  const visibleRoutes = state.routes.filter((route) => route.name !== "settings");
  const focusedKey = state.routes[state.index]?.key;
  const focusedIndex = visibleRoutes.findIndex((route) => route.key === focusedKey);

  const slot = barWidth > 0 ? (barWidth - 12) / visibleRoutes.length : 0;
  const x = useSharedValue(0);
  const shown = useSharedValue(focusedIndex >= 0 ? 1 : 0);
  const stretch = useSharedValue(1);

  useEffect(() => {
    if (focusedIndex >= 0) {
      x.value = withSpring(focusedIndex * slot, { damping: 17, stiffness: 190, mass: 0.9 });
      // The lens stretches as it travels and settles back, like a drop of liquid.
      stretch.value = withSequence(
        withTiming(1.22, { duration: 130, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 11, stiffness: 190 })
      );
    }
    shown.value = withSpring(focusedIndex >= 0 ? 1 : 0, springs.snappy);
  }, [focusedIndex, slot, x, shown, stretch]);

  const lens = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [
      { translateX: x.value },
      { scaleX: stretch.value },
      { scaleY: 2 - stretch.value > 0.9 ? 2 - stretch.value : 0.9 },
    ],
  }));

  return (
    <View
      pointerEvents="box-none"
      style={[styles.tabBarWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}
    >
      <View
        style={styles.tabBarSize}
        onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
      >
        <Glass dark={isDark} radius={34} contentStyle={styles.tabBar}>
          {slot > 0 ? (
            <Animated.View
              style={[
                styles.lens,
                {
                  width: slot,
                  backgroundColor: isDark ? "rgba(255,255,255,0.13)" : "rgba(27,42,92,0.09)",
                  borderColor: isDark ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,1)",
                  shadowOpacity: isDark ? 0.4 : 0.06,
                },
                lens,
              ]}
            />
          ) : null}
          {visibleRoutes.map((route) => {
            const { options } = descriptors[route.key];
            const label = options.title || route.name;
            const focused = focusedKey === route.key;
            return (
              <TabItem
                key={route.key}
                label={label}
                routeName={route.name}
                focused={focused}
                onPress={() => {
                  if (focused) return;
                  tick();
                  router.navigate(`/(tabs)/${route.name}` as Href);
                }}
              />
            );
          })}
        </Glass>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function TabLayout() {
  const { isAuthenticated } = useAuth();
  const { colors, isDark } = useAppTheme();

  if (!isAuthenticated) {
    return <Redirect href="/" />;
  }

  return (
    <Animated.View entering={FadeIn.duration(350)} style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Tabs
        tabBar={(props) => <GlassTabBar {...props} />}
        screenOptions={{
          header: () => <AppHeader />,
          headerShown: true,
          headerTransparent: true,
          animation: "fade",
          sceneStyle: { backgroundColor: colors.background },
        }}
      >
        <Tabs.Screen name="overview" options={{ title: "Overview" }} />
        <Tabs.Screen name="campaigns" options={{ title: "Campaigns" }} />
        <Tabs.Screen name="insights" options={{ title: "Insights" }} />
        <Tabs.Screen name="assets" options={{ title: "Assets" }} />
        <Tabs.Screen name="billing" options={{ title: "Billing" }} />
        <Tabs.Screen name="settings" options={{ title: "Settings" }} />
      </Tabs>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: 12, alignItems: "center" },
  headerGlass: { width: "100%", maxWidth: 560 },
  header: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 16,
    paddingRight: 9,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 6 },
  avatarButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: { width: 34, height: 34, borderRadius: 17 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  menuBackdrop: {
    position: "absolute",
    top: 0,
    left: -1000,
    right: -1000,
    height: 3000,
  },
  menu: { position: "absolute", right: 14, width: 236 },
  menuWho: { paddingHorizontal: 16, paddingVertical: 10 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tabBarWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  tabBarSize: { width: "100%", maxWidth: 460 },
  tabBar: {
    height: 68,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  lens: {
    position: "absolute",
    left: 6,
    top: 6,
    bottom: 6,
    borderRadius: 28,
    borderWidth: 1,
    shadowColor: "#000000",
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  tabItem: { flex: 1, height: "100%", alignItems: "center", justifyContent: "center", gap: 3 },
});
