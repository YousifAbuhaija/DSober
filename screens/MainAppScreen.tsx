import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MainAppScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Main App</Text>
      <Text style={styles.subtext}>Coming soon in next tasks...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 16,
    color: '#666',
  },
});
