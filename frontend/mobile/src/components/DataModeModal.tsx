import React from 'react';
import { View, Text, Modal, TouchableOpacity, Pressable } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';
import { DataMode } from '../contexts/DataContext';

/**
 * DataModeModal - Confirmation dialog for switching between data modes
 * 
 * Provides a simple modal to confirm switching between live and demo data modes.
 * Text automatically adapts based on current mode for better user experience.
 */

interface DataModeModalProps {
  visible: boolean;
  currentMode: DataMode;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Generate dynamic text based on current data mode
 */
const getActionText = (currentMode: DataMode): string => {
  return currentMode === 'live' ? 'Switch to Demo Mode' : 'Switch to Live Mode';
};

export default function DataModeModal({ visible, currentMode, onConfirm, onCancel }: DataModeModalProps) {
  const actionText = getActionText(currentMode);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <View style={styles.modalContainer}>
          <View style={styles.modal}>
            <Text style={styles.modalText}>{actionText}</Text>
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.confirmButton} onPress={onConfirm}>
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = createStyles({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: theme.spacing.xl,
  },
  modal: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalText: {
    color: theme.colors.foreground,
    ...getTextStyle('lg', 'medium'),
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: theme.colors.muted,
    ...getTextStyle('md', 'medium'),
  },
  confirmButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: theme.colors.foreground,
    ...getTextStyle('md', 'medium'),
  },
});