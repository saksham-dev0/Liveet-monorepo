import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useConvex } from "convex/react";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { colors, radii, cardShadow } from "../../../constants/theme";

const TAB_BAR_CLEARANCE = 88;
const H_PAD = 16;

type ConversationRow = {
  _id: string;
  propertyId: string;
  propertyName: string;
  tenantName: string;
  tenantImageUrl: string | null;
  lastMessageAt: number | null;
  lastMessageText: string | null;
  lastMessageTimeLabel: string | null;
  unreadCount: number;
};

export default function ChatsTabScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const convex = useConvex();
  const [query, setQuery] = useState("");
  const [conversations, setConversations] = useState<ConversationRow[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await (convex as any).query("chats:listConversationsForOperator", {});
      setConversations(Array.isArray(data) ? (data as ConversationRow[]) : []);
    } catch {
      setConversations((prev) => prev ?? []);
    }
  }, [convex]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const loading = conversations === null;

  const filtered = useMemo(() => {
    const list = conversations ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.tenantName.toLowerCase().includes(q) ||
        c.propertyName.toLowerCase().includes(q) ||
        (c.lastMessageText ?? "").toLowerCase().includes(q)
    );
  }, [conversations, query]);

  const showEmpty = !loading && (conversations ?? []).length === 0;
  const bottomPad = insets.bottom + TAB_BAR_CLEARANCE;

  return (
    <View style={[s.root, { paddingTop: insets.top + 4 }]}>
      <View style={s.headerRow}>
        <Text style={s.headerTitle} numberOfLines={1}>
          Chats
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
            placeholder="Search by tenant or property"
            placeholderTextColor="rgba(107,114,128,0.9)"
            style={s.searchInput}
            editable={!loading}
          />
          <Ionicons name="search" size={18} color={colors.muted} />
        </View>
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
            Tenants who express interest in your property will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          style={s.list}
          data={filtered}
          keyExtractor={(item) => item._id}
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
          renderItem={({ item }: { item: ConversationRow }) => (
            <View style={s.cardOuter}>
              <Pressable
                style={({ pressed }) => [s.card, pressed && s.cardPressed]}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/chats/[conversationId]",
                    params: {
                      conversationId: item._id,
                      tenantName: item.tenantName,
                      propertyName: item.propertyName,
                    },
                  } as any)
                }
                accessibilityRole="button"
                accessibilityLabel={`Chat with ${item.tenantName}`}
              >
                <View style={s.avatarWrap}>
                  {item.tenantImageUrl ? (
                    <Image
                      source={{ uri: item.tenantImageUrl }}
                      style={s.avatar}
                      contentFit="cover"
                      transition={120}
                    />
                  ) : (
                    <View style={s.avatarFallback}>
                      <Ionicons name="person" size={22} color={colors.white} />
                    </View>
                  )}
                </View>

                <View style={s.cardBody}>
                  <View style={s.titleRow}>
                    <Text style={s.rowTitle} numberOfLines={1}>
                      {item.tenantName}
                    </Text>
                    {item.unreadCount > 0 && (
                      <View style={s.badge}>
                        <Text style={s.badgeText}>{item.unreadCount}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.rowSub} numberOfLines={1}>
                    {item.propertyName}
                  </Text>
                  <Text
                    style={[s.rowPreview, item.unreadCount > 0 && s.rowPreviewUnread]}
                    numberOfLines={1}
                  >
                    {item.lastMessageText ?? "No messages yet"}
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
    paddingHorizontal: H_PAD,
    marginBottom: 12,
  },
  searchField: {
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
    fontSize: 15,
    fontWeight: "500",
    color: colors.navy,
    paddingVertical: 0,
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
  },
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
  cardBody: { flex: 1, minWidth: 0 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
    gap: 8,
  },
  rowTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy,
  },
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
  rowSub: { fontSize: 12, fontWeight: "500", color: colors.muted, marginBottom: 4 },
  rowPreview: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.muted,
    lineHeight: 18,
    marginBottom: 4,
  },
  rowPreviewUnread: { color: colors.navy, fontWeight: "600" },
  rowMetaTime: { fontSize: 12, fontWeight: "500", color: colors.muted },
  noResults: { paddingVertical: 40, alignItems: "center" },
  noResultsText: { fontSize: 14, fontWeight: "600", color: colors.muted },
});
