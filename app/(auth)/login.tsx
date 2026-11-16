import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../src/context/AuthContext";
import { Aurora, Seal } from "../../src/ui/brand";
import { Glass } from "../../src/ui/Glass";
import { Tap, notify, type IconName } from "../../src/ui/primitives";
import { fonts, midnight, radius, space } from "../../src/ui/theme";

type InputRef = React.ComponentRef<typeof TextInput>;

function Field({
  label,
  icon,
  focused,
  invalid,
  trailing,
  inputRef,
  ...input
}: React.ComponentProps<typeof TextInput> & {
  label: string;
  icon: IconName;
  focused: boolean;
  invalid: boolean;
  trailing?: React.ReactNode;
  inputRef?: React.Ref<InputRef>;
}) {
  const borderColor = invalid ? "#F0A0A0" : focused ? midnight.lamp : "rgba(246,244,238,0.18)";
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, { borderColor, borderWidth: focused || invalid ? 1.5 : 1 }]}>
        <Ionicons name={icon} size={19} color={focused ? midnight.lamp : midnight.muted} />
        <TextInput
          ref={inputRef}
          accessibilityLabel={label}
          placeholderTextColor={midnight.faint}
          selectionColor={midnight.lamp}
          keyboardAppearance="dark"
          style={styles.input}
          {...input}
        />
        {trailing}
      </View>
    </View>
  );
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const passwordInputRef = useRef<InputRef>(null);

  const { signIn } = useAuth();

  // A short sideways shake tells the user the form was rejected.
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const fail = (message: string) => {
    setErrorMessage(message);
    notify("error");
    shake.value = withSequence(
      withTiming(-9, { duration: 55 }),
      withTiming(9, { duration: 55 }),
      withTiming(-6, { duration: 55 }),
      withTiming(6, { duration: 55 }),
      withTiming(0, { duration: 55 })
    );
  };

  const handleLogin = async () => {
    setErrorMessage("");

    if (!email.trim() || !password) {
      fail("Enter your email and password.");
      return;
    }

    const normalizedEmail = email.trim();

    if (!/^[^\s@]+@[^\s@]+$/.test(normalizedEmail)) {
      fail("Enter a valid email address.");
      return;
    }

    try {
      setLoading(true);
      await signIn(normalizedEmail, password);
      notify("success");
      router.replace("/(tabs)/overview");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";

      if (
        /401|unauthorized|invalid credentials|invalid email|incorrect password/i.test(message)
      ) {
        fail("That email or password is not right. Try again.");
      } else {
        fail(message || "Sign-in failed. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Aurora width={width} height={height} />
      <View pointerEvents="none" style={styles.veil} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 20) + 16 },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Tap
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
            style={styles.back}
          >
            <Ionicons name="chevron-back" size={20} color={midnight.text} />
          </Tap>

          <View style={styles.top}>
            <Animated.View entering={FadeIn.duration(900)}>
              <Seal size={92} />
            </Animated.View>
            <Animated.Text
              entering={FadeInDown.delay(150).duration(700).easing(Easing.out(Easing.cubic))}
              style={styles.headline}
            >
              Welcome back.
            </Animated.Text>
            <Animated.Text entering={FadeIn.delay(400).duration(700)} style={styles.lede}>
              Sign in to see how your campaigns are doing.
            </Animated.Text>
          </View>

          <Animated.View
            entering={FadeInDown.delay(300).duration(700).easing(Easing.out(Easing.cubic))}
            style={styles.cardWrap}
          >
            <Glass dark radius={30} strength={0.2} contentStyle={{ padding: 22 }}>
              <Animated.View style={[styles.form, shakeStyle]}>
                <Field
                  label="Email"
                  icon="mail-outline"
                  focused={focusedField === "email"}
                  invalid={!!errorMessage}
                  placeholder="you@company.com"
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    setErrorMessage("");
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  returnKeyType="next"
                  editable={!loading}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField("")}
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                />

                <Field
                  inputRef={passwordInputRef}
                  label="Password"
                  icon="lock-closed-outline"
                  focused={focusedField === "password"}
                  invalid={!!errorMessage}
                  placeholder="Your password"
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    setErrorMessage("");
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="current-password"
                  returnKeyType="done"
                  editable={!loading}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField("")}
                  onSubmitEditing={handleLogin}
                  trailing={
                    <Tap
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                      onPress={() => setShowPassword(!showPassword)}
                      disabled={loading}
                      hitSlop={10}
                    >
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color={midnight.muted}
                      />
                    </Tap>
                  }
                />

                {errorMessage ? (
                  <Animated.View entering={FadeInDown.duration(220)} style={styles.error}>
                    <Ionicons name="alert-circle-outline" size={16} color="#F5B5B5" />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </Animated.View>
                ) : null}

                <Tap
                  accessibilityRole="button"
                  accessibilityLabel="Sign in"
                  onPress={handleLogin}
                  disabled={loading}
                  style={styles.submit}
                >
                  {loading ? (
                    <ActivityIndicator color="#0A0F3A" />
                  ) : (
                    <Text style={styles.submitText}>Sign in</Text>
                  )}
                </Tap>
              </Animated.View>
            </Glass>
          </Animated.View>

          <Text style={styles.help}>
            Lost your sign-in details? Your Fifth Avenue account manager can reset them.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: midnight.top },
  veil: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,28,0.45)" },
  scroll: { flexGrow: 1, paddingHorizontal: 22 },
  back: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: midnight.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: midnight.line,
    alignItems: "center",
    justifyContent: "center",
  },
  top: { alignItems: "center", marginTop: 18, marginBottom: 30 },
  headline: {
    fontFamily: fonts.serif,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -1,
    color: midnight.text,
    textAlign: "center",
    marginTop: 22,
  },
  lede: {
    fontFamily: fonts.sans,
    fontSize: 14.5,
    lineHeight: 22,
    color: midnight.muted,
    textAlign: "center",
    marginTop: 8,
  },
  cardWrap: { maxWidth: 520, width: "100%", alignSelf: "center" },
  form: { gap: space.lg },
  label: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: midnight.muted },
  field: {
    height: 56,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  input: {
    flex: 1,
    height: "100%",
    fontFamily: fonts.sans,
    fontSize: 15,
    color: midnight.text,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null),
  },
  error: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: "rgba(229,115,115,0.16)",
  },
  errorText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 12.5, lineHeight: 17, color: "#F5B5B5" },
  submit: {
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: midnight.text,
    alignItems: "center",
    justifyContent: "center",
    marginTop: space.sm,
  },
  submitText: { fontFamily: fonts.sansSemi, fontSize: 16, color: "#0A0F3A" },
  help: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: midnight.faint,
    textAlign: "center",
    marginTop: 26,
    maxWidth: 300,
    alignSelf: "center",
  },
});
