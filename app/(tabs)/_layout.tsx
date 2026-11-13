import React, { useEffect, useState } from "react";

import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
} from "react-native";

import {
  Tabs,
  router,
  type Href,
  usePathname,
} from "expo-router";

import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

import { useAuth } from "../../src/context/AuthContext";
import { getPortalAvatarUrl } from "../../src/lib/api";

// ---------------------------------------------
// TOP HEADER
// ---------------------------------------------

function AppHeader() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const { user, signOut } = useAuth();

  const [menuVisible, setMenuVisible] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  // Close dropdown whenever the current route changes.
  useEffect(() => {
    setMenuVisible(false);
  }, [pathname]);

  const userName =
    user?.name ||
    user?.email?.split("@")[0] ||
    "Client";

  const avatar =
    user?.id && user.hasAvatar === true
      ? getPortalAvatarUrl(user.id, user.avatarUpdatedAt)
      : typeof user?.avatar === "string"
        ? user.avatar
        : null;

  const showAvatar = !!avatar && !avatarFailed;

  // ---------------------------------------------
  // OPEN SETTINGS
  // ---------------------------------------------

  const openSettings = () => {
    setMenuVisible(false);

    router.push({
      pathname: "/settings",
      params: { section: "profile" },
    });
  };

  // ---------------------------------------------
  // SIGN OUT
  // ---------------------------------------------

  const handleSignOut = () => {
    setMenuVisible(false);
    signOut();
    router.replace("/(auth)/login");
  };

  return (
    <View
      style={[
        styles.headerWrapper,
        { paddingTop: insets.top + 7 },
      ]}
    >
      <View style={styles.headerContent}>

        {/* BRAND */}
        <Pressable
          onPress={() => {
            setMenuVisible(false);
            router.replace("/(tabs)/overview");
          }}
          style={styles.brandContainer}
        >
          <Text style={styles.brandText}>
            FIFTH <Text style={styles.brandAccent}>AVENUE</Text>
          </Text>
        </Pressable>

        {/* PROFILE */}
        <Pressable
          style={styles.profileButton}
          onPress={() => setMenuVisible((prev) => !prev)}
        >
          {showAvatar ? (
            <Image
              source={{ uri: avatar! }}
              style={styles.avatar}
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>
                {userName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <View style={styles.profileNameContainer}>
            <Text style={styles.profileName} numberOfLines={1}>
              {userName}
            </Text>

            <Text style={styles.profileRole} numberOfLines={1}>
              {typeof user?.title === "string"
                ? user.title
                : "Client"}
            </Text>
          </View>

          <Ionicons
            name={menuVisible ? "chevron-up" : "chevron-down"}
            size={16}
            color="#6F6A5D"
          />
        </Pressable>
      </View>

      {/* PROFILE DROPDOWN */}
      {menuVisible && (
        <>
          {/* Outside tap closes dropdown */}
          <Pressable
            style={styles.menuBackdrop}
            onPress={() => setMenuVisible(false)}
          />

          <View style={styles.dropdownMenu}>

            {/* PROFILE */}
            <Pressable
              style={styles.dropdownItem}
              onPress={openSettings}
            >
              <Ionicons
                name="person-outline"
                size={19}
                color="#263B68"
              />

              <Text style={styles.dropdownText}>
                Profile
              </Text>
            </Pressable>

            <View style={styles.menuDivider} />

            {/* SIGN OUT */}
            <Pressable
              style={styles.dropdownItem}
              onPress={handleSignOut}
            >
              <Ionicons
                name="log-out-outline"
                size={19}
                color="#B42318"
              />

              <Text style={styles.signOutText}>
                Sign out
              </Text>
            </Pressable>

          </View>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------
// CUSTOM BOTTOM TAB BAR
// ---------------------------------------------

function CustomTabBar({
  state,
  descriptors,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  // Hide Settings from bottom navigation.
  const visibleRoutes = state.routes.filter(
    (route) => route.name !== "settings"
  );

  const focusedRouteKey = state.routes[state.index]?.key;

  return (
    <View
      style={[
        styles.tabBarContainer,
        {
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      <View style={styles.tabBar}>
        {visibleRoutes.map((route) => {
          const { options } = descriptors[route.key];

          const label = options.title || route.name;
          const isFocused = focusedRouteKey === route.key;

          const color = isFocused ? "#FFFFFF" : "#263247";
          const iconSize = isFocused ? 21 : 20;

          const handlePress = () => {
            if (isFocused) return;

            router.navigate(
              (`/(tabs)/${route.name}`) as Href
            );
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={
                options.tabBarAccessibilityLabel || label
              }
              testID={options.tabBarButtonTestID}
              onPress={handlePress}
              style={styles.tabItem}
            >
              <View
                style={[
                  styles.tabPill,
                  isFocused && styles.activeTabPill,
                ]}
              >
                {options.tabBarIcon?.({
                  focused: isFocused,
                  color,
                  size: iconSize,
                })}

                <Text
                  numberOfLines={1}
                  style={[
                    styles.tabLabel,
                    isFocused
                      ? styles.activeTabLabel
                      : styles.inactiveTabLabel,
                  ]}
                >
                  {label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------
// TAB LAYOUT
// ---------------------------------------------

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        header: () => <AppHeader />,
        headerShown: true,
      }}
    >

      {/* OVERVIEW */}
      <Tabs.Screen
        name="overview"
        options={{
          title: "Overview",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="home-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* CAMPAIGNS */}
      <Tabs.Screen
        name="campaigns"
        options={{
          title: "Campaigns",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="create-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* INSIGHTS */}
      <Tabs.Screen
        name="insights"
        options={{
          title: "Insights",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="analytics-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* ASSETS */}
      <Tabs.Screen
        name="assets"
        options={{
          title: "Assets",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="briefcase-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* BILLING */}
      <Tabs.Screen
        name="billing"
        options={{
          title: "Billing",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="wallet-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* SETTINGS */}
      <Tabs.Screen
        name="settings"
        options={{
          headerShown: true,
          title: "Settings",
          tabBarStyle: { display: "none" },
        }}
      />

    </Tabs>
  );
}

// ---------------------------------------------
// STYLES
// ---------------------------------------------

const styles = StyleSheet.create({

  // HEADER
  headerWrapper: {
    backgroundColor: "#F8F7F4",
    paddingHorizontal: 18,
    paddingBottom: 12,
    zIndex: 100,
    elevation: 5,
  },

  headerContent: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  brandContainer: {
    flex: 1,
  },

  brandText: {
    color: "#17243A",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 3,
  },

  brandAccent: {
    color: "#42577F",
  },

  // PROFILE BUTTON
  profileButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E9E6DF",
    borderRadius: 28,
    paddingVertical: 5,
    paddingHorizontal: 7,
    maxWidth: 160,
  },

  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },

  avatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#172F68",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarInitial: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  profileNameContainer: {
    flexShrink: 1,
  },

  profileName: {
    color: "#24221E",
    fontSize: 12,
    fontWeight: "700",
  },

  profileRole: {
    color: "#777264",
    fontSize: 10,
    marginTop: 1,
  },

  // DROPDOWN BACKDROP
  menuBackdrop: {
    position: "absolute",
    top: 0,
    left: -1000,
    right: -1000,
    bottom: -1000,
    zIndex: 1,
  },

  // DROPDOWN
  dropdownMenu: {
    position: "absolute",
    top: "100%",
    right: 18,
    marginTop: 12,
    width: 205,
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#EAE7E0",
    elevation: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    zIndex: 2,
  },

  dropdownItem: {
    minHeight: 47,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingHorizontal: 16,
  },

  dropdownText: {
    color: "#263247",
    fontSize: 14,
    fontWeight: "500",
  },

  signOutText: {
    color: "#B42318",
    fontSize: 14,
    fontWeight: "600",
  },

  menuDivider: {
    height: 1,
    backgroundColor: "#F0EEE9",
    marginHorizontal: 13,
  },

  // BOTTOM TAB BAR
  tabBarContainer: {
    backgroundColor: "#FFFFFF",
    paddingTop: 7,
    paddingHorizontal: 7,
    borderTopWidth: 0,
    elevation: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },

  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 54,
  },

  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  tabPill: {
    minWidth: 55,
    height: 49,
    paddingHorizontal: 5,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },

  activeTabPill: {
    backgroundColor: "#172F68",
    minWidth: 70,
    paddingHorizontal: 8,
    borderRadius: 30,
  },

  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },

  activeTabLabel: {
    color: "#FFFFFF",
  },

  inactiveTabLabel: {
    color: "#263247",
  },

});