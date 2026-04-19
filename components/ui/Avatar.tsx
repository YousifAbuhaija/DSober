import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, radii, typography } from '../../theme';

interface Props {
  uri?: string | null;
  name?: string;
  size?: number;
}

export default function Avatar({ uri, name, size = 40 }: Props) {
  const initials = name
    ? name
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('')
    : '?';

  const fontSize = size * 0.36;

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.img, { width: size, height: size, borderRadius: size / 2 }]}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  img: {
    backgroundColor: colors.bg.muted,
  },
  fallback: {
    backgroundColor: colors.brand.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.brand.primary,
    fontWeight: '600',
  },
});
