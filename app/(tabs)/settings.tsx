import React, { useCallback, useEffect, useState } from "react";
import { Alert, Image, Platform, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../../src/context/AuthContext";
import {
  changePortalPassword,
  getCompanyLogoUrl,
  getPortalAvatarUrl,
  getPortalClient,
  updatePortalProfile,
  PortalClient,
} from "../../src/lib/api";
import { useAppTheme, ThemeChoice } from "../../src/context/ThemeContext";
import {
  Button,
  Card,
  EmptyState,
  Hairline,
  Reveal,
  ScreenScroll,
  Segmented,
  Skeleton,
  T,
  Tap,
  notify,
} from "../../src/ui/primitives";
import { fonts, palettes, radius, space } from "../../src/ui/theme";

type Section = "profile" | "appearance" | "company";

function getInitials(name?: string) {
  return (name || "You")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function displayValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return "";
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  editable = true,
  secure,
}: {
  label: string;
  value: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "phone-pad";
  editable?: boolean;
  secure?: boolean;
}) {
  const { colors } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <T v="label" tone="muted">
        {label}
      </T>
      <View
        style={[
          styles.field,
          {
            backgroundColor: editable ? colors.input : colors.well,
            borderColor: focused ? colors.accent : colors.borderStrong,
            borderWidth: focused ? 1.5 : 1,
          },
        ]}
      >
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder || label}
          placeholderTextColor={colors.faint}
          selectionColor={colors.accent}
          keyboardType={keyboardType}
          editable={editable}
          autoCapitalize="none"
          secureTextEntry={secure && !revealed}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, { color: editable ? colors.text : colors.muted }]}
        />
        {secure ? (
          <Tap
            accessibilityRole="button"
            accessibilityLabel={revealed ? `Hide ${label}` : `Show ${label}`}
            onPress={() => setRevealed(!revealed)}
            hitSlop={10}
          >
            <Ionicons
              name={revealed ? "eye-off-outline" : "eye-outline"}
              size={19}
              color={colors.icon}
            />
          </Tap>
        ) : !editable ? (
          <Ionicons name="lock-closed-outline" size={15} color={colors.faint} />
        ) : null}
      </View>
    </View>
  );
}

