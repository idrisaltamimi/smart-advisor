import { Link } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function SignIn() {
  const { signIn } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordRef = useRef<TextInput>(null);

  async function handleSignIn() {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (e: any) {
      Alert.alert('Sign In Failed', e.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  function fillDevCredentials() {
    setEmail('i@g.com');
    setPassword('12345678');
  }

  const inputStyle = [styles.input, { borderColor: colors.icon, color: colors.text }];

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.inner}>
          <View style={styles.titleRow}>
            <ThemedText type="title" style={styles.title}>Sign In</ThemedText>
            {__DEV__ && (
              <TouchableOpacity onPress={fillDevCredentials} style={[styles.devBadge, { backgroundColor: colors.tint }]}>
                <ThemedText style={styles.devBadgeText}>DEV</ThemedText>
              </TouchableOpacity>
            )}
          </View>

          <TextInput
            style={inputStyle}
            placeholder="Email"
            placeholderTextColor={colors.icon}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => passwordRef.current?.focus()}
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            ref={passwordRef}
            style={inputStyle}
            placeholder="Password"
            placeholderTextColor={colors.icon}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={handleSignIn}
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.tint }]}
            onPress={handleSignIn}
            disabled={loading}
          >
            <ThemedText style={styles.buttonText}>{loading ? 'Signing in…' : 'Sign In'}</ThemedText>
          </TouchableOpacity>

          <View style={styles.footer}>
            <ThemedText>Don't have an account? </ThemedText>
            <Link href="/(auth)/sign-up">
              <ThemedText style={{ color: colors.tint }}>Sign Up</ThemedText>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  kav: { flex: 1 },
  inner: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 16, paddingVertical: 40 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  title: { marginBottom: 0 },
  devBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  devBadgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
});
