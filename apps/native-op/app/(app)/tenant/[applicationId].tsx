import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  Linking,
  Platform,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useConvex } from "convex/react";
import {
  colors,
  radii,
  card as cardStyle,
  cardShadow,
} from "../../../constants/theme";

type AvailableRoom = {
  roomId: string;
  roomNumber: string;
  displayName?: string;
  category?: string;
  roomOptionId?: string | null;
  rentAmount?: number | null;
};

type ManagePayload = {
  notFound: false;
  applicationId: string;
  propertyId: string;
  propertyName: string;
  legalNameAsOnId: string;
  tenantImageUrl?: string;
  phone: string;
  email: string;
  moveInDate?: string;
  paymentStatus?: "paid" | "pending";
  paymentMethod?: string;
  assignedRoomId?: string;
  assignedRoomNumber?: string;
  selectedRoomOptionId?: string;
  rentAmount?: number;
  onboardingAgreementDuration?: string;
  metaLine: string;
  agreementDuration?: string;
  agreementLockIn?: string;
  checklist: {
    percentRemaining: number;
    completedCount: number;
    totalSteps: number;
    segmentFilled: boolean[];
    currentTaskLabel: string;
    steps: Array<{ key: string; label: string; done: boolean }>;
  };
};

function digitsForWhatsApp(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  return d;
}

const DURATION_OPTIONS = [1, 3, 6, 9, 12] as const;

