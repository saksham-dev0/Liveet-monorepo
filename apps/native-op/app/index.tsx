import { useState } from "react";
import { Button, Text, View } from "react-native";
import { useConvex } from "convex/react";

export default function Index() {
  const convex = useConvex();
  const [status, setStatus] = useState<string | null>(null);

  const callExampleFunction = async () => {
    try {
      // Calls the Convex query exported as `hello` in `convex/sample.ts`
      const result = await (convex as any).query("sample:hello", {
        name: "native-op",
      });
      setStatus(`Success: ${String(result)}`);
    } catch (error) {
      console.error(error);
      setStatus("Convex call failed. Check function name and backend.");
    }
  };

  return (
    <View className="flex-1 items-center justify-center gap-3 bg-white">
      <Text className="text-lg font-semibold text-center text-blue-600">
        Convex is wired into this app.
      </Text>
      <Button title="Call example Convex function" onPress={callExampleFunction} />
      {status && <Text className="mt-2 text-base text-gray-700">{status}</Text>}
    </View>
  );
}
