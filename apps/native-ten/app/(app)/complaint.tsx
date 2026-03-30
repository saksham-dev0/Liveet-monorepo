import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useConvex } from "convex/react";
import { useRouter } from "expo-router";
import { colors, radii } from "../../constants/theme";

type Priority = "High" | "Medium" | "Low";

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: "High", label: "High", color: "#DC2626" },
  { value: "Medium", label: "Medium", color: "#D97706" },
  { value: "Low", label: "Low", color: "#16A34A" },
];

export default function ComplaintScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const convex = useConvex();

  const [problemTitle, setProblemTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageStorageId, setImageStorageId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    problemTitle.trim().length > 0 &&
    description.trim().length > 0 &&
    !uploadingImage &&
    !submitting;

  async function handlePickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Photo library access is required to attach an image.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: true,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset) return;
    setImageUri(asset.uri);
    setImageStorageId(null);
    setUploadingImage(true);
    try {
      const uploadUrl = await (convex as any).mutation(
        "complaints:generateComplaintImageUploadUrl",
        {},
      );
      const fileResponse = await fetch(asset.uri);
      const blob = await fileResponse.blob();
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        body: blob,
        headers: { "Content-Type": asset.mimeType ?? "image/jpeg" },
      });
      const { storageId } = await uploadRes.json();
      if (!storageId) throw new Error("Upload failed");
      setImageStorageId(storageId);
    } catch {
      Alert.alert("Upload failed", "Could not upload the image. Please try again.");
      setImageUri(null);
      setImageStorageId(null);
    } finally {
      setUploadingImage(false);
    }
  }

  function handleRemoveImage() {
    setImageUri(null);
    setImageStorageId(null);
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      // Get tenant's active application to link the complaint
      const activeApp = await (convex as any).query(
        "complaints:getTenantActiveApplication",
        {},
      );

      if (!activeApp?.propertyId) {
        Alert.alert(
          "No active tenancy",
          "You need an active tenancy to file a complaint.",
        );
        return;
      }

      await (convex as any).mutation("complaints:submitComplaint", {
        propertyId: activeApp.propertyId,
        applicationId: activeApp.applicationId ?? undefined,
        problemTitle: problemTitle.trim(),
        description: description.trim(),
        priority,
        imageFileId: imageStorageId ?? undefined,
      });

      Alert.alert(
        "Complaint submitted",
        "Your complaint has been sent to the property manager.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Could not submit complaint. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={s.root}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[
          s.content,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top bar */}
        <View style={s.topBar}>
          <Pressable
            style={s.roundBtn}
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color={colors.navy} />
          </Pressable>
          <Text style={s.topTitle}>Add Complaint</Text>
          <View style={{ width: 44, height: 44 }} />
        </View>

        <Text style={s.subtitle}>
          Report an issue to your property manager. We'll make sure it gets resolved.
        </Text>

        {/* Problem title */}
        <Text style={s.label}>Problem *</Text>
        <TextInput
          style={s.input}
          placeholder="e.g. Water leakage, No hot water, AC not working"
          placeholderTextColor={colors.muted}
          value={problemTitle}
          onChangeText={setProblemTitle}
          maxLength={80}
          returnKeyType="next"
        />

        {/* Description */}
        <Text style={s.label}>Describe the problem *</Text>
        <TextInput
          style={[s.input, s.multilineInput]}
          placeholder="Provide details about the issue — when it started, how it affects you, etc."
          placeholderTextColor={colors.muted}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={500}
          textAlignVertical="top"
        />

        {/* Priority */}
        <Text style={s.label}>Priority *</Text>
        <View style={s.priorityRow}>
          {PRIORITIES.map((p) => {
            const selected = priority === p.value;
            return (
              <Pressable
                key={p.value}
                style={[
                  s.priorityChip,
                  selected && { backgroundColor: p.color, borderColor: p.color },
                ]}
                onPress={() => setPriority(p.value)}
              >
                <View
                  style={[
                    s.priorityDot,
                    { backgroundColor: selected ? colors.white : p.color },
                  ]}
                />
                <Text
                  style={[
                    s.priorityChipText,
                    selected && { color: colors.white, fontWeight: "700" },
                  ]}
                >
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Image attachment */}
        <Text style={s.label}>Attach image (optional)</Text>
        {imageUri ? (
          <View style={s.imagePreviewWrap}>
            <Image source={{ uri: imageUri }} style={s.imagePreview} contentFit="cover" />
            {uploadingImage ? (
              <View style={s.imageOverlay}>
                <ActivityIndicator size="small" color={colors.white} />
                <Text style={s.imageOverlayText}>Uploading…</Text>
              </View>
            ) : null}
            <Pressable style={s.removeImageBtn} onPress={handleRemoveImage} hitSlop={8}>
              <Ionicons name="close-circle" size={24} color={colors.white} />
            </Pressable>
          </View>
        ) : (
          <Pressable style={s.imagePicker} onPress={() => void handlePickImage()}>
            <Ionicons name="image-outline" size={24} color={colors.muted} />
            <Text style={s.imagePickerText}>Tap to select a photo</Text>
          </Pressable>
        )}

        {/* Submit */}
        <Pressable
          style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
          onPress={() => void handleSubmit()}
          disabled={!canSubmit}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Ionicons
                name="send-outline"
                size={18}
                color={colors.white}
                style={{ marginRight: 8 }}
              />
              <Text style={s.submitBtnText}>Submit Complaint</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
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
    color: colors.navy,
  },

  subtitle: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
    marginBottom: 20,
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy,
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.navy,
  },
  multilineInput: {
    minHeight: 100,
    paddingTop: 13,
  },

  priorityRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  priorityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityChipText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.navy,
  },

  imagePicker: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    gap: 8,
  },
  imagePickerText: {
    fontSize: 14,
    color: colors.muted,
  },
  imagePreviewWrap: {
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  imagePreview: {
    width: "100%",
    height: 200,
    borderRadius: 12,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  imageOverlayText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "600",
  },
  removeImageBtn: {
    position: "absolute",
    top: 10,
    right: 10,
  },

  submitBtn: {
    marginTop: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    paddingVertical: 15,
    backgroundColor: colors.primary,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.white,
  },
});
