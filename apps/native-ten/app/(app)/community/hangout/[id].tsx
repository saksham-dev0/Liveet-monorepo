import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useConvex } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { colors, radii, cardShadow } from "../../../../constants/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

type Attendee = { userId: string; name: string; imageUrl: string | null };

type HangoutDetail = {
  id: string;
  title: string;
  description: string;
  location: string;
  dateTime: string;
  maxAttendees: number | null;
  attendeeCount: number;
  spotsLeft: number | null;
  status: string;
  isGoing: boolean;
  isCreator: boolean;
  creatorUserId: string;
  creatorName: string;
  creatorImageUrl: string | null;
  communityName: string | null;
  attendees: Attendee[];
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HangoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const convex = useConvex();
  const router = useRouter();
  const [hangout, setHangout] = useState<HangoutDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const data = await (convex as any).query("communities:getHangout", {
        hangoutId: id,
      });
      if (mountedRef.current) {
        setHangout(data ?? null);
        setLoading(false);
      }
    } catch {
      if (mountedRef.current) setLoading(false);
    }
  }, [convex, id]);

  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;
      void refresh();
      return () => {
        mountedRef.current = false;
      };
    }, [refresh]),
  );

  const handleJoin = async () => {
    setJoining(true);
    try {
      await (convex as any).mutation("communities:requestJoinHangout", {
        hangoutId: id,
      });
      await refresh();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not join hangout.");
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    setJoining(true);
    try {
      await (convex as any).mutation("communities:leaveHangout", {
        hangoutId: id,
      });
      await refresh();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not leave hangout.");
    } finally {
      setJoining(false);
    }
  };

  const startChat = async (otherUserId: string, otherName: string) => {
    try {
      const result = await (convex as any).mutation("peerChats:getOrCreate", {
        otherUserId,
      });
      router.push(
        `/(app)/chats/peer/${result.conversationId}?otherName=${encodeURIComponent(otherName)}` as any,
      );
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not start chat.");
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!hangout) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={s.center}>
          <Text style={s.emptyText}>Hangout not found.</Text>
        </View>
      </View>
    );
  }

  const full =
    hangout.spotsLeft !== null && hangout.spotsLeft <= 0 && !hangout.isGoing;

  // ── Main UI ────────────────────────────────────────────────────────────────

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>
          Hangout
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={s.title}>{hangout.title}</Text>

        {/* Community pill */}
        {hangout.communityName ? (
          <View style={s.communityPill}>
            <Ionicons name="people-outline" size={13} color={colors.primary} />
            <Text style={s.communityPillText}>{hangout.communityName}</Text>
          </View>
        ) : null}

        {/* Meta card */}
        <View style={s.metaCard}>
          {hangout.location ? (
            <View style={s.metaRow}>
              <Ionicons name="location-outline" size={16} color={colors.muted} />
              <Text style={s.metaText}>{hangout.location}</Text>
            </View>
          ) : null}
          <View style={s.metaRow}>
            <Ionicons name="time-outline" size={16} color={colors.muted} />
            <Text style={s.metaText}>{hangout.dateTime}</Text>
          </View>
          <View style={s.metaRow}>
            <Ionicons name="people-outline" size={16} color={colors.muted} />
            <Text style={s.metaText}>
              {hangout.attendeeCount} going
              {hangout.spotsLeft !== null
                ? ` · ${hangout.spotsLeft} spot${hangout.spotsLeft !== 1 ? "s" : ""} left`
                : ""}
            </Text>
          </View>
        </View>

        {/* Description */}
        {hangout.description ? (
          <>
            <Text style={s.sectionLabel}>About</Text>
            <Text style={s.description}>{hangout.description}</Text>
          </>
        ) : null}

        {/* Organizer */}
        <Text style={s.sectionLabel}>Organized by</Text>
        <View style={s.personRow}>
          <View style={s.avatar}>
            <Ionicons name="person" size={20} color={colors.muted} />
          </View>
          <Text style={s.personName}>{hangout.creatorName}</Text>
          {!hangout.isCreator ? (
            <TouchableOpacity
              style={s.msgBtn}
              onPress={() => startChat(hangout.creatorUserId, hangout.creatorName)}
            >
              <Ionicons name="chatbubble-outline" size={15} color={colors.primary} />
              <Text style={s.msgBtnText}>Message</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Attendees list — only visible to creator */}
        {hangout.isCreator && hangout.attendees.length > 0 ? (
          <>
            <Text style={s.sectionLabel}>
              Attendees ({hangout.attendees.length})
            </Text>
            {hangout.attendees.map((a) => (
              <View key={a.userId} style={s.personRow}>
                <View style={s.avatar}>
                  <Ionicons name="person" size={20} color={colors.muted} />
                </View>
                <Text style={s.personName}>{a.name}</Text>
                <TouchableOpacity
                  style={s.msgBtn}
                  onPress={() => startChat(a.userId, a.name)}
                >
                  <Ionicons name="chatbubble-outline" size={15} color={colors.primary} />
                  <Text style={s.msgBtnText}>Message</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        ) : null}

        {/* Join / Leave */}
        {!hangout.isCreator ? (
          <TouchableOpacity
            style={[
              s.joinBtn,
              hangout.isGoing && s.joinBtnGoing,
              full && s.joinBtnDisabled,
            ]}
            onPress={hangout.isGoing ? handleLeave : handleJoin}
            disabled={joining || full}
          >
            {joining ? (
              <ActivityIndicator
                size="small"
                color={hangout.isGoing ? colors.muted : colors.white}
              />
            ) : (
              <Text style={[s.joinBtnText, hangout.isGoing && s.joinBtnTextGoing]}>
                {full ? "Full" : hangout.isGoing ? "Leave Hangout" : "Join Hangout"}
              </Text>
            )}
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  backBtn: { width: 40, alignItems: "flex-start" },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: colors.muted, fontSize: 15 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  title: { fontSize: 24, fontWeight: "800", color: colors.text, marginBottom: 8 },
  communityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: colors.primary + "15",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 16,
  },
  communityPillText: { fontSize: 12, color: colors.primary, fontWeight: "600" },
  metaCard: {
    backgroundColor: colors.white,
    borderRadius: radii.card,
    padding: 14,
    gap: 10,
    marginBottom: 20,
    ...cardShadow,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaText: { fontSize: 14, color: colors.text, flex: 1 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  description: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    marginBottom: 20,
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: radii.card,
    padding: 12,
    marginBottom: 8,
    ...cardShadow,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.muted + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  personName: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.text },
  msgBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  msgBtnText: { fontSize: 13, color: colors.primary, fontWeight: "600" },
  joinBtn: {
    marginTop: 24,
    backgroundColor: colors.primary,
    borderRadius: radii.card,
    paddingVertical: 15,
    alignItems: "center",
  },
  joinBtnGoing: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.muted,
  },
  joinBtnDisabled: { backgroundColor: colors.muted + "40" },
  joinBtnText: { fontSize: 16, fontWeight: "700", color: colors.white },
  joinBtnTextGoing: { color: colors.muted },
});
