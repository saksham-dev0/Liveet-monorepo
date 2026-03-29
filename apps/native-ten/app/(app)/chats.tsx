import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useConvex } from "convex/react";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { colors, radii, cardShadow } from "../../constants/theme";

const TAB_BAR_CLEARANCE = 88;
const H_PAD = 16;
const ONLINE = colors.positiveAmount;

type ChatRow = {
  propertyId: string;
  propertyName: string;
  propertyCity: string | null;
  coverImageUrl: string | null;
  conversationId: string | null;
  lastMessageAt: number | null;
  lastMessageText: string | null;
  lastMessageTimeLabel: string | null;
  unreadCount: number;
};

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const convex = useConvex();
  const [query, setQuery] = useState("");
  // null = never loaded yet, ChatRow[] = loaded (may be empty)
  const [chats, setChats] = useState<ChatRow[] | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const data = await (convex as any).query("chats:listChatsForTenant", {});
      if (mountedRef.current) {
        setChats((prev) => {
          if (!Array.isArray(data)) return prev;
          // Never regress from a non-empty list to empty on a stale response
          if (data.length === 0 && prev !== null && prev.length > 0) return prev;
          return data as ChatRow[];
        });
      }
    } catch {
      // keep last known list on error
    }
  }, [convex]);

  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;
      void refresh();
      return () => {
        mountedRef.current = false;
      };
    }, [refresh])
  );

  const loading = chats === null;

  const filtered = useMemo(() => {
    const list = chats ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (t) =>
        t.propertyName.toLowerCase().includes(q) ||
        (t.lastMessageText ?? "").toLowerCase().includes(q)
    );
  }, [chats, query]);

  const showEmpty = !loading && (chats ?? []).length === 0;
  const bottomPad = insets.bottom + TAB_BAR_CLEARANCE;

  return (
    <View style={[s.root, { paddingTop: insets.top + 4 }]}>
      <View style={s.headerRow}>
        <Text style={s.headerTitle} numberOfLines={1}>
          Messages
        </Text>
        <Pressable
          style={s.headerIconBtn}
          accessibilityRole="button"
          accessibilityLabel="More options"
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.navy} />
        </Pressable>
      </View>

      <View style={s.searchOuter}>
        <View style={s.searchField}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by property or message"
            placeholderTextColor="rgba(107,114,128,0.9)"
            style={s.searchInput}
            editable={!loading}
          />
          <Ionicons name="search" size={18} color={colors.muted} />
        </View>
        <Pressable style={s.filterBtn} accessibilityRole="button" accessibilityLabel="Filter">
          <Ionicons name="options-outline" size={20} color={colors.navy} />
        </Pressable>
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : showEmpty ? (
        <View style={s.emptyWrap}>
          <View style={s.emptyCircle}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.muted} />
          </View>
          <Text style={s.emptyTitle}>No conversations yet</Text>
          <Text style={s.emptySub}>
            Save properties on Discover to start chatting with hosts.
          </Text>
          <TouchableOpacity
            style={s.cta}
            activeOpacity={0.85}
            onPress={() => router.navigate("/(app)" as any)}
            accessibilityRole="button"
            accessibilityLabel="Go to Discover"
          >
            <Text style={s.ctaText}>Browse Discover</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.white} />
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          style={s.list}
          data={filtered}
          keyExtractor={(item) => item.propertyId}
          contentContainerStyle={[
            s.listContent,
            { paddingBottom: bottomPad, paddingHorizontal: H_PAD },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          {...(Platform.OS === "ios"
            ? { contentInsetAdjustmentBehavior: "never" as const }
            : {})}
          renderItem={({ item }: { item: ChatRow }) => (
            <View style={s.cardOuter}>
              <Pressable
                style={({ pressed }) => [s.card, pressed && s.cardPressed]}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/chats/[propertyId]",
                    params: { propertyId: item.propertyId, title: item.propertyName },
                  } as any)
                }
                accessibilityRole="button"
                accessibilityLabel={`Open chat with ${item.propertyName}`}
              >
                <View style={s.avatarWrap}>
                  {item.coverImageUrl ? (
                    <Image
                      source={{ uri: item.coverImageUrl }}
                      style={s.avatar}
                      contentFit="cover"
                      transition={120}
                    />
                  ) : (
                    <View style={s.avatarFallback}>
                      <Ionicons name="business" size={22} color={colors.white} />
                    </View>
                  )}
                  {item.conversationId ? <View style={s.onlineDot} /> : null}
                </View>

                <View style={s.cardBody}>
                  <View style={s.titleRow}>
                    <Text style={s.rowTitle} numberOfLines={1}>
                      {item.propertyName}
                    </Text>
                    {item.unreadCount > 0 && (
                      <View style={s.badge}>
                        <Text style={s.badgeText}>{item.unreadCount}</Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={[s.rowPreview, item.unreadCount > 0 && s.rowPreviewUnread]}
                    numberOfLines={2}
                  >
                    {item.lastMessageText ?? "Tap to start chatting with the host."}
                  </Text>
                  {item.lastMessageTimeLabel ? (
                    <Text style={s.rowMetaTime} numberOfLines={1}>
                      {item.lastMessageTimeLabel}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            query.trim() ? (
              <View style={s.noResults}>
                <Text style={s.noResultsText}>No matches for "{query.trim()}"</Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.pageBg,
    maxWidth: "100%",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: H_PAD,
    paddingBottom: 10,
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 22,
    fontWeight: "800",
    color: colors.navy,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 0,
  },
  searchOuter: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: H_PAD,
    marginBottom: 12,
    gap: 10,
  },
  searchField: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: "500",
    color: colors.navy,
    paddingVertical: 0,
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 0,
  },
  list: { flex: 1, width: "100%" },
  listContent: { paddingTop: 4 },
  cardOuter: { width: "100%", marginBottom: 12 },
  card: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
  },
  cardPressed: { opacity: 0.92 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 32,
  },
  emptyCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surfaceGray,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: radii.pill,
  },
  ctaText: { fontSize: 15, fontWeight: "700", color: colors.white },
  avatarWrap: { position: "relative", marginTop: 2, flexShrink: 0 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  onlineDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: ONLINE,
    borderWidth: 2,
    borderColor: colors.cardBg,
  },
  cardBody: { flex: 1, minWidth: 0 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 8,
  },
  rowTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.navy },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  badgeText: { fontSize: 11, fontWeight: "700", color: colors.white },
  rowPreview: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.muted,
    lineHeight: 18,
    marginBottom: 6,
  },
  rowPreviewUnread: { color: colors.navy, fontWeight: "600" },
  rowMetaTime: { fontSize: 12, fontWeight: "500", color: colors.muted },
  noResults: { paddingVertical: 40, alignItems: "center" },
  noResultsText: { fontSize: 14, fontWeight: "600", color: colors.muted },
});
