import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useConvex } from "convex/react";
import { colors } from "../../../constants/theme";

type Priority = "High" | "Medium" | "Low";

type ManagePayload = {
  notFound: false;
  legalNameAsOnId: string;
  propertyName: string;
};

type AssignmentPayload =
  | { notFound: true }
  | { notFound: false; alreadyAssigned: true; assignedRoomNumber: string | null }
  | {
      notFound: false;
      alreadyAssigned: false;
      availableRooms: Array<{ roomId: string; roomLabel: string }>;
    };

function getPriorityTone(priority: Priority) {
  if (priority === "High") {
    return { bg: "#FEE2E2", border: "#FECACA", text: "#B91C1C" };
  }
  if (priority === "Medium") {
    return { bg: "#FEF3C7", border: "#FDE68A", text: "#92400E" };
  }
  return { bg: "#DCFCE7", border: "#BBF7D0", text: "#166534" };
}

export default function TaskDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const convex = useConvex();
  const {
    applicationId,
    taskDescription,
    priority,
    dueLabel,
    tenantName,
  } = useLocalSearchParams<{
    applicationId: string;
    taskDescription?: string;
    priority?: Priority;
    dueLabel?: string;
    tenantName?: string;
  }>();

  const [resolvedTenantName, setResolvedTenantName] = useState<string | null>(null);
  const [propertyName, setPropertyName] = useState<string | null>(null);
  const [assignmentData, setAssignmentData] = useState<AssignmentPayload | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignMessage, setAssignMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!applicationId || typeof applicationId !== "string") {
      setLoading(false);
      return;
    }
    try {
      const [manageRes, assignmentRes] = await Promise.all([
        (convex as any).query("properties:getTenantManageDetails", {
          applicationId,
        }),
        (convex as any).query("properties:getRoomAssignmentTask", {
          applicationId,
        }),
      ]);
      if (manageRes && !manageRes.notFound) {
        const data = manageRes as ManagePayload;
        setResolvedTenantName(data.legalNameAsOnId);
        setPropertyName(data.propertyName);
      }
      setAssignmentData((assignmentRes ?? null) as AssignmentPayload | null);
      if (assignmentRes && !assignmentRes.notFound && !assignmentRes.alreadyAssigned) {
        setSelectedRoomId(assignmentRes.availableRooms[0]?.roomId ?? null);
      }
    } catch {
      // Keep fallback values from route params if query fails.
      setAssignmentData(null);
    } finally {
      setLoading(false);
    }
  }, [applicationId, convex]);

  useEffect(() => {
    void load();
  }, [load]);

  const finalPriority: Priority = priority ?? "High";
  const tone = getPriorityTone(finalPriority);
  const finalTaskDescription = taskDescription ?? "Task details";
  const finalDueLabel = dueLabel ?? "Due soon";
  const finalTenantName = resolvedTenantName ?? tenantName ?? "Tenant";

  const assignRoom = useCallback(async () => {
    if (!applicationId || typeof applicationId !== "string" || !selectedRoomId) return;
    setAssigning(true);
    setAssignMessage(null);
    try {
      const res = await (convex as any).mutation("properties:assignRoomToTenant", {
        applicationId,
        roomId: selectedRoomId,
      });
      const roomNumber =
        typeof res?.assignedRoomNumber === "string" ? res.assignedRoomNumber : null;
      setAssignMessage(
        roomNumber ? `Room ${roomNumber} assigned successfully.` : "Room assigned successfully.",
      );
      await load();
    } catch (err) {
      setAssignMessage(
        err instanceof Error ? err.message : "Could not assign room. Please try again.",
      );
    } finally {
      setAssigning(false);
    }
  }, [applicationId, convex, load, selectedRoomId]);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable
            style={styles.roundBtn}
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color={colors.black} />
          </Pressable>
          <Text style={styles.topTitle}>Task Details</Text>
          <View style={{ width: 44, height: 44 }} />
        </View>

        <View style={styles.card}>
          <View style={styles.topRow}>
            <View
              style={[
                styles.priorityTag,
                { backgroundColor: tone.bg, borderColor: tone.border },
              ]}
            >
              <Text style={[styles.priorityTagText, { color: tone.text }]}>
                {finalPriority} Priority
              </Text>
            </View>
            <Text style={styles.dueText}>{finalDueLabel}</Text>
          </View>

          <Text style={styles.taskTitle}>{finalTaskDescription}</Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Tenant</Text>
            <Text style={styles.metaValue}>{finalTenantName}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Application</Text>
            <Text style={styles.metaValue} numberOfLines={1}>
              {applicationId}
            </Text>
          </View>
          {propertyName ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Property</Text>
              <Text style={styles.metaValue}>{propertyName}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderTitle}>Available Rooms</Text>
          <Text style={styles.placeholderBody}>
            Select a room and assign it to this tenant.
          </Text>

          {!loading && assignmentData?.notFound ? (
            <Text style={styles.infoText}>Room assignment task not found.</Text>
          ) : null}

          {!loading && assignmentData && !assignmentData.notFound && assignmentData.alreadyAssigned ? (
            <Text style={styles.infoText}>
              Already assigned to room {assignmentData.assignedRoomNumber ?? "—"}.
            </Text>
          ) : null}

          {!loading &&
          assignmentData &&
          !assignmentData.notFound &&
          !assignmentData.alreadyAssigned ? (
            <>
              <View style={styles.roomGrid}>
                {assignmentData.availableRooms.map((room) => {
                  const selected = selectedRoomId === room.roomId;
                  return (
                    <Pressable
                      key={room.roomId}
                      style={[
                        styles.roomChip,
                        selected ? styles.roomChipSelected : null,
                      ]}
                      onPress={() => setSelectedRoomId(room.roomId)}
                    >
                      <Text
                        style={[
                          styles.roomChipText,
                          selected ? styles.roomChipTextSelected : null,
                        ]}
                      >
                        {room.roomLabel}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                style={[
                  styles.assignBtn,
                  (!selectedRoomId || assigning) && styles.assignBtnDisabled,
                ]}
                disabled={!selectedRoomId || assigning}
                onPress={() => void assignRoom()}
              >
                <Text style={styles.assignBtnText}>
                  {assigning ? "Assigning..." : "Assign selected room"}
                </Text>
              </Pressable>
            </>
          ) : null}

          {assignMessage ? <Text style={styles.infoText}>{assignMessage}</Text> : null}

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Loading latest tenant data...</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  topTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: colors.black,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    padding: 16,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  priorityTag: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  priorityTagText: {
    fontSize: 11,
    fontWeight: "700",
  },
  dueText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "500",
  },
  taskTitle: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "800",
    color: colors.black,
    marginBottom: 14,
  },
  metaRow: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 10,
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  metaLabel: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "600",
  },
  metaValue: {
    fontSize: 13,
    color: colors.black,
    fontWeight: "700",
    maxWidth: "62%",
    textAlign: "right",
  },
  placeholderCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    padding: 16,
  },
  placeholderTitle: {
    fontSize: 16,
    color: colors.black,
    fontWeight: "800",
    marginBottom: 8,
  },
  placeholderBody: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
  },
  loadingRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: colors.muted,
  },
  roomGrid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  roomChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#F8FAFC",
  },
  roomChipSelected: {
    backgroundColor: "#DBEAFE",
    borderColor: "#93C5FD",
  },
  roomChipText: {
    fontSize: 13,
    color: colors.navy,
    fontWeight: "600",
  },
  roomChipTextSelected: {
    color: "#1D4ED8",
    fontWeight: "700",
  },
  assignBtn: {
    marginTop: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingVertical: 12,
    backgroundColor: colors.primary,
  },
  assignBtnDisabled: {
    opacity: 0.5,
  },
  assignBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.white,
  },
  infoText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },
});
