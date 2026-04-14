import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useSignIn, useSignUp, useOAuth } from "@clerk/clerk-expo";
import * as Linking from "expo-linking";
import { useConvex } from "convex/react";
import { useSyncUserWithConvex } from "../hooks/useSyncUserWithConvex";
import {
  colors,
  radii,
  card as cardStyle,
} from "../../constants/theme";
import LiveetLogo from "../../assets/images/liveet-logo-ios.png";

type AuthStep = "email" | "otp";

export default function AuthScreen() {
  const router = useRouter();
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } =
    useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } =
    useSignUp();
  const convex = useConvex();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<AuthStep>("email");
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { syncUser } = useSyncUserWithConvex();

  const googleOAuth = useOAuth({ strategy: "oauth_google" });
  const appleOAuth = useOAuth({ strategy: "oauth_apple" });

  const navigateAfterAuth = useCallback(async () => {
    await syncUser();
    try {
      // Retry query — Convex JWT may not be ready immediately after setActive
      let status = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        status = await (convex as any).query(
          "onboarding:getOnboardingStatus",
          {},
        );
        if (status !== null) break;
        if (attempt < 4) {
          await new Promise((resolve) =>
            setTimeout(resolve, 300 + attempt * 300),
          );
        }
      }
      if (status?.hasCompletedOnboarding) {
        router.replace("/(app)/(tabs)");
      } else if (
        status?.onboardingProfile ||
        status?.businessProfile ||
        status?.property
      ) {
        // User already started manual onboarding — go to hub
        router.replace("/(onboarding)" as any);
      } else {
        // Fresh user — show manual vs import choice
        router.replace("/(onboarding)/import-method" as any);
      }
    } catch {
      router.replace("/(app)/(tabs)");
    }
  }, [convex, router, syncUser]);

  const handleSendCode = useCallback(async () => {
    if (!signInLoaded || !signUpLoaded) return;
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    setLoading(true);
    setError(null);

    try {
      const { supportedFirstFactors } = await signIn.create({
        identifier: trimmedEmail,
      });
      const emailCodeFactor = supportedFirstFactors?.find(
        (factor) => factor.strategy === "email_code",
      );
      if (emailCodeFactor && "emailAddressId" in emailCodeFactor) {
        await signIn.prepareFirstFactor({
          strategy: "email_code",
          emailAddressId: emailCodeFactor.emailAddressId,
        });
        setIsNewUser(false);
        setStep("otp");
      } else {
        setError("Email sign-in is not available for this account.");
      }
    } catch {
      try {
        await signUp.create({ emailAddress: trimmedEmail });
        try {
          const missing = signUp?.missingFields ?? [];
          if (missing.length > 0) {
            const nameFromEmail = trimmedEmail.split("@")[0] || "User";
            const updatePayload: Record<string, string> = {};
            if (missing.includes("first_name"))
              updatePayload.firstName = nameFromEmail;
            if (missing.includes("last_name"))
              updatePayload.lastName = nameFromEmail;
            if (missing.includes("password")) {
              updatePayload.password = `${nameFromEmail}-${Math.random()
                .toString(36)
                .slice(2)}-${Date.now().toString(36)}`;
            }
            if (missing.includes("username"))
              updatePayload.username = nameFromEmail;
            if (Object.keys(updatePayload).length > 0)
              await signUp.update(updatePayload);
          }
        } catch {}
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setIsNewUser(true);
        setStep("otp");
      } catch (err: unknown) {
        const clerkError = err as { errors?: Array<{ message: string }> };
        setError(
          clerkError.errors?.[0]?.message ??
            "Something went wrong. Please try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [email, signInLoaded, signUpLoaded, signIn, signUp]);

  const handleVerifyCode = useCallback(
    async (otpOverride?: string) => {
      if (!signInLoaded || !signUpLoaded) return;
      const value = (otpOverride ?? code).trim();
      if (!value) return;
      setLoading(true);
      setError(null);
      try {
        if (isNewUser) {
          const result = await signUp.attemptEmailAddressVerification({
            code: value,
          });
          if (result.status === "complete") {
            if (result.createdSessionId)
              await setSignUpActive({ session: result.createdSessionId });
            await navigateAfterAuth();
            return;
          }
          setError(`Verification incomplete. Please try again.`);
        } else {
          const result = await signIn.attemptFirstFactor({
            strategy: "email_code",
            code: value,
          });
          if (result.status === "complete") {
            if (result.createdSessionId)
              await setSignInActive({ session: result.createdSessionId });
            await navigateAfterAuth();
            return;
          }
          setError(`Verification incomplete. Please try again.`);
        }
      } catch (err: unknown) {
        const clerkError = err as { errors?: Array<{ message: string }> };
        setError(
          clerkError.errors?.[0]?.message ?? "Invalid code. Please try again.",
        );
      } finally {
        setLoading(false);
      }
    },
    [
      code, isNewUser, signInLoaded, signUpLoaded,
      signIn, signUp, setSignInActive, setSignUpActive, navigateAfterAuth,
    ],
  );

  const handleOAuth = useCallback(
    async (provider: "google" | "apple") => {
      const oAuth = provider === "google" ? googleOAuth : appleOAuth;
      setLoading(true);
      setError(null);
      try {
        const { startOAuthFlow } = oAuth;
        const { createdSessionId, setActive } = await startOAuthFlow({
          redirectUrl: Linking.createURL("/oauth-native-callback"),
        });
        if (createdSessionId && setActive) {
          await setActive({ session: createdSessionId });
          await navigateAfterAuth();
        }
        // If user cancelled, createdSessionId will be undefined - stay on auth screen
      } catch (err: unknown) {
        const clerkError = err as { errors?: Array<{ message: string }> };
        setError(
          clerkError.errors?.[0]?.message ??
            "OAuth sign-in failed. Please try again.",
        );
      } finally {
        setLoading(false);
      }
    },
    [googleOAuth, appleOAuth, navigateAfterAuth],
  );

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.headerSection}>
          <View style={s.logoWrapper}>
            <Image source={LiveetLogo} style={s.logoImage} />
          </View>
          <View style={s.headerText}>
            <Text style={s.appName}>Liveet</Text>
            <Text style={s.appTagline}>Smart property operations</Text>
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.title}>
            {step === "email" ? "Welcome back" : "Check your inbox"}
          </Text>
          <Text style={s.subtitle}>
            {step === "email"
              ? "Use your work email to access dashboards, tenants and payouts."
              : `We sent a 6-digit code to ${email}. Enter it below to continue.`}
          </Text>

          {error ? <Text style={s.error}>{error}</Text> : null}

          {step === "email" ? (
            <>
              <Text style={s.label}>Email address</Text>
              <TextInput
                style={s.input}
                placeholder="you@example.com"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                editable={!loading}
              />
              <Pressable
                style={[
                  s.primaryBtn,
                  (loading || !email.trim()) && s.primaryBtnDisabled,
                ]}
                onPress={handleSendCode}
                disabled={loading || !email.trim()}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={s.primaryBtnText}>Continue</Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <Text style={s.label}>Verification code</Text>
              <TextInput
                style={s.input}
                placeholder="000000"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                value={code}
                onChangeText={(text) => {
                  setCode(text);
                  if (text.length === 6) void handleVerifyCode(text);
                }}
                maxLength={6}
                editable={!loading}
              />
              <Pressable
                style={[
                  s.primaryBtn,
                  (loading || !code.trim()) && s.primaryBtnDisabled,
                ]}
                onPress={() => handleVerifyCode()}
                disabled={loading || !code.trim()}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={s.primaryBtnText}>Verify</Text>
                )}
              </Pressable>
              <Pressable
                style={s.linkBtn}
                onPress={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                  setIsNewUser(false);
                }}
                disabled={loading}
              >
                <Text style={s.linkText}>Use a different email</Text>
              </Pressable>
            </>
          )}

          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>or</Text>
            <View style={s.dividerLine} />
          </View>

          <View style={s.oauthRow}>
            <Pressable
              style={s.oauthBtn}
              onPress={() => handleOAuth("google")}
              disabled={loading}
            >
              <Text style={s.oauthIcon}>G</Text>
              <Text style={s.oauthLabel}>Google</Text>
            </Pressable>
            <Pressable
              style={s.oauthBtn}
              onPress={() => handleOAuth("apple")}
              disabled={loading}
            >
              <Text style={s.oauthIcon}>{"\uF8FF"}</Text>
              <Text style={s.oauthLabel}>Apple</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  headerSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  logoWrapper: {
    width: 56,
    height: 56,
    borderRadius: 20,
    overflow: "hidden",
    marginRight: 14,
  },
  logoImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  headerText: {
    flexShrink: 1,
  },
  appName: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.navy,
    letterSpacing: -0.3,
  },
  appTagline: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  card: {
    ...cardStyle,
    width: "100%",
    maxWidth: 420,
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.navy,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 22,
    lineHeight: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    backgroundColor: colors.inputBg,
    color: colors.navy,
    marginBottom: 16,
  },
  error: {
    color: colors.error,
    marginBottom: 12,
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  primaryBtn: {
    borderRadius: radii.pill,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    minHeight: 50,
  },
  primaryBtnDisabled: { backgroundColor: colors.primaryLight },
  primaryBtnText: { fontSize: 16, fontWeight: "700", color: colors.white },
  linkBtn: { marginTop: 14, alignItems: "center" },
  linkText: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 22,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: {
    marginHorizontal: 14,
    fontSize: 12,
    fontWeight: "500",
    color: colors.muted,
  },
  oauthRow: { flexDirection: "row", gap: 12 },
  oauthBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radii.pill,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  oauthIcon: { fontSize: 16, fontWeight: "800", color: colors.navy },
  oauthLabel: { fontSize: 14, fontWeight: "600", color: colors.navy },
});
