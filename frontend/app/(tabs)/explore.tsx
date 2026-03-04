import React, { useState, useCallback } from 'react'
import {
  ActivityIndicator,
  Alert,
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
import {
  SemesterDetail,
  apiCancelSemester,
  apiGetSemesters,
  apiUpdateSemesterStatus,
} from '@/services/api'

const SEMESTER_ORDER: Record<string, number> = { Spring: 1, Summer: 2, Fall: 3 }

function semesterSortKey(label: string): [number, number] {
  const parts = label.split(' ')
  const type = parts[0]
  const year = parseInt(parts[parts.length - 1], 10)
  return [isNaN(year) ? 0 : year, SEMESTER_ORDER[type] ?? 0]
}

export default function SemesterHistoryScreen() {
  const { token } = useAuth()
  const colorScheme = useColorScheme() ?? 'light'
  const colors = Colors[colorScheme]

  const [semesters, setSemesters] = useState<SemesterDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [transitioningId, setTransitioningId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const fetchSemesters = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await apiGetSemesters(token)
      setSemesters(res.semesters)
    } catch (e: any) {
      setError(e.message ?? 'Failed to load semesters')
    } finally {
      setLoading(false)
    }
  }, [token])

  useFocusEffect(
    useCallback(() => {
      fetchSemesters()
    }, [fetchSemesters])
  )

  async function handleTransition(semesterId: string, newStatus: 'enrolled' | 'completed') {
    if (!token) return
    setTransitioningId(semesterId)
    setError(null)
    try {
      await apiUpdateSemesterStatus(semesterId, newStatus, token)
      await fetchSemesters()
    } catch (e: any) {
      setError(e.message ?? 'Failed to update semester status')
    } finally {
      setTransitioningId(null)
    }
  }

  function handleCancel(semesterId: string, label: string) {
    Alert.alert(
      'Cancel Semester',
      `Are you sure you want to cancel "${label}"? This cannot be undone.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Semester',
          style: 'destructive',
          onPress: async () => {
            if (!token) return
            setCancellingId(semesterId)
            setError(null)
            try {
              await apiCancelSemester(semesterId, token)
              await fetchSemesters()
            } catch (e: any) {
              setError(e.message ?? 'Failed to cancel semester')
            } finally {
              setCancellingId(null)
            }
          },
        },
      ]
    )
  }

  const planned = semesters.filter(s => s.status === 'planned')
  const current = semesters.filter(s => s.status === 'current')
  const completed = semesters.filter(s => s.status === 'completed')

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    )
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.scrollContent}
    >
      <ThemedText type="title" style={styles.pageTitle}>
        Semester History
      </ThemedText>

      {error && (
        <View style={styles.errorBanner}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      )}

      {semesters.length === 0 && !error && (
        <View style={styles.emptyState}>
          <ThemedText style={[styles.emptyText, { color: colors.icon }]}>
            No semesters yet. Use the Advisor tab to plan and enroll in a semester.
          </ThemedText>
        </View>
      )}

      {current.length > 0 && (
        <Section title="Current">
          {current.map(sem => (
            <SemesterCard
              key={sem.id}
              semester={sem}
              colors={colors}
              transitioning={transitioningId === sem.id}
              onAction={() => handleTransition(sem.id, 'completed')}
              actionLabel="Mark as Completed"
            />
          ))}
        </Section>
      )}

      {planned.length > 0 && (
        <Section title="Planned">
          {[...planned]
            .sort((a, b) => {
              const [yearA, orderA] = semesterSortKey(a.semester_label)
              const [yearB, orderB] = semesterSortKey(b.semester_label)
              return yearA !== yearB ? yearA - yearB : orderA - orderB
            })
            .map((sem, index) => (
              <SemesterCard
                key={sem.id}
                semester={sem}
                colors={colors}
                transitioning={transitioningId === sem.id}
                onAction={index === 0 ? () => handleTransition(sem.id, 'enrolled') : undefined}
                actionLabel={index === 0 ? 'Activate Semester' : undefined}
                onCancel={() => handleCancel(sem.id, sem.semester_label)}
                cancelling={cancellingId === sem.id}
              />
            ))}
        </Section>
      )}

      {completed.length > 0 && (
        <Section title="Past">
          {completed.map(sem => (
            <SemesterCard
              key={sem.id}
              semester={sem}
              colors={colors}
              transitioning={false}
            />
          ))}
        </Section>
      )}
    </ScrollView>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      {children}
    </View>
  )
}

function SemesterCard({
  semester,
  colors,
  transitioning,
  onAction,
  actionLabel,
  onCancel,
  cancelling,
}: {
  semester: SemesterDetail
  colors: (typeof Colors)[keyof typeof Colors]
  transitioning: boolean
  onAction?: () => void
  actionLabel?: string
  onCancel?: () => void
  cancelling?: boolean
}) {
  const badge = getStatusBadge(semester.status)

  return (
    <View style={[styles.card, { borderColor: colors.icon + '33' }]}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <ThemedText type="defaultSemiBold" style={styles.cardLabel}>
          {semester.semester_label}
        </ThemedText>
        <View style={styles.cardHeaderRight}>
          <View style={[styles.creditsPill, { backgroundColor: colors.tint + '22' }]}>
            <ThemedText style={[styles.creditsPillText, { color: colors.tint }]}>
              {semester.total_credits} cr
            </ThemedText>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <ThemedText style={[styles.statusBadgeText, { color: badge.text }]}>
              {badge.label}
            </ThemedText>
          </View>
        </View>
      </View>

      {/* Course list */}
      {semester.courses.map(course => (
        <View key={course.course_id} style={styles.courseRow}>
          <ThemedText style={styles.courseCode}>{course.course_code}</ThemedText>
          <ThemedText style={[styles.courseName, { color: colors.icon }]} numberOfLines={1}>
            {course.course_name}
          </ThemedText>
          <ThemedText style={[styles.courseCredits, { color: colors.icon }]}>
            {course.credits}cr
          </ThemedText>
        </View>
      ))}

      {/* Activate button */}
      {onAction && actionLabel && (
        <TouchableOpacity
          style={[
            styles.actionBtn,
            { backgroundColor: colors.tint, opacity: transitioning ? 0.6 : 1 },
          ]}
          onPress={onAction}
          disabled={transitioning}
        >
          {transitioning ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.actionBtnText}>{actionLabel}</ThemedText>
          )}
        </TouchableOpacity>
      )}

      {/* Cancel button */}
      {onCancel && (
        <TouchableOpacity
          style={[styles.cancelBtn, { opacity: cancelling ? 0.6 : 1 }]}
          onPress={onCancel}
          disabled={cancelling}
        >
          {cancelling ? (
            <ActivityIndicator color="#ef4444" />
          ) : (
            <ThemedText style={styles.cancelBtnText}>Cancel Semester</ThemedText>
          )}
        </TouchableOpacity>
      )}
    </View>
  )
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'current':
      return { bg: '#dbeafe', text: '#1d4ed8', label: 'Current' }
    case 'completed':
      return { bg: '#dcfce7', text: '#15803d', label: 'Completed' }
    default:
      return { bg: '#f3f4f6', text: '#6b7280', label: 'Planned' }
  }
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    marginBottom: 4,
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  errorText: {
    color: '#991b1b',
    fontSize: 13,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardLabel: {
    fontSize: 15,
  },
  creditsPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  creditsPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  courseCode: {
    fontSize: 13,
    fontWeight: '600',
    minWidth: 80,
  },
  courseName: {
    flex: 1,
    fontSize: 13,
  },
  courseCredits: {
    fontSize: 12,
  },
  actionBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  cancelBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ef4444',
    marginTop: 4,
  },
  cancelBtnText: {
    color: '#ef4444',
    fontWeight: '700',
    fontSize: 15,
  },
})
