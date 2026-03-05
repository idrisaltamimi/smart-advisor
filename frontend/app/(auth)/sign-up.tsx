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

export default function SignUp() {
  const { signUp } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  async function handleSignUp() {
    if (!fullName || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await signUp(fullName.trim(), email.trim(), password);
    } catch (e: any) {
      Alert.alert('Sign Up Failed', e.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = (field: string) => [
    styles.input,
    { borderColor: focusedField === field ? colors.tint : colors.icon + '55', color: colors.text },
  ];

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.inner}>
          <ThemedText type="title" style={styles.title}>Create Account</ThemedText>

          <TextInput
            style={inputStyle('name')}
            placeholder="Full Name"
            placeholderTextColor={colors.icon}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => emailRef.current?.focus()}
            onFocus={() => setFocusedField('name')}
            onBlur={() => setFocusedField(null)}
            value={fullName}
            onChangeText={setFullName}
          />

          <TextInput
            ref={emailRef}
            style={inputStyle('email')}
            placeholder="Email"
            placeholderTextColor={colors.icon}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => passwordRef.current?.focus()}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            ref={passwordRef}
            style={inputStyle('password')}
            placeholder="Password (min 8 characters)"
            placeholderTextColor={colors.icon}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={handleSignUp}
            onFocus={() => setFocusedField('password')}
            onBlur={() => setFocusedField(null)}
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.tint }]}
            onPress={handleSignUp}
            disabled={loading}
          >
            <ThemedText style={styles.buttonText}>{loading ? 'Creating account…' : 'Sign Up'}</ThemedText>
          </TouchableOpacity>

          <View style={styles.footer}>
            <ThemedText>Already have an account? </ThemedText>
            <Link href="/(auth)/sign-in">
              <ThemedText style={{ color: colors.tint }}>Sign In</ThemedText>
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
  title: { marginBottom: 8 },
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
