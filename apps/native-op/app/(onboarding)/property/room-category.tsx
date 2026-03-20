import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useConvex } from "convex/react";
import {
  colors,
  errorText,
  input,
  label,
  radii,
} from "../../../constants/theme";

const BEDS_PER_CATEGORY: Record<string, number> = {
  single: 1,
  double: 2,
  triple: 3,
  "3plus": 4,
};

type RoomOption = {
  _id: string;
  category: string;
  numberOfRooms?: number;
  typeName?: string;
  rentAmount?: number;
  attachedWashroom?: boolean;
  attachedBalcony?: boolean;
  airConditioner?: boolean;
  geyser?: boolean;
  customFeatures?: string[];
};

export default function RoomCategoryScreen() {
  const router = useRouter();
  const convex = useConvex();
  const { propertyId, category } = useLocalSearchParams<{
    propertyId: string;
    category: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [typeName, setTypeName] = useState("");
  const [numberOfRooms, setNumberOfRooms] = useState("");
  const [rentAmount, setRentAmount] = useState("");
  const [attachedWashroom, setAttachedWashroom] = useState(false);
  const [attachedBalcony, setAttachedBalcony] = useState(false);
  const [airConditioner, setAirConditioner] = useState(false);
  const [geyser, setGeyser] = useState(false);
  const [roomOptions, setRoomOptions] = useState<RoomOption[]>([]);
  const [totalUnits, setTotalUnits] = useState<number>(0);
  const [allRoomOptions, setAllRoomOptions] = useState<RoomOption[]>([]);
  const [editingOption, setEditingOption] = useState<RoomOption | null>(null);
  const [menuOptionId, setMenuOptionId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await (convex as any).query(
          "onboarding:getOnboardingStatus",
          {},
        );
        if (cancelled || !status) return;
        const all: RoomOption[] = status.roomOptions ?? [];
        setAllRoomOptions(all);
        setTotalUnits(status.property?.totalUnits ?? 0);
        const filtered = all.filter((opt) => opt.category === category);
        setRoomOptions(filtered);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [convex, category]);

  const bedsUsedByOthers = roomOptions.reduce(
    (sum, opt) =>
      sum + (opt.numberOfRooms ?? 1) * (BEDS_PER_CATEGORY[opt.category] ?? 1),
    0,
  );
  const otherCategoriesBeds = allRoomOptions
    .filter((opt) => opt.category !== category)
    .reduce(
      (sum, opt) =>
        sum + (opt.numberOfRooms ?? 1) * (BEDS_PER_CATEGORY[opt.category] ?? 1),
      0,
    );
  const bedsUsedByThisCategory = bedsUsedByOthers;
  const totalBedsUsed = otherCategoriesBeds + bedsUsedByThisCategory;
  const bedsRemaining = totalUnits - totalBedsUsed;
  const bedsPerRoom = BEDS_PER_CATEGORY[category] ?? 1;
  const maxRoomsForCategory = Math.max(
    0,
    Math.floor(bedsRemaining / bedsPerRoom),
  );
  const maxRoomsWhenEditing =
    editingOption != null
      ? Math.floor(bedsRemaining / bedsPerRoom) +
        (editingOption.numberOfRooms ?? 1)
      : maxRoomsForCategory;

  const displayCategory =
    category === "single"
      ? "Single room"
      : category === "double"
      ? "Double room"
      : category === "triple"
      ? "Triple room"
      : "3+ sharing";

  const toggle = (value: boolean, setter: (v: boolean) => void) =>
    setter(!value);

  const handleAddOption = async (): Promise<boolean> => {
    if (!propertyId) return false;
    const num = numberOfRooms.trim() ? parseInt(numberOfRooms, 10) : 1;
    if (Number.isNaN(num) || num < 1) {
      setError("Please enter at least 1 room.");
      return false;
    }
    if (num > maxRoomsForCategory) {
      setError(
        `You can add at most ${maxRoomsForCategory} room(s) of this type (${bedsRemaining} beds remaining).`,
      );
      return false;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await (convex as any).mutation(
        "onboarding:addRoomOption",
        {
          propertyId,
          category,
          numberOfRooms: num,
          typeName: typeName.trim() || undefined,
          rentAmount: rentAmount ? Number(rentAmount) : undefined,
          attachedWashroom,
          attachedBalcony,
          airConditioner,
          geyser,
        },
      );
      const newOption: RoomOption = {
        _id: result.roomOptionId,
        category,
        numberOfRooms: num,
        typeName: typeName.trim() || undefined,
        rentAmount: rentAmount ? Number(rentAmount) : undefined,
        attachedWashroom,
        attachedBalcony,
        airConditioner,
        geyser,
      };
      setRoomOptions((prev) => [...prev, newOption]);
      setAllRoomOptions((prev) => [...prev, newOption]);
      setTypeName("");
      setNumberOfRooms("");
      setRentAmount("");
      setAttachedWashroom(false);
      setAttachedBalcony(false);
      setAirConditioner(false);
      setGeyser(false);
      return true;
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const hasFormData =
    typeName.trim() !== "" ||
    numberOfRooms.trim() !== "" ||
    rentAmount.trim() !== "" ||
    attachedWashroom ||
    attachedBalcony ||
    airConditioner ||
    geyser;

  const handleProceed = async () => {
    if (hasFormData) {
      const added = await handleAddOption();
      if (added) router.back();
    } else {
      router.back();
    }
  };

  const openEditForm = (item: RoomOption) => {
    setMenuOptionId(null);
    setEditingOption(item);
    setTypeName(item.typeName ?? "");
    setNumberOfRooms(String(item.numberOfRooms ?? 1));
    setRentAmount(item.rentAmount != null ? String(item.rentAmount) : "");
    setAttachedWashroom(item.attachedWashroom ?? false);
    setAttachedBalcony(item.attachedBalcony ?? false);
    setAirConditioner(item.airConditioner ?? false);
    setGeyser(item.geyser ?? false);
    setError(null);
  };

  const handleUpdateOption = async (): Promise<boolean> => {
    if (!propertyId || !editingOption) return false;
    const num = numberOfRooms.trim() ? parseInt(numberOfRooms, 10) : 1;
    if (Number.isNaN(num) || num < 1) {
      setError("Please enter at least 1 room.");
      return false;
    }
    const maxRooms = maxRoomsWhenEditing;
    if (num > maxRooms) {
      setError(
        `You can set at most ${maxRooms} room(s) for this option (${bedsRemaining} beds remaining).`,
      );
      return false;
    }
    setSaving(true);
    setError(null);
    try {
      await (convex as any).mutation("onboarding:updateRoomOption", {
        roomOptionId: editingOption._id,
        numberOfRooms: num,
        typeName: typeName.trim() || undefined,
        rentAmount: rentAmount ? Number(rentAmount) : undefined,
        attachedWashroom,
        attachedBalcony,
        airConditioner,
        geyser,
      });
      const updated: RoomOption = {
        ...editingOption,
        numberOfRooms: num,
        typeName: typeName.trim() || undefined,
        rentAmount: rentAmount ? Number(rentAmount) : undefined,
        attachedWashroom,
        attachedBalcony,
        airConditioner,
        geyser,
      };
      setRoomOptions((prev) =>
        prev.map((o) => (o._id === editingOption._id ? updated : o)),
      );
      setAllRoomOptions((prev) =>
        prev.map((o) => (o._id === editingOption._id ? updated : o)),
      );
      setEditingOption(null);
      setTypeName("");
      setNumberOfRooms("");
      setRentAmount("");
      setAttachedWashroom(false);
      setAttachedBalcony(false);
      setAirConditioner(false);
      setGeyser(false);
      return true;
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOption = (item: RoomOption) => {
    setMenuOptionId(null);
    Alert.alert(
      "Delete option",
      "Are you sure you want to remove this room option?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await (convex as any).mutation("onboarding:deleteRoomOption", {
                roomOptionId: item._id,
              });
              setRoomOptions((prev) => prev.filter((o) => o._id !== item._id));
              setAllRoomOptions((prev) =>
                prev.filter((o) => o._id !== item._id),
              );
              if (editingOption?._id === item._id) {
                setEditingOption(null);
                setTypeName("");
                setNumberOfRooms("");
                setRentAmount("");
                setAttachedWashroom(false);
                setAttachedBalcony(false);
                setAirConditioner(false);
                setGeyser(false);
              }
            } catch {
              setError("Failed to delete option.");
            }
          },
        },
      ],
    );
  };

  const menuOption = menuOptionId
    ? roomOptions.find((o) => o._id === menuOptionId)
    : null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.headerAction}>{"\u2190"} Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{displayCategory}</Text>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <>
            <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                {editingOption ? "Edit option" : "Add Options"}
              </Text>
              {editingOption ? (
                <View style={styles.editActions}>
                  <TouchableOpacity
                    style={styles.cancelEditButton}
                    onPress={() => {
                      setEditingOption(null);
                      setTypeName("");
                      setNumberOfRooms("");
                      setRentAmount("");
                      setAttachedWashroom(false);
                      setAttachedBalcony(false);
                      setAirConditioner(false);
                      setGeyser(false);
                      setError(null);
                    }}
                  >
                    <Text style={styles.cancelEditText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => handleUpdateOption()}
                    disabled={saving}
                  >
                    <Text style={styles.addButtonText}>
                      {saving ? "Saving..." : "Update"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={handleAddOption}
                  disabled={saving}
                >
                  <Text style={styles.addButtonText}>
                    {saving ? "Saving..." : "+ Add"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {error ? <Text style={errorText}>{error}</Text> : null}

            {totalUnits <= 0 ? (
              <Text style={styles.bedsHelper}>
                Set total units in property basic details first.
              </Text>
            ) : (
              <Text style={styles.bedsHelper}>
                {bedsRemaining} beds remaining. You can add up to{" "}
                {maxRoomsForCategory} room(s) of this type.
              </Text>
            )}

            <Text style={label}>Type name</Text>
            <TextInput
              style={input}
              placeholder="e.g. AC room"
              placeholderTextColor={colors.muted}
              value={typeName}
              onChangeText={setTypeName}
            />

            <Text style={label}>Number of rooms</Text>
            <TextInput
              style={input}
              placeholder={
                (editingOption ? maxRoomsWhenEditing : maxRoomsForCategory) > 0
                  ? `1–${editingOption ? maxRoomsWhenEditing : maxRoomsForCategory}`
                  : "Set total units in basic details first"
              }
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              value={numberOfRooms}
              onChangeText={setNumberOfRooms}
              editable={
                (editingOption ? maxRoomsWhenEditing : maxRoomsForCategory) > 0
              }
            />

            <Text style={label}>Rent</Text>
            <TextInput
              style={input}
              placeholder="Amount"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              value={rentAmount}
              onChangeText={setRentAmount}
            />

            <Text style={styles.featureTitle}>Room features</Text>
            <View style={styles.checkboxRow}>
              <TouchableOpacity
                style={styles.checkboxItem}
                onPress={() => toggle(attachedWashroom, setAttachedWashroom)}
              >
                <View
                  style={[
                    styles.checkboxBox,
                    attachedWashroom && styles.checkboxBoxChecked,
                  ]}
                />
                <Text style={styles.checkboxLabel}>Attached washroom</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.checkboxItem}
                onPress={() => toggle(attachedBalcony, setAttachedBalcony)}
              >
                <View
                  style={[
                    styles.checkboxBox,
                    attachedBalcony && styles.checkboxBoxChecked,
                  ]}
                />
                <Text style={styles.checkboxLabel}>Attached balcony</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.checkboxItem}
                onPress={() => toggle(airConditioner, setAirConditioner)}
              >
                <View
                  style={[
                    styles.checkboxBox,
                    airConditioner && styles.checkboxBoxChecked,
                  ]}
                />
                <Text style={styles.checkboxLabel}>Air conditioner</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.checkboxItem}
                onPress={() => toggle(geyser, setGeyser)}
              >
                <View
                  style={[
                    styles.checkboxBox,
                    geyser && styles.checkboxBoxChecked,
                  ]}
                />
                <Text style={styles.checkboxLabel}>Geyser</Text>
              </TouchableOpacity>
            </View>
          </View>

            <Text style={styles.optionsHeader}>Added options</Text>
            {roomOptions.length === 0 ? (
              <Text style={styles.emptyText}>No room options added yet.</Text>
            ) : (
              <View style={styles.optionsList}>
                {roomOptions.map((item) => (
                  <View key={item._id} style={styles.optionRow}>
                    <View style={styles.optionRowContent}>
                      <Text style={styles.optionTitle}>
                        {item.typeName || "Option"}
                        {item.numberOfRooms != null && item.numberOfRooms > 0
                          ? ` · ${item.numberOfRooms} room${item.numberOfRooms > 1 ? "s" : ""}`
                          : ""}
                      </Text>
                      <Text style={styles.optionSubtitle}>
                        {"\u20B9"} {item.rentAmount ?? 0}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.optionMenuButton}
                      onPress={() => setMenuOptionId(item._id)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      <Text style={styles.optionMenuIcon}>⋮</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={styles.footerButton}
              onPress={handleProceed}
              disabled={saving}
            >
              <Text style={styles.footerButtonText}>
                {saving ? "Saving..." : "Proceed"}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <Modal
        visible={menuOptionId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOptionId(null)}
      >
        <TouchableOpacity
          style={styles.menuBackdrop}
          activeOpacity={1}
          onPress={() => setMenuOptionId(null)}
        >
          <TouchableOpacity
            style={styles.menuCard}
            activeOpacity={1}
            onPress={() => {}}
          >
            {menuOption && (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => openEditForm(menuOption)}
                >
                  <Text style={styles.menuItemText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, styles.menuItemDanger]}
                  onPress={() => handleDeleteOption(menuOption)}
                >
                  <Text style={styles.menuItemTextDanger}>Delete</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    paddingTop: 4,
    paddingHorizontal: 20,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerAction: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.navy,
  },
  loadingCenter: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  bedsHelper: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 10,
  },
  section: {
    marginTop: 8,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.navy,
  },
  addButton: {
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: colors.primary,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.white,
  },
  editActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cancelEditButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  cancelEditText: {
    fontSize: 14,
    color: colors.muted,
    fontWeight: "500",
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 14,
    marginBottom: 8,
    color: colors.navy,
  },
  checkboxRow: {
    gap: 10,
  },
  checkboxItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginRight: 10,
    backgroundColor: colors.inputBg,
  },
  checkboxBoxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    fontSize: 14,
    color: colors.navy,
  },
  optionsHeader: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 20,
    marginBottom: 8,
    color: colors.navy,
  },
  optionsList: {
    paddingBottom: 16,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionRowContent: {
    flex: 1,
  },
  optionMenuButton: {
    padding: 8,
    marginLeft: 8,
  },
  optionMenuIcon: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.muted,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.navy,
  },
  optionSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  emptyText: {
    fontSize: 13,
    color: colors.muted,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  menuCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    minWidth: 180,
    overflow: "hidden",
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  menuItemDanger: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  menuItemText: {
    fontSize: 16,
    color: colors.navy,
    fontWeight: "500",
  },
  menuItemTextDanger: {
    fontSize: 16,
    color: "#dc2626",
    fontWeight: "500",
  },
  footerButton: {
    marginTop: 24,
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  footerButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.white,
  },
});
