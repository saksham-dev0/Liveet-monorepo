import { useConvex } from "convex/react";

export function useSyncUserWithConvex() {
  const convex = useConvex();

  return {
    syncUser: async () => {
      // Retry a few times because Clerk -> Convex auth can take
      // a moment to propagate right after sign-in.
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await (convex as any).mutation("users:ensureCurrentUser", {
            role: "operator",
          });
          return;
        } catch (error: any) {
          const message = error?.message ?? "";
          const isUnauthed =
            typeof message === "string" &&
            message.includes("Unauthenticated call to ensureCurrentUser");

          if (!isUnauthed) {
            // Real failure, surface it.
            throw error;
          }

          // If still unauthenticated, wait a bit and retry.
          if (attempt < 4) {
            await new Promise((resolve) =>
              setTimeout(resolve, 200 + attempt * 200),
            );
            continue;
          }

          // After final attempt, just stop; user will be created
          // on the next successful authenticated call.
          return;
        }
      }
    },
  };
}