/** A miniature screen drawn in the palette each appearance option would use. */
function ThemePreview({ choice }: { choice: ThemeChoice }) {
  const half = (palette: (typeof palettes)["light"], key: string) => (
    <View key={key} style={{ flex: 1, backgroundColor: palette.background, padding: 6, gap: 4 }}>
      <View style={{ height: 5, width: "70%", borderRadius: 3, backgroundColor: palette.text }} />
      <View
        style={{
          flex: 1,
          borderRadius: 5,
          backgroundColor: palette.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: palette.borderStrong,
        }}
      />
      <View style={{ height: 6, borderRadius: 3, backgroundColor: palette.accent }} />
    </View>
  );
  return (
    <View style={styles.preview}>
      {choice === "system"
        ? [half(palettes.light, "l"), half(palettes.dark, "d")]
        : half(palettes[choice], choice)}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SettingsScreen() {
  const { user, updateUser } = useAuth();
  const params = useLocalSearchParams<{ section?: string }>();

  const { theme, setTheme, colors, isDark } = useAppTheme();

  const [section, setSection] = useState<Section>("profile");

  const [name, setName] = useState(user?.name || "");
  const [title, setTitle] = useState(
    typeof user?.title === "string" ? user.title : ""
  );
  const [phone, setPhone] = useState(
    typeof user?.phone === "string" ? user.phone : ""
  );

  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [company, setCompany] = useState<PortalClient | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companyError, setCompanyError] = useState("");

  const [refreshing, setRefreshing] = useState(false);

  const brandId = user?.brandId;
  const accountId = user?.id;

  useEffect(() => {
    const requestedSection = params.section;

    if (
      requestedSection === "profile" ||
      requestedSection === "appearance" ||
      requestedSection === "company"
    ) {
      setSection(requestedSection);
    }
  }, [params.section]);

  useEffect(() => {
    setName(user?.name || "");
    setTitle(typeof user?.title === "string" ? user.title : "");
    setPhone(typeof user?.phone === "string" ? user.phone : "");
  }, [user]);

  const loadCompany = useCallback(async () => {
    if (!brandId) {
      setCompanyError("Company information is unavailable.");
      return;
    }

    setCompanyLoading(true);
    setCompanyError("");

    try {
      const result = await getPortalClient(brandId);
      setCompany(result);
    } catch (error) {
      setCompanyError(
        error instanceof Error
          ? error.message
          : "Unable to load company information."
      );
    } finally {
      setCompanyLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    if (section === "company") {
      loadCompany();
    }
  }, [section, loadCompany]);

  const handleRefresh = async () => {
    setRefreshing(true);

    try {
      if (section === "company") {
        await loadCompany();
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!accountId) {
      Alert.alert("Account unavailable", "Please sign in again.");
      return;
    }

    if (!name.trim()) {
      Alert.alert("Name required", "Please enter your name.");
      return;
    }

    setSavingProfile(true);

    try {
      const patch = {
        name: name.trim(),
        title: title.trim(),
        phone: phone.trim(),
      };

      const updated = await updatePortalProfile(accountId, patch);

      updateUser({
        ...updated,
        ...patch,
      });

      Alert.alert("Profile updated", "Your profile has been saved.");
    } catch (error) {
      Alert.alert(
        "Update failed",
        error instanceof Error
          ? error.message
          : "Unable to update your profile."
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!accountId) {
      Alert.alert("Account unavailable", "Please sign in again.");
      return;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Missing information", "Complete all password fields.");
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert(
        "Password too short",
        "Your new password must contain at least 8 characters."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Passwords don't match", "Check your confirmation.");
      return;
    }

    setSavingPassword(true);

    try {
      await changePortalPassword(
        accountId,
        currentPassword,
        newPassword
      );

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      Alert.alert("Password changed", "Your password was updated.");
    } catch (error) {
      Alert.alert(
        "Password change failed",
        error instanceof Error
          ? error.message
          : "Unable to change your password."
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const handleThemeChange = async (value: ThemeChoice) => {
    try {
      await setTheme(value);
    } catch {
      Alert.alert(
        "Theme update failed",
        "Unable to save your appearance preference."
      );
    }
  };

  const companyLogoUrl =
    company?.hasAvatar && brandId
      ? getCompanyLogoUrl(brandId, company.avatarUpdatedAt as string | null | undefined)
      : null;

  const companyFields = [
    { key: "name", label: "Company name" },
    { key: "website", label: "Website" },
    { key: "industry", label: "Industry" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "address", label: "Address" },
    { key: "city", label: "City" },
    { key: "country", label: "Country" },
  ];

  const themeOptions: {
    value: ThemeChoice;
    label: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [
    {
      value: "light",
      label: "Light",
      description: "A bright and clean appearance",
      icon: "sunny-outline",
    },
    {
      value: "dark",
      label: "Dark",
      description: "A darker appearance",
      icon: "moon-outline",
    },
    {
      value: "system",
      label: "System default",
      description: "Follow your device settings",
      icon: "phone-portrait-outline",
    },
  ];

  const { signOut } = useAuth();
  const [avatarFailed, setAvatarFailed] = useState(false);

  const avatarUrl =
    user?.id && user.hasAvatar === true
      ? getPortalAvatarUrl(user.id, user.avatarUpdatedAt)
      : typeof user?.avatar === "string"
        ? user.avatar
        : null;

  return (
    <ScreenScroll
      refreshing={refreshing}
      onRefresh={handleRefresh}
      automaticallyAdjustKeyboardInsets
    >
      <Reveal style={styles.identity}>
        {avatarUrl && !avatarFailed ? (
          <Image
            source={{ uri: avatarUrl }}
            style={styles.avatar}
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          <View style={[styles.avatar, styles.center, { backgroundColor: colors.accent }]}>
            <T style={{ fontFamily: fonts.serifMedium, fontSize: 26, lineHeight: 32 }} color={colors.onAccent}>
              {getInitials(name)}
            </T>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <T v="title" numberOfLines={1} adjustsFontSizeToFit>
            {name || "Your name"}
          </T>
          <T tone="muted" numberOfLines={1}>
            {user?.email || "No email on file"}
          </T>
        </View>
      </Reveal>

      <Reveal index={1}>
        <Segmented
          value={section}
          onChange={setSection}
          options={[
            { value: "profile", label: "Profile" },
            { value: "appearance", label: "Appearance" },
            { value: "company", label: "Company" },
          ]}
        />
      </Reveal>

      {section === "profile" ? (
        <Animated.View key="profile" entering={FadeIn.duration(260)} style={styles.gap}>
          <Card style={styles.gap}>
            <View>
              <T v="heading">Personal information</T>
              <T v="caption" tone="faint">
                How you appear to the Fifth Avenue team
              </T>
            </View>
            <Field label="Full name" value={name} onChangeText={setName} placeholder="Your name" />
            <Field
              label="Designation"
              value={title}
              onChangeText={setTitle}
              placeholder="For example, Marketing Manager"
            />
            <Field
              label="Phone number"
              value={phone}
              onChangeText={setPhone}
              placeholder="Your phone number"
              keyboardType="phone-pad"
            />
            <Field label="Email address" value={user?.email || ""} editable={false} />
            <Button
              label="Save changes"
              icon="checkmark"
              loading={savingProfile}
              onPress={handleSaveProfile}
            />
          </Card>

          <Card style={styles.gap}>
            <View>
              <T v="heading">Change password</T>
              <T v="caption" tone="faint">
                You need your current password to set a new one
              </T>
            </View>
            <Field
              secure
              label="Current password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Your current password"
            />
            <Field
              secure
              label="New password"
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="At least 8 characters"
            />
            <Field
              secure
              label="Confirm new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="The new password again"
            />
            <Button
              kind="ghost"
              label="Update password"
              loading={savingPassword}
              onPress={handleChangePassword}
            />
          </Card>

          <Button
            kind="danger"
            label="Sign out"
            icon="log-out-outline"
            onPress={() => {
              signOut();
              router.replace("/");
            }}
          />
        </Animated.View>
      ) : null}

      {section === "appearance" ? (
        <Animated.View key="appearance" entering={FadeIn.duration(260)} style={styles.gap}>
          <View style={{ flexDirection: "row", gap: space.md }}>
            {themeOptions.map((option) => {
              const selected = theme === option.value;
              return (
                <Tap
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${option.label}. ${option.description}`}
                  onPress={() => {
                    notify("success");
                    handleThemeChange(option.value);
                  }}
                  haptic={false}
                  style={[
                    styles.themeOption,
                    {
                      backgroundColor: colors.surface,
                      borderColor: selected ? colors.accent : colors.border,
                      borderWidth: selected ? 2 : 1,
                    },
                  ]}
                >
                  <ThemePreview choice={option.value} />
                  <View style={styles.themeLabel}>
                    <Ionicons
                      name={selected ? "checkmark-circle" : option.icon}
                      size={15}
                      color={selected ? colors.accent : colors.muted}
                    />
                    <T v="label" numberOfLines={1}>
                      {option.value === "system" ? "System" : option.label}
                    </T>
                  </View>
                </Tap>
              );
            })}
          </View>

          <T tone="muted">
            {theme === "system"
              ? `Following your device, which is set to ${isDark ? "dark" : "light"} right now.`
              : `The ${theme} appearance is on.`}{" "}
            Your choice is saved and used the next time you open the app.
          </T>
        </Animated.View>
      ) : null}

      {section === "company" ? (
        <Animated.View key="company" entering={FadeIn.duration(260)} style={styles.gap}>
          {companyLoading ? (
            <Card style={styles.gap}>
              <Skeleton height={56} width={56} round={16} />
              <Skeleton height={16} width="70%" />
              <Skeleton height={16} width="50%" />
              <Skeleton height={16} width="60%" />
            </Card>
          ) : companyError ? (
            <EmptyState
              icon="alert-circle-outline"
              title="Company details did not load"
              message={companyError}
              action={
                <Button small kind="ghost" label="Try again" icon="refresh" onPress={loadCompany} />
              }
            />
          ) : company ? (
            <>
              <Card pad={0}>
                <View style={styles.companyHead}>
                  {companyLogoUrl ? (
                    <Image
                      source={{ uri: companyLogoUrl }}
                      style={[styles.logo, { borderColor: colors.border, backgroundColor: "#FFFFFF" }]}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={[styles.logo, styles.center, { backgroundColor: colors.accentMuted, borderColor: "transparent" }]}>
                      <Ionicons name="business-outline" size={26} color={colors.accent} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <T v="heading" numberOfLines={2}>
                      {company.name || user?.clientName || "Company"}
                    </T>
                    <T v="caption" tone="faint">
                      The organisation this account belongs to
                    </T>
                  </View>
                </View>

                {companyFields.map((field) => {
                  const value = displayValue(company[field.key as keyof PortalClient]);
                  if (!value || field.key === "name") return null;
                  return (
                    <View key={field.key}>
                      <Hairline style={{ marginLeft: space.lg }} />
                      <View style={styles.companyRow}>
                        <T tone="muted">{field.label}</T>
                        <T v="bodyStrong" style={{ flex: 1, textAlign: "right" }} selectable>
                          {value}
                        </T>
                      </View>
                    </View>
                  );
                })}
              </Card>

              <View style={styles.notice}>
                <Ionicons name="lock-closed-outline" size={14} color={colors.muted} />
                <T v="caption" tone="faint" style={{ flex: 1 }}>
                  Fifth Avenue manages these details. Ask your account manager to change them.
                </T>
              </View>
            </>
          ) : (
            <T tone="muted">No company information on file.</T>
          )}
        </Animated.View>
      ) : null}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.lg },
  center: { alignItems: "center", justifyContent: "center" },
  identity: { flexDirection: "row", alignItems: "center", gap: space.lg },
  avatar: { width: 68, height: 68, borderRadius: 34 },
  field: {
    height: 52,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    flex: 1,
    height: "100%",
    fontFamily: fonts.sans,
    fontSize: 14.5,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null),
  },
  themeOption: { flex: 1, borderRadius: radius.lg, padding: 8, gap: 8 },
  preview: {
    height: 92,
    borderRadius: radius.sm,
    overflow: "hidden",
    flexDirection: "row",
  },
  themeLabel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingBottom: 4,
  },
  companyHead: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg },
  logo: { width: 56, height: 56, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  companyRow: { flexDirection: "row", alignItems: "flex-start", gap: space.lg, padding: space.lg },
  notice: { flexDirection: "row", alignItems: "center", gap: 8 },
});
