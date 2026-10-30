import { useState } from "react";
import { StyleSheet, TextInput } from "react-native";
import { dayField, parseDayField } from "@/lib/orderList";
import { useTheme } from "../AppProviders";
import { TYPE } from "../theme";

interface DateBoxProps {
  value: number | null;
  onChange: (day: number | null) => void;
  label: string;
}

/** Off the web (not shipped yet) a typed year-month-day; the web build uses the browser's date box. */
export function DateBox({ value, onChange, label }: DateBoxProps) {
  const { theme } = useTheme();
  const [text, setText] = useState(value == null ? "" : dayField(value));
  return (
    <TextInput
      accessibilityLabel={label}
      value={text}
      onChangeText={(next) => {
        setText(next);
        onChange(parseDayField(next));
      }}
      placeholder="2026-10-29"
      placeholderTextColor={theme.textFaint}
      keyboardType="numbers-and-punctuation"
      style={[styles.input, { color: theme.text }]}
    />
  );
}

const styles = StyleSheet.create({
  input: { ...TYPE.body, flex: 1, textAlign: "right" },
});
