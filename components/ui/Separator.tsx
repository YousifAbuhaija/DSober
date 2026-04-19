import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme';

interface Props {
  inset?: number;
}

export default function Separator({ inset = 0 }: Props) {
  return <View style={[styles.line, { marginHorizontal: inset }]} />;
}

const styles = StyleSheet.create({
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.sm,
  },
});
