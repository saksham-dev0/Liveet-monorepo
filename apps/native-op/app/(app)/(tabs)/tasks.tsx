import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { colors } from "../../../constants/theme";
import { useConvex } from "convex/react";
import { useFocusEffect } from "@react-navigation/native";

type Priority = "High" | "Medium" | "Low";

type TaskItem = {
  id: string; // applicationId
  priority: Priority;
  description: string;
  tenantName: string;
  dueLabel: string;
};

function getPriorityStyles(priority: Priority) {
  if (priority === "High") {
    return {
      tagBg: "#FEE2E2",
      tagBorder: "#FECACA",
      tagText: "#B91C1C",
    };
  }
  if (priority === "Medium") {
    return {
      tagBg: "#FEF3C7",
      tagBorder: "#FDE68A",
      tagText: "#92400E",
    };
  }
  return {
    tagBg: "#DCFCE7",
    tagBorder: "#BBF7D0",
    tagText: "#166534",
  };
}

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const convex = useConvex();

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await (convex as any).query(
        "properties:getRoomAssignmentTasksForOperator",
        { limit: 30 },
      );
      const items = res?.items;
      if (!Array.isArray(items)) {
        setTasks([]);
        return;
      }
      setTasks(
        items.map((t: any) => ({
          id: t.applicationId,
          priority: t.priority,
          description: t.description,
          tenantName: t.tenantName,
          dueLabel: t.dueLabel,
        })),
      );
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [convex]);

  useFocusEffect(
    useCallback(() => {
      void loadTasks();
    }, [loadTasks]),
  );

  const highCount = tasks.filter((task) => task.priority === "High").length;
  const mediumCount = tasks.filter((task) => task.priority === "Medium").length;
  const lowCount = tasks.filter((task) => task.priority === "Low").length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingTop: insets.top + 10 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Tasks</Text>
      <Text style={styles.subtitle}>
        Track and complete tenant-related action items quickly.
      </Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total Tasks</Text>
        <Text style={styles.summaryValue}>{tasks.length}</Text>
        <View style={styles.priorityStatsRow}>
          <View style={styles.priorityStatItem}>
            <View style={[styles.priorityDot, { backgroundColor: "#DC2626" }]} />
            <Text style={styles.priorityStatText}>{highCount} High</Text>
          </View>
          <View style={styles.priorityStatItem}>
            <View style={[styles.priorityDot, { backgroundColor: "#D97706" }]} />
            <Text style={styles.priorityStatText}>{mediumCount} Medium</Text>
          </View>
          <View style={styles.priorityStatItem}>
            <View style={[styles.priorityDot, { backgroundColor: "#16A34A" }]} />
            <Text style={styles.priorityStatText}>{lowCount} Low</Text>
          </View>
        </View>
      </View>

      <View style={styles.taskList}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.muted}>Loading tasks…</Text>
          </View>
        ) : tasks.length === 0 ? (
          <View style={styles.summaryCard}>
            <Text style={styles.emptyTitle}>No tasks right now</Text>
            <Text style={styles.emptyBody}>
              When tenants pay or complete e-KYC, assignment tasks will appear here.
            </Text>
          </View>
        ) : (
          tasks.map((task) => {
          const priorityColors = getPriorityStyles(task.priority);

          return (
            <View key={task.id + task.description} style={styles.taskCard}>
              <Pressable
                style={({ pressed }) => [
                  styles.taskCardPressable,
                  pressed ? { opacity: 0.92 } : null,
                ]}
                onPress={() =>
                  router.push(
                    {
                      pathname: "/(app)/tasks/[applicationId]",
                      params: {
                        applicationId: task.id,
                        taskDescription: task.description,
                        priority: task.priority,
                        dueLabel: task.dueLabel,
                        tenantName: task.tenantName,
                      },
                    } as unknown as Href,
                  )
                }
              >
                <View style={styles.taskTopRow}>
                  <View
                    style={[
                      styles.priorityTag,
                      {
                        backgroundColor: priorityColors.tagBg,
                        borderColor: priorityColors.tagBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.priorityTagText, { color: priorityColors.tagText }]}
                    >
                      {task.priority} Priority
                    </Text>
                  </View>
                  <Text style={styles.dueText}>{task.dueLabel}</Text>
                </View>

                <Text style={styles.taskDescription}>{task.description}</Text>

                <View style={styles.tenantRow}>
                  <Text style={styles.tenantLabel}>Assigned Tenant</Text>
                  <Text style={styles.tenantName}>{task.tenantName}</Text>
                </View>
              </Pressable>
            </View>
          );
        })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.black,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    padding: 16,
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.black,
  },
  centered: {
    paddingTop: 32,
    paddingBottom: 20,
    alignItems: "center",
  },
  muted: {
    marginTop: 10,
    fontSize: 14,
    color: colors.muted,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.black,
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },
  priorityStatsRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  priorityStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F8FAFC",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  priorityStatText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.black,
  },
  taskList: {
    gap: 12,
  },
  taskCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    padding: 16,
  },
  taskCardPressable: {
    borderRadius: 12,
  },
  taskTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
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
  taskDescription: {
    fontSize: 14,
    color: colors.black,
    lineHeight: 20,
    marginBottom: 12,
    fontWeight: "500",
  },
  tenantRow: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  tenantLabel: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "500",
  },
  tenantName: {
    fontSize: 13,
    color: colors.black,
    fontWeight: "700",
  },
});
