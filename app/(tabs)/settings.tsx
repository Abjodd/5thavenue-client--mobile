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

type Section = "profile" | "appearance" | "company";
type ThemeChoice = "light" | "dark" | "system";

const NAVY = "#17243A";
const MUTED = "#818895";
const BORDER = "#E9EAF0";

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


function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "phone-pad";
  editable?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || label}
        placeholderTextColor="#A7ABB4"
        keyboardType={keyboardType}
        editable={editable}
        autoCapitalize="none"
        style={[
          styles.input,
          !editable && styles.readOnlyInput,
        ]}
      />
    </View>
  );
}

function SectionButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.sectionButton,
        active && styles.sectionButtonActive,
      ]}
    >
      <Ionicons
        name={icon}
        size={17}
        color={active ? "#FFFFFF" : MUTED}
      />
      <Text
        style={[
          styles.sectionButtonText,
          active && styles.sectionButtonTextActive,
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

  const [section, setSection] = useState<Section>("profile");



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

  const [theme, setTheme] = useState<ThemeChoice>("light");

  const [refreshing, setRefreshing] = useState(false);

  const brandId = user?.brandId;
  const accountId = user?.id;

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

  useEffect(() => {
    setName(user?.name || "");
    setTitle(typeof user?.title === "string" ? user.title : "");
    setPhone(typeof user?.phone === "string" ? user.phone : "");
  }, [user]);

  const handleRefresh = async () => {
    setRefreshing(true);

    if (section === "company") {
      await loadCompany();
    }

    setRefreshing(false);
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

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={NAVY}
          />
        }
      >
        <View style={styles.pageHeading}>
          <Text style={styles.eyebrow}>ACCOUNT</Text>
          <Text style={styles.pageTitle}>Settings</Text>
          <Text style={styles.pageDescription}>
            Manage your profile and company preferences.
          </Text>
        </View>

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
          />

          <SectionButton
            icon="contrast-outline"
            label="Appearance"
            active={section === "appearance"}
            onPress={() => setSection("appearance")}
          />

          <SectionButton
            icon="business-outline"
            label="Company"
            active={section === "company"}
            onPress={() => setSection("company")}
          />
        </ScrollView>

        {section === "profile" && (
          <>
            <View style={styles.card}>
              <View style={styles.cardHeading}>
                <View>
                  <Text style={styles.cardTitle}>Personal information</Text>
                  <Text style={styles.cardDescription}>
                    Update the details associated with your account.
                  </Text>
                </View>
              </View>

              <View style={styles.profileIdentity}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {getInitials(name)}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.identityName}>
                    {name || "Your name"}
                  </Text>
                  <Text style={styles.identityEmail}>
                    {user?.email || "No email available"}
                  </Text>
                </View>
              </View>

              <Field
                label="Full name"
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
              />

              <Field
                label="Designation"
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Marketing Manager"
              />

              <Field
                label="Phone number"
                value={phone}
                onChangeText={setPhone}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
              />

              <Field
                label="Email address"
                value={user?.email || ""}
                editable={false}
              />

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.primaryButton}
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

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Change password</Text>
              <Text style={styles.cardDescription}>
                Use your current password to set a new one.
              </Text>

              <Field
                label="Current password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
              />

              <Field
                label="New password"
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="At least 8 characters"
              />

              <Field
                label="Confirm new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter new password"
              />

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.secondaryButton}
                onPress={handleChangePassword}
                disabled={savingPassword}
              >
                {savingPassword ? (
                  <ActivityIndicator color={NAVY} />
                ) : (
                  <Text style={styles.secondaryButtonText}>
                    Update password
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {section === "appearance" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Appearance</Text>
            <Text style={styles.cardDescription}>
              Choose how the mobile app should look.
            </Text>

            {(
              [
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
              ] as const
            ).map((option) => {
              const selected = theme === option.value;

              return (
                <TouchableOpacity
                  key={option.value}
                  activeOpacity={0.8}
                  onPress={() => setTheme(option.value)}
                  style={[
                    styles.themeOption,
                    selected && styles.themeOptionSelected,
                  ]}
                >
                  <View style={styles.themeIcon}>
                    <Ionicons
                      name={option.icon}
                      size={21}
                      color={NAVY}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.themeLabel}>
                      {option.label}
                    </Text>
                    <Text style={styles.themeDescription}>
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
                    color={selected ? NAVY : "#B6BBC4"}
                  />
                </TouchableOpacity>
              );
            })}

            <Text style={styles.appearanceNote}>
              Theme selection is currently a screen-level preference.
              App-wide theme persistence will be connected when the
              shared theme provider is added.
            </Text>
          </View>
        )}

        {section === "company" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Company information</Text>
            <Text style={styles.cardDescription}>
              Your organisation's details linked to this portal account.
            </Text>

            {companyLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={NAVY} />
                <Text style={styles.loadingText}>
                  Loading company details...
                </Text>
              </View>
            ) : companyError ? (
              <View style={styles.errorContainer}>
                <Ionicons
                  name="alert-circle-outline"
                  size={25}
                  color="#C65A52"
                />
                <Text style={styles.errorText}>{companyError}</Text>
                <TouchableOpacity onPress={loadCompany}>
                  <Text style={styles.retryText}>Try again</Text>
                </TouchableOpacity>
              </View>
            ) : company ? (
              <>
                <View style={styles.companyIdentity}>
                  {companyLogoUrl ? (
                    <Image
                      source={{ uri: companyLogoUrl }}
                      style={styles.companyLogo}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.companyLogoPlaceholder}>
                      <Ionicons
                        name="business-outline"
                        size={29}
                        color={NAVY}
                      />
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <Text style={styles.companyName}>
                      {company.name || user?.clientName || "Company"}
                    </Text>
                    <Text style={styles.companySubtitle}>
                      Connected client organisation
                    </Text>
                  </View>
                </View>

                {companyFields.map((field) => {
                  const value = displayValue(company[field.key]);

                  if (!value || field.key === "name") return null;

                  return (
                    <View key={field.key} style={styles.companyField}>
                      <Text style={styles.companyFieldLabel}>
                        {field.label}
                      </Text>
                      <Text style={styles.companyFieldValue}>
                        {value}
                      </Text>
                    </View>
                  );
                })}

                <View style={styles.readOnlyNotice}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={15}
                    color={MUTED}
                  />
                  <Text style={styles.readOnlyText}>
                    Company details are managed by Fifth Avenue.
                  </Text>
                </View>
              </>
            ) : (
              <Text style={styles.loadingText}>
                No company information available.
              </Text>
            )}
          </View>
        )}

        <Text style={styles.footerText}>
          Fifth Avenue Client Portal
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8F7F4",
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
    color: "#9298A3",
    marginBottom: 7,
  },
  pageTitle: {
    fontSize: 29,
    fontWeight: "700",
    color: NAVY,
    letterSpacing: -0.7,
  },
  pageDescription: {
    fontSize: 13,
    color: MUTED,
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
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: BORDER,
  flexDirection: "row",
  alignItems: "center",
  gap: 5,
},
  sectionButtonActive: {
    backgroundColor: NAVY,
    borderColor: NAVY,
  },
  sectionButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#697181",
  },
  sectionButtonTextActive: {
    color: "#FFFFFF",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 19,
    padding: 19,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  cardHeading: {
    marginBottom: 17,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: NAVY,
  },
  cardDescription: {
    fontSize: 12,
    color: MUTED,
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
    borderBottomColor: "#F0F0F0",
  },
  avatar: {
    width: 53,
    height: 53,
    borderRadius: 27,
    backgroundColor: "#E8ECF4",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 17,
    fontWeight: "700",
    color: NAVY,
  },
  identityName: {
    fontSize: 15,
    fontWeight: "700",
    color: NAVY,
  },
  identityEmail: {
    fontSize: 12,
    color: MUTED,
    marginTop: 4,
  },
  field: {
    marginTop: 15,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#555E6D",
    marginBottom: 8,
  },
  input: {
    height: 47,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 13,
    fontSize: 13,
    color: NAVY,
    backgroundColor: "#FFFFFF",
  },
  readOnlyInput: {
    backgroundColor: "#F6F6F7",
    color: "#8B919C",
  },
  primaryButton: {
    height: 48,
    borderRadius: 11,
    backgroundColor: NAVY,
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
    backgroundColor: "#F0F2F6",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 21,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: NAVY,
  },
  themeOption: {
    minHeight: 75,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  themeOptionSelected: {
    borderColor: NAVY,
    backgroundColor: "#F5F7FA",
  },
  themeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EDF0F5",
    alignItems: "center",
    justifyContent: "center",
  },
  themeLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: NAVY,
  },
  themeDescription: {
    fontSize: 11,
    color: MUTED,
    marginTop: 4,
  },
  appearanceNote: {
    fontSize: 11,
    lineHeight: 17,
    color: MUTED,
    marginTop: 8,
  },
  companyIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingBottom: 20,
    marginBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  companyLogo: {
    width: 58,
    height: 58,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
  },
  companyLogoPlaceholder: {
    width: 58,
    height: 58,
    borderRadius: 13,
    backgroundColor: "#EDF0F5",
    alignItems: "center",
    justifyContent: "center",
  },
  companyName: {
    fontSize: 16,
    fontWeight: "700",
    color: NAVY,
  },
  companySubtitle: {
    fontSize: 11,
    color: MUTED,
    marginTop: 5,
  },
  companyField: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F1F2",
  },
  companyFieldLabel: {
    fontSize: 11,
    color: MUTED,
    marginBottom: 5,
  },
  companyFieldValue: {
    fontSize: 13,
    fontWeight: "600",
    color: NAVY,
  },
  readOnlyNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 17,
  },
  readOnlyText: {
    fontSize: 11,
    color: MUTED,
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
    color: MUTED,
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
    color: "#A94E48",
    textAlign: "center",
  },
  retryText: {
    fontSize: 13,
    fontWeight: "700",
    color: NAVY,
  },
  footerText: {
    textAlign: "center",
    color: "#A2A6AE",
    fontSize: 10,
    marginTop: 9,
  },
});