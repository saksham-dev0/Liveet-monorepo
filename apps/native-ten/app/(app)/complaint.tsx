import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  ActionSheetIOS,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../packages/backend/convex/_generated/api";
import * as ImagePicker from "expo-image-picker";
import { colors, radii } from "@/constants/theme";

const generateUploadUrlRef = api.complaints.generateUploadUrl;
const submitComplaintRef = api.complaints.submitComplaint;

const CATEGORIES = [
  { value: "maintenance", label: "Maintenance", icon: "construct-outline" },
  { value: "cleanliness", label: "Cleanliness", icon: "sparkles-outline" },
  { value: "security", label: "Security", icon: "shield-outline" },
  { value: "noise", label: "Noise", icon: "volume-high-outline" },
  { value: "amenities", label: "Amenities", icon: "home-outline" },
  { value: "other", label: "Other", icon: "ellipsis-horizontal-circle-outline" },
] as const;

const URGENCY_LEVELS = [
  { value: "low", label: "Low", color: "#22c55e" },
  { value: "medium", label: "Medium", color: "#f59e0b" },
  { value: "high", label: "High", color: "#ef4444" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];
type Urgency = (typeof URGENCY_LEVELS)[number]["value"];
type PickedImage = { uri: string; mimeType: string };

export default function ComplaintScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [urgency, setUrgency] = useState<Urgency | null>(null);
  const [images, setImages] = useState<PickedImage[]>([]);
  const [loading, setLoading] = useState(false);

  const generateUploadUrl = useMutation(generateUploadUrlRef);
  const submitComplaint = useMutation(submitComplaintRef);

  const isValid =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    category !== null &&
    urgency !== null;

  async function uploadImage(img: PickedImage): Promise<string> {
    const uploadUrl = await generateUploadUrl({});
    const response = await fetch(img.uri);
    const blob = await response.blob();
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": img.mimeType },
      body: blob,
    });
    if (!res.ok) throw new Error("Image upload failed");
    const { storageId } = await res.json();
    return storageId;
  }

  async function pickImage() {
    if (images.length >= 3) {
      Alert.alert("Limit reached", "You can attach up to 3 images.");
      return;
    }

    const showPicker = async (source: "camera" | "gallery") => {
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
              allowsEditing: true,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
              allowsEditing: false,
            });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setImages((prev) => [
          ...prev,
          { uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg" },
        ]);
      }
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Cancel", "Take Photo", "Choose from Library"], cancelButtonIndex: 0 },
        (idx) => {
          if (idx === 1) showPicker("camera");
          else if (idx === 2) showPicker("gallery");
        }
      );
    } else {
      Alert.alert("Add Image", "Choose source", [
        { text: "Camera", onPress: () => showPicker("camera") },
        { text: "Gallery", onPress: () => showPicker("gallery") },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    if (!isValid) return;
    setLoading(true);
    try {
      let imageStorageIds: string[] | undefined;
      if (images.length > 0) {
        imageStorageIds = await Promise.all(images.map(uploadImage));
      }
      await submitComplaint({
        title: title.trim(),
        description: description.trim(),
        category: category!,
        urgency: urgency!,
        imageStorageIds,
      });
      Alert.alert("Complaint raised", "Your complaint has been submitted to the operator.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to submit complaint.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Raise a Complaint</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Banner */}
        <View style={s.banner}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.navy} style={{ marginTop: 1 }} />
          <Text style={s.bannerText}>
            Describe your issue clearly. The operator will be notified and will respond promptly.
          </Text>
        </View>

        {/* Title */}
        <Text style={s.label}>Title</Text>
        <TextInput
          style={s.input}
          placeholder="Brief summary of the issue"
          placeholderTextColor={colors.muted}
          value={title}
          onChangeText={setTitle}
          returnKeyType="next"
          maxLength={100}
        />

        {/* Description */}
        <Text style={s.label}>Describe the issue</Text>
        <TextInput
          style={[s.input, s.multiline]}
          placeholder="Provide as much detail as possible…"
          placeholderTextColor={colors.muted}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          returnKeyType="done"
        />

        {/* Category */}
        <Text style={s.label}>Category</Text>
        <View style={s.grid}>
          {CATEGORIES.map((cat) => {
            const selected = category === cat.value;
            return (
              <TouchableOpacity
                key={cat.value}
                style={[s.chip, selected && s.chipSelected]}
                activeOpacity={0.7}
                onPress={() => setCategory(cat.value)}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={16}
                  color={selected ? colors.white : colors.navy}
                />
                <Text style={[s.chipText, selected && s.chipTextSelected]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Urgency */}
        <Text style={s.label}>Urgency level</Text>
        <View style={s.urgencyRow}>
          {URGENCY_LEVELS.map((u) => {
            const selected = urgency === u.value;
            return (
              <TouchableOpacity
                key={u.value}
                style={[
                  s.urgencyChip,
                  selected && { backgroundColor: u.color, borderColor: u.color },
                ]}
                activeOpacity={0.7}
                onPress={() => setUrgency(u.value)}
              >
                <View style={[s.urgencyDot, { backgroundColor: selected ? colors.white : u.color }]} />
                <Text style={[s.urgencyText, selected && { color: colors.white }]}>{u.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Images */}
        <Text style={s.label}>Attach photos <Text style={s.optional}>(optional, up to 3)</Text></Text>
        <View style={s.imageRow}>
          {images.map((img, idx) => (
            <View key={idx} style={s.imageWrapper}>
              <Image source={{ uri: img.uri }} style={s.thumbImage} />
              <TouchableOpacity style={s.removeBtn} onPress={() => removeImage(idx)} activeOpacity={0.8}>
                <Ionicons name="close-circle" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
          {images.length < 3 && (
            <TouchableOpacity style={s.addImageBtn} onPress={pickImage} activeOpacity={0.7}>
              <Ionicons name="camera-outline" size={24} color={colors.muted} />
              <Text style={s.addImageText}>Add photo</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[s.btn, (!isValid || loading) && s.btnDisabled]}
          activeOpacity={0.8}
          onPress={handleSubmit}
          disabled={!isValid || loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={s.btnText}>Submit complaint</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surfaceGray,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: colors.navy },
  body: { paddingHorizontal: 20, paddingTop: 20 },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: radii.card,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bannerText: { flex: 1, fontSize: 13, color: colors.muted, lineHeight: 19 },
  label: { fontSize: 13, fontWeight: "600", color: colors.navy, marginBottom: 6, marginTop: 20 },
  optional: { fontWeight: "400", color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    backgroundColor: colors.white,
    color: colors.navy,
  },
  multiline: { minHeight: 120, paddingTop: 13 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipSelected: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.navy },
  chipTextSelected: { color: colors.white },
  urgencyRow: { flexDirection: "row", gap: 10 },
  urgencyChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  urgencyDot: { width: 8, height: 8, borderRadius: 4 },
  urgencyText: { fontSize: 13, fontWeight: "700", color: colors.navy },
  imageRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  imageWrapper: { position: "relative" },
  thumbImage: { width: 88, height: 88, borderRadius: 12 },
  removeBtn: { position: "absolute", top: -8, right: -8 },
  addImageBtn: {
    width: 88, height: 88,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: colors.white,
  },
  addImageText: { fontSize: 11, color: colors.muted, fontWeight: "500" },
  btn: {
    marginTop: 36,
    borderRadius: radii.pill,
    paddingVertical: 15,
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  btnDisabled: { opacity: 0.35 },
  btnText: { fontSize: 15, fontWeight: "700", color: colors.white },
});
