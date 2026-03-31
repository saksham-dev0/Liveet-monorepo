import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useConvex } from "convex/react";
import { useFocusEffect } from "@react-navigation/native";
import { colors, radii, cardShadow } from "../../constants/theme";

// ─── Types ───────────────────────────────────────────────────────────────────

type Community = {
  id: string;
  name: string;
  description: string;
  category: string;
  memberCount: number;
  isMember: boolean;
  creatorName: string;
};

type Hangout = {
  id: string;
  title: string;
  description: string;
  location: string;
  dateTime: string;
  maxAttendees: number | null;
  attendeeCount: number;
  status: string;
  isGoing: boolean;
  creatorName: string;
  communityName: string | null;
};

const COMMUNITY_CATEGORIES = [
  "General",
  "Students",
  "Working Professionals",
  "Sports & Fitness",
  "Food & Dining",
  "Gaming",
  "Arts & Culture",
  "Tech",
  "Other",
];

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  General: "globe-outline",
  Students: "school-outline",
  "Working Professionals": "briefcase-outline",
  "Sports & Fitness": "fitness-outline",
  "Food & Dining": "restaurant-outline",
  Gaming: "game-controller-outline",
  "Arts & Culture": "color-palette-outline",
  Tech: "code-slash-outline",
  Other: "ellipsis-horizontal-circle-outline",
};

const ACCENT_COLORS: Record<string, string> = {
  General: "#6366F1",
  Students: "#F59E0B",
  "Working Professionals": "#0EA5E9",
  "Sports & Fitness": "#10B981",
  "Food & Dining": "#F97316",
  Gaming: "#8B5CF6",
  "Arts & Culture": "#EC4899",
  Tech: "#14B8A6",
  Other: "#6B7280",
};

const TAB_BAR_CLEARANCE = 88;

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const convex = useConvex();
  const [activeTab, setActiveTab] = useState<"communities" | "hangouts">("communities");
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [showCreateHangout, setShowCreateHangout] = useState(false);

  const [communities, setCommunities] = useState<Community[] | null>(null);
  const [hangouts, setHangouts] = useState<Hangout[] | null>(null);
  const mountedRef = useRef(true);

  const refreshCommunities = useCallback(async () => {
    try {
      const data = await (convex as any).query("communities:listCommunities", {});
      if (mountedRef.current && Array.isArray(data)) setCommunities(data);
    } catch {
      if (mountedRef.current && communities === null) setCommunities([]);
    }
  }, [convex, communities]);

  const refreshHangouts = useCallback(async () => {
    try {
      const data = await (convex as any).query("communities:listHangouts", {});
      if (mountedRef.current && Array.isArray(data)) setHangouts(data);
    } catch {
      if (mountedRef.current && hangouts === null) setHangouts([]);
    }
  }, [convex, hangouts]);

  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;
      void refreshCommunities();
      void refreshHangouts();
      return () => {
        mountedRef.current = false;
      };
    }, [refreshCommunities, refreshHangouts])
  );

  const handleJoinCommunity = async (id: string) => {
    try {
      await (convex as any).mutation("communities:joinCommunity", { communityId: id });
      await refreshCommunities();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not join community.");
    }
  };

  const handleLeaveCommunity = async (id: string) => {
    try {
      await (convex as any).mutation("communities:leaveCommunity", { communityId: id });
      await refreshCommunities();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not leave community.");
    }
  };

  const handleJoinHangout = async (id: string) => {
    try {
      await (convex as any).mutation("communities:requestJoinHangout", { hangoutId: id });
      await refreshHangouts();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not join hangout.");
    }
  };

  const handleLeaveHangout = async (id: string) => {
    try {
      await (convex as any).mutation("communities:leaveHangout", { hangoutId: id });
      await refreshHangouts();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not leave hangout.");
    }
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Community</Text>
        <TouchableOpacity
          style={s.createBtn}
          onPress={() =>
            activeTab === "communities"
              ? setShowCreateCommunity(true)
              : setShowCreateHangout(true)
          }
        >
          <Ionicons name="add" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <View style={s.tabBar}>
        <TouchableOpacity
          style={[s.tab, activeTab === "communities" && s.tabActive]}
          onPress={() => setActiveTab("communities")}
        >
          <Ionicons
            name="people"
            size={16}
            color={activeTab === "communities" ? colors.white : colors.muted}
          />
          <Text style={[s.tabText, activeTab === "communities" && s.tabTextActive]}>
            Communities
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, activeTab === "hangouts" && s.tabActive]}
          onPress={() => setActiveTab("hangouts")}
        >
          <Ionicons
            name="calendar"
            size={16}
            color={activeTab === "hangouts" ? colors.white : colors.muted}
          />
          <Text style={[s.tabText, activeTab === "hangouts" && s.tabTextActive]}>
            Hangouts
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === "communities" ? (
        communities === null ? (
          <LoadingState />
        ) : communities.length === 0 ? (
          <EmptyState
            icon="people-circle-outline"
            title="No communities yet"
            subtitle="Be the first to create a community for tenants around you."
            cta="Create Community"
            onCta={() => setShowCreateCommunity(true)}
          />
        ) : (
          <FlatList
            data={communities}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[s.list, { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }]}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <CommunityCard
                community={item}
                onJoin={() => handleJoinCommunity(item.id)}
                onLeave={() => handleLeaveCommunity(item.id)}
              />
            )}
          />
        )
      ) : hangouts === null ? (
        <LoadingState />
      ) : hangouts.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title="No hangouts yet"
          subtitle="Plan a hangout and invite people in your community."
          cta="Create Hangout"
          onCta={() => setShowCreateHangout(true)}
        />
      ) : (
        <FlatList
          data={hangouts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <HangoutCard
              hangout={item}
              onJoin={() => handleJoinHangout(item.id)}
              onLeave={() => handleLeaveHangout(item.id)}
            />
          )}
        />
      )}

      {/* Modals */}
      <CreateCommunityModal
        visible={showCreateCommunity}
        onClose={() => setShowCreateCommunity(false)}
        onCreated={refreshCommunities}
      />
      <CreateHangoutModal
        visible={showCreateHangout}
        onClose={() => setShowCreateHangout(false)}
        onCreated={refreshHangouts}
      />
    </View>
  );
}

