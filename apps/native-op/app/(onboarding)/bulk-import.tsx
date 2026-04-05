import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useConvex } from "convex/react";
import {
  colors,
  radii,
  card as cardStyle,
  container as containerStyle,
  primaryButton,
  primaryButtonText,
  primaryButtonDisabled,
  secondaryButton,
  secondaryButtonText,
  footerRow,
} from "../../constants/theme";

type ImportPhase =
  | "pick"
  | "uploading"
  | "processing"
  | "completed"
  | "failed";

type ImportResult = {
  totalRows?: number;
  importedRows?: number;
  error?: string;
};

export default function BulkImportScreen() {
  const router = useRouter();
  const convex = useConvex();

  const [phase, setPhase] = useState<ImportPhase>("pick");
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult>({});
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  // Pulse animation for processing state
  useEffect(() => {
    if (phase === "processing" || phase === "uploading") {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [phase, pulseAnim]);

  const pickAndUpload = useCallback(async () => {
    try {
      const docResult = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "text/csv",
          "text/comma-separated-values",
        ],
        copyToCacheDirectory: true,
      });

      if (docResult.canceled || !docResult.assets?.[0]) return;

      const file = docResult.assets[0];
      const name = file.name ?? "file";

      // Validate extension
      const ext = name.split(".").pop()?.toLowerCase();
      if (!ext || !["xlsx", "xls", "csv"].includes(ext)) {
        Alert.alert("Invalid file", "Please upload an .xlsx, .xls, or .csv file.");
        return;
      }

      setFileName(name);
      setPhase("uploading");

      // 1. Get upload URL
      const uploadUrl = await (convex as any).mutation(
        "bulkImport:generateUploadUrl",
        {},
      );

      // 2. Upload the file
      const response = await fetch(file.uri);
      const blob = await response.blob();

      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": file.mimeType || "application/octet-stream",
        },
        body: blob,
      });

      if (!uploadResponse.ok) {
        throw new Error("File upload failed");
      }

      const { storageId } = await uploadResponse.json();

      setPhase("processing");

      // 3. Start the AI import action (waits until complete)
      const importId = await (convex as any).action(
        "bulkImportAction:startImport",
        { fileId: storageId, fileName: name },
      );

      // Action completed — fetch the final status
      const status = await (convex as any).query(
        "bulkImport:getImportStatus",
        { importId },
      );

      if (status?.status === "completed") {
        setResult({
          totalRows: status.totalRows,
          importedRows: status.importedRows,
        });
        setPhase("completed");
      } else if (status?.status === "failed") {
        setResult({ error: status.error });
        setPhase("failed");
      } else {
        // Shouldn't happen but handle gracefully
        setResult({
          totalRows: status?.totalRows,
          importedRows: status?.importedRows,
        });
        setPhase("completed");
      }
    } catch (e: any) {
      setResult({ error: e.message || "Something went wrong" });
      setPhase("failed");
    }
  }, [convex]);

  const handleContinue = useCallback(() => {
    // After import, go to main onboarding hub where property section will be marked done
    router.replace("/(onboarding)" as any);
  }, [router]);

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={[containerStyle, s.grow]}
      showsVerticalScrollIndicator={false}
    >
      {/* Back button */}
      <TouchableOpacity
        style={s.backBtn}
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={22} color={colors.navy} />
      </TouchableOpacity>

      <Text style={s.title}>Import tenant data</Text>
      <Text style={s.subtitle}>
        Upload your Excel or CSV file and our AI will automatically extract
        tenant details, room info, rent, and deposits.
      </Text>

      {/* Required fields info */}
      <View style={s.infoCard}>
        <Ionicons
          name="information-circle-outline"
          size={20}
          color={colors.primary}
        />
        <View style={s.infoContent}>
          <Text style={s.infoTitle}>Recommended columns</Text>
          <Text style={s.infoText}>
            Tenant name, Room number, Room type, Rent, Deposit, Agreement
            duration, Phone, Email, Move-in date
          </Text>
        </View>
      </View>

      {/* Phase: Pick file */}
      {phase === "pick" && (
        <TouchableOpacity
          style={s.dropZone}
          activeOpacity={0.7}
          onPress={pickAndUpload}
        >
          <View style={s.uploadIconCircle}>
            <Ionicons
              name="cloud-upload-outline"
              size={32}
              color={colors.primary}
            />
          </View>
          <Text style={s.dropTitle}>Tap to upload file</Text>
          <Text style={s.dropHint}>Supports .xlsx, .xls, .csv</Text>
        </TouchableOpacity>
      )}

      {/* Phase: Uploading */}
      {phase === "uploading" && (
        <View style={s.statusCard}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={s.statusTitle}>Uploading file...</Text>
          {fileName && <Text style={s.statusFile}>{fileName}</Text>}
        </View>
      )}

      {/* Phase: Processing */}
      {phase === "processing" && (
        <View style={s.statusCard}>
          <Animated.View style={{ opacity: pulseAnim }}>
            <View style={s.aiIconCircle}>
              <Ionicons name="sparkles" size={32} color="#D4F542" />
            </View>
          </Animated.View>
          <Text style={s.statusTitle}>AI is analyzing your data...</Text>
          <Text style={s.statusHint}>
            Extracting tenant info, mapping room types, and setting up your
            property.
          </Text>
          {fileName && <Text style={s.statusFile}>{fileName}</Text>}
        </View>
      )}

      {/* Phase: Completed */}
      {phase === "completed" && (
        <View style={s.statusCard}>
          <View style={s.successCircle}>
            <Ionicons name="checkmark" size={36} color={colors.white} />
          </View>
          <Text style={s.statusTitle}>Import successful!</Text>
          <View style={s.statsRow}>
            <View style={s.statBox}>
              <Text style={s.statNum}>{result.totalRows ?? 0}</Text>
              <Text style={s.statLabel}>Tenants found</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statBox}>
              <Text style={s.statNum}>{result.importedRows ?? 0}</Text>
              <Text style={s.statLabel}>Imported</Text>
            </View>
          </View>
          <Text style={s.statusHint}>
            Your property, rooms, and tenant data have been set up. Complete the
            remaining onboarding steps to go live.
          </Text>
        </View>
      )}

      {/* Phase: Failed */}
      {phase === "failed" && (
        <View style={s.statusCard}>
          <View style={s.errorCircle}>
            <Ionicons name="close" size={36} color={colors.white} />
          </View>
          <Text style={s.statusTitle}>Import failed</Text>
          <Text style={s.errorText}>
            {result.error || "Something went wrong. Please try again."}
          </Text>
        </View>
      )}

      {/* Footer actions */}
      <View style={{ flex: 1 }} />
      <View style={footerRow}>
        {phase === "completed" ? (
          <TouchableOpacity
            style={primaryButton}
            onPress={handleContinue}
            activeOpacity={0.7}
          >
            <Text style={primaryButtonText}>Continue setup</Text>
          </TouchableOpacity>
        ) : phase === "failed" ? (
          <>
            <TouchableOpacity
              style={secondaryButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Text style={secondaryButtonText}>Go back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={primaryButton}
              onPress={() => {
                setPhase("pick");
                setResult({});
                setFileName(null);
              }}
              activeOpacity={0.7}
            >
              <Text style={primaryButtonText}>Try again</Text>
            </TouchableOpacity>
          </>
        ) : phase === "pick" ? (
          <TouchableOpacity
            style={secondaryButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={secondaryButtonText}>Go back</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.pageBg },
  grow: { flexGrow: 1 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.navy,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
    marginBottom: 20,
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: "#EEF2FF",
    borderRadius: radii.card,
    padding: 14,
    gap: 10,
    marginBottom: 20,
    alignItems: "flex-start",
  },
  infoContent: { flex: 1 },
  infoTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
  },
  dropZone: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: radii.card,
    backgroundColor: colors.white,
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  uploadIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.inputBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  dropTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 4,
  },
  dropHint: {
    fontSize: 13,
    color: colors.muted,
  },
  statusCard: {
    ...cardStyle,
    alignItems: "center",
    paddingVertical: 32,
  },
  aiIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 8,
    marginTop: 4,
  },
  statusHint: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  statusFile: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 8,
    fontStyle: "italic",
  },
  successCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 20,
  },
  statBox: { alignItems: "center" },
  statNum: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.navy,
  },
  statLabel: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
  errorCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    color: colors.error,
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 8,
  },
});
