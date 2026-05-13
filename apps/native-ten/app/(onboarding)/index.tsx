import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConvex } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";

const EMOJIS = {
  house: require("@/assets/fluent-emojis/house_3d.webp"),
  waving: require("@/assets/fluent-emojis/waving_hand_3d.webp"),
  party: require("@/assets/fluent-emojis/party_popper_3d.webp"),
  check: require("@/assets/fluent-emojis/check_mark_button_3d.webp"),
  alarm: require("@/assets/fluent-emojis/alarm_clock_3d.webp"),
  receipt: require("@/assets/fluent-emojis/receipt_3d.webp"),
  moneyWings: require("@/assets/fluent-emojis/money_with_wings_3d.webp"),
  key: require("@/assets/fluent-emojis/key_3d.webp"),
  card: require("@/assets/fluent-emojis/credit_card_3d.webp"),
  calendar: require("@/assets/fluent-emojis/calendar_3d.webp"),
  sparkles: require("@/assets/fluent-emojis/sparkles_3d.webp"),
  magnify: require("@/assets/fluent-emojis/magnifying_glass_3d.webp"),
  coin: require("@/assets/fluent-emojis/coin_3d.webp"),
  people: require("@/assets/fluent-emojis/people_hugging_3d.webp"),
};

type MatchedTenant = {
  importedTenantId: string;
  tenantName: string;
  propertyName: string | null;
  propertyCity: string | null;
  propertyState: string | null;
  propertyLine1: string | null;
  roomNumber: string | null;
  roomType: string | null;
  rent: number | null;
  moveInDate: string | null;
};

type Step =
  | "welcome"
  | "name"
  | "pain_checklist"
  | "why_liveet"
  | "details"
  | "right_place"
  | "all_set"
  | "verify";

type PainPoint = {
  id: string;
  label: string;
  emoji?: keyof typeof EMOJIS;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
};

const PAIN_POINTS: PainPoint[] = [
  { id: "reminders", label: "Forgetting rent due dates", emoji: "alarm" },
  { id: "maintenance", label: "Maintenance requests ignored", icon: "construct-outline" },
  { id: "communication", label: "Hard to reach landlord", icon: "chatbubble-ellipses-outline" },
  { id: "history", label: "No clear payment history", emoji: "receipt" },
  { id: "charges", label: "Unclear extra charges", emoji: "moneyWings" },
  { id: "movein", label: "Move-in / move-out hassle", emoji: "key" },
];

type Feature = {
  emoji?: keyof typeof EMOJIS;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  desc: string;
};

const WHY_FEATURES: Feature[] = [
  {
    emoji: "card",
    title: "Pay rent in seconds",
    desc: "One tap to pay. Get instant confirmation and full payment history.",
  },
  {
    icon: "chatbubble-outline",
    title: "Message your operator",
    desc: "Direct chat with your landlord — no calls, no waiting.",
  },
  {
    emoji: "key",
    title: "Raise requests digitally",
    desc: "Maintenance, move-out, late entry — all tracked in one place.",
  },
  {
    emoji: "alarm",
    title: "Never miss a reminder",
    desc: "Smart alerts so your rent is always on time.",
  },
];

const ORDERED_STEPS: Step[] = [
  "welcome",
  "name",
  "pain_checklist",
  "why_liveet",
  "details",
  "right_place",
  "all_set",
];

