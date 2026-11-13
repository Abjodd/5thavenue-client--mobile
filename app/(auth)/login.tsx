import { useRef, useState } from "react";

import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const scrollRef = useRef<ScrollView>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const { signIn } = useAuth();

  // Actual backend login
  const handleLogin = async () => {
    setErrorMessage("");

    // Validate empty fields
    if (!email.trim() || !password) {
      setErrorMessage("Please enter your email and password.");
      return;
    }

    // Validate email format (domain extension is optional)
const normalizedEmail = email.trim();

if (!/^[^\s@]+@[^\s@]+$/.test(normalizedEmail)) {
  setErrorMessage("Please enter a valid email address.");
  return;
}

    try {
      setLoading(true);

      await signIn(normalizedEmail, password);

      // Login successful
      router.replace("/(tabs)/overview");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "";

      // Friendly message for invalid credentials
      if (
        /401|unauthorized|invalid credentials|invalid email|incorrect password/i.test(
          message
        )
      ) {
        setErrorMessage("Invalid email or password. Please try again.");
      } else {
        setErrorMessage(
          message || "Unable to sign in. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#F8F8FC"
      />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        >
          <View style={styles.container}>
            {/* Branding */}
            <View style={styles.brandSection}>
              <Text style={styles.brandLabel}>
                CLIENT PORTAL
              </Text>

              <Text style={styles.heading}>
                Sign in.
              </Text>

              <Text style={styles.description}>
                Your campaigns, analytics and{"\n"}
                billing — on one calm dashboard.
              </Text>
            </View>

            {/* Login Form */}
            <View style={styles.form}>
              {/* Email */}
              <View
                style={[
                  styles.inputContainer,
                  focusedField === "email" && styles.inputFocused,
                  !!errorMessage && styles.inputError,
                ]}
              >
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={
                    focusedField === "email"
                      ? "#172F68"
                      : "#53617A"
                  }
                />

                <TextInput
                  style={styles.input}
                  placeholder="you@company.com"
                  placeholderTextColor="#8991A1"
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
                  onSubmitEditing={() =>
                    passwordInputRef.current?.focus()
                  }
                />
              </View>

              {/* Password */}
              <View
                style={[
                  styles.inputContainer,
                  focusedField === "password" && styles.inputFocused,
                  !!errorMessage && styles.inputError,
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={
                    focusedField === "password"
                      ? "#172F68"
                      : "#53617A"
                  }
                />

                <TextInput
                  ref={passwordInputRef}
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#8991A1"
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
                />

                {/* Show / Hide Password */}
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  activeOpacity={0.7}
                  disabled={loading}
                >
                  <Ionicons
                    name={
                      showPassword
                        ? "eye-off-outline"
                        : "eye-outline"
                    }
                    size={21}
                    color="#53617A"
                  />
                </TouchableOpacity>
              </View>

              {/* Inline Error Message */}
              {!!errorMessage && (
                <View style={styles.errorContainer}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={17}
                    color="#B42318"
                  />

                  <Text style={styles.errorText}>
                    {errorMessage}
                  </Text>
                </View>
              )}

              {/* Sign In Button */}
              <TouchableOpacity
                style={[
                  styles.loginButton,
                  loading && styles.buttonDisabled,
                ]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text style={styles.loginButtonText}>
                  {loading ? "Signing in..." : "Sign in"}
                </Text>

                {!loading && (
                  <Ionicons
                    name="arrow-forward"
                    size={19}
                    color="#FFFFFF"
                  />
                )}
              </TouchableOpacity>

              {/* Help Text */}
              <Text style={styles.helpText}>
                Lost your credentials? Contact your{"\n"}
                Fifth Avenue account manager.
              </Text>
            </View>
          </View>

          {/* Bottom Decorative Waves */}
          <View style={styles.waveContainer}>
            <View style={styles.waveBack} />
            <View style={styles.waveMiddle} />
            <View style={styles.waveFront} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8F8FC",
  },

  keyboardContainer: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: "space-between",
  },

  container: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingTop: Platform.OS === "ios" ? 95 : 85,
    paddingBottom: 35,
  },

  // Branding
  brandSection: {
    marginBottom: 40,
  },

  brandLabel: {
    color: "#536B9D",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 3,
    marginBottom: 12,
  },

  heading: {
    color: "#142B60",
    fontSize: 43,
    fontWeight: "700",
    letterSpacing: -1.5,
    marginBottom: 12,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },

  description: {
    color: "#34435F",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "400",
  },

  // Form
  form: {
    width: "100%",
    gap: 17,
  },

  inputContainer: {
    height: 54,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#D8DCE7",
    backgroundColor: "rgba(255,255,255,0.75)",
  },

  inputFocused: {
    borderColor: "#233F79",
    borderWidth: 1.5,
    backgroundColor: "#FFFFFF",
  },

  inputError: {
    borderColor: "#D92D20",
  },

  input: {
    flex: 1,
    height: "100%",
    marginLeft: 12,
    fontSize: 13,
    color: "#17243A",
    paddingVertical: 0,
  },

  eyeButton: {
    padding: 5,
    marginLeft: 5,
  },

  // Error
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: -7,
    paddingHorizontal: 2,
  },

  errorText: {
    flex: 1,
    color: "#B42318",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },

  // Sign In Button
  loginButton: {
    height: 54,
    borderRadius: 13,
    backgroundColor: "#142D66",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 3,
    elevation: 3,
    shadowColor: "#142D66",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.17,
    shadowRadius: 7,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  // Help
  helpText: {
    color: "#52617D",
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 1,
  },

  // Bottom Waves
  waveContainer: {
    height: 105,
    width: "100%",
    overflow: "hidden",
    position: "relative",
    marginTop: 5,
  },

  waveBack: {
    position: "absolute",
    width: "125%",
    height: 105,
    left: "-12%",
    top: 22,
    backgroundColor: "#DCE2F4",
    borderTopLeftRadius: 100,
    borderTopRightRadius: 65,
    transform: [{ rotate: "-5deg" }],
  },

  waveMiddle: {
    position: "absolute",
    width: "125%",
    height: 100,
    left: "-10%",
    top: 40,
    backgroundColor: "#879ACB",
    borderTopLeftRadius: 100,
    borderTopRightRadius: 75,
    transform: [{ rotate: "-7deg" }],
  },

  waveFront: {
    position: "absolute",
    width: "125%",
    height: 100,
    left: "-10%",
    top: 55,
    backgroundColor: "#203F82",
    borderTopLeftRadius: 110,
    borderTopRightRadius: 75,
    transform: [{ rotate: "-5deg" }],
  },
});