import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConvex } from "convex/react";
import { usePropertyRole } from "../../context/PropertyRoleContext";

const C = {
  navy: "#1E293B",
  muted: "#6B7280",
  border: "#E2E8F0",
  white: "#FFFFFF",
  error: "#DC2626",
  pageBg: "#EEF2F6",
  accent: "#D4F542",
  orange: "#F59E0B",
};

type Member = {
  _id: string;
  role: "owner" | "manager";
  joinedAt: number;
  user: { _id: string; name?: string; email?: string; imageUrl?: string } | null;
};

type PendingInvite = {
  _id: string;
  email: string;
  expiresAt: number;
};

type Team = { members: Member[]; pendingInvites: PendingInvite[] };

export default function TeamScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const convex = useConvex();
  const { activePropertyId, isOwner } = usePropertyRole();

  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const fetchTeam = useCallback(async () => {
    if (!activePropertyId) return;
    try {
      const data = await (convex as any).query("propertyMembers:getTeam", {
        propertyId: activePropertyId,
      });
      setTeam(data);
    } catch (e) {
      // silently fail — user may not be a member yet
    } finally {
      setLoading(false);
    }
  }, [activePropertyId, convex]);

  useFocusEffect(useCallback(() => { fetchTeam(); }, [fetchTeam]));

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !activePropertyId) return;
    setInviting(true);
    try {
      const result = await (convex as any).mutation("propertyMembers:inviteManager", {
        propertyId: activePropertyId,
        email: inviteEmail.trim().toLowerCase(),
      });
      setShowInviteModal(false);
      setInviteEmail("");
      fetchTeam();
      Alert.alert(
        "Invite sent",
        `An email with instructions has been sent to ${inviteEmail}.`,
        [{ text: "OK" }]
      );
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not send invite");
    } finally {
      setInviting(false);
    }
  };

  const handleRevoke = (inviteId: string, email: string) => {
    Alert.alert("Revoke invite", `Revoke invite for ${email}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Revoke",
        style: "destructive",
        onPress: async () => {
          try {
            await (convex as any).mutation("propertyMembers:revokeInvite", { inviteId });
            fetchTeam();
          } catch (e: any) {
            Alert.alert("Error", e.message);
          }
        },
      },
    ]);
  };

  const handleRemove = (membershipId: string, name: string) => {
    Alert.alert("Remove member", `Remove ${name} from this property?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await (convex as any).mutation("propertyMembers:removeMember", { membershipId });
            fetchTeam();
          } catch (e: any) {
            Alert.alert("Error", e.message);
          }
        },
      },
    ]);
  };

  if (!activePropertyId) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <View style={styles.emptyWrap}>
          <Ionicons name="people-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>No property selected</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={styles.title}>Team</Text>
        {isOwner && (
          <TouchableOpacity
            style={styles.inviteBtn}
            onPress={() => setShowInviteModal(true)}
          >
            <Ionicons name="person-add-outline" size={18} color={C.navy} />
            <Text style={styles.inviteBtnText}>Invite</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.emptyWrap}>
          <ActivityIndicator color={C.navy} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionLabel}>Members</Text>
          {team?.members.map((m) => (
            <View key={m._id} style={styles.card}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {((m.user?.name ?? m.user?.email ?? "?")[0] ?? "?").toUpperCase()}
                </Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{m.user?.name ?? "Unknown"}</Text>
                <Text style={styles.cardEmail}>{m.user?.email ?? ""}</Text>
              </View>
              <View style={styles.cardRight}>
                <View style={[styles.rolePill, m.role === "owner" ? styles.ownerPill : styles.managerPill]}>
                  <Text style={[styles.roleText, m.role === "owner" ? styles.ownerText : styles.managerText]}>
                    {m.role}
                  </Text>
                </View>
                {isOwner && m.role === "manager" && (
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => handleRemove(m._id, m.user?.name ?? "this member")}
                  >
                    <Ionicons name="trash-outline" size={16} color={C.error} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}

          {isOwner && (team?.pendingInvites.length ?? 0) > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Pending Invites</Text>
              {team?.pendingInvites.map((inv) => (
                <View key={inv._id} style={styles.card}>
                  <View style={[styles.avatar, { backgroundColor: "#FEF3C7" }]}>
                    <Ionicons name="mail-outline" size={20} color={C.orange} />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>{inv.email}</Text>
                    <Text style={styles.cardEmail}>
                      Expires {new Date(inv.expiresAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => handleRevoke(inv._id, inv.email)}
                  >
                    <Ionicons name="close-circle-outline" size={20} color={C.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          {!isOwner && (
            <View style={styles.noticeCard}>
              <Ionicons name="information-circle-outline" size={18} color={C.muted} />
              <Text style={styles.noticeText}>
                You are a manager on this property. Tenant contact details are hidden.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Invite Modal */}
      <Modal visible={showInviteModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Invite Manager</Text>
            <Text style={styles.modalSubtitle}>
              Managers can do everything except view tenant contact details.
            </Text>
            <Text style={styles.inputLabel}>Email address</Text>
            <TextInput
              style={styles.input}
              placeholder="manager@example.com"
              placeholderTextColor={C.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={inviteEmail}
              onChangeText={setInviteEmail}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setShowInviteModal(false); setInviteEmail(""); }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, (!inviteEmail.trim() || inviting) && styles.sendBtnDisabled]}
                onPress={handleInvite}
                disabled={!inviteEmail.trim() || inviting}
              >
                {inviting ? (
                  <ActivityIndicator color={C.navy} size="small" />
                ) : (
                  <Text style={styles.sendText}>Send Invite</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.pageBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  backBtn: { padding: 4 },
  title: { flex: 1, fontSize: 24, fontWeight: "800", color: C.navy },
  inviteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  inviteBtnText: { fontSize: 14, fontWeight: "700", color: C.navy },
  scroll: { paddingHorizontal: 20 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: C.muted,
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EEF2F6",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 16, fontWeight: "700", color: C.navy },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 14, fontWeight: "700", color: C.navy },
  cardEmail: { fontSize: 12, color: C.muted, marginTop: 2 },
  cardRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  rolePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  ownerPill: { backgroundColor: "#EFF6FF" },
  managerPill: { backgroundColor: "#F0FDF4" },
  roleText: { fontSize: 12, fontWeight: "700" },
  ownerText: { color: "#2563EB" },
  managerText: { color: "#16A34A" },
  removeBtn: { padding: 4 },
  noticeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  noticeText: { flex: 1, fontSize: 13, color: C.muted, lineHeight: 18 },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 15, color: C.muted },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalSheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: C.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: C.navy, marginBottom: 6 },
  modalSubtitle: { fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 18 },
  inputLabel: { fontSize: 12, fontWeight: "700", color: C.muted, marginBottom: 8 },
  input: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: C.navy,
    marginBottom: 20,
  },
  modalActions: { flexDirection: "row", gap: 12 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: "center",
  },
  cancelText: { fontSize: 15, fontWeight: "700", color: C.muted },
  sendBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: C.accent,
    alignItems: "center",
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { fontSize: 15, fontWeight: "700", color: C.navy },
});
