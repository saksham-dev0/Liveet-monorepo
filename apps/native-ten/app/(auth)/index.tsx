import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  Pressable,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useSignIn, useSignUp, useOAuth } from "@clerk/clerk-expo";
import { useSyncUserWithConvex } from "../hooks/useSyncUserWithConvex";

type AuthStep = "email" | "otp";

export default function AuthScreen() {
  const router = useRouter();
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } =
    useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } =
    useSignUp();

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
    // Kick off Convex user sync, but don't block navigation on it.
    void syncUser();
    router.replace("/(app)");
  }, [router, syncUser]);

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
        await signUp.create({
          emailAddress: trimmedEmail,
        });

        // #region agent log
        fetch(
          "http://127.0.0.1:7705/ingest/31413d30-c336-48c7-b2f1-ff91680701eb",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Debug-Session-Id": "8ae98b",
            },
            body: JSON.stringify({
              sessionId: "8ae98b",
              runId: "pre-fix-1",
              hypothesisId: "H-missing-fields-after-create",
              location:
                "apps/native-op/app/(auth)/index.tsx:handleSendCode:afterSignUpCreate",
              message: "signUp fields right after create",
              data: {
                missingFields: signUp?.missingFields,
                requiredFields: signUp?.requiredFields,
              },
              timestamp: Date.now(),
            }),
          },
        ).catch(() => {});
        // #endregion agent log

        // Auto-fill common required fields (first name, last name, username, password)
        // so that sign up can complete without extra UI.
        try {
          const missing = signUp?.missingFields ?? [];
          if (missing.length > 0) {
            const nameFromEmail = trimmedEmail.split("@")[0] || "User";
            const updatePayload: Record<string, string> = {};

            if (missing.includes("first_name")) {
              updatePayload.firstName = nameFromEmail;
            }
            if (missing.includes("last_name")) {
              updatePayload.lastName = nameFromEmail;
            }
            if (missing.includes("password")) {
              // Generate a random password if Clerk requires one.
              // Do NOT log or expose this value.
              const randomPassword = `${nameFromEmail}-${Math.random()
                .toString(36)
                .slice(2)}-${Date.now().toString(36)}`;
              
              updatePayload.password = randomPassword;
            }
            if (missing.includes("username")) {
              updatePayload.username = nameFromEmail;
            }

            if (Object.keys(updatePayload).length > 0) {
              await signUp.update(updatePayload);
            }

            // #region agent log
            fetch(
              "http://127.0.0.1:7705/ingest/31413d30-c336-48c7-b2f1-ff91680701eb",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-Debug-Session-Id": "8ae98b",
                },
                body: JSON.stringify({
                  sessionId: "8ae98b",
                  runId: "pre-fix-1",
                  hypothesisId: "H-missing-fields-after-update",
                  location:
                    "apps/native-op/app/(auth)/index.tsx:handleSendCode:afterSignUpUpdate",
                  message: "signUp fields after autofill update",
                  data: {
                    missingFields: signUp?.missingFields,
                    requiredFields: signUp?.requiredFields,
                  },
                  timestamp: Date.now(),
                }),
              },
            ).catch(() => {});
            // #endregion agent log
          }
        } catch {
          // If we can't auto-fill, we'll let verification surface the error.
        }

        await signUp.prepareEmailAddressVerification({
          strategy: "email_code",
        });

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

          // #region agent log
          fetch(
            "http://127.0.0.1:7705/ingest/31413d30-c336-48c7-b2f1-ff91680701eb",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Debug-Session-Id": "8ae98b",
              },
              body: JSON.stringify({
                sessionId: "8ae98b",
                runId: "pre-fix-1",
                hypothesisId: "H-status-signup-verification",
                location:
                  "apps/native-op/app/(auth)/index.tsx:handleVerifyCode:isNewUser",
                message: "signUp verification result",
                data: {
                  status: result.status,
                  missingFields: signUp?.missingFields,
                  requiredFields: signUp?.requiredFields,
                },
                timestamp: Date.now(),
              }),
            },
          ).catch(() => {});
          // #endregion agent log

          if (result.status === "complete") {
            if (result.createdSessionId) {
              await setSignUpActive({ session: result.createdSessionId });
            }
            await navigateAfterAuth();
            return;
          }

          setError(
            `Verification incomplete. Status: ${result.status ?? "unknown"}. Please try again.`,
          );
        } else {
          const result = await signIn.attemptFirstFactor({
            strategy: "email_code",
            code: value,
          });

          if (result.status === "complete") {
            if (result.createdSessionId) {
              await setSignInActive({ session: result.createdSessionId });
            }
            await navigateAfterAuth();
            return;
          }

          setError(
            `Verification incomplete. Status: ${result.status ?? "unknown"}. Please try again.`,
          );
        }
      } catch (err: unknown) {
        const clerkError = err as { errors?: Array<{ message: string }> };
        setError(
          clerkError.errors?.[0]?.message ??
            "Invalid code. Please try again.",
        );
      } finally {
        setLoading(false);
      }
    },
    [
      code,
      isNewUser,
      signInLoaded,
      signUpLoaded,
      signIn,
      signUp,
      setSignInActive,
      setSignUpActive,
      navigateAfterAuth,
    ],
  );

  const handleOAuth = useCallback(
    async (provider: "google" | "apple") => {
      const oAuth = provider === "google" ? googleOAuth : appleOAuth;
      setLoading(true);
      setError(null);
      try {
        const { startOAuthFlow } = oAuth;
        const { createdSessionId, setActive } = await startOAuthFlow();

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
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>
          {step === "email" ? "Welcome" : "Enter verification code"}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {step === "email" ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              editable={!loading}
            />
            <Button
              title={loading ? "Sending..." : "Continue"}
              onPress={handleSendCode}
              disabled={loading || !email.trim()}
            />
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>{`Sent to ${email}`}</Text>
            <TextInput
              style={styles.input}
              placeholder="6-digit code"
              keyboardType="number-pad"
              value={code}
              onChangeText={(text) => {
                setCode(text);
                if (text.length === 6) {
                  void handleVerifyCode(text);
                }
              }}
              maxLength={6}
              editable={!loading}
            />
            <Button
              title={loading ? "Verifying..." : "Verify"}
              onPress={() => handleVerifyCode()}
              disabled={loading || !code.trim()}
            />
            <Pressable
              style={styles.linkButton}
              onPress={() => {
                setStep("email");
                setCode("");
                setError(null);
                setIsNewUser(false);
              }}
              disabled={loading}
            >
              <Text style={styles.linkText}>Use a different email</Text>
            </Pressable>
          </>
        )}

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerLabel}>or continue with</Text>
          <View style={styles.divider} />
        </View>

        <View style={styles.oauthRow}>
          <Button
            title="Google"
            onPress={() => handleOAuth("google")}
            disabled={loading}
          />
          <Button
            title="Apple"
            onPress={() => handleOAuth("apple")}
            disabled={loading}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "white",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    padding: 24,
    backgroundColor: "white",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 8,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 12,
  },
  error: {
    color: "#dc2626",
    marginBottom: 12,
    textAlign: "center",
  },
  linkButton: {
    marginTop: 8,
    alignItems: "center",
  },
  linkText: {
    color: "#4b5563",
    textDecorationLine: "underline",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  divider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#e5e7eb",
  },
  dividerLabel: {
    marginHorizontal: 8,
    fontSize: 12,
    color: "#6b7280",
  },
  oauthRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
});

