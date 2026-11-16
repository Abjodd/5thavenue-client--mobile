import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Alert,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../../src/context/AuthContext";
import {
  changePortalPassword,
  getCompanyLogoUrl,
  getPortalClient,
  updatePortalProfile,
  PortalClient,
} from "../../src/lib/api";

import {
  useAppTheme,
  ThemeChoice,
} from "../../src/context/ThemeContext";

type Section = "profile" | "appearance" | "company";

function getInitials(name?: string) {
  return (name || "Client")
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

// Reusable input field
function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  editable = true,
  colors,
}: {
  label: string;
  value: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "phone-pad";
  editable?: boolean;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.fieldLabel }]}>
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || label}
        placeholderTextColor={colors.placeholder}
        keyboardType={keyboardType}
        editable={editable}
        autoCapitalize="none"
        secureTextEntry={label.toLowerCase().includes("password")}
        style={[
          styles.input,
          {
            backgroundColor: editable
              ? colors.input
              : colors.disabled,
            borderColor: colors.border,
            color: editable
              ? colors.inputText
              : colors.disabledText,
          },
        ]}
      />
    </View>
  );
}

// Reusable section navigation button
function SectionButton({
  icon,
  label,
  active,
  onPress,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.sectionButton,
        {
          backgroundColor: active
            ? colors.primary
            : colors.surface,
          borderColor: active
            ? colors.primary
            : colors.border,
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={17}
        color={active ? "#FFFFFF" : colors.muted}
      />

      <Text
        style={[
          styles.sectionButtonText,
          {
            color: active ? "#FFFFFF" : colors.text,
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

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
      ? getCompanyLogoUrl(brandId, company.avatarUpdatedAt)
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

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.background },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Page heading */}
        <View style={styles.pageHeading}>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>
            ACCOUNT
          </Text>

          <Text style={[styles.pageTitle, { color: colors.text }]}>
            Settings
          </Text>

          <Text
            style={[
              styles.pageDescription,
              { color: colors.muted },
            ]}
          >
            Manage your profile and company preferences.
          </Text>
        </View>

        {/* Section navigation */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sectionNavigation}
        >
          <SectionButton
            icon="person-outline"
            label="Profile"
            active={section === "profile"}
            onPress={() => setSection("profile")}
            colors={colors}
          />

          <SectionButton
            icon="contrast-outline"
            label="Appearance"
            active={section === "appearance"}
            onPress={() => setSection("appearance")}
            colors={colors}
          />

          <SectionButton
            icon="business-outline"
            label="Company"
            active={section === "company"}
            onPress={() => setSection("company")}
            colors={colors}
          />
        </ScrollView>

        {/* PROFILE */}
        {section === "profile" && (
          <>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.cardHeading}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  Personal information
                </Text>

                <Text
                  style={[
                    styles.cardDescription,
                    { color: colors.muted },
                  ]}
                >
                  Update the details associated with your account.
                </Text>
              </View>

              <View
                style={[
                  styles.profileIdentity,
                  { borderBottomColor: colors.border },
                ]}
              >
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: colors.avatar },
                  ]}
                >
                  <Text
                    style={[
                      styles.avatarText,
                      { color: colors.text },
                    ]}
                  >
                    {getInitials(name)}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.identityName,
                      { color: colors.text },
                    ]}
                  >
                    {name || "Your name"}
                  </Text>

                  <Text
                    style={[
                      styles.identityEmail,
                      { color: colors.muted },
                    ]}
                  >
                    {user?.email || "No email available"}
                  </Text>
                </View>
              </View>

              <Field
                label="Full name"
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                colors={colors}
              />

              <Field
                label="Designation"
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Marketing Manager"
                colors={colors}
              />

              <Field
                label="Phone number"
                value={phone}
                onChangeText={setPhone}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
                colors={colors}
              />

              <Field
                label="Email address"
                value={user?.email || ""}
                editable={false}
                colors={colors}
              />

              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.primaryButton,
                  { backgroundColor: colors.primary },
                ]}
                onPress={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>
                      Save changes
                    </Text>
                    <Ionicons
                      name="arrow-forward"
                      size={17}
                      color="#FFFFFF"
                    />
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Change password */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                Change password
              </Text>

              <Text
                style={[
                  styles.cardDescription,
                  { color: colors.muted },
                ]}
              >
                Use your current password to set a new one.
              </Text>

              <Field
                label="Current password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                colors={colors}
              />

              <Field
                label="New password"
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="At least 8 characters"
                colors={colors}
              />

              <Field
                label="Confirm new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter new password"
                colors={colors}
              />

              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.secondaryButton,
                  { backgroundColor: colors.buttonSecondary },
                ]}
                onPress={handleChangePassword}
                disabled={savingPassword}
              >
                {savingPassword ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text
                    style={[
                      styles.secondaryButtonText,
                      { color: colors.buttonSecondaryText },
                    ]}
                  >
                    Update password
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* APPEARANCE */}
        {section === "appearance" && (
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Appearance
            </Text>

            <Text
              style={[
                styles.cardDescription,
                { color: colors.muted },
              ]}
            >
              Choose how the mobile app should look.
            </Text>

            {themeOptions.map((option) => {
              const selected = theme === option.value;

              return (
                <TouchableOpacity
                  key={option.value}
                  activeOpacity={0.8}
                  onPress={() => handleThemeChange(option.value)}
                  style={[
                    styles.themeOption,
                    {
                      backgroundColor: selected
                        ? colors.selected
                        : colors.surface,
                      borderColor: selected
                        ? colors.primary
                        : colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.themeIcon,
                      { backgroundColor: colors.surfaceSecondary },
                    ]}
                  >
                    <Ionicons
                      name={option.icon}
                      size={21}
                      color={colors.primary}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.themeLabel,
                        { color: colors.text },
                      ]}
                    >
                      {option.label}
                    </Text>

                    <Text
                      style={[
                        styles.themeDescription,
                        { color: colors.muted },
                      ]}
                    >
                      {option.description}
                    </Text>
                  </View>

                  <Ionicons
                    name={
                      selected
                        ? "radio-button-on"
                        : "radio-button-off"
                    }
                    size={21}
                    color={
                      selected ? colors.primary : colors.muted
                    }
                  />
                </TouchableOpacity>
              );
            })}

            <View
              style={[
                styles.themeStatus,
                { backgroundColor: colors.surfaceSecondary },
              ]}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={17}
                color={colors.primary}
              />

              <Text
                style={[
                  styles.themeStatusText,
                  { color: colors.text },
                ]}
              >
                {theme === "system"
                  ? `Following system appearance (${isDark ? "Dark" : "Light"})`
                  : `${theme === "dark" ? "Dark" : "Light"} appearance enabled`}
              </Text>
            </View>

            <Text
              style={[
                styles.appearanceNote,
                { color: colors.muted },
              ]}
            >
              Your appearance preference is saved automatically and
              will be remembered next time you open the app.
            </Text>
          </View>
        )}

        {/* COMPANY */}
        {section === "company" && (
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Company information
            </Text>

            <Text
              style={[
                styles.cardDescription,
                { color: colors.muted },
              ]}
            >
              Your organisation's details linked to this portal account.
            </Text>

            {companyLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator
                  size="large"
                  color={colors.primary}
                />
                <Text
                  style={[
                    styles.loadingText,
                    { color: colors.muted },
                  ]}
                >
                  Loading company details...
                </Text>
              </View>
            ) : companyError ? (
              <View style={styles.errorContainer}>
                <Ionicons
                  name="alert-circle-outline"
                  size={25}
                  color={colors.danger}
                />

                <Text
                  style={[
                    styles.errorText,
                    { color: colors.danger },
                  ]}
                >
                  {companyError}
                </Text>

                <TouchableOpacity onPress={loadCompany}>
                  <Text
                    style={[
                      styles.retryText,
                      { color: colors.primary },
                    ]}
                  >
                    Try again
                  </Text>
                </TouchableOpacity>
              </View>
            ) : company ? (
              <>
                <View
                  style={[
                    styles.companyIdentity,
                    { borderBottomColor: colors.border },
                  ]}
                >
                  {companyLogoUrl ? (
                    <Image
                      source={{ uri: companyLogoUrl }}
                      style={[
                        styles.companyLogo,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                      resizeMode="contain"
                    />
                  ) : (
                    <View
                      style={[
                        styles.companyLogoPlaceholder,
                        { backgroundColor: colors.surfaceSecondary },
                      ]}
                    >
                      <Ionicons
                        name="business-outline"
                        size={29}
                        color={colors.primary}
                      />
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.companyName,
                        { color: colors.text },
                      ]}
                    >
                      {company.name || user?.clientName || "Company"}
                    </Text>

                    <Text
                      style={[
                        styles.companySubtitle,
                        { color: colors.muted },
                      ]}
                    >
                      Connected client organisation
                    </Text>
                  </View>
                </View>

                {companyFields.map((field) => {
                  const value = displayValue(
                    company[field.key as keyof PortalClient]
                  );

                  if (!value || field.key === "name") return null;

                  return (
                    <View
                      key={field.key}
                      style={[
                        styles.companyField,
                        { borderBottomColor: colors.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.companyFieldLabel,
                          { color: colors.muted },
                        ]}
                      >
                        {field.label}
                      </Text>

                      <Text
                        style={[
                          styles.companyFieldValue,
                          { color: colors.text },
                        ]}
                      >
                        {value}
                      </Text>
                    </View>
                  );
                })}

                <View style={styles.readOnlyNotice}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={15}
                    color={colors.muted}
                  />

                  <Text
                    style={[
                      styles.readOnlyText,
                      { color: colors.muted },
                    ]}
                  >
                    Company details are managed by Fifth Avenue.
                  </Text>
                </View>
              </>
            ) : (
              <Text
                style={[
                  styles.loadingText,
                  { color: colors.muted },
                ]}
              >
                No company information available.
              </Text>
            )}
          </View>
        )}

        <Text
          style={[
            styles.footerText,
            { color: colors.muted },
          ]}
        >
          Fifth Avenue Client Portal
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 25,
    paddingBottom: 40,
  },

  pageHeading: {
    marginBottom: 22,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 7,
  },

  pageTitle: {
    fontSize: 29,
    fontWeight: "700",
    letterSpacing: -0.7,
  },

  pageDescription: {
    fontSize: 13,
    marginTop: 6,
  },

  sectionNavigation: {
    gap: 10,
    paddingBottom: 14,
  },

  sectionButton: {
    height: 40,
    paddingHorizontal: 11,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  sectionButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },

  card: {
    borderRadius: 19,
    padding: 19,
    marginBottom: 16,
    borderWidth: 1,
  },

  cardHeading: {
    marginBottom: 17,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
  },

  cardDescription: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 18,
  },

  profileIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingBottom: 19,
    marginBottom: 5,
    borderBottomWidth: 1,
  },

  avatar: {
    width: 53,
    height: 53,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    fontSize: 17,
    fontWeight: "700",
  },

  identityName: {
    fontSize: 15,
    fontWeight: "700",
  },

  identityEmail: {
    fontSize: 12,
    marginTop: 4,
  },

  field: {
    marginTop: 15,
  },

  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },

  input: {
    height: 47,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 13,
    fontSize: 13,
  },

  primaryButton: {
    height: 48,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 22,
  },

  primaryButtonText: {
    fontSize: 13,
    color: "#FFFFFF",
    fontWeight: "700",
  },

  secondaryButton: {
    height: 46,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 21,
  },

  secondaryButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },

  themeOption: {
    minHeight: 75,
    borderRadius: 13,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },

  themeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  themeLabel: {
    fontSize: 13,
    fontWeight: "700",
  },

  themeDescription: {
    fontSize: 11,
    marginTop: 4,
  },

  themeStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 11,
    marginTop: 7,
  },

  themeStatusText: {
    fontSize: 11,
    fontWeight: "600",
    flex: 1,
  },

  appearanceNote: {
    fontSize: 11,
    lineHeight: 17,
    marginTop: 12,
  },

  companyIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingBottom: 20,
    marginBottom: 5,
    borderBottomWidth: 1,
  },

  companyLogo: {
    width: 58,
    height: 58,
    borderRadius: 13,
    borderWidth: 1,
  },

  companyLogoPlaceholder: {
    width: 58,
    height: 58,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  companyName: {
    fontSize: 16,
    fontWeight: "700",
  },

  companySubtitle: {
    fontSize: 11,
    marginTop: 5,
  },

  companyField: {
    paddingVertical: 13,
    borderBottomWidth: 1,
  },

  companyFieldLabel: {
    fontSize: 11,
    marginBottom: 5,
  },

  companyFieldValue: {
    fontSize: 13,
    fontWeight: "600",
  },

  readOnlyNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 17,
  },

  readOnlyText: {
    fontSize: 11,
    flex: 1,
  },

  loadingContainer: {
    minHeight: 150,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },

  loadingText: {
    fontSize: 12,
    textAlign: "center",
  },

  errorContainer: {
    minHeight: 140,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  errorText: {
    fontSize: 12,
    textAlign: "center",
  },

  retryText: {
    fontSize: 13,
    fontWeight: "700",
  },

  footerText: {
    textAlign: "center",
    fontSize: 10,
    marginTop: 9,
  },
});