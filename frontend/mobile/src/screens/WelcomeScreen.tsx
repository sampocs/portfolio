import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';
import { apiService } from '../services/api';
import { StorageService } from '../services/storage';

interface WelcomeScreenProps {
  onAuthenticationSuccess: () => void;
  onDemoMode: () => void;
}

export default function WelcomeScreen({ onAuthenticationSuccess, onDemoMode }: WelcomeScreenProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmitInviteCode = async () => {
    if (!inviteCode.trim()) {
      setError('Please enter an invite code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await apiService.authenticate(inviteCode.trim());
      
      if (result.success) {
        // Store the API key and proceed to live mode
        await StorageService.storeApiKey(inviteCode.trim());
        onAuthenticationSuccess();
        // Keep loading state - don't set setIsLoading(false) on success
        // The loading will persist until this screen transitions away
      } else {
        setError(result.message || 'Invalid invite code');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setError('Authentication failed. Please try again.');
      setIsLoading(false);
    }
  };

  const handleDemoMode = () => {
    onDemoMode();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Welcome to Portfolio</Text>
          <Text style={styles.subtitle}>Enter your invite code to get started</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            placeholder="Invite Code"
            placeholderTextColor={theme.colors.muted}
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />

          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleSubmitInviteCode}
            disabled={isLoading}
          >
            <Text style={styles.primaryButtonText}>
              {isLoading ? 'Authenticating...' : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.orText}>or</Text>
          
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleDemoMode}
            disabled={isLoading}
          >
            <Text style={styles.secondaryButtonText}>Try Demo Mode</Text>
          </TouchableOpacity>
        </View>
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = createStyles({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxxl,
  },
  title: {
    color: theme.colors.foreground,
    ...getTextStyle('xxxl', 'bold'),
    marginBottom: theme.spacing.md,
  },
  subtitle: {
    color: theme.colors.muted,
    ...getTextStyle('lg', 'normal'),
    textAlign: 'center',
  },
  form: {
    marginBottom: theme.spacing.xxxl,
  },
  input: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    color: theme.colors.foreground,
    ...getTextStyle('lg', 'normal'),
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inputError: {
    borderColor: theme.colors.destructive,
  },
  errorText: {
    color: theme.colors.destructive,
    ...getTextStyle('sm', 'normal'),
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: theme.colors.foreground,
    ...getTextStyle('lg', 'semibold'),
  },
  footer: {
    alignItems: 'center',
  },
  orText: {
    color: theme.colors.muted,
    ...getTextStyle('md', 'normal'),
    marginBottom: theme.spacing.lg,
  },
  secondaryButton: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  secondaryButtonText: {
    color: theme.colors.muted,
    ...getTextStyle('lg', 'normal'),
  },
});