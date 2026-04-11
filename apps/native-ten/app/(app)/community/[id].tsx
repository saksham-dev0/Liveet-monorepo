import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Switch,
  FlatList,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useConvex } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { colors, radii, cardShadow } from "../../../constants/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

type CommunityDetail = {
  id: string;
  name: string;
  description: string;
  category: string;
  isPublic: boolean;
  propertyName: string;
  memberCount: number;
  isMember: boolean;
  isAdmin: boolean;
  isSoleAdmin: boolean;
  isCreator: boolean;
  creatorName: string;
  createdAt: number;
  memberNames: string[];
  bannerImageUrl: string | null;
  bannerColor: string | null;
};

type Member = {
  userId: string;
  name: string;
  isAdmin: boolean;
  isCreator: boolean;
  isMe: boolean;
};

type CommunityEvent = {
  id: string;
  name: string;
  organizer: string;
  place: string;
  dateTime: string;
  about: string;
  isFree: boolean;
  ticketPrice: number | null;
  totalTickets: number | null;
  soldCount: number;
  isFull: boolean;
  isRegistered: boolean;
  createdAt: number;
};

type ActiveModal = "none" | "rename" | "description" | "category" | "color" | "members" | "createEvent";

// ─── Constants ────────────────────────────────────────────────────────────────

