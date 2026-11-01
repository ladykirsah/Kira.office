import { useState } from "react";
import { StyleSheet, TextInput } from "react-native";
import { parseTimeField } from "@/lib/bannerPage";
import { useTheme } from "../AppProviders";
import { TYPE } from "../theme";

interface TimeBoxProps {
  /** "23:59". */
  value: string;
  onChange: (minutes: number | null, text: string) => void;
  label: string;
}

/** Off the web (not shipped yet) a typed hour:minute; the web build uses the browser's time box. */
export function TimeBox({ value, onChange, label }: TimeBoxProps) {
  const { theme } = useTheme();
  const [text, setText] = useState(value);
  return (
    <TextInput
      accessibilityLabel={label}
      value={text}
      onChangeText={(next) => {
        setText(next);
        onChange(parseTimeField(next), next);
      }}
      placeholder="00:00"
      placeholderTextColor={theme.textFaint}
      keyboardType="numbers-and-punctuation"
      style={[styles.input, { color: theme.text }]}
    />
  );
}

const styles = StyleSheet.create({
  input: { ...TYPE.body, width: 72, textAlign: "right" },
});