const PROGRESS_STEPS = ORDERED_STEPS.filter((s) => s !== "all_set");

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const convex = useConvex();

  const [step, setStep] = useState<Step>("welcome");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isAlreadyInLiveet, setIsAlreadyInLiveet] = useState<boolean | null>(null);
  const [selectedPains, setSelectedPains] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [matchedTenant, setMatchedTenant] = useState<MatchedTenant | null>(null);

  const progressIndex = PROGRESS_STEPS.indexOf(step as (typeof PROGRESS_STEPS)[number]);
  const showProgress = progressIndex >= 0;

  function goNext(nextStep: Step) {
    setStep(nextStep);
  }

  function togglePain(id: string) {
    setSelectedPains((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const canSubmitDetails =
    name.trim().length > 0 && phone.trim().length > 0 && isAlreadyInLiveet !== null;

  async function handleDetailsContinue() {
    if (!canSubmitDetails) return;
    setLoading(true);
    try {
      if (isAlreadyInLiveet) {
        const match = await (convex as any).query("users:lookupImportedTenantByPhone", {
          phone: phone.trim(),
        });
        if (match) {
          setMatchedTenant(match);
          setStep("verify");
          return;
        }
      }
      setStep("right_place");
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function submitOnboarding(skipToLiveet?: boolean) {
    setLoading(true);
    try {
      const resolvedIsAlreadyInLiveet =
        typeof skipToLiveet === "boolean" ? skipToLiveet : isAlreadyInLiveet!;
      await (convex as any).mutation("users:completeTenantOnboarding", {
        name: name.trim(),
        phone: phone.trim(),
        isAlreadyInLiveet: resolvedIsAlreadyInLiveet,
        ...(resolvedIsAlreadyInLiveet && matchedTenant
          ? { importedTenantId: matchedTenant.importedTenantId }
          : {}),
      });
      setStep("all_set");
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {showProgress && (
        <View style={[styles.progressWrap, { paddingTop: insets.top + 12 }]}>
          {PROGRESS_STEPS.map((s, i) => (
            <View
              key={s}
              style={[styles.progressDot, i <= progressIndex && styles.progressDotActive]}
            />
          ))}
        </View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: showProgress ? 16 : insets.top + 32,
            paddingBottom: insets.bottom + 40,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── WELCOME ── */}
        {step === "welcome" && (
          <View style={styles.centeredContent}>
            <View style={styles.bigIconWrap}>
              <Image source={EMOJIS.house} style={styles.bigEmoji} />
            </View>
            <Text style={styles.heroTitle}>Welcome to Liveet</Text>
            <Text style={styles.heroSubtitle}>
              Your rental life, simplified. From rent payments to maintenance — all in one place.
            </Text>
            <View style={styles.tagRow}>
              <Tag label="Pay rent" />
              <Tag label="Chat with operator" />
              <Tag label="Raise requests" />
            </View>
            <CTAButton label="Get started" onPress={() => goNext("name")} />
          </View>
        )}

        {/* ── NAME ── */}
        {step === "name" && (
          <View style={styles.stepContent}>
            <View style={styles.stepIconWrap}>
              <Image source={EMOJIS.waving} style={styles.stepEmoji} />
            </View>
            <Text style={styles.stepEyebrow}>Step 1 of 5</Text>
            <Text style={styles.stepTitle}>What should we call you?</Text>
            <Text style={styles.stepSubtitle}>
              We'll personalise your experience based on your name.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Your full name"
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoFocus
            />
            <CTAButton
              label="Continue"
              onPress={() => goNext("pain_checklist")}
              disabled={name.trim().length === 0}
            />
          </View>
        )}

        {/* ── PAIN CHECKLIST ── */}
        {step === "pain_checklist" && (
          <View style={styles.stepContent}>
            <View style={styles.stepIconWrap}>
              <Image source={EMOJIS.sparkles} style={styles.stepEmoji} />
            </View>
            <Text style={styles.stepEyebrow}>Step 2 of 5</Text>
            <Text style={styles.stepTitle}>
              What frustrates you most, {name.split(" ")[0]}?
            </Text>
            <Text style={styles.stepSubtitle}>Pick all that apply.</Text>
            <View style={styles.painGrid}>
              {PAIN_POINTS.map((p) => {
                const active = selectedPains.has(p.id);
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.painCard, active && styles.painCardActive]}
                    onPress={() => togglePain(p.id)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.painIconWrap, active && styles.painIconWrapActive]}>
                      {p.emoji ? (
                        <Image
                          source={EMOJIS[p.emoji]}
                          style={active ? styles.painEmojiActive : styles.painEmoji}
                        />
                      ) : (
                        <Ionicons
                          name={p.icon!}
                          size={20}
                          color={active ? "#fff" : colors.navy}
                        />
                      )}
                    </View>
                    <Text style={[styles.painLabel, active && styles.painLabelActive]}>
                      {p.label}
                    </Text>
                    {active && (
                      <View style={styles.checkBadge}>
                        <Ionicons name="checkmark" size={11} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <CTAButton label="Continue" onPress={() => goNext("why_liveet")} />
          </View>
        )}

        {/* ── WHY LIVEET ── */}
        {step === "why_liveet" && (
          <View style={styles.stepContent}>
            <View style={styles.stepIconWrap}>
              <Image source={EMOJIS.coin} style={styles.stepEmoji} />
            </View>
            <Text style={styles.stepEyebrow}>Step 3 of 5</Text>
            <Text style={styles.stepTitle}>Here's how Liveet fixes that</Text>
            <Text style={styles.stepSubtitle}>Built specifically for tenants like you.</Text>
            <View style={styles.featuresWrap}>
              {WHY_FEATURES.map((f) => (
                <View key={f.title} style={styles.featureCard}>
                  <View style={styles.featureIconWrap}>
                    {f.emoji ? (
                      <Image source={EMOJIS[f.emoji]} style={styles.featureEmoji} />
                    ) : (
                      <Ionicons name={f.icon!} size={22} color={colors.navy} />
                    )}
                  </View>
                  <View style={styles.featureText}>
                    <Text style={styles.featureTitle}>{f.title}</Text>
                    <Text style={styles.featureDesc}>{f.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
            <CTAButton label="Sounds good!" onPress={() => goNext("details")} />
          </View>
        )}

        {/* ── DETAILS ── */}
        {step === "details" && (
          <View style={styles.stepContent}>
            <View style={styles.stepIconWrap}>
              <Image source={EMOJIS.calendar} style={styles.stepEmoji} />
            </View>
            <Text style={styles.stepEyebrow}>Step 4 of 5</Text>
            <Text style={styles.stepTitle}>A couple more details</Text>
            <Text style={styles.stepSubtitle}>
              This helps us connect you to your property and operator.
            </Text>

            <Text style={styles.fieldLabel}>Contact number</Text>
            <TextInput
              style={styles.input}
              placeholder="Your phone number"
              placeholderTextColor={colors.muted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              editable={!loading}
            />

            <Text style={[styles.fieldLabel, { marginTop: 20 }]}>
              Are you already living in a Liveet property?
            </Text>
            <View style={styles.optionRow}>
              <TouchableOpacity
                style={[styles.option, isAlreadyInLiveet === true && styles.optionActive]}
                onPress={() => setIsAlreadyInLiveet(true)}
                disabled={loading}
              >
                <Ionicons
                  name="home"
                  size={16}
                  color={isAlreadyInLiveet === true ? "#fff" : colors.muted}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[styles.optionText, isAlreadyInLiveet === true && styles.optionTextActive]}
                >
                  Yes, I am
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.option, isAlreadyInLiveet === false && styles.optionActive]}
                onPress={() => setIsAlreadyInLiveet(false)}
                disabled={loading}
              >
                <Ionicons
                  name="search"
                  size={16}
                  color={isAlreadyInLiveet === false ? "#fff" : colors.muted}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[styles.optionText, isAlreadyInLiveet === false && styles.optionTextActive]}
                >
                  Not yet
                </Text>
              </TouchableOpacity>
            </View>

            <CTAButton
              label="Continue"
              onPress={() => void handleDetailsContinue()}
              disabled={!canSubmitDetails}
              loading={loading}
            />
          </View>
        )}

        {/* ── RIGHT PLACE ── */}
        {step === "right_place" && (
          <View style={styles.centeredContent}>
            <View style={[styles.bigIconWrap, { backgroundColor: "#DCFCE7" }]}>
              <Image source={EMOJIS.check} style={styles.bigEmoji} />
            </View>
            <Text style={styles.heroTitle}>You're in the right place!</Text>
            <Text style={styles.heroSubtitle}>
              Thousands of tenants manage their rental life with Liveet. You're about to join them.
            </Text>
            <View style={styles.bulletCard}>
              <BulletRow text="Pay rent without calling anyone" />
              <BulletRow text="Raise maintenance requests instantly" />
              <BulletRow text="Chat directly with your operator" />
              <BulletRow text="Track every payment, dispute-free" />
            </View>
            <CTAButton
              label="Let's go"
              onPress={() => void submitOnboarding()}
              loading={loading}
            />
          </View>
        )}

        {/* ── ALL SET ── */}
        {step === "all_set" && (
          <View style={[styles.centeredContent, { paddingTop: insets.top + 40 }]}>
            <View style={[styles.bigIconWrap, { backgroundColor: "#FEF9C3" }]}>
              <Image source={EMOJIS.party} style={styles.bigEmoji} />
            </View>
            <Text style={styles.heroTitle}>You're all set,{"\n"}{name.split(" ")[0]}!</Text>
            <Text style={styles.heroSubtitle}>
              Your account is ready. Explore your dashboard, pay rent, and connect with your operator.
            </Text>
            <CTAButton
              label="Go to dashboard"
              onPress={() => router.replace("/(app)")}
            />
          </View>
        )}

        {/* ── VERIFY ── */}
        {step === "verify" && matchedTenant && (
          <View style={styles.stepContent}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => { setStep("details"); setMatchedTenant(null); }}
              disabled={loading}
            >
              <Ionicons name="arrow-back" size={20} color={colors.navy} />
            </TouchableOpacity>
            <View style={styles.stepIconWrap}>
              <Image source={EMOJIS.magnify} style={styles.stepEmoji} />
            </View>
            <Text style={styles.stepTitle}>Is this you?</Text>
            <Text style={styles.stepSubtitle}>
              We found a record matching your number. Confirm if the details below are yours.
            </Text>
            <View style={styles.matchCard}>
              <DetailRow icon="person-outline" label="Name" value={matchedTenant.tenantName} />
              {(matchedTenant.propertyName || matchedTenant.propertyCity) && (
                <DetailRow
                  icon="home-outline"
                  label="Property"
                  value={[
                    matchedTenant.propertyName,
                    matchedTenant.propertyCity,
                    matchedTenant.propertyState,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                />
              )}
              {matchedTenant.propertyLine1 && (
                <DetailRow icon="location-outline" label="Address" value={matchedTenant.propertyLine1} />
              )}
              {matchedTenant.roomNumber && (
                <DetailRow
                  icon="bed-outline"
                  label="Room"
                  value={`Room ${matchedTenant.roomNumber}${matchedTenant.roomType ? ` · ${matchedTenant.roomType}` : ""}`}
                />
              )}
              {matchedTenant.rent != null && (
                <DetailRow
                  icon="cash-outline"
                  label="Rent"
                  value={`₹${matchedTenant.rent.toLocaleString("en-IN")} / month`}
                />
              )}
              {matchedTenant.moveInDate && (
                <DetailRow icon="calendar-outline" label="Move-in" value={matchedTenant.moveInDate} />
              )}
            </View>
            <CTAButton
              label="Yes, that's me"
              onPress={() => void submitOnboarding(true)}
              loading={loading}
            />
            <TouchableOpacity
              style={[styles.ghostBtn, loading && { opacity: 0.4 }]}
              onPress={() => void submitOnboarding(false)}
              disabled={loading}
            >
              <Text style={styles.ghostBtnText}>No, this isn't me</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function CTAButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.ctaBtn, (disabled || loading) && styles.ctaBtnDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.ctaBtnText}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

function BulletRow({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot}>
        <Ionicons name="checkmark" size={12} color="#fff" />
      </View>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIconWrap}>
        <Ionicons name={icon} size={15} color={colors.navy} />
      </View>
      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    backgroundColor: "#fff",
  },

  progressWrap: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 24,
    paddingBottom: 4,
    backgroundColor: "#fff",
  },
  progressDot: {
    flex: 1,
    height: 3,
    borderRadius: 99,
    backgroundColor: "#E5E7EB",
  },
  progressDotActive: {
    backgroundColor: colors.navy,
  },

  centeredContent: {
    flex: 1,
    paddingTop: 32,
  },
  stepContent: {
    flex: 1,
    paddingTop: 20,
  },

  // Big hero icon (welcome / right place / all set)
  bigIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  bigEmoji: {
    width: 48,
    height: 48,
  },

  // Step icon (smaller, top of step screens)
  stepIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  stepEmoji: {
    width: 30,
    height: 30,
  },

  heroTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.navy,
    marginBottom: 12,
    lineHeight: 36,
  },
  heroSubtitle: {
    fontSize: 16,
    color: colors.muted,
    lineHeight: 24,
    marginBottom: 24,
  },

  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 36,
  },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  tagText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy,
  },

  stepEyebrow: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.navy,
    marginBottom: 8,
    lineHeight: 32,
  },
  stepSubtitle: {
    fontSize: 15,
    color: colors.muted,
    lineHeight: 22,
    marginBottom: 24,
  },

  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.navy,
    backgroundColor: "#F8FAFC",
    marginBottom: 8,
  },

  painGrid: {
    gap: 10,
    marginBottom: 28,
  },
  painCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 14,
    backgroundColor: "#F8FAFC",
    gap: 12,
  },
  painCardActive: {
    borderColor: colors.navy,
    backgroundColor: "#F1F5F9",
  },
  painIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  painIconWrapActive: {
    backgroundColor: colors.navy,
  },
  painEmoji: {
    width: 22,
    height: 22,
  },
  painEmojiActive: {
    width: 22,
    height: 22,
    tintColor: undefined,
  },
  painLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: colors.navy,
  },
  painLabelActive: {
    color: colors.navy,
  },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 99,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
  },

  featuresWrap: {
    gap: 12,
    marginBottom: 28,
  },
  featureCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 16,
    backgroundColor: "#F8FAFC",
    gap: 14,
  },
  featureIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  featureEmoji: {
    width: 26,
    height: 26,
  },
  featureText: { flex: 1 },
  featureTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 3,
  },
  featureDesc: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 19,
  },

  optionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 28,
    marginTop: 2,
  },
  option: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingVertical: 14,
    backgroundColor: "#F8FAFC",
  },
  optionActive: {
    borderColor: colors.navy,
    backgroundColor: colors.navy,
  },
  optionText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.muted,
  },
  optionTextActive: {
    color: "#fff",
  },

  bulletCard: {
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 20,
    backgroundColor: "#F8FAFC",
    gap: 14,
    marginBottom: 32,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bulletDot: {
    width: 22,
    height: 22,
    borderRadius: 99,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  bulletText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy,
    flex: 1,
  },

  ctaBtn: {
    backgroundColor: colors.navy,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: "center",
    marginTop: 4,
  },
  ctaBtnDisabled: {
    opacity: 0.35,
  },
  ctaBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  ghostBtn: {
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 10,
  },
  ghostBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.muted,
  },

  backBtn: {
    alignSelf: "flex-start",
    marginBottom: 20,
    padding: 4,
  },

  matchCard: {
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingVertical: 4,
    paddingHorizontal: 16,
    marginBottom: 20,
    backgroundColor: "#F8FAFC",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  detailIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 1,
  },
  detailText: { flex: 1 },
  detailLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy,
    lineHeight: 20,
  },
});
