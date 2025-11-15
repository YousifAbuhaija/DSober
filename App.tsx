import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { supabase } from './lib/supabase';
import { useEffect, useState } from 'react';

export default function App() {
  const [connectionStatus, setConnectionStatus] = useState<string>('Checking...');

  useEffect(() => {
    // Test Supabase connection
    const testConnection = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          setConnectionStatus('⚠️ Supabase configured but not connected. Please check your credentials.');
        } else {
          setConnectionStatus('✅ Supabase connected successfully!');
        }
      } catch (err) {
        setConnectionStatus('❌ Error: Please configure Supabase credentials in .env file');
      }
    };

    testConnection();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>DSober</Text>
      <Text style={styles.subtitle}>Designated Driver Management Platform</Text>
      <Text style={styles.status}>{connectionStatus}</Text>
      <Text style={styles.instructions}>
        Ready to start building! Check README.md for setup instructions.
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  status: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  instructions: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 20,
  },
});
