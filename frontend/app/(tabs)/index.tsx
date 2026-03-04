import React, { useCallback } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'

import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { Colors } from '@/constants/theme'
import { useAuth } from '@/context/auth-context'
import { useColorScheme } from '@/hooks/use-color-scheme'
import {
  ProgressResponse,
  ProgressSemesterSummary,
  RequirementProgressItem,
  apiGetProgress,
} from '@/services/api'

export default function HomeScreen() {
  const { token, user } = useAuth()
  const colorScheme = useColorScheme() ?? 'light'
  const colors = Colors[colorScheme]

  const [progress, setProgress] = React.useState<ProgressResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const fetchProgress = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiGetProgress(token)
      setProgress(data)
    } catch (e: any) {
      setError(e.message ?? 'Failed to load progress')
    } finally {
      setLoading(false)
    }
  }, [token])

  useFocusEffect(
    useCallback(() => {
      fetchProgress()
    }, [fetchProgress])
  )

  const firstName = user?.full_name?.split(' ')[0] ?? 'there'

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    )
  }

  if (error || !progress) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText style={{ color: colors.icon, textAlign: 'center' }}>
          {error ?? 'No data available. Set up your major to get started.'}
        </ThemedText>
      </ThemedView>
    )
  }

  const graduationPct = progress.credits_required > 0
    ? Math.min(1, progress.credits_completed / progress.credits_required)
    : 0

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Greeting */}
      <ThemedText type="title" style={styles.greeting}>
        Hi, {firstName}
      </ThemedText>

      {/* CGPA + Graduation row */}
      <View style={styles.topRow}>
        <View style={[styles.cgpaCard, { backgroundColor: colors.tint }]}>
          <ThemedText style={styles.cgpaLabel}>CGPA</ThemedText>
          <ThemedText style={styles.cgpaValue}>
            {progress.cgpa != null ? progress.cgpa.toFixed(2) : '—'}
          </ThemedText>
        </View>

        <View style={[styles.graduationCard, { borderColor: colors.icon + '33' }]}>
          <View style={styles.graduationHeader}>
            <ThemedText style={styles.graduationLabel}>Graduation Progress</ThemedText>
            <ThemedText style={[styles.graduationPct, { color: colors.tint }]}>
              {Math.round(graduationPct * 100)}%
            </ThemedText>
          </View>
          <View style={[styles.progressBarTrack, { backgroundColor: colors.icon + '22' }]}>
            <View
              style={[
                styles.progressBarFill,
                { backgroundColor: colors.tint, width: `${Math.round(graduationPct * 100)}%` },
              ]}
            />
          </View>
          <ThemedText style={[styles.graduationCredits, { color: colors.icon }]}>
            {progress.credits_completed} / {progress.credits_required} credits
          </ThemedText>
        </View>
      </View>

      {/* Active semester */}
      {progress.active_semester && (
        <SemesterCard
          title="Current Semester"
          summary={progress.active_semester}
          colors={colors}
          accentColor={colors.tint}
          badgeColor="#dbeafe"
          badgeText="#1d4ed8"
          badgeLabel="Current"
        />
      )}

      {/* Next planned semester */}
      {!progress.active_semester && progress.next_planned_semester && (
        <SemesterCard
          title="Next Planned Semester"
          summary={progress.next_planned_semester}
          colors={colors}
          accentColor="#6b7280"
          badgeColor="#f3f4f6"
          badgeText="#6b7280"
          badgeLabel="Planned"
        />
      )}

      {/* Requirement breakdown */}
      <View style={[styles.section, { borderColor: colors.icon + '33' }]}>
        <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
          Requirement Progress
        </ThemedText>
        {progress.requirement_progress.map(req => (
          <RequirementRow key={req.name} req={req} colors={colors} />
        ))}
      </View>
    </ScrollView>
  )
}

function SemesterCard({
  title,
  summary,
  colors,
  accentColor,
  badgeColor,
  badgeText,
  badgeLabel,
}: {
  title: string
  summary: ProgressSemesterSummary
  colors: (typeof Colors)[keyof typeof Colors]
  accentColor: string
  badgeColor: string
  badgeText: string
  badgeLabel: string
}) {
  return (
    <View style={[styles.section, { borderColor: colors.icon + '33' }]}>
      <View style={styles.semesterCardHeader}>
        <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
          {title}
        </ThemedText>
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <ThemedText style={[styles.badgeText, { color: badgeText }]}>{badgeLabel}</ThemedText>
        </View>
      </View>
      <ThemedText style={[styles.semesterLabel, { color: accentColor }]}>
        {summary.semester_label} · {summary.total_credits} cr
      </ThemedText>
      {summary.courses.map(course => (
        <View key={course.course_code} style={styles.courseRow}>
          <ThemedText style={styles.courseCode}>{course.course_code}</ThemedText>
          <ThemedText style={[styles.courseName, { color: colors.icon }]} numberOfLines={1}>
            {course.course_name}
          </ThemedText>
          <ThemedText style={[styles.courseCredits, { color: colors.icon }]}>
            {course.credits}cr
          </ThemedText>
        </View>
      ))}
    </View>
  )
}

function RequirementRow({
  req,
  colors,
}: {
  req: RequirementProgressItem
  colors: (typeof Colors)[keyof typeof Colors]
}) {
  const pct = req.credits_required > 0
    ? Math.min(1, req.credits_completed / req.credits_required)
    : 1
  const done = req.credits_completed >= req.credits_required

  return (
    <View style={styles.reqRow}>
      <View style={styles.reqHeader}>
        <ThemedText style={styles.reqName} numberOfLines={1}>
          {req.name}
        </ThemedText>
        <ThemedText style={[styles.reqCredits, { color: done ? '#15803d' : colors.icon }]}>
          {req.credits_completed}/{req.credits_required}
        </ThemedText>
      </View>
      <View style={[styles.reqBarTrack, { backgroundColor: colors.icon + '22' }]}>
        <View
          style={[
            styles.reqBarFill,
            {
              backgroundColor: done ? '#22c55e' : colors.tint,
              width: `${Math.round(pct * 100)}%`,
            },
          ]}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  greeting: {
    marginBottom: 4,
  },
  topRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  cgpaCard: {
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  cgpaLabel: {
    color: '#ffffffcc',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cgpaValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 4,
  },
  graduationCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    justifyContent: 'center',
  },
  graduationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  graduationLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  graduationPct: {
    fontSize: 15,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 8,
    borderRadius: 4,
  },
  graduationCredits: {
    fontSize: 12,
    marginTop: -2,
  },
  section: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  semesterCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  semesterLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: -4,
  },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
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
  reqRow: {
    gap: 5,
  },
  reqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reqName: {
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  reqCredits: {
    fontSize: 12,
    fontWeight: '600',
  },
  reqBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  reqBarFill: {
    height: 6,
    borderRadius: 3,
  },
})