const COMMUNITY_CATEGORIES = [
  "General", "Students", "Working Professionals",
  "Sports & Fitness", "Food & Dining", "Gaming",
  "Arts & Culture", "Tech", "Other",
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

const BANNER_COLORS = [
  "#6366F1", "#F59E0B", "#0EA5E9", "#10B981",
  "#F97316", "#8B5CF6", "#EC4899", "#14B8A6",
  "#EF4444", "#06B6D4", "#84CC16", "#F43F5E",
];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CommunityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const convex = useConvex();

  const [community, setCommunity] = useState<CommunityDetail | null>(null);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveModal>("none");
  const mountedRef = useRef(true);

  const fetchCommunity = useCallback(async () => {
    if (!id) return;
    try {
      const data = await (convex as any).query("communities:getCommunity", { communityId: id });
      if (mountedRef.current) { setCommunity(data ?? null); setLoading(false); }
    } catch { if (mountedRef.current) setLoading(false); }
  }, [convex, id]);

  const fetchEvents = useCallback(async () => {
    if (!id) return;
    try {
      const data = await (convex as any).query("communityEvents:listCommunityEvents", { communityId: id });
      if (mountedRef.current && Array.isArray(data)) setEvents(data);
    } catch { /* non-critical */ }
  }, [convex, id]);

  useEffect(() => {
    mountedRef.current = true;
    void fetchCommunity();
    void fetchEvents();
    return () => { mountedRef.current = false; };
  }, [fetchCommunity, fetchEvents]);

  // ── CTA action: Join / Leave / Delete ──────────────────────────────────────

  const handleJoin = async () => {
    setActionLoading(true);
    try {
      await (convex as any).mutation("communities:joinCommunity", { communityId: community!.id });
      await fetchCommunity();
    } catch (e: any) { Alert.alert("Error", e.message ?? "Could not join."); }
    finally { setActionLoading(false); }
  };

  const handleLeave = async () => {
    setActionLoading(true);
    try {
      await (convex as any).mutation("communities:leaveCommunity", { communityId: community!.id });
      await fetchCommunity();
    } catch (e: any) { Alert.alert("Error", e.message ?? "Could not leave."); }
    finally { setActionLoading(false); }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Community",
      "This will permanently delete the community and remove all members. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            setActionLoading(true);
            try {
              await (convex as any).mutation("communities:deleteCommunity", { communityId: community!.id });
              router.back();
            } catch (e: any) {
              Alert.alert("Error", e.message ?? "Could not delete.");
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  // ── Banner image upload ────────────────────────────────────────────────────

  const handlePickBannerImage = async () => {
    setShowSettings(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Photo library access is required to set a banner image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], quality: 0.85, allowsEditing: true, aspect: [16, 9],
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setActionLoading(true);
    try {
      const uploadUrl = await (convex as any).mutation("communities:generateCommunityBannerUploadUrl", {});
      const blob = await (await fetch(asset.uri)).blob();
      const uploadRes = await fetch(uploadUrl, {
        method: "POST", body: blob,
        headers: { "Content-Type": asset.mimeType ?? "image/jpeg" },
      });
      const { storageId } = await uploadRes.json();
      if (!storageId) throw new Error("Upload failed");
      await (convex as any).mutation("communities:updateCommunity", {
        communityId: community!.id, bannerImageFileId: storageId,
      });
      await fetchCommunity();
    } catch { Alert.alert("Upload failed", "Could not upload the banner image. Try again."); }
    finally { setActionLoading(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return <View style={[s.root, s.center]}><ActivityIndicator size="large" color={colors.navy} /></View>;
  }

  if (!community) {
    return (
      <View style={[s.root, s.center]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.muted} />
        <Text style={s.notFoundText}>Community not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.backLink}>
          <Text style={s.backLinkText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const accent = community.bannerColor ?? (ACCENT_COLORS[community.category] ?? "#6366F1");
  const icon = CATEGORY_ICONS[community.category] ?? "globe-outline";

  // CTA logic: sole admin → delete, other member → leave, non-member → join
  const ctaIsDelete = community.isCreator && community.isSoleAdmin && community.memberCount === 1;
  const ctaIsLeave = community.isMember && !ctaIsDelete;

  return (
    <View style={s.root}>

      {/* ── Hero ── */}
      <View style={[s.hero, { backgroundColor: accent }]}>
        <View style={s.heroOverlay} />
        {community.bannerImageUrl ? (
          <Image source={{ uri: community.bannerImageUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
        ) : (
          <View style={[s.heroIconWrap, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
            <Ionicons name={icon} size={52} color="rgba(255,255,255,0.95)" />
          </View>
        )}
        <TouchableOpacity style={[s.heroBtn, { top: insets.top + 12, left: 16 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.white} />
        </TouchableOpacity>
        {community.isAdmin && (
          <TouchableOpacity style={[s.heroBtn, { top: insets.top + 12, right: 16 }]} onPress={() => setShowSettings(true)}>
            <Ionicons name="ellipsis-vertical" size={20} color={colors.white} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Member Pill ── */}
      <View style={s.memberPillWrap}>
        <View style={s.memberPill}>
          <View style={s.avatarsRow}>
            {community.memberNames.slice(0, 3).map((name, i) => (
              <View key={i} style={[s.avatar, { backgroundColor: accent, marginLeft: i === 0 ? 0 : -10, zIndex: 3 - i }]}>
                <Text style={s.avatarText}>{name.charAt(0).toUpperCase()}</Text>
              </View>
            ))}
            {community.memberNames.length === 0 && (
              <View style={[s.avatar, { backgroundColor: accent }]}>
                <Ionicons name="person" size={14} color={colors.white} />
              </View>
            )}
          </View>
          <Text style={s.memberCountText}>
            {community.memberCount === 0 ? "No members yet" : `+${community.memberCount} Member${community.memberCount !== 1 ? "s" : ""}`}
          </Text>
          {/* pill button only for non-sole-admin members */}
          {!ctaIsDelete && (
            <TouchableOpacity
              style={[s.joinPillBtn, ctaIsLeave && s.joinPillBtnActive]}
              onPress={ctaIsLeave ? handleLeave : handleJoin}
              disabled={actionLoading}
            >
              {actionLoading
                ? <ActivityIndicator size="small" color={ctaIsLeave ? colors.muted : colors.white} />
                : <Text style={[s.joinPillBtnText, ctaIsLeave && s.joinPillBtnTextActive]}>{ctaIsLeave ? "Leave" : "Join"}</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Body ── */}
      <ScrollView style={s.scroll} contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 110 }]} showsVerticalScrollIndicator={false}>
        <Text style={s.communityName}>{community.name}</Text>

        {/* Info rows */}
        <View style={s.infoSection}>
          <InfoRow icon="grid-outline" accent={accent} label="Category" value={community.category} />
          {community.propertyName ? <InfoRow icon="home-outline" accent={accent} label="Property" value={community.propertyName} /> : null}
          <InfoRow icon="person-circle-outline" accent={accent} label="Created by" value={community.creatorName} />
          <InfoRow
            icon={community.isPublic ? "earth-outline" : "lock-closed-outline"}
            accent={accent} label="Visibility"
            value={community.isPublic ? "Public — anyone can join" : "Private"}
          />
        </View>

        {/* About */}
        {community.description ? (
          <View style={s.aboutSection}>
            <Text style={s.aboutTitle}>About</Text>
            <Text style={s.aboutBody}>{community.description}</Text>
          </View>
        ) : null}

        {/* Events section */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Events</Text>
          {community.isAdmin && (
            <TouchableOpacity style={[s.addEventBtn, { backgroundColor: accent }]} onPress={() => setActiveModal("createEvent")}>
              <Ionicons name="add" size={16} color={colors.white} />
              <Text style={s.addEventBtnText}>Create</Text>
            </TouchableOpacity>
          )}
        </View>

        {events.length === 0 ? (
          <View style={s.eventsEmpty}>
            <Ionicons name="calendar-outline" size={32} color={colors.muted} />
            <Text style={s.eventsEmptyText}>{community.isAdmin ? "No events yet. Create one!" : "No events yet."}</Text>
          </View>
        ) : (
          events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              accent={accent}
              onRegister={async () => {
                try {
                  await (convex as any).mutation("communityEvents:registerForEvent", { eventId: event.id });
                  await fetchEvents();
                } catch (e: any) { Alert.alert("Error", e.message ?? "Could not register."); }
              }}
              onUnregister={async () => {
                try {
                  await (convex as any).mutation("communityEvents:unregisterFromEvent", { eventId: event.id });
                  await fetchEvents();
                } catch (e: any) { Alert.alert("Error", e.message ?? "Could not unregister."); }
              }}
            />
          ))
        )}

        {/* Members card */}
        <TouchableOpacity style={s.membersCard} activeOpacity={0.8} onPress={() => setActiveModal("members")}>
          <View style={s.membersCardLeft}>
            <View style={[s.membersCardIcon, { backgroundColor: accent + "18" }]}>
              <Ionicons name="people" size={20} color={accent} />
            </View>
            <View>
              <Text style={s.membersCardTitle}>Members</Text>
              <Text style={s.membersCardSub}>{community.memberCount} {community.memberCount === 1 ? "person" : "people"} in this community</Text>
            </View>
          </View>
          <View style={s.membersAvatarRow}>
            {community.memberNames.slice(0, 3).map((name, i) => (
              <View key={i} style={[s.smallAvatar, { backgroundColor: accent, marginLeft: i === 0 ? 0 : -8 }]}>
                <Text style={s.smallAvatarText}>{name.charAt(0).toUpperCase()}</Text>
              </View>
            ))}
            <Ionicons name="chevron-forward" size={16} color={colors.muted} style={{ marginLeft: 8 }} />
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Sticky CTA ── */}
      <View style={[s.stickyBottom, { paddingBottom: insets.bottom + 12 }]}>
        {ctaIsDelete ? (
          <TouchableOpacity style={[s.ctaBtn, { backgroundColor: colors.error }]} onPress={handleDelete} disabled={actionLoading}>
            {actionLoading
              ? <ActivityIndicator color={colors.white} />
              : <>
                  <Ionicons name="trash-outline" size={18} color={colors.white} />
                  <Text style={s.ctaBtnText}>Delete Community</Text>
                </>
            }
          </TouchableOpacity>
        ) : ctaIsLeave ? (
          <TouchableOpacity style={[s.ctaBtn, { backgroundColor: colors.surfaceGray, borderWidth: 1, borderColor: colors.border }]} onPress={handleLeave} disabled={actionLoading}>
            {actionLoading
              ? <ActivityIndicator color={colors.muted} />
              : <Text style={[s.ctaBtnText, { color: colors.navy }]}>Leave Community</Text>
            }
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[s.ctaBtn, { backgroundColor: accent }]} onPress={handleJoin} disabled={actionLoading}>
            {actionLoading
              ? <ActivityIndicator color={colors.white} />
              : <>
                  <Text style={s.ctaBtnText}>Join Community</Text>
                  <View style={s.ctaArrow}><Ionicons name="arrow-forward" size={18} color={accent} /></View>
                </>
            }
          </TouchableOpacity>
        )}
      </View>

      {/* ── Settings Bottom Sheet ── */}
      <Modal visible={showSettings} animationType="slide" transparent onRequestClose={() => setShowSettings(false)}>
        <TouchableOpacity style={s.sheetBackdrop} activeOpacity={1} onPress={() => setShowSettings(false)} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>Community Settings</Text>
          <SettingRow icon="pencil-outline" accent={accent} label="Rename Community" onPress={() => { setShowSettings(false); setActiveModal("rename"); }} />
          <SettingRow icon="document-text-outline" accent={accent} label="Edit Description" onPress={() => { setShowSettings(false); setActiveModal("description"); }} />
          <SettingRow icon="grid-outline" accent={accent} label="Change Category" onPress={() => { setShowSettings(false); setActiveModal("category"); }} />
          <SettingRow icon="color-palette-outline" accent={accent} label="Change Banner Color" onPress={() => { setShowSettings(false); setActiveModal("color"); }} />
          <SettingRow icon="image-outline" accent={accent} label="Change Banner Image" onPress={handlePickBannerImage} />
          <VisibilityRow
            accent={accent} isPublic={community.isPublic}
            onToggle={async (val) => {
              try {
                await (convex as any).mutation("communities:updateCommunity", { communityId: community.id, isPublic: val });
                await fetchCommunity();
              } catch (e: any) { Alert.alert("Error", e.message ?? "Could not update visibility."); }
            }}
          />
        </View>
      </Modal>

      {/* ── Edit Modals ── */}
      <TextEditModal
        visible={activeModal === "rename"} title="Rename Community" label="Community Name"
        initialValue={community.name} maxLength={60} multiline={false}
        onClose={() => setActiveModal("none")}
        onSave={async (val) => {
          await (convex as any).mutation("communities:updateCommunity", { communityId: community.id, name: val });
          await fetchCommunity(); setActiveModal("none");
        }}
      />
      <TextEditModal
        visible={activeModal === "description"} title="Edit Description" label="Description"
        initialValue={community.description} maxLength={300} multiline
        onClose={() => setActiveModal("none")}
        onSave={async (val) => {
          await (convex as any).mutation("communities:updateCommunity", { communityId: community.id, description: val });
          await fetchCommunity(); setActiveModal("none");
        }}
      />
      <CategoryPickerModal
        visible={activeModal === "category"} current={community.category}
        onClose={() => setActiveModal("none")}
        onSave={async (cat) => {
          await (convex as any).mutation("communities:updateCommunity", { communityId: community.id, category: cat });
          await fetchCommunity(); setActiveModal("none");
        }}
      />
      <ColorPickerModal
        visible={activeModal === "color"} current={community.bannerColor}
        onClose={() => setActiveModal("none")}
        onSave={async (color) => {
          await (convex as any).mutation("communities:updateCommunity", { communityId: community.id, bannerColor: color });
          await fetchCommunity(); setActiveModal("none");
        }}
      />
      <MembersModal
        visible={activeModal === "members"}
        communityId={community.id}
        accent={accent}
        isAdmin={community.isAdmin}
        isCreator={community.isCreator}
        onClose={() => setActiveModal("none")}
        onRefresh={fetchCommunity}
      />
      <CreateEventModal
        visible={activeModal === "createEvent"}
        communityId={community.id}
        accent={accent}
        onClose={() => setActiveModal("none")}
        onCreated={async () => { setActiveModal("none"); await fetchEvents(); }}
      />
    </View>
  );
}

// ─── Info Row ─────────────────────────────────────────────────────────────────

function InfoRow({ icon, accent, label, value }: {
  icon: keyof typeof Ionicons.glyphMap; accent: string; label: string; value: string;
}) {
  return (
    <View style={s.infoRow}>
      <View style={[s.infoIconWrap, { backgroundColor: accent + "18" }]}>
        <Ionicons name={icon} size={20} color={accent} />
      </View>
      <View style={s.infoText}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Setting Row ──────────────────────────────────────────────────────────────

function SettingRow({ icon, accent, label, onPress }: {
  icon: keyof typeof Ionicons.glyphMap; accent: string; label: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.settingRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.settingIconWrap, { backgroundColor: accent + "18" }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <Text style={s.settingLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </TouchableOpacity>
  );
}

// ─── Visibility Row ───────────────────────────────────────────────────────────

function VisibilityRow({ accent, isPublic, onToggle }: {
  accent: string; isPublic: boolean; onToggle: (val: boolean) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const handle = async (val: boolean) => { setLoading(true); try { await onToggle(val); } finally { setLoading(false); } };
  return (
    <View style={s.settingRow}>
      <View style={[s.settingIconWrap, { backgroundColor: accent + "18" }]}>
        <Ionicons name={isPublic ? "earth-outline" : "lock-closed-outline"} size={18} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.settingLabel}>Public Community</Text>
        <Text style={s.settingSubLabel}>{isPublic ? "Anyone can join" : "Invite only"}</Text>
      </View>
      {loading ? <ActivityIndicator size="small" color={accent} /> : (
        <Switch value={isPublic} onValueChange={handle} trackColor={{ false: colors.border, true: accent + "80" }} thumbColor={isPublic ? accent : colors.muted} />
      )}
    </View>
  );
}

// ─── Members Modal ────────────────────────────────────────────────────────────

function MembersModal({ visible, communityId, accent, isAdmin, isCreator, onClose, onRefresh }: {
  visible: boolean; communityId: string; accent: string;
  isAdmin: boolean; isCreator: boolean;
  onClose: () => void; onRefresh: () => Promise<void>;
}) {
  const convex = useConvex();
  const insets = useSafeAreaInsets();
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const data = await (convex as any).query("communities:listCommunityMembers", { communityId });
      setMembers(Array.isArray(data) ? data : []);
    } catch { setMembers([]); }
    finally { setLoadingMembers(false); }
  }, [convex, communityId]);

  useEffect(() => { if (visible) void fetchMembers(); }, [visible, fetchMembers]);

  const handleMakeAdmin = async (userId: string) => {
    setActionId(userId);
    try {
      await (convex as any).mutation("communities:makeAdmin", { communityId, targetUserId: userId });
      await fetchMembers();
      await onRefresh();
    } catch (e: any) { Alert.alert("Error", e.message ?? "Could not make admin."); }
    finally { setActionId(null); }
  };

  const handleRemoveAdmin = async (userId: string) => {
    setActionId(userId);
    try {
      await (convex as any).mutation("communities:removeAdmin", { communityId, targetUserId: userId });
      await fetchMembers();
      await onRefresh();
    } catch (e: any) { Alert.alert("Error", e.message ?? "Could not remove admin."); }
    finally { setActionId(null); }
  };

  const renderMember = ({ item }: { item: Member }) => {
    const initials = item.name.charAt(0).toUpperCase();
    const isActing = actionId === item.userId;

    return (
      <View style={ms.memberRow}>
        <View style={[ms.memberAvatar, { backgroundColor: accent }]}>
          <Text style={ms.memberAvatarText}>{initials}</Text>
        </View>
        <View style={ms.memberInfo}>
          <View style={ms.memberNameRow}>
            <Text style={ms.memberName}>{item.name}{item.isMe ? " (you)" : ""}</Text>
            {item.isCreator && (
              <View style={[ms.badge, { backgroundColor: accent + "20" }]}>
                <Text style={[ms.badgeText, { color: accent }]}>Creator</Text>
              </View>
            )}
            {item.isAdmin && !item.isCreator && (
              <View style={[ms.badge, { backgroundColor: "#F59E0B20" }]}>
                <Text style={[ms.badgeText, { color: "#F59E0B" }]}>Admin</Text>
              </View>
            )}
          </View>
          <Text style={ms.memberRole}>{item.isAdmin ? "Admin" : "Member"}</Text>
        </View>

        {/* Admin can promote/demote (not themselves, not the creator) */}
        {isAdmin && !item.isMe && !item.isCreator && (
          <TouchableOpacity
            style={[ms.adminBtn, item.isAdmin && ms.adminBtnActive]}
            onPress={() => item.isAdmin ? handleRemoveAdmin(item.userId) : handleMakeAdmin(item.userId)}
            disabled={isActing}
          >
            {isActing
              ? <ActivityIndicator size="small" color={item.isAdmin ? colors.muted : accent} />
              : <Text style={[ms.adminBtnText, item.isAdmin && ms.adminBtnTextActive]}>
                  {item.isAdmin ? "Remove admin" : "Make admin"}
                </Text>
            }
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={[s.modalSheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={s.sheetHandle} />
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Members</Text>
            <TouchableOpacity onPress={onClose} style={s.modalCloseBtn}>
              <Ionicons name="close" size={20} color={colors.navy} />
            </TouchableOpacity>
          </View>
          {loadingMembers ? (
            <View style={ms.center}><ActivityIndicator color={colors.navy} /></View>
          ) : (
            <FlatList
              data={members}
              keyExtractor={(m) => m.userId}
              renderItem={renderMember}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={ms.separator} />}
              contentContainerStyle={{ paddingBottom: 8 }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Text Edit Modal ──────────────────────────────────────────────────────────

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ event, accent, onRegister, onUnregister }: {
  event: CommunityEvent;
  accent: string;
  onRegister: () => Promise<void>;
  onUnregister: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    try { event.isRegistered ? await onUnregister() : await onRegister(); }
    finally { setLoading(false); }
  };

  const ticketsLeft = event.totalTickets != null ? event.totalTickets - event.soldCount : null;

  return (
    <View style={ev.card}>
      {/* Top row: name + full/price badge */}
      <View style={ev.cardTopRow}>
        <Text style={ev.cardName} numberOfLines={2}>{event.name}</Text>
        {event.isFull ? (
          <View style={ev.fullBadge}><Text style={ev.fullBadgeText}>FULL</Text></View>
        ) : event.isFree ? (
          <View style={[ev.priceBadge, { backgroundColor: accent + "18" }]}>
            <Text style={[ev.priceBadgeText, { color: accent }]}>Free</Text>
          </View>
        ) : (
          <View style={[ev.priceBadge, { backgroundColor: accent + "18" }]}>
            <Text style={[ev.priceBadgeText, { color: accent }]}>₹{event.ticketPrice}</Text>
          </View>
        )}
      </View>

      {/* Meta rows */}
      <View style={ev.metaSection}>
        <View style={ev.metaRow}>
          <Ionicons name="person-outline" size={13} color={colors.muted} />
          <Text style={ev.metaText}>{event.organizer}</Text>
        </View>
        <View style={ev.metaRow}>
          <Ionicons name="location-outline" size={13} color={colors.muted} />
          <Text style={ev.metaText} numberOfLines={1}>{event.place}</Text>
        </View>
        <View style={ev.metaRow}>
          <Ionicons name="time-outline" size={13} color={colors.muted} />
          <Text style={ev.metaText}>{event.dateTime}</Text>
        </View>
        {event.totalTickets != null && (
          <View style={ev.metaRow}>
            <Ionicons name="ticket-outline" size={13} color={colors.muted} />
            <Text style={ev.metaText}>
              {event.isFull
                ? `${event.soldCount} registered · Sold out`
                : `${event.soldCount} registered · ${ticketsLeft} left`}
            </Text>
          </View>
        )}
      </View>

      {/* About */}
      {event.about ? <Text style={ev.about} numberOfLines={3}>{event.about}</Text> : null}

      {/* Divider + CTA */}
      <View style={ev.footer}>
        <TouchableOpacity
          style={[
            ev.ctaBtn,
            event.isRegistered && ev.ctaBtnActive,
            event.isFull && !event.isRegistered && ev.ctaBtnDisabled,
            { borderColor: accent },
          ]}
          onPress={handleToggle}
          disabled={loading || (event.isFull && !event.isRegistered)}
        >
          {loading ? (
            <ActivityIndicator size="small" color={event.isRegistered ? colors.muted : accent} />
          ) : (
            <>
              {event.isRegistered && <Ionicons name="checkmark-circle" size={15} color={colors.muted} />}
              <Text style={[ev.ctaBtnText, { color: event.isRegistered || (event.isFull && !event.isRegistered) ? colors.muted : accent }]}>
                {event.isFull && !event.isRegistered
                  ? "Event Full"
                  : event.isRegistered
                  ? "Registered"
                  : event.isFree ? "Register Free" : `Get Ticket · ₹${event.ticketPrice}`}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Create Event Modal ───────────────────────────────────────────────────────

function CreateEventModal({ visible, communityId, accent, onClose, onCreated }: {
  visible: boolean;
  communityId: string;
  accent: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const convex = useConvex();
  const [name, setName] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [place, setPlace] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [about, setAbout] = useState("");
  const [isFree, setIsFree] = useState(true);
  const [ticketPrice, setTicketPrice] = useState("");
  const [totalTickets, setTotalTickets] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setName(""); setOrganizer(""); setPlace(""); setDateTime("");
    setAbout(""); setIsFree(true); setTicketPrice(""); setTotalTickets(""); setError("");
  };

  useEffect(() => { if (visible) reset(); }, [visible]);

  const handleSave = async () => {
    setError("");
    if (!name.trim()) { setError("Event name is required."); return; }
    if (!organizer.trim()) { setError("Organizer name is required."); return; }
    if (!place.trim()) { setError("Place is required."); return; }
    if (!dateTime.trim()) { setError("Date & time is required."); return; }
    if (!isFree) {
      const price = parseFloat(ticketPrice);
      if (isNaN(price) || price <= 0) { setError("Enter a valid ticket price."); return; }
    }
    let parsedTickets: number | undefined;
    if (totalTickets.trim()) {
      const n = parseInt(totalTickets, 10);
      if (isNaN(n) || n <= 0 || String(n) !== totalTickets.trim()) {
        setError("Total tickets must be a positive whole number."); return;
      }
      parsedTickets = n;
    }

    setSaving(true);
    try {
      await (convex as any).mutation("communityEvents:createCommunityEvent", {
        communityId,
        name: name.trim(),
        organizer: organizer.trim(),
        place: place.trim(),
        dateTime: dateTime.trim(),
        about: about.trim() || undefined,
        isFree,
        ticketPrice: isFree ? undefined : parseFloat(ticketPrice),
        totalTickets: parsedTickets,
      });
      await onCreated();
    } catch (e: any) {
      setError(e.message ?? "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[s.modalSheet, { paddingBottom: 32 }]}>
          <View style={s.sheetHandle} />
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Create Event</Text>
            <TouchableOpacity onPress={onClose} style={s.modalCloseBtn}>
              <Ionicons name="close" size={20} color={colors.navy} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Event Name */}
            <Text style={s.fieldLabel}>Event Name *</Text>
            <TextInput style={s.input} value={name} onChangeText={setName} maxLength={80} placeholder="e.g. Rooftop Movie Night" placeholderTextColor={colors.muted} />

            {/* Organizer */}
            <Text style={s.fieldLabel}>Organizer *</Text>
            <TextInput style={s.input} value={organizer} onChangeText={setOrganizer} maxLength={60} placeholder="e.g. Rahul Sharma" placeholderTextColor={colors.muted} />

            {/* Place */}
            <Text style={s.fieldLabel}>Place *</Text>
            <TextInput style={s.input} value={place} onChangeText={setPlace} maxLength={100} placeholder="e.g. Terrace, Block B" placeholderTextColor={colors.muted} />

            {/* Date & Time */}
            <Text style={s.fieldLabel}>Date & Time *</Text>
            <TextInput style={s.input} value={dateTime} onChangeText={setDateTime} placeholder="e.g. Sat 19 Apr, 7:00 PM" placeholderTextColor={colors.muted} />

            {/* About */}
            <Text style={s.fieldLabel}>About Event</Text>
            <TextInput
              style={[s.input, s.textArea]} value={about} onChangeText={setAbout}
              maxLength={400} multiline placeholder="Tell people what to expect…" placeholderTextColor={colors.muted}
            />

            {/* Ticket Type toggle */}
            <Text style={s.fieldLabel}>Ticket Type</Text>
            <View style={cev.ticketTypeRow}>
              <TouchableOpacity
                style={[cev.typeBtn, isFree && { backgroundColor: accent, borderColor: accent }]}
                onPress={() => setIsFree(true)}
              >
                <Ionicons name="gift-outline" size={15} color={isFree ? colors.white : colors.muted} />
                <Text style={[cev.typeBtnText, { color: isFree ? colors.white : colors.muted }]}>Free</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[cev.typeBtn, !isFree && { backgroundColor: accent, borderColor: accent }]}
                onPress={() => setIsFree(false)}
              >
                <Ionicons name="pricetag-outline" size={15} color={!isFree ? colors.white : colors.muted} />
                <Text style={[cev.typeBtnText, { color: !isFree ? colors.white : colors.muted }]}>Paid</Text>
              </TouchableOpacity>
            </View>

            {/* Price (shown only for paid) */}
            {!isFree && (
              <>
                <Text style={s.fieldLabel}>Ticket Price (₹) *</Text>
                <TextInput
                  style={s.input} value={ticketPrice} onChangeText={setTicketPrice}
                  placeholder="e.g. 199" placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                />
              </>
            )}

            {/* Total tickets */}
            <Text style={s.fieldLabel}>Total Tickets on Sale</Text>
            <TextInput
              style={s.input} value={totalTickets} onChangeText={setTotalTickets}
              placeholder="Leave blank for unlimited" placeholderTextColor={colors.muted}
              keyboardType="number-pad"
            />

            {error ? <Text style={s.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: accent }, saving && { opacity: 0.6 }]}
              onPress={handleSave} disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={colors.white} />
                : <Text style={s.saveBtnText}>Create Event</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Text Edit Modal ──────────────────────────────────────────────────────────

function TextEditModal({ visible, title, label, initialValue, maxLength, multiline, onClose, onSave }: {
  visible: boolean; title: string; label: string; initialValue: string;
  maxLength: number; multiline: boolean;
  onClose: () => void; onSave: (val: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (visible) { setValue(initialValue); setError(""); } }, [visible, initialValue]);

  const handleSave = async () => {
    if (!value.trim() && !multiline) { setError(`${label} cannot be empty.`); return; }
    setSaving(true); setError("");
    try { await onSave(value.trim()); }
    catch (e: any) { setError(e.message ?? "Something went wrong."); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.modalSheet}>
          <View style={s.sheetHandle} />
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={s.modalCloseBtn}>
              <Ionicons name="close" size={20} color={colors.navy} />
            </TouchableOpacity>
          </View>
          <Text style={s.fieldLabel}>{label}</Text>
          <TextInput
            style={[s.input, multiline && s.textArea]}
            value={value} onChangeText={setValue} maxLength={maxLength}
            multiline={multiline} autoFocus placeholderTextColor={colors.muted}
          />
          <Text style={s.charCount}>{value.length}/{maxLength}</Text>
          {error ? <Text style={s.errorText}>{error}</Text> : null}
          <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.white} /> : <Text style={s.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Category Picker Modal ────────────────────────────────────────────────────

function CategoryPickerModal({ visible, current, onClose, onSave }: {
  visible: boolean; current: string; onClose: () => void; onSave: (cat: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState(current);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (visible) setSelected(current); }, [visible, current]);

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(selected); }
    catch (e: any) { Alert.alert("Error", e.message ?? "Could not update category."); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalSheet}>
          <View style={s.sheetHandle} />
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Change Category</Text>
            <TouchableOpacity onPress={onClose} style={s.modalCloseBtn}>
              <Ionicons name="close" size={20} color={colors.navy} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={s.categoryGrid}>
              {COMMUNITY_CATEGORIES.map((cat) => {
                const accent = ACCENT_COLORS[cat] ?? "#6B7280";
                const icon = CATEGORY_ICONS[cat] ?? "globe-outline";
                const isSel = selected === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[s.categoryChip, isSel && { backgroundColor: accent, borderColor: accent }]}
                    onPress={() => setSelected(cat)}
                  >
                    <Ionicons name={icon} size={14} color={isSel ? colors.white : accent} />
                    <Text style={[s.categoryChipText, { color: isSel ? colors.white : colors.navy }]}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
          <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.white} /> : <Text style={s.saveBtnText}>Apply Category</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Color Picker Modal ───────────────────────────────────────────────────────

function ColorPickerModal({ visible, current, onClose, onSave }: {
  visible: boolean; current: string | null; onClose: () => void; onSave: (color: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string | null>(current);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (visible) setSelected(current); }, [visible, current]);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try { await onSave(selected); }
    catch (e: any) { Alert.alert("Error", e.message ?? "Could not update color."); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalSheet}>
          <View style={s.sheetHandle} />
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Banner Color</Text>
            <TouchableOpacity onPress={onClose} style={s.modalCloseBtn}>
              <Ionicons name="close" size={20} color={colors.navy} />
            </TouchableOpacity>
          </View>
          <Text style={s.fieldLabel}>Pick a color for the hero banner</Text>
          <View style={s.colorGrid}>
            {BANNER_COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                style={[s.colorSwatch, { backgroundColor: color }, selected === color && s.colorSwatchSelected]}
                onPress={() => setSelected(color)}
              >
                {selected === color && <Ionicons name="checkmark" size={18} color={colors.white} />}
              </TouchableOpacity>
            ))}
          </View>
          {selected && (
            <View style={[s.colorPreview, { backgroundColor: selected }]}>
              <Text style={s.colorPreviewText}>Preview</Text>
            </View>
          )}
          <TouchableOpacity
            style={[s.saveBtn, (!selected || saving) && { opacity: 0.6 }]}
            onPress={handleSave} disabled={!selected || saving}
          >
            {saving ? <ActivityIndicator color={colors.white} /> : <Text style={s.saveBtnText}>Apply Color</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const HERO_HEIGHT = 240;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  center: { alignItems: "center", justifyContent: "center" },

  hero: { height: HERO_HEIGHT, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.18)" },
  heroIconWrap: { width: 96, height: 96, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  heroBtn: {
    position: "absolute", width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.32)", alignItems: "center", justifyContent: "center",
  },

  memberPillWrap: { paddingHorizontal: 20, marginTop: -24, zIndex: 10 },
  memberPill: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.cardBg,
    borderRadius: 50, paddingVertical: 10, paddingHorizontal: 16, gap: 10, ...cardShadow,
  },
  avatarsRow: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.cardBg },
  avatarText: { fontSize: 12, fontWeight: "700", color: colors.white },
  memberCountText: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.navy },
  joinPillBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: colors.navy, minWidth: 64, alignItems: "center" },
  joinPillBtnActive: { backgroundColor: colors.surfaceGray, borderWidth: 1, borderColor: colors.border },
  joinPillBtnText: { fontSize: 13, fontWeight: "700", color: colors.white },
  joinPillBtnTextActive: { color: colors.muted },

  scroll: { flex: 1 },
  body: { paddingHorizontal: 20, paddingTop: 20 },
  communityName: { fontSize: 28, fontWeight: "800", color: colors.navy, lineHeight: 36, marginBottom: 20 },

  infoSection: { gap: 12, marginBottom: 24 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.cardBg, borderRadius: radii.card, padding: 14, ...cardShadow },
  infoIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  infoText: { flex: 1, gap: 2 },
  infoLabel: { fontSize: 12, color: colors.muted, fontWeight: "500" },
  infoValue: { fontSize: 15, fontWeight: "600", color: colors.navy },

  aboutSection: { backgroundColor: colors.cardBg, borderRadius: radii.card, padding: 18, ...cardShadow, marginBottom: 16 },
  aboutTitle: { fontSize: 16, fontWeight: "700", color: colors.navy, marginBottom: 10 },
  aboutBody: { fontSize: 15, color: colors.muted, lineHeight: 24 },

  // Members card
  membersCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: colors.cardBg, borderRadius: radii.card, padding: 16, gap: 12,
    marginBottom: 16, ...cardShadow,
  },
  membersCardLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  membersCardIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  membersCardTitle: { fontSize: 15, fontWeight: "700", color: colors.navy },
  membersCardSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  membersAvatarRow: { flexDirection: "row", alignItems: "center" },
  smallAvatar: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.cardBg },
  smallAvatarText: { fontSize: 10, fontWeight: "700", color: colors.white },

  // Sticky CTA
  stickyBottom: { backgroundColor: colors.cardBg, paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  ctaBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: radii.pill, paddingVertical: 16, gap: 10 },
  ctaBtnText: { fontSize: 15, fontWeight: "700", color: colors.white, letterSpacing: 0.3 },
  ctaArrow: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },

  // Settings sheet
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { backgroundColor: colors.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginTop: 12, marginBottom: 4 },
  sheetTitle: { fontSize: 17, fontWeight: "800", color: colors.navy, marginBottom: 14, marginTop: 10 },
  settingRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  settingIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  settingLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.navy },
  settingSubLabel: { fontSize: 12, color: colors.muted, marginTop: 1 },

  // Modal shared
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: { backgroundColor: colors.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 40, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16, marginTop: 10 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: colors.navy },
  modalCloseBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceGray, alignItems: "center", justifyContent: "center" },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: colors.navy, marginBottom: 8, marginTop: 4 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.input, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, backgroundColor: colors.inputBg, color: colors.navy },
  textArea: { minHeight: 100, textAlignVertical: "top", paddingTop: 13 },
  charCount: { fontSize: 11, color: colors.muted, textAlign: "right", marginTop: 4 },
  errorText: { color: colors.error, fontSize: 13, fontWeight: "500", marginTop: 8 },
  saveBtn: { borderRadius: radii.pill, paddingVertical: 15, alignItems: "center", backgroundColor: colors.navy, marginTop: 20 },
  saveBtnText: { fontSize: 15, fontWeight: "700", color: colors.white },

  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  categoryChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.inputBg },
  categoryChipText: { fontSize: 13, fontWeight: "500" },

  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 4, marginBottom: 16 },
  colorSwatch: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  colorSwatchSelected: { borderWidth: 3, borderColor: colors.white, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 4 },
  colorPreview: { height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  colorPreviewText: { fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.9)" },

  notFoundText: { fontSize: 16, color: colors.muted, marginTop: 12, marginBottom: 20 },
  backLink: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: radii.pill, backgroundColor: colors.navy },
  backLinkText: { fontSize: 14, fontWeight: "700", color: colors.white },

  // Events section
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.navy },
  addEventBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 7, borderRadius: radii.pill },
  addEventBtnText: { fontSize: 13, fontWeight: "700", color: colors.white },
  eventsEmpty: { alignItems: "center", paddingVertical: 28, gap: 8, backgroundColor: colors.cardBg, borderRadius: radii.card, marginBottom: 16, ...cardShadow },
  eventsEmptyText: { fontSize: 14, color: colors.muted },
});

// Members modal styles
const ms = StyleSheet.create({
  center: { height: 120, alignItems: "center", justifyContent: "center" },
  memberRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12 },
  memberAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  memberAvatarText: { fontSize: 16, fontWeight: "700", color: colors.white },
  memberInfo: { flex: 1, gap: 2 },
  memberNameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  memberName: { fontSize: 15, fontWeight: "600", color: colors.navy },
  memberRole: { fontSize: 12, color: colors.muted },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.pill },
  badgeText: { fontSize: 11, fontWeight: "700" },
  adminBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill,
    backgroundColor: colors.navy, minWidth: 90, alignItems: "center",
  },
  adminBtnActive: { backgroundColor: colors.surfaceGray, borderWidth: 1, borderColor: colors.border },
  adminBtnText: { fontSize: 12, fontWeight: "600", color: colors.white },
  adminBtnTextActive: { color: colors.muted },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: 54 },
});

// Event card styles
const ev = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg, borderRadius: radii.card,
    padding: 16, marginBottom: 14, ...cardShadow,
  },
  cardTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 },
  cardName: { fontSize: 16, fontWeight: "800", color: colors.navy, flex: 1, lineHeight: 22 },
  fullBadge: { backgroundColor: colors.error + "18", paddingHorizontal: 10, paddingVertical: 3, borderRadius: radii.pill, flexShrink: 0 },
  fullBadgeText: { fontSize: 11, fontWeight: "800", color: colors.error, letterSpacing: 0.5 },
  priceBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radii.pill, flexShrink: 0 },
  priceBadgeText: { fontSize: 12, fontWeight: "700" },
  metaSection: { gap: 5, marginBottom: 10 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontSize: 13, color: colors.muted, flex: 1 },
  about: { fontSize: 14, color: colors.muted, lineHeight: 20, marginBottom: 12 },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  ctaBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderRadius: radii.pill, paddingVertical: 11,
    borderWidth: 1.5,
  },
  ctaBtnActive: { backgroundColor: colors.surfaceGray, borderColor: colors.border },
  ctaBtnDisabled: { backgroundColor: colors.surfaceGray, borderColor: colors.border },
  ctaBtnText: { fontSize: 14, fontWeight: "700" },
});

// Create event modal styles
const cev = StyleSheet.create({
  ticketTypeRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  typeBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 11, borderRadius: radii.pill,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.inputBg,
  },
  typeBtnText: { fontSize: 14, fontWeight: "600" },
});
