import React from "react";
import { Text, TextProps } from "react-native";

export type ThemedTextProps = TextProps;

export function ThemedText(props: ThemedTextProps) {
  return React.createElement(Text, props);
}

