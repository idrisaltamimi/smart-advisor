import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { apiGetMajors, Major } from '@/services/api';

export default function SelectMajor() {
  const { setMajor } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [majors, setMajors] = useState<Major[]>([]);
  const [loadingMajors, setLoadingMajors] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiGetMajors()
      .then(setMajors)
      .catch(() => Alert.alert('Error', 'Failed to load majors.'))
      .finally(() => setLoadingMajors(false));
  }, []);

  async function handleSelect(major: Major) {
    setSubmitting(true);
    try {
      await setMajor(major.id);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to set major.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Choose Your Major</ThemedText>
        <ThemedText style={styles.subtitle}>
          Select the program you are enrolled in.
        </ThemedText>
      </View>

      {loadingMajors ? (
        <ActivityIndicator size="large" color={colors.tint} style={styles.loader} />
      ) : (
        <FlatList
          data={majors}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, { borderColor: colors.icon }]}
              onPress={() => handleSelect(item)}
              disabled={submitting}
            >
              <ThemedText style={styles.majorName}>{item.name}</ThemedText>
              <ThemedText style={[styles.credits, { color: colors.icon }]}>
                {item.total_credits_required} credits required
              </ThemedText>
            </TouchableOpacity>
          )}
        />
      )}

      {submitting && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 24, gap: 8 },
  subtitle: { opacity: 0.6, fontSize: 15 },
  loader: { marginTop: 48 },
  list: { paddingHorizontal: 24, gap: 12, paddingBottom: 32 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 4,
  },
  majorName: { fontSize: 16, fontWeight: '600' },
  credits: { fontSize: 13 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
});