export default function TenantManageScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const convex = useConvex();
  const { applicationId } = useLocalSearchParams<{
    applicationId: string;
  }>();

  const [data, setData] = useState<ManagePayload | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checklistExpanded, setChecklistExpanded] = useState(false);

  // Shift tenant modal state
  const [shiftModalVisible, setShiftModalVisible] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<AvailableRoom | null>(null);
  const [shiftReason, setShiftReason] = useState("");
  const [shiftRentInput, setShiftRentInput] = useState("");
  const [shifting, setShifting] = useState(false);

  // Extend stay modal state
  const [extendModalVisible, setExtendModalVisible] = useState(false);
  const [extendMonths, setExtendMonths] = useState(3);
  const [sendingLink, setSendingLink] = useState(false);

  const load = useCallback(async () => {
    if (!applicationId || typeof applicationId !== "string") {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    try {
      const res = await (convex as any).query(
        "properties:getTenantManageDetails",
        { applicationId },
      );
      if (res?.notFound) {
        setNotFound(true);
        setData(null);
      } else {
        setData(res as ManagePayload);
      }
    } catch {
      setNotFound(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [convex, applicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openWhatsApp = () => {
    if (!data?.phone) return;
    const n = digitsForWhatsApp(data.phone);
    if (!n) return;
    const url = `https://wa.me/${n}`;
    void Linking.openURL(url);
  };

  const openCall = () => {
    if (!data?.phone) return;
    const cleaned = data.phone.replace(/[^\d+]/g, "");
    void Linking.openURL(`tel:${cleaned || data.phone}`);
  };

  const openShiftModal = async () => {
    if (!data?.applicationId) return;
    setShiftModalVisible(true);
    setSelectedRoom(null);
    setShiftReason("");
    setShiftRentInput("");
    setLoadingRooms(true);
    try {
      const rooms = await (convex as any).query(
        "properties:getAvailableRoomsForShift",
        { applicationId: data.applicationId },
      );
      setAvailableRooms(rooms ?? []);
    } catch {
      setAvailableRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  };

  const confirmShift = async () => {
    if (!selectedRoom || !data?.applicationId) return;
    if (!shiftReason.trim()) {
      Alert.alert("Reason required", "Please provide a reason for the room change.");
      return;
    }
    const parsedRent = shiftRentInput.trim() ? parseFloat(shiftRentInput.trim()) : null;
    if (shiftRentInput.trim() && (isNaN(parsedRent!) || parsedRent! <= 0)) {
      Alert.alert("Invalid rent", "Please enter a valid rent amount.");
      return;
    }
    setShifting(true);
    try {
      await (convex as any).mutation("properties:operatorShiftTenant", {
        applicationId: data.applicationId,
        newRoomId: selectedRoom.roomId,
        reason: shiftReason.trim(),
        ...(parsedRent ? { newRentAmount: parsedRent } : {}),
      });
      setShiftModalVisible(false);
      Alert.alert(
        "Room changed",
        `${data.legalNameAsOnId} has been moved to room ${selectedRoom.roomNumber}.`,
      );
      void load(); // refresh data
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to shift tenant.");
    } finally {
      setShifting(false);
    }
  };

  const openExtendModal = () => {
    if (!data?.rentAmount) {
      Alert.alert(
        "Rent not set",
        "No rent amount is linked to this tenant's room option. Please assign a room type with rent first.",
      );
      return;
    }
    setExtendMonths(3);
    setExtendModalVisible(true);
  };

  const confirmExtendStay = async () => {
    if (!data?.applicationId || !data.rentAmount) return;
    setSendingLink(true);
    try {
      const res = await (convex as any).mutation(
        "rentTransactions:sendExtendStayPaymentLink",
        { applicationId: data.applicationId, months: extendMonths },
      );
      setExtendModalVisible(false);
      Alert.alert(
        "Payment link sent",
        `A payment of ₹${(res.amount as number).toLocaleString("en-IN")} for ${res.months} month${res.months > 1 ? "s" : ""} has been sent to ${data.legalNameAsOnId}.`,
      );
      void load();
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to send payment link.");
    } finally {
      setSendingLink(false);
    }
  };

  const handleRemoveTenant = () => {
    if (!data?.applicationId) return;
    Alert.alert(
      "Remove tenant?",
      `This will end ${data.legalNameAsOnId}'s tenancy and notify them. The records will be preserved for your reference.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await (convex as any).mutation(
                "properties:operatorRemoveTenant",
                { applicationId: data.applicationId },
              );
              router.back();
            } catch (err: any) {
              Alert.alert("Error", err?.message ?? "Failed to remove tenant.");
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.mutedSmall}>Loading tenant…</Text>
      </View>
    );
  }

  if (notFound || !data) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top, paddingHorizontal: 24 }]}>
        <Text style={styles.errorTitle}>Tenant not found</Text>
        <Text style={styles.errorBody}>
          This tenant may have been removed or you don’t have access.
        </Text>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.back()}
        >
          <Text style={styles.primaryBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const { checklist } = data;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 120 },
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
          <Pressable style={styles.roundBtn} hitSlop={12} accessibilityLabel="Settings">
            <Ionicons name="settings-outline" size={20} color={colors.black} />
          </Pressable>
        </View>

        <View style={styles.heroRow}>
          <View style={styles.heroText}>
            <Text style={styles.propertyName}>{data.propertyName}</Text>
            <Text style={styles.tenantName}>{data.legalNameAsOnId}</Text>
            <Text style={styles.metaLine}>{data.metaLine}</Text>
            {data.assignedRoomNumber?.trim() ? (
              <View style={styles.assignedRow}>
                <Ionicons name="bed-outline" size={16} color={colors.muted} />
                <Text style={styles.assignedText}>
                  Assigned room: {data.assignedRoomNumber}
                </Text>
              </View>
            ) : null}
          </View>
          {data.tenantImageUrl ? (
            <Image source={{ uri: data.tenantImageUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={32} color={colors.muted} />
            </View>
          )}
        </View>

        <View style={[styles.card, styles.checklistCard]}>
          <View style={styles.checklistHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Tenant move-in checklist</Text>
              <Text style={styles.checklistSub}>
                {checklist.percentRemaining}% remaining
              </Text>
            </View>
            <View style={styles.checklistActions}>
              <Pressable style={styles.iconCircle} hitSlop={8}>
                <Ionicons name="share-outline" size={18} color={colors.navy} />
              </Pressable>
              <Pressable style={styles.iconCircle} hitSlop={8}>
                <Ionicons name="time-outline" size={18} color={colors.navy} />
              </Pressable>
            </View>
          </View>

          <View style={styles.segmentRow}>
            {checklist.segmentFilled.map((filled, i) => (
              <View
                key={i}
                style={[
                  styles.segment,
                  filled ? styles.segmentOn : styles.segmentOff,
                ]}
              />
            ))}
          </View>

          <View style={styles.currentTaskRow}>
            <Ionicons name="person-add-outline" size={20} color={colors.primary} />
            <Text style={styles.currentTaskText} numberOfLines={2}>
              {checklist.currentTaskLabel}
            </Text>
          </View>

          <Pressable
            style={styles.viewAllRow}
            onPress={() => setChecklistExpanded((v) => !v)}
          >
            <Text style={styles.viewAllText}>
              {checklistExpanded ? "Hide details" : "View all"}
            </Text>
            <Ionicons
              name={checklistExpanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.muted}
            />
          </Pressable>

          {checklistExpanded ? (
            <View style={styles.stepList}>
              {checklist.steps.map((step) => (
                <View key={step.key} style={styles.stepRow}>
                  <Ionicons
                    name={step.done ? "checkmark-circle" : "ellipse-outline"}
                    size={20}
                    color={step.done ? colors.positiveAmount : colors.muted}
                  />
                  <Text
                    style={[
                      styles.stepLabel,
                      step.done && styles.stepLabelDone,
                    ]}
                  >
                    {step.label}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <ActionRow
          icon="checkmark-circle"
          iconBg={colors.inputBg}
          title="Move-in date"
          subtitle={formatMoveInDisplay(data.moveInDate)}
          right={
            <View style={styles.badgeDone}>
              <Text style={styles.badgeDoneText}>Completed</Text>
            </View>
          }
        />

        <ActionRow
          icon="business-outline"
          iconBg={colors.inputBg}
          title="Shift tenant"
          subtitle={
            data.assignedRoomNumber
              ? `Current room: ${data.assignedRoomNumber}`
              : "Change room or property."
          }
          right={
            <Pressable style={styles.outlineBtnSm} onPress={openShiftModal}>
              <Text style={styles.outlineBtnSmText}>Change</Text>
            </Pressable>
          }
        />

        <ActionRow
          icon="document-text-outline"
          iconBg={colors.inputBg}
          title="Agreement"
          subtitle={
            data.onboardingAgreementDuration
              ? `Duration: ${data.onboardingAgreementDuration}`
              : data.agreementDuration
                ? `Duration: ${data.agreementDuration}`
                : data.agreementLockIn
                  ? `Lock-in: ${data.agreementLockIn}`
                  : "Agreement on file"
          }
          right={
            <Pressable style={styles.outlineBtnSm} onPress={openExtendModal}>
              <Text style={styles.outlineBtnSmText}>Extend stay</Text>
            </Pressable>
          }
        />

        <View style={[styles.card, styles.offboardCard]}>
          <View style={styles.offboardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: colors.inputBg }]}>
              <Ionicons name="arrow-up-outline" size={18} color={colors.error} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.offboardTitle}>Tenant moving out?</Text>
              <Text style={styles.offboardBody}>
                Set a move-out date to vacate the unit. You can still view tenant
                records afterward.
              </Text>
            </View>
          </View>
          <Pressable style={styles.removeBtn} onPress={handleRemoveTenant}>
            <Text style={styles.removeBtnText}>Remove tenant</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Quick links</Text>
        <Pressable
          style={styles.quickLink}
          onPress={() =>
            router.push("/(app)/(tabs)/transfer" as Href)
          }
        >
          <Text style={styles.quickLinkText}>Collections & payments</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        <Text style={[styles.sectionLabel, styles.viewDetailsHeading]}>
          View details
        </Text>
        <View style={styles.viewDetailsCard}>
          <View
            style={[
              styles.viewDetailsBanner,
              checklist.percentRemaining > 0
                ? styles.viewDetailsBannerPending
                : styles.viewDetailsBannerDone,
            ]}
          >
            <Ionicons
              name={
                checklist.percentRemaining > 0
                  ? "key-outline"
                  : "checkmark-circle-outline"
              }
              size={18}
              color={
                checklist.percentRemaining > 0 ? "#B45309" : "#166534"
              }
            />
            <Text
              style={
                checklist.percentRemaining > 0
                  ? styles.viewDetailsBannerTextPending
                  : styles.viewDetailsBannerTextDone
              }
            >
              {checklist.percentRemaining > 0
                ? "Onboarding checklist pending"
                : "All onboarding steps complete"}
            </Text>
          </View>

          <View style={styles.viewDetailsActions}>
            <Pressable
              style={styles.viewDetailsAction}
              onPress={() =>
                Alert.alert(
                  "Terms",
                  [
                    data.agreementDuration &&
                      `Agreement duration: ${data.agreementDuration}`,
                    data.agreementLockIn && `Lock-in: ${data.agreementLockIn}`,
                    "Rental terms are recorded with this tenancy.",
                  ]
                    .filter(Boolean)
                    .join("\n") || "No agreement terms on file for this property.",
                )
              }
            >
              <View style={styles.viewDetailsIconCircle}>
                <Ionicons name="business-outline" size={22} color={colors.navy} />
              </View>
              <Text style={styles.viewDetailsActionLabel}>Terms</Text>
            </Pressable>

            <Pressable
              style={styles.viewDetailsAction}
              onPress={() =>
                Alert.alert(
                  "Documents",
                  "ID proofs and move-in documents submitted by the tenant are stored with this application. Full document viewer is coming soon.",
                )
              }
            >
              <View style={styles.viewDetailsIconCircle}>
                <Ionicons
                  name="document-attach-outline"
                  size={22}
                  color={colors.navy}
                />
              </View>
              <Text style={styles.viewDetailsActionLabel}>Documents</Text>
            </Pressable>

            <Pressable
              style={styles.viewDetailsAction}
              onPress={() =>
                Alert.alert(
                  "Tenant profile",
                  [
                    `Name: ${data.legalNameAsOnId}`,
                    `Phone: ${data.phone}`,
                    `Email: ${data.email}`,
                  ].join("\n"),
                )
              }
            >
              <View style={styles.viewDetailsIconCircle}>
                <Ionicons name="person-outline" size={22} color={colors.navy} />
              </View>
              <Text style={styles.viewDetailsActionLabel}>Profile</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={shiftModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => !shifting && setShiftModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => !shifting && setShiftModalVisible(false)}
          />
          <View
            style={[
              styles.modalSheet,
              { paddingBottom: Math.max(insets.bottom, 20) },
            ]}
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Shift tenant</Text>
            <Text style={styles.modalSubtitle}>
              {data.assignedRoomNumber
                ? `Current room: ${data.assignedRoomNumber}`
                : "Select a new room"}
            </Text>

            {loadingRooms ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={{ marginVertical: 24 }}
              />
            ) : availableRooms.length === 0 ? (
              <View style={styles.emptyRooms}>
                <Ionicons name="bed-outline" size={28} color={colors.muted} />
                <Text style={styles.emptyRoomsText}>
                  No available rooms of the same type.
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.modalSectionLabel}>
                  Available rooms ({availableRooms.length})
                </Text>
                <ScrollView
                  style={styles.roomList}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  {availableRooms.map((room) => {
                    const isSelected = selectedRoom?.roomId === room.roomId;
                    return (
                      <Pressable
                        key={room.roomId}
                        style={[
                          styles.roomItem,
                          isSelected && styles.roomItemSelected,
                        ]}
                        onPress={() => {
                          setSelectedRoom(room);
                          setShiftRentInput(
                            room.rentAmount != null
                              ? String(room.rentAmount)
                              : "",
                          );
                        }}
                      >
                        <Ionicons
                          name={isSelected ? "radio-button-on" : "radio-button-off"}
                          size={22}
                          color={isSelected ? colors.primary : colors.muted}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.roomItemTitle}>
                            Room {room.roomNumber}
                          </Text>
                          <Text style={styles.roomItemSub}>
                            {[room.category, room.rentAmount != null ? `₹${room.rentAmount.toLocaleString("en-IN")}/mo` : "Rent not set"]
                              .filter(Boolean)
                              .join("  ·  ")}
                          </Text>
                        </View>
                        <View style={styles.roomBadgeEmpty}>
                          <Text style={styles.roomBadgeEmptyText}>Empty</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {selectedRoom ? (
                  <>
                    <Text style={styles.modalSectionLabel}>
                      Set rent for this room
                    </Text>
                    <View style={styles.rentInputRow}>
                      <Text style={styles.rentInputPrefix}>₹</Text>
                      <TextInput
                        style={styles.rentInput}
                        placeholder={
                          selectedRoom.rentAmount != null
                            ? String(selectedRoom.rentAmount)
                            : "Enter amount"
                        }
                        placeholderTextColor={colors.muted}
                        value={shiftRentInput}
                        onChangeText={setShiftRentInput}
                        keyboardType="numeric"
                      />
                      <Text style={styles.rentInputSuffix}>/month</Text>
                    </View>
                  </>
                ) : null}

                <Text style={styles.modalSectionLabel}>
                  Reason for change
                </Text>
                <TextInput
                  style={styles.reasonInput}
                  placeholder="e.g. Maintenance, tenant request…"
                  placeholderTextColor={colors.muted}
                  value={shiftReason}
                  onChangeText={setShiftReason}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />

                <Pressable
                  style={[
                    styles.confirmBtn,
                    (!selectedRoom || shifting) && styles.confirmBtnDisabled,
                  ]}
                  onPress={confirmShift}
                  disabled={!selectedRoom || shifting}
                >
                  {shifting ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.confirmBtnText}>
                      Confirm room change
                    </Text>
                  )}
                </Pressable>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={extendModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => !sendingLink && setExtendModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => !sendingLink && setExtendModalVisible(false)}
          />
          <View
            style={[
              styles.modalSheet,
              { paddingBottom: Math.max(insets.bottom, 20) },
            ]}
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Extend stay</Text>
            <Text style={styles.modalSubtitle}>
              Send a payment link to {data.legalNameAsOnId} for the extended
              duration.
            </Text>

            <Text style={styles.modalSectionLabel}>
              Extension duration (months)
            </Text>
            <View style={styles.durationRow}>
              {DURATION_OPTIONS.map((m) => {
                const active = extendMonths === m;
                return (
                  <Pressable
                    key={m}
                    style={[
                      styles.durationChip,
                      active && styles.durationChipActive,
                    ]}
                    onPress={() => setExtendMonths(m)}
                  >
                    <Text
                      style={[
                        styles.durationChipText,
                        active && styles.durationChipTextActive,
                      ]}
                    >
                      {m} {m === 1 ? "mo" : "mo"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.extendSummaryCard}>
              <View style={styles.extendSummaryRow}>
                <Text style={styles.extendSummaryLabel}>Monthly rent</Text>
                <Text style={styles.extendSummaryValue}>
                  ₹{(data.rentAmount ?? 0).toLocaleString("en-IN")}
                </Text>
              </View>
              <View style={styles.extendSummaryRow}>
                <Text style={styles.extendSummaryLabel}>Duration</Text>
                <Text style={styles.extendSummaryValue}>
                  {extendMonths} month{extendMonths > 1 ? "s" : ""}
                </Text>
              </View>
              <View style={styles.extendDivider} />
              <View style={styles.extendSummaryRow}>
                <Text style={styles.extendTotalLabel}>Total amount</Text>
                <Text style={styles.extendTotalValue}>
                  ₹{((data.rentAmount ?? 0) * extendMonths).toLocaleString("en-IN")}
                </Text>
              </View>
            </View>

            <Pressable
              style={[
                styles.confirmBtn,
                sendingLink && styles.confirmBtnDisabled,
              ]}
              onPress={confirmExtendStay}
              disabled={sendingLink}
            >
              {sendingLink ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.confirmBtnText}>
                  Send payment link
                </Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 12),
            paddingTop: 12,
          },
        ]}
      >
        <Pressable
          style={[styles.footerBtn, styles.footerWhatsApp]}
          onPress={openWhatsApp}
        >
          <Ionicons name="logo-whatsapp" size={22} color={colors.white} />
          <Text style={styles.footerBtnText}>WhatsApp</Text>
        </Pressable>
        <Pressable
          style={[styles.footerBtn, styles.footerCall]}
          onPress={openCall}
        >
          <Ionicons name="call-outline" size={22} color={colors.white} />
          <Text style={styles.footerBtnText}>Call</Text>
        </Pressable>
      </View>
    </View>
  );
}

function formatMoveInDisplay(raw?: string): string {
  if (!raw?.trim()) return "Not set";
  const t = raw.trim();
  const parsed = Date.parse(t);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  return t;
}

function ActionRow({
  icon,
  iconBg,
  title,
  subtitle,
  right,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  title: string;
  subtitle: string;
  right: React.ReactNode;
}) {
  return (
    <View style={styles.actionRow}>
      <View style={[styles.actionIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={colors.navy} />
      </View>
      <View style={styles.actionBody}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.pageBg,
  },
  mutedSmall: {
    marginTop: 10,
    fontSize: 14,
    color: colors.muted,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.black,
    marginBottom: 8,
    textAlign: "center",
  },
  errorBody: {
    fontSize: 15,
    color: colors.muted,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: radii.pill,
  },
  primaryBtnText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 15,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
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
  heroRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  heroText: {
    flex: 1,
    marginRight: 12,
  },
  propertyName: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.muted,
    marginBottom: 4,
  },
  tenantName: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.black,
    letterSpacing: -0.5,
  },
  metaLine: {
    marginTop: 6,
    fontSize: 14,
    color: colors.muted,
  },
  assignedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  assignedText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.inputBg,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.inputBg,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    ...cardStyle,
    ...cardShadow,
    marginBottom: 12,
  },
  checklistCard: {
    padding: 18,
  },
  checklistHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.black,
  },
  checklistSub: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
  },
  checklistActions: {
    flexDirection: "row",
    gap: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 14,
  },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  segmentOn: {
    backgroundColor: colors.primary,
  },
  segmentOff: {
    backgroundColor: colors.progressTrack,
  },
  currentTaskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  currentTaskText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: colors.navy,
  },
  viewAllRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.muted,
  },
  stepList: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 10,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.navy,
  },
  stepLabelDone: {
    color: colors.muted,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radii.card,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  actionBody: {
    flex: 1,
    minWidth: 0,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.black,
  },
  actionSubtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  badgeDone: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeDoneText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#166534",
  },
  outlineBtnSm: {
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
  },
  outlineBtnSmText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy,
  },
  offboardCard: {
    padding: 16,
  },
  offboardHeader: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  offboardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.black,
    marginBottom: 6,
  },
  offboardBody: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  removeBtn: {
    borderWidth: 1.5,
    borderColor: colors.error,
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: "center",
  },
  removeBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.error,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy,
    marginTop: 8,
    marginBottom: 10,
  },
  quickLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  quickLinkText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.black,
  },
  viewDetailsHeading: {
    marginTop: 20,
  },
  viewDetailsCard: {
    backgroundColor: colors.white,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 8,
    ...cardShadow,
  },
  viewDetailsBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radii.input,
    marginBottom: 18,
  },
  viewDetailsBannerPending: {
    backgroundColor: "#FEF3C7",
  },
  viewDetailsBannerDone: {
    backgroundColor: "#DCFCE7",
  },
  viewDetailsBannerTextPending: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#92400E",
    lineHeight: 20,
  },
  viewDetailsBannerTextDone: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#166534",
    lineHeight: 20,
  },
  viewDetailsActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 4,
  },
  viewDetailsAction: {
    flex: 1,
    alignItems: "center",
    minWidth: 0,
  },
  viewDetailsIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.inputBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  viewDetailsActionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.navy,
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    backgroundColor: colors.pageBg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
    }),
  },
  footerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radii.pill,
  },
  footerWhatsApp: {
    backgroundColor: colors.positiveAmount,
  },
  footerCall: {
    backgroundColor: colors.primary,
  },
  footerBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.white,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "85%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.black,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 16,
  },
  modalSectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 8,
    marginTop: 4,
  },
  roomList: {
    maxHeight: 200,
    marginBottom: 12,
  },
  roomItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    marginBottom: 8,
  },
  roomItemSelected: {
    borderColor: colors.primary,
    backgroundColor: "#F0F4FF",
  },
  roomItemTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.black,
  },
  roomItemSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  emptyRooms: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 10,
  },
  emptyRoomsText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
  },
  roomBadgeEmpty: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roomBadgeEmptyText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#166534",
  },
  rentInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    backgroundColor: colors.inputBg,
    paddingHorizontal: 14,
    marginBottom: 16,
    height: 52,
  },
  rentInputPrefix: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.navy,
    marginRight: 4,
  },
  rentInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: colors.black,
  },
  rentInputSuffix: {
    fontSize: 13,
    color: colors.muted,
    marginLeft: 4,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    backgroundColor: colors.inputBg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.black,
    minHeight: 80,
    marginBottom: 16,
  },
  confirmBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.white,
  },
  durationRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  durationChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  durationChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  durationChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy,
  },
  durationChipTextActive: {
    color: colors.white,
  },
  extendSummaryCard: {
    backgroundColor: colors.inputBg,
    borderRadius: radii.input,
    padding: 16,
    marginBottom: 20,
  },
  extendSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  extendSummaryLabel: {
    fontSize: 14,
    color: colors.muted,
  },
  extendSummaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy,
  },
  extendDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  extendTotalLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.black,
  },
  extendTotalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.primary,
  },
});
