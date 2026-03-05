import React, { useState, useCallback } from 'react'
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
import {
  CompleteSemesterResponse,
  CourseGradeInput,
  FeedbackItem,
  GradeValue,
  SemesterDetail,
  SemesterCourseDetail,
  apiCancelSemester,
  apiCompleteSemester,
  apiGetSemesters,
  apiSubmitFeedback,
  apiUpdateSemesterStatus,
} from '@/services/api'

const GRADES: GradeValue[] = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F']

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

  // Grade modal state
  const [gradeModalSemester, setGradeModalSemester] = useState<SemesterDetail | null>(null)
  const [selectedGrades, setSelectedGrades] = useState<Record<string, GradeValue>>({})
  const [completing, setCompleting] = useState(false)
  const [completionResult, setCompletionResult] = useState<CompleteSemesterResponse | null>(null)

  // Feedback modal state
  const [feedbackSemesterId, setFeedbackSemesterId] = useState<string | null>(null)
  const [feedbackCourses, setFeedbackCourses] = useState<SemesterCourseDetail[]>([])
  const [difficultyRatings, setDifficultyRatings] = useState<Record<string, number>>({})
  const [submittingFeedback, setSubmittingFeedback] = useState(false)

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

  function openGradeModal(semester: SemesterDetail) {
    setSelectedGrades({})
    setGradeModalSemester(semester)
  }

  function closeGradeModal() {
    setGradeModalSemester(null)
    setSelectedGrades({})
  }

  async function handleConfirmGrades() {
    if (!token || !gradeModalSemester) return
    const course_grades: CourseGradeInput[] = gradeModalSemester.courses.map(c => ({
      course_id: c.course_id,
      grade: selectedGrades[c.course_id],
    }))
    const semesterSnapshot = gradeModalSemester
    setCompleting(true)
    try {
      const result = await apiCompleteSemester(semesterSnapshot.id, course_grades, token)
      closeGradeModal()
      setCompletionResult(result)
      // Stash courses for the feedback modal
      setFeedbackSemesterId(semesterSnapshot.id)
      setFeedbackCourses(semesterSnapshot.courses)
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to complete semester')
    } finally {
      setCompleting(false)
    }
  }

  function handleDismissResult() {
    setCompletionResult(null)
    // Open feedback modal if we have courses to rate
    if (feedbackSemesterId && feedbackCourses.length > 0) {
      setDifficultyRatings({})
    } else {
      fetchSemesters()
    }
  }

  async function handleSubmitFeedback() {
    if (!token || !feedbackSemesterId) return
    setSubmittingFeedback(true)
    try {
      const feedback: FeedbackItem[] = Object.entries(difficultyRatings).map(
        ([course_id, difficulty_rating]) => ({ course_id, difficulty_rating })
      )
      if (feedback.length > 0) {
        await apiSubmitFeedback(feedbackSemesterId, feedback, token)
      }
    } catch {
      // Feedback errors are non-critical — silently ignore
    } finally {
      setSubmittingFeedback(false)
      setFeedbackSemesterId(null)
      setFeedbackCourses([])
      setDifficultyRatings({})
      fetchSemesters()
    }
  }

  function handleSkipFeedback() {
    setFeedbackSemesterId(null)
    setFeedbackCourses([])
    setDifficultyRatings({})
    fetchSemesters()
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

  const allGradesSelected =
    gradeModalSemester !== null &&
    gradeModalSemester.courses.every(c => !!selectedGrades[c.course_id])

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    )
  }

  return (
    <>
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
                onAction={() => openGradeModal(sem)}
                actionLabel="Mark as Completed"
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
      </ScrollView>

      {/* ── Grade Entry Modal ── */}
      <Modal
        visible={!!gradeModalSemester}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeGradeModal}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <ThemedText type="title" style={styles.modalTitle}>
              Complete Semester
            </ThemedText>
            <TouchableOpacity onPress={closeGradeModal} style={styles.modalCloseBtn}>
              <ThemedText style={[styles.modalCloseBtnText, { color: colors.tint }]}>
                Cancel
              </ThemedText>
            </TouchableOpacity>
          </View>
          <ThemedText style={[styles.modalSubtitle, { color: colors.icon }]}>
            Enter a grade for each course
          </ThemedText>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
            {gradeModalSemester?.courses.map(course => (
              <View key={course.course_id} style={[styles.gradeRow, { borderColor: colors.icon + '33' }]}>
                <View style={styles.gradeRowLeft}>
                  <ThemedText style={styles.gradeRowCode}>{course.course_code}</ThemedText>
                  <ThemedText style={[styles.gradeRowName, { color: colors.icon }]} numberOfLines={2}>
                    {course.course_name}
                  </ThemedText>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipsScroll}
                  contentContainerStyle={styles.chipsContent}
                >
                  {GRADES.map(grade => {
                    const isSelected = selectedGrades[course.course_id] === grade
                    const isFail = grade === 'F'
                    return (
                      <TouchableOpacity
                        key={grade}
                        style={[
                          styles.gradeChip,
                          isSelected && {
                            backgroundColor: isFail ? '#ef4444' : colors.tint,
                            borderColor: isFail ? '#ef4444' : colors.tint,
                          },
                          !isSelected && { borderColor: colors.icon + '55' },
                        ]}
                        onPress={() =>
                          setSelectedGrades(prev => ({ ...prev, [course.course_id]: grade }))
                        }
                      >
                        <ThemedText
                          style={[
                            styles.gradeChipText,
                            isSelected && { color: '#fff' },
                            !isSelected && { color: colors.text },
                          ]}
                        >
                          {grade}
                        </ThemedText>
                      </TouchableOpacity>
                    )
                  })}
                </ScrollView>
              </View>
            ))}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                {
                  backgroundColor: allGradesSelected ? colors.tint : colors.icon + '44',
                  opacity: completing ? 0.7 : 1,
                },
              ]}
              onPress={handleConfirmGrades}
              disabled={!allGradesSelected || completing}
            >
              {completing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.confirmBtnText}>Confirm & Complete</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Difficulty Feedback Modal ── */}
      <Modal
        visible={!completionResult && !!feedbackSemesterId && feedbackCourses.length > 0}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleSkipFeedback}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <ThemedText type="title" style={styles.modalTitle}>
              Rate Difficulty
            </ThemedText>
            <TouchableOpacity onPress={handleSkipFeedback} style={styles.modalCloseBtn}>
              <ThemedText style={[styles.modalCloseBtnText, { color: colors.icon }]}>
                Skip
              </ThemedText>
            </TouchableOpacity>
          </View>
          <ThemedText style={[styles.modalSubtitle, { color: colors.icon }]}>
            How difficult was each course? (1 = easy, 5 = very hard)
          </ThemedText>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
            {feedbackCourses.map(course => (
              <View key={course.course_id} style={[styles.gradeRow, { borderColor: colors.icon + '33' }]}>
                <View style={styles.gradeRowLeft}>
                  <ThemedText style={styles.gradeRowCode}>{course.course_code}</ThemedText>
                  <ThemedText style={[styles.gradeRowName, { color: colors.icon }]} numberOfLines={2}>
                    {course.course_name}
                  </ThemedText>
                </View>
                <View style={styles.chipsRow}>
                  <ThemedText style={[styles.scaleLabel, { color: colors.icon }]}>Easy</ThemedText>
                <View style={styles.chipsContent}>
                  {[1, 2, 3, 4, 5].map(star => {
                    const isSelected = difficultyRatings[course.course_id] === star
                    return (
                      <TouchableOpacity
                        key={star}
                        style={[
                          styles.gradeChip,
                          isSelected
                            ? { backgroundColor: colors.tint, borderColor: colors.tint }
                            : { borderColor: colors.icon + '55' },
                        ]}
                        onPress={() =>
                          setDifficultyRatings(prev => ({ ...prev, [course.course_id]: star }))
                        }
                      >
                        <ThemedText
                          style={[
                            styles.gradeChipText,
                            isSelected ? { color: '#fff' } : { color: colors.text },
                          ]}
                        >
                          {star}
                        </ThemedText>
                      </TouchableOpacity>
                    )
                  })}
                </View>
                  <ThemedText style={[styles.scaleLabel, { color: colors.icon }]}>Hard</ThemedText>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                { backgroundColor: colors.tint, opacity: submittingFeedback ? 0.7 : 1 },
              ]}
              onPress={handleSubmitFeedback}
              disabled={submittingFeedback}
            >
              {submittingFeedback ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.confirmBtnText}>Submit Feedback</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Completion Results Modal ── */}
      <Modal
        visible={!!completionResult}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleDismissResult}
      >
        {completionResult && (
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="title" style={styles.modalTitle}>
                Semester Completed
              </ThemedText>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
              {/* GPA block */}
              <View style={[styles.gpaBlock, { backgroundColor: colors.tint + '18', borderColor: colors.tint + '44' }]}>
                <View style={styles.gpaRow}>
                  <ThemedText style={styles.gpaLabel}>Semester GPA</ThemedText>
                  <ThemedText style={[styles.gpaValue, { color: colors.tint }]}>
                    {completionResult.semester_gpa.toFixed(2)}
                  </ThemedText>
                </View>
                <View style={[styles.gpaDivider, { backgroundColor: colors.tint + '33' }]} />
                <View style={styles.gpaRow}>
                  <ThemedText style={styles.gpaLabel}>Cumulative GPA</ThemedText>
                  <ThemedText style={[styles.gpaValue, { color: colors.tint }]}>
                    {completionResult.new_cgpa.toFixed(2)}
                  </ThemedText>
                </View>
              </View>

              {/* Failed courses */}
              {completionResult.failed_courses.length > 0 && (
                <View style={styles.failedBlock}>
                  <ThemedText style={styles.failedTitle}>Failed Courses</ThemedText>
                  {completionResult.failed_courses.map(fc => (
                    <View key={fc.course_id} style={styles.failedRow}>
                      <View style={styles.failedDot} />
                      <ThemedText style={styles.failedText}>
                        {fc.course_code} — {fc.course_name}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              )}

              {/* Case 2 — plans cancelled banner */}
              {completionResult.warning_type === 'plans_cancelled' && (
                <View style={styles.alertBannerRed}>
                  <ThemedText style={styles.alertBannerTitle}>Future Plans Cancelled</ThemedText>
                  <ThemedText style={styles.alertBannerBody}>
                    {completionResult.warning_message}
                  </ThemedText>
                </View>
              )}

              {/* Case 1 — priority warning banner */}
              {completionResult.warning_type === 'priority_warning' && (
                <View style={styles.alertBannerYellow}>
                  <ThemedText style={styles.alertBannerTitleYellow}>Note</ThemedText>
                  <ThemedText style={styles.alertBannerBodyYellow}>
                    {completionResult.warning_message}
                  </ThemedText>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: colors.tint }]}
                onPress={handleDismissResult}
              >
                <ThemedText style={styles.confirmBtnText}>Done</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>
    </>
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
          {semester.semester_gpa !== null && (
            <View style={[styles.creditsPill, { backgroundColor: '#dcfce7' }]}>
              <ThemedText style={[styles.creditsPillText, { color: '#15803d' }]}>
                GPA {Number(semester.semester_gpa).toFixed(2)}
              </ThemedText>
            </View>
          )}
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
          {course.grade ? (
            <View style={[
              styles.gradeBadge,
              { backgroundColor: course.grade === 'F' ? '#fee2e2' : '#dcfce7' },
            ]}>
              <ThemedText style={[
                styles.gradeBadgeText,
                { color: course.grade === 'F' ? '#991b1b' : '#15803d' },
              ]}>
                {course.grade}
              </ThemedText>
            </View>
          ) : (
            <ThemedText style={[styles.courseCredits, { color: colors.icon }]}>
              {course.credits}cr
            </ThemedText>
          )}
        </View>
      ))}

      {/* Action button */}
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
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    flex: 1,
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
  gradeBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  gradeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
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

  // ── Modal ──────────────────────────────────────────────────────────────────
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
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
  modalSubtitle: {
    fontSize: 13,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  modalFooter: {
    padding: 20,
    paddingBottom: 36,
  },
  gradeRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  gradeRowLeft: {
    gap: 2,
  },
  gradeRowCode: {
    fontSize: 13,
    fontWeight: '700',
  },
  gradeRowName: {
    fontSize: 12,
  },
  chipsScroll: {
    flexGrow: 0,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scaleLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  chipsContent: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
  },
  gradeChip: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  confirmBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },

  // ── Results Modal ──────────────────────────────────────────────────────────
  gpaBlock: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginTop: 8,
  },
  gpaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gpaLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  gpaValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  gpaDivider: {
    height: 1,
  },
  failedBlock: {
    gap: 8,
    marginTop: 4,
  },
  failedTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#991b1b',
  },
  failedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  failedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  failedText: {
    fontSize: 13,
    color: '#991b1b',
    flex: 1,
  },
  alertBannerRed: {
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
    gap: 6,
  },
  alertBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991b1b',
  },
  alertBannerBody: {
    fontSize: 13,
    color: '#991b1b',
    lineHeight: 18,
  },
  alertBannerYellow: {
    backgroundColor: '#fefce8',
    borderRadius: 10,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#ca8a04',
    gap: 6,
  },
  alertBannerTitleYellow: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400e',
  },
  alertBannerBodyYellow: {
    fontSize: 13,
    color: '#92400e',
    lineHeight: 18,
  },
})
