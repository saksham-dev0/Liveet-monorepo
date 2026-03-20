import { useConvex } from "convex/react";

export function useSyncUserWithConvex() {
  const convex = useConvex();

  return {
    syncUser: async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await (convex as any).mutation("users:ensureCurrentUser", {
            role: "tenant",
          });
          return;
        } catch (error: any) {
          const message = error?.message ?? "";
          const isUnauthed =
            typeof message === "string" &&
            message.includes("Unauthenticated call to ensureCurrentUser");

          if (!isUnauthed) throw error;

          if (attempt < 4) {
            await new Promise((resolve) =>
              setTimeout(resolve, 200 + attempt * 200),
            );
            continue;
          }
          return;
        }
      }
    },
  };
}
