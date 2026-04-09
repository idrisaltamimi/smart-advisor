import React, { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'

import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { Colors } from '@/constants/theme'
import { useAuth } from '@/context/auth-context'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { Major, apiDevReset, apiGetMajors } from '@/services/api'

export default function ProfileScreen() {
  const { user, token, signOut, setMajor } = useAuth()
  const colorScheme = useColorScheme() ?? 'light'
  const colors = Colors[colorScheme]

  const [majors, setMajors] = useState<Major[]>([])
  const [changeMajorVisible, setChangeMajorVisible] = useState(false)
  const [savingMajor, setSavingMajor] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [resetting, setResetting] = useState(false)

  useFocusEffect(
    useCallback(() => {
      apiGetMajors().then(setMajors).catch(() => {})
    }, [])
  )

  const majorName = majors.find(m => m.id === user?.major_id)?.name ?? '—'

  function handleChangeMajorPress() {
    Alert.alert(
      'Change Major',
      'Changing your major will update future AI-generated plans to the new major\'s requirements. Your existing semester history will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => setChangeMajorVisible(true) },
      ]
    )
  }

  async function handleSelectMajor(major_id: string) {
    setSavingMajor(true)
    try {
      await setMajor(major_id)
      setChangeMajorVisible(false)
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to update major')
    } finally {
      setSavingMajor(false)
    }
  }

  function handleDevReset() {
    Alert.alert(
      '[DEV] Start Over',
      'This will delete all semesters, enrolled courses, and reset your CGPA. Your name and major will be kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Over',
          style: 'destructive',
          onPress: async () => {
            if (!token) return
            setResetting(true)
            try {
              await apiDevReset(token)
              Alert.alert('Done', 'Student data has been reset.')
            } catch (e: any) {
              Alert.alert('Error', e.message ?? 'Reset failed')
            } finally {
              setResetting(false)
            }
          },
        },
      ]
    )
  }

  function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true)
          try {
            await signOut()
          } finally {
            setSigningOut(false)
          }
        },
      },
    ])
  }

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={styles.scrollContent}
      >
        <ThemedText type="title" style={styles.pageTitle}>
          Profile
        </ThemedText>

        {/* Info card */}
        <View style={[styles.card, { borderColor: colors.icon + '33' }]}>
          <InfoRow label="Name" value={user?.full_name ?? '—'} colors={colors} />
          <Divider colors={colors} />
          <InfoRow label="Email" value={user?.email ?? '—'} colors={colors} />
          <Divider colors={colors} />
          <InfoRow label="Major" value={majorName} colors={colors} />
          <Divider colors={colors} />
          <InfoRow
            label="CGPA"
            value="—"
            colors={colors}
            note="See the Home tab for your current CGPA"
          />
        </View>

        {/* Change major */}
        <TouchableOpacity
          style={[styles.outlineBtn, { borderColor: colors.tint }]}
          onPress={handleChangeMajorPress}
        >
          <ThemedText style={[styles.outlineBtnText, { color: colors.tint }]}>
            Change Major
          </ThemedText>
        </TouchableOpacity>

        {/* Dev-only: Start Over */}
        {__DEV__ && (
          <TouchableOpacity
            style={[styles.devBtn, { opacity: resetting ? 0.6 : 1 }]}
            onPress={handleDevReset}
            disabled={resetting}
          >
            {resetting ? (
              <ActivityIndicator color="#f59e0b" />
            ) : (
              <ThemedText style={styles.devBtnText}>Start Over</ThemedText>
            )}
          </TouchableOpacity>
        )}

        {/* Logout */}
        <TouchableOpacity
          style={[styles.destructiveBtn, { opacity: signingOut ? 0.6 : 1 }]}
          onPress={handleLogout}
          disabled={signingOut}
        >
          {signingOut ? (
            <ActivityIndicator color="#ef4444" />
          ) : (
            <ThemedText style={styles.destructiveBtnText}>Sign Out</ThemedText>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Change Major Modal */}
      <Modal
        visible={changeMajorVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setChangeMajorVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <ThemedText type="title" style={styles.modalTitle}>
              Select Major
            </ThemedText>
            <TouchableOpacity
              onPress={() => setChangeMajorVisible(false)}
              style={styles.modalCloseBtn}
            >
              <ThemedText style={[styles.modalCloseBtnText, { color: colors.tint }]}>
                Cancel
              </ThemedText>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
          >
            {majors.map(major => {
              const isSelected = major.id === user?.major_id
              return (
                <TouchableOpacity
                  key={major.id}
                  style={[
                    styles.majorItem,
                    {
                      borderColor: isSelected ? colors.tint : colors.icon + '33',
                      backgroundColor: isSelected ? colors.tint + '12' : 'transparent',
                    },
                  ]}
                  onPress={() => handleSelectMajor(major.id)}
                  disabled={savingMajor || isSelected}
                >
                  <View style={styles.majorItemContent}>
                    <ThemedText
                      style={[
                        styles.majorName,
                        isSelected && { color: colors.tint, fontWeight: '700' },
                      ]}
                    >
                      {major.name}
                    </ThemedText>
                    <ThemedText style={[styles.majorCredits, { color: colors.icon }]}>
                      {major.total_credits_required} credits
                    </ThemedText>
                  </View>
                  {isSelected && (
                    <View style={[styles.selectedDot, { backgroundColor: colors.tint }]} />
                  )}
                </TouchableOpacity>
              )
            })}
          </ScrollView>

          {savingMajor && (
            <View style={styles.savingOverlay}>
              <ActivityIndicator size="large" color={colors.tint} />
            </View>
          )}
        </View>
      </Modal>
    </>
  )
}

function InfoRow({
  label,
  value,
  colors,
  note,
}: {
  label: string
  value: string
  colors: (typeof Colors)[keyof typeof Colors]
  note?: string
}) {
  return (
    <View style={styles.infoRow}>
      <ThemedText style={[styles.infoLabel, { color: colors.icon }]}>{label}</ThemedText>
      <View style={styles.infoValueBlock}>
        <ThemedText style={styles.infoValue}>{value}</ThemedText>
        {note && (
          <ThemedText style={[styles.infoNote, { color: colors.icon }]}>{note}</ThemedText>
        )}
      </View>
    </View>
  )
}

function Divider({ colors }: { colors: (typeof Colors)[keyof typeof Colors] }) {
  return <View style={[styles.divider, { backgroundColor: colors.icon + '22' }]} />
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  pageTitle: {
    marginBottom: 4,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 12,
  },
  infoLabel: {
    fontSize: 13,
    width: 60,
    paddingTop: 1,
  },
  infoValueBlock: {
    flex: 1,
    gap: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  infoNote: {
    fontSize: 11,
  },
  divider: {
    height: 1,
    marginHorizontal: 14,
  },
  outlineBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  outlineBtnText: {
    fontWeight: '700',
    fontSize: 16,
  },
  devBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    borderStyle: 'dashed',
  },
  devBtnText: {
    color: '#f59e0b',
    fontWeight: '700',
    fontSize: 16,
  },
  destructiveBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ef4444',
  },
  destructiveBtnText: {
    color: '#ef4444',
    fontWeight: '700',
    fontSize: 16,
  },

  // Modal
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
  },
  modalCloseBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  modalCloseBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 10,
    paddingTop: 8,
  },
  majorItem: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  majorItemContent: {
    flex: 1,
    gap: 3,
  },
  majorName: {
    fontSize: 15,
  },
  majorCredits: {
    fontSize: 12,
  },
  selectedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
})