// ─── Community Card ───────────────────────────────────────────────────────────

function CommunityCard({
  community,
  onJoin,
  onLeave,
}: {
  community: Community;
  onJoin: () => Promise<void>;
  onLeave: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const accent = ACCENT_COLORS[community.category] ?? "#6366F1";
  const icon = CATEGORY_ICONS[community.category] ?? "globe-outline";

  const handleToggle = async () => {
    setLoading(true);
    try {
      community.isMember ? await onLeave() : await onJoin();
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.card}>
      <View style={[s.cardIconWrap, { backgroundColor: accent + "18" }]}>
        <Ionicons name={icon} size={26} color={accent} />
      </View>
      <View style={s.cardBody}>
        <View style={s.cardRow}>
          <Text style={s.cardTitle} numberOfLines={1}>
            {community.name}
          </Text>
          <View style={[s.categoryBadge, { backgroundColor: accent + "18" }]}>
            <Text style={[s.categoryBadgeText, { color: accent }]}>
              {community.category}
            </Text>
          </View>
        </View>
        {community.description ? (
          <Text style={s.cardSub} numberOfLines={2}>
            {community.description}
          </Text>
        ) : null}
        <View style={s.cardMeta}>
          <Ionicons name="people-outline" size={13} color={colors.muted} />
          <Text style={s.cardMetaText}>
            {community.memberCount} member{community.memberCount !== 1 ? "s" : ""}
          </Text>
          <Text style={s.dot}>·</Text>
          <Text style={s.cardMetaText}>by {community.creatorName}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[s.joinBtn, community.isMember && s.joinBtnActive]}
        onPress={handleToggle}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={community.isMember ? colors.muted : colors.white}
          />
        ) : (
          <Text style={[s.joinBtnText, community.isMember && s.joinBtnTextActive]}>
            {community.isMember ? "Leave" : "Join"}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Hangout Card ─────────────────────────────────────────────────────────────

function HangoutCard({
  hangout,
  onJoin,
  onLeave,
}: {
  hangout: Hangout;
  onJoin: () => Promise<void>;
  onLeave: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const spotsLeft =
    hangout.maxAttendees != null ? hangout.maxAttendees - hangout.attendeeCount : null;
  const full = spotsLeft !== null && spotsLeft <= 0;

  const handleToggle = async () => {
    setLoading(true);
    try {
      hangout.isGoing ? await onLeave() : await onJoin();
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.hangoutCard}>
      <View style={s.hangoutAccent} />
      <View style={s.hangoutContent}>
        <View style={s.hangoutTopRow}>
          <Text style={s.hangoutTitle} numberOfLines={1}>
            {hangout.title}
          </Text>
          {hangout.communityName ? (
            <View style={s.communityPill}>
              <Text style={s.communityPillText} numberOfLines={1}>
                {hangout.communityName}
              </Text>
            </View>
          ) : null}
        </View>

        {hangout.description ? (
          <Text style={s.hangoutSub} numberOfLines={2}>
            {hangout.description}
          </Text>
        ) : null}

        <View style={s.hangoutMeta}>
          {hangout.location ? (
            <View style={s.metaItem}>
              <Ionicons name="location-outline" size={13} color={colors.muted} />
              <Text style={s.metaText} numberOfLines={1}>
                {hangout.location}
              </Text>
            </View>
          ) : null}
          <View style={s.metaItem}>
            <Ionicons name="time-outline" size={13} color={colors.muted} />
            <Text style={s.metaText}>{hangout.dateTime}</Text>
          </View>
          <View style={s.metaItem}>
            <Ionicons name="people-outline" size={13} color={colors.muted} />
            <Text style={s.metaText}>
              {hangout.attendeeCount} going
              {spotsLeft !== null
                ? ` · ${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left`
                : ""}
            </Text>
          </View>
        </View>

        <View style={s.hangoutFooter}>
          <Text style={s.byText}>by {hangout.creatorName}</Text>
          <TouchableOpacity
            style={[
              s.goingBtn,
              hangout.isGoing && s.goingBtnActive,
              full && !hangout.isGoing && s.goingBtnDisabled,
            ]}
            onPress={handleToggle}
            disabled={loading || (full && !hangout.isGoing)}
          >
            {loading ? (
              <ActivityIndicator
                size="small"
                color={hangout.isGoing ? colors.muted : colors.white}
              />
            ) : (
              <>
                {hangout.isGoing ? (
                  <Ionicons name="checkmark" size={14} color={colors.muted} />
                ) : null}
                <Text style={[s.goingBtnText, hangout.isGoing && s.goingBtnTextActive]}>
                  {full && !hangout.isGoing ? "Full" : hangout.isGoing ? "Going" : "Join"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Create Community Modal ───────────────────────────────────────────────────

function CreateCommunityModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const convex = useConvex();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Community name is required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await (convex as any).mutation("communities:createCommunity", {
        name: name.trim(),
        description: description.trim() || undefined,
        category,
        isPublic: true,
      });
      setName("");
      setDescription("");
      setCategory("General");
      onClose();
      await onCreated();
    } catch (e: any) {
      setError(e.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={s.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={s.modalSheet}>
          <View style={s.modalHandle} />
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Create Community</Text>
            <TouchableOpacity onPress={onClose} style={s.modalClose}>
              <Ionicons name="close" size={22} color={colors.navy} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={s.fieldLabel}>Community Name *</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Koramangala Foodies"
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
              maxLength={60}
            />

            <Text style={s.fieldLabel}>Description</Text>
            <TextInput
              style={[s.input, s.textArea]}
              placeholder="What's this community about?"
              placeholderTextColor={colors.muted}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={200}
            />

            <Text style={s.fieldLabel}>Category</Text>
            <View style={s.categoryGrid}>
              {COMMUNITY_CATEGORIES.map((cat) => {
                const accent = ACCENT_COLORS[cat] ?? "#6B7280";
                const icon = CATEGORY_ICONS[cat] ?? "globe-outline";
                const selected = category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      s.categoryChip,
                      selected && { backgroundColor: accent, borderColor: accent },
                    ]}
                    onPress={() => setCategory(cat)}
                  >
                    <Ionicons
                      name={icon}
                      size={14}
                      color={selected ? colors.white : accent}
                    />
                    <Text
                      style={[
                        s.categoryChipText,
                        { color: selected ? colors.white : colors.navy },
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {error ? <Text style={s.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[s.submitBtn, loading && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={s.submitBtnText}>Create Community</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Create Hangout Modal ─────────────────────────────────────────────────────

function CreateHangoutModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const convex = useConvex();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [maxAttendees, setMaxAttendees] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Hangout title is required.");
      return;
    }
    if (!dateTime.trim()) {
      setError("Date & time is required.");
      return;
    }
    let parsedMaxAttendees: number | undefined;
    if (maxAttendees.trim()) {
      const n = parseInt(maxAttendees, 10);
      if (isNaN(n) || n <= 0 || String(n) !== maxAttendees.trim()) {
        setError("Max attendees must be a positive whole number.");
        return;
      }
      parsedMaxAttendees = n;
    }
    setLoading(true);
    setError("");
    try {
      await (convex as any).mutation("communities:createHangout", {
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        dateTime: dateTime.trim(),
        maxAttendees: parsedMaxAttendees,
      });
      setTitle("");
      setDescription("");
      setLocation("");
      setDateTime("");
      setMaxAttendees("");
      onClose();
      await onCreated();
    } catch (e: any) {
      setError(e.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={s.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={s.modalSheet}>
          <View style={s.modalHandle} />
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Create Hangout</Text>
            <TouchableOpacity onPress={onClose} style={s.modalClose}>
              <Ionicons name="close" size={22} color={colors.navy} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={s.fieldLabel}>Title *</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Weekend Cricket Match"
              placeholderTextColor={colors.muted}
              value={title}
              onChangeText={setTitle}
              maxLength={80}
            />

            <Text style={s.fieldLabel}>Description</Text>
            <TextInput
              style={[s.input, s.textArea]}
              placeholder="Tell people what to expect…"
              placeholderTextColor={colors.muted}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={300}
            />

            <Text style={s.fieldLabel}>Location</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Cubbon Park, Gate 2"
              placeholderTextColor={colors.muted}
              value={location}
              onChangeText={setLocation}
            />

            <Text style={s.fieldLabel}>Date & Time *</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Sat 5 Apr, 6:00 PM"
              placeholderTextColor={colors.muted}
              value={dateTime}
              onChangeText={setDateTime}
            />

            <Text style={s.fieldLabel}>Max Attendees</Text>
            <TextInput
              style={s.input}
              placeholder="Leave blank for unlimited"
              placeholderTextColor={colors.muted}
              value={maxAttendees}
              onChangeText={setMaxAttendees}
              keyboardType="number-pad"
            />

            {error ? <Text style={s.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[s.submitBtn, loading && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={s.submitBtnText}>Create Hangout</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Helper Components ────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={colors.navy} />
    </View>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
  cta,
  onCta,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  cta: string;
  onCta: () => void;
}) {
  return (
    <View style={s.center}>
      <View style={s.emptyCircle}>
        <Ionicons name={icon} size={44} color={colors.muted} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptySub}>{subtitle}</Text>
      <TouchableOpacity style={s.emptyCta} onPress={onCta}>
        <Text style={s.emptyCtaText}>{cta}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
  },
  headerTitle: { fontSize: 24, fontWeight: "800", color: colors.navy },
  createBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
  },

  tabBar: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: colors.surfaceGray,
    borderRadius: radii.pill,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    gap: 6,
    borderRadius: radii.pill,
  },
  tabActive: { backgroundColor: colors.navy },
  tabText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  tabTextActive: { color: colors.white },

  list: { paddingHorizontal: 16, gap: 12 },

  // Community Card
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    padding: 16,
    gap: 14,
    ...cardShadow,
  },
  cardIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardBody: { flex: 1, gap: 4 },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.navy, flexShrink: 1 },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill },
  categoryBadgeText: { fontSize: 11, fontWeight: "600" },
  cardSub: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  cardMetaText: { fontSize: 12, color: colors.muted },
  dot: { fontSize: 12, color: colors.muted },
  joinBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.navy,
    minWidth: 56,
    alignItems: "center",
    flexShrink: 0,
  },
  joinBtnActive: {
    backgroundColor: colors.surfaceGray,
    borderWidth: 1,
    borderColor: colors.border,
  },
  joinBtnText: { fontSize: 13, fontWeight: "700", color: colors.white },
  joinBtnTextActive: { color: colors.muted },

  // Hangout Card
  hangoutCard: {
    flexDirection: "row",
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    overflow: "hidden",
    ...cardShadow,
  },
  hangoutAccent: { width: 4, backgroundColor: colors.trendBadge },
  hangoutContent: { flex: 1, padding: 16, gap: 6 },
  hangoutTopRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  hangoutTitle: { fontSize: 15, fontWeight: "700", color: colors.navy, flexShrink: 1 },
  communityPill: {
    backgroundColor: colors.surfaceGray,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  communityPillText: { fontSize: 11, fontWeight: "600", color: colors.muted, maxWidth: 100 },
  hangoutSub: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  hangoutMeta: { gap: 4, marginTop: 2 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 12, color: colors.muted, flexShrink: 1 },
  hangoutFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  byText: { fontSize: 12, color: colors.muted },
  goingBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.navy,
  },
  goingBtnActive: {
    backgroundColor: colors.surfaceGray,
    borderWidth: 1,
    borderColor: colors.border,
  },
  goingBtnDisabled: {
    backgroundColor: colors.surfaceGray,
    borderWidth: 1,
    borderColor: colors.border,
  },
  goingBtnText: { fontSize: 13, fontWeight: "700", color: colors.white },
  goingBtnTextActive: { color: colors.muted },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalSheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: "90%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: colors.navy },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceGray,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy,
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    backgroundColor: colors.inputBg,
    color: colors.navy,
  },
  textArea: { minHeight: 80, textAlignVertical: "top", paddingTop: 13 },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
  },
  categoryChipText: { fontSize: 13, fontWeight: "500" },
  errorText: { color: colors.error, fontSize: 13, fontWeight: "500", marginTop: 12 },
  submitBtn: {
    borderRadius: radii.pill,
    paddingVertical: 15,
    alignItems: "center",
    backgroundColor: colors.navy,
    marginTop: 24,
    marginBottom: 8,
  },
  submitBtnText: { fontSize: 15, fontWeight: "700", color: colors.white },

  // Empty / Loading
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.surfaceGray,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.navy, textAlign: "center" },
  emptySub: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8,
  },
  emptyCta: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.navy,
  },
  emptyCtaText: { fontSize: 14, fontWeight: "700", color: colors.white },
});
