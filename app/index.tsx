import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  StatusBar,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { router } from "expo-router";
import { useAuth } from "../src/context/AuthContext";

const { width, height } = Dimensions.get("window");

export default function SplashScreen() {
  const { isAuthenticated } = useAuth();

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.75)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const waveAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 45,
          friction: 7,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnimation, {
          toValue: 1,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.timing(waveAnimation, {
          toValue: 0,
          duration: 2500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.timing(progress, {
      toValue: 1,
      duration: 2500,
      useNativeDriver: false,
    }).start();

    const timer = setTimeout(() => {
      router.replace(
        isAuthenticated ? "/(tabs)/overview" : "/(auth)/login"
      );
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 160],
  });

  const waveTranslate = waveAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -12],
  });

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      <LinearGradient
        colors={["#F4F3FF", "#FFFFFF", "#F3F0FF"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Top decorative curves */}
      <View style={styles.topDecoration}>
        <Svg
          width={width}
          height={height * 0.27}
          viewBox="0 0 390 240"
          preserveAspectRatio="xMidYMin slice"
        >
          <Path
            d="M0 0 H390 V25 C270 40 180 95 95 155 C55 183 25 190 0 200 Z"
            fill="#E7E5FF"
            opacity={0.45}
          />
          <Path
            d="M0 0 H300 C225 45 190 115 110 145 C65 165 25 180 0 190 Z"
            fill="#DCD9FF"
            opacity={0.35}
          />
        </Svg>
      </View>

      {/* Main branding */}
      <View style={styles.brandContent}>
        <Animated.View
          style={{
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          }}
        >
          <Image
            source={require("../assets/images/va-logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.textContent,
            { opacity: contentOpacity },
          ]}
        >
          <Text style={styles.brandName}>FIFTH AVENUE</Text>

          <View style={styles.taglineContainer}>
            <View style={styles.line} />
            <Text style={styles.tagline}>
              Creative. Connected. Influential.
            </Text>
            <View style={styles.line} />
          </View>
        </Animated.View>
      </View>

      {/* Bottom animated waves */}
      <Animated.View
        style={[
          styles.bottomWaves,
          { transform: [{ translateY: waveTranslate }] },
        ]}
      >
        <Svg
          width={width}
          height={height * 0.43}
          viewBox="0 0 390 370"
          preserveAspectRatio="xMidYMax slice"
        >
          <Path
            d="M0 130 C75 65 115 85 180 120 C245 160 305 55 390 35 L390 370 H0 Z"
            fill="#DAD9FF"
            opacity={0.55}
          />

          <Path
            d="M0 180 C90 120 130 165 190 180 C265 200 320 85 390 85 L390 370 H0 Z"
            fill="#AEB7F2"
            opacity={0.65}
          />

          <Path
            d="M0 235 C85 160 130 195 190 205 C260 220 315 115 390 110 L390 370 H0 Z"
            fill="#666ED1"
            opacity={0.85}
          />

          <Path
            d="M0 290 C100 205 145 250 210 245 C280 240 330 165 390 145 L390 370 H0 Z"
            fill="#263A88"
          />

          <Path
            d="M0 335 C90 265 145 285 220 275 C290 265 340 220 390 205 L390 370 H0 Z"
            fill="#111D56"
          />
        </Svg>
      </Animated.View>

      {/* Loading indicator */}
      <View style={styles.loadingContainer}>
        <View style={styles.progressBackground}>
          <Animated.View
            style={[
              styles.progressFill,
              { width: progressWidth },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F6FF",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },

  topDecoration: {
    position: "absolute",
    top: 0,
    left: 0,
  },

  brandContent: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -height * 0.02,
    zIndex: 2,
  },

  logo: {
    width: 340,
    height: 230,
  },

  textContent: {
    alignItems: "center",
    marginTop: -5,
  },

  brandName: {
    fontSize: 27,
    fontWeight: "700",
    color: "#101B50",
    letterSpacing: 7,
    textAlign: "center",
  },

  taglineContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
    gap: 12,
  },

  tagline: {
    fontSize: 13,
    color: "#626D94",
    letterSpacing: 0.4,
    fontWeight: "500",
  },

  line: {
    width: 22,
    height: 1,
    backgroundColor: "#A3A8D6",
  },

  bottomWaves: {
    position: "absolute",
    bottom: -2,
    left: 0,
    width: "100%",
    zIndex: 1,
  },

  loadingContainer: {
    position: "absolute",
    bottom: height * 0.12,
    alignItems: "center",
    zIndex: 3,
  },

  progressBackground: {
    width: 160,
    height: 5,
    backgroundColor: "rgba(255,255,255,0.45)",
    borderRadius: 10,
    overflow: "hidden",
  },

  progressFill: {
    height: 5,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
  },
});