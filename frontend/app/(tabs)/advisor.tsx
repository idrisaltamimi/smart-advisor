import React, { useState } from "react"
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from "react-native"

import { ThemedText } from "@/components/themed-text"
import { ThemedView } from "@/components/themed-view"
import { Collapsible } from "@/components/ui/collapsible"
import { Colors } from "@/constants/theme"
import { useAuth } from "@/context/auth-context"
import { useColorScheme } from "@/hooks/use-color-scheme"
import {
  AlternativeCourse,
  GenerateResponse,
  SemesterType,
  SuggestedCourse,
  apiEnrollPlan,
  apiGeneratePlan,
  apiGetAlternatives
} from "@/services/api"

type Phase = "form" | "loading" | "results" | "success"

const SUMMER_CAP = 9
const MAX_CREDITS = 19

const ALL_CREDIT_OPTIONS = [3, 6, 9, 12, 15, 18, 19]
const SUMMER_CREDIT_OPTIONS = [3, 6, 9]

export default function AdvisorScreen() {
  const { token } = useAuth()
  const colorScheme = useColorScheme() ?? "light"
  const colors = Colors[colorScheme]

  const [phase, setPhase] = useState<Phase>("form")
  const [semester, setSemester] = useState<SemesterType>("Fall")
  const [maxCredits, setMaxCredits] = useState(15)
  const [description, setDescription] = useState("")
  const [result, setResult] = useState<GenerateResponse | null>(null)
  const [localCourses, setLocalCourses] = useState<SuggestedCourse[]>([])
  const [excludedCourseIds, setExcludedCourseIds] = useState<string[]>([])
  const [enrolling, setEnrolling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Swap modal state
  const [swapTarget, setSwapTarget] = useState<SuggestedCourse | null>(null)
  const [alternatives, setAlternatives] = useState<AlternativeCourse[]>([])
  const [swapLoading, setSwapLoading] = useState(false)
  const [swapError, setSwapError] = useState<string | null>(null)

  const creditOptions = semester === "Summer" ? SUMMER_CREDIT_OPTIONS : ALL_CREDIT_OPTIONS

  function handleSemesterChange(s: SemesterType) {
    setSemester(s)
    if (s === "Summer" && maxCredits > SUMMER_CAP) {
      setMaxCredits(SUMMER_CAP)
    }
  }

  async function handleGenerate() {
    if (!token) return
    setError(null)
    setPhase("loading")
    try {
      const res = await apiGeneratePlan(
        semester,
        maxCredits,
        description.trim() || null,
        token,
        excludedCourseIds
      )
      setResult(res)
      setLocalCourses(res.suggested_courses)
      setPhase("results")
    } catch (e: any) {
      setError(e.message ?? "Something went wrong")
      setPhase("form")
    }
  }

  async function handleEnroll() {
    if (!token || !result) return
    setEnrolling(true)
    setError(null)
    try {
      await apiEnrollPlan(
        result.semester_label,
        localCourses.map((c) => c.course_id),
        token
      )
      setPhase("success")
    } catch (e: any) {
      setError(e.message ?? "Enrollment failed")
    } finally {
      setEnrolling(false)
    }
  }

  function handleReset() {
    setResult(null)
    setLocalCourses([])
    setExcludedCourseIds([])
    setError(null)
    setPhase("form")
  }

  function handleRemoveCourse(course: SuggestedCourse) {
    setLocalCourses((prev) => prev.filter((c) => c.course_id !== course.course_id))
    setExcludedCourseIds((prev) => [...prev, course.course_id])
  }

  async function handleOpenSwap(course: SuggestedCourse) {
    if (!token) return
    setSwapTarget(course)
    setSwapLoading(true)
    setSwapError(null)
    setAlternatives([])
    try {
      const res = await apiGetAlternatives(
        course.course_id,
        localCourses.map((c) => c.course_id),
        token
      )
      setAlternatives(res.alternatives)
    } catch (e: any) {
      setSwapError(e.message ?? "Failed to load alternatives")
    } finally {
      setSwapLoading(false)
    }
  }

  function handleSelectAlternative(alt: AlternativeCourse) {
    if (!swapTarget) return
    setLocalCourses((prev) =>
      prev.map((c) =>
        c.course_id === swapTarget.course_id
          ? {
              ...alt,
              reason: `Swapped in for ${swapTarget.course_code}`,
              swappable: true
            }
          : c
      )
    )
    setSwapTarget(null)
  }

  // ── Phases ─────────────────────────────────────────────────────────────────

  if (phase === "loading") {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.tint} />
        <ThemedText style={styles.loadingText}>
          Generating your personalized plan...
        </ThemedText>
      </ThemedView>
    )
  }

  if (phase === "success" && result) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText style={styles.checkmark}>✓</ThemedText>
        <ThemedText type="title" style={styles.successTitle}>
          Enrolled!
        </ThemedText>
        <ThemedText style={[styles.semesterLabel, { color: colors.icon }]}>
          {result.semester_label}
        </ThemedText>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.tint }]}
          onPress={handleReset}
        >
          <ThemedText style={styles.primaryBtnText}>Plan Another Semester</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    )
  }

  if (phase === "results" && result) {
    const localCredits = localCourses.reduce((sum, c) => sum + c.credits, 0)

    // Group localCourses by category
    const grouped: Record<string, SuggestedCourse[]> = {}
    for (const c of localCourses) {
      if (!grouped[c.requirement_category]) grouped[c.requirement_category] = []
      grouped[c.requirement_category].push(c)
    }

    return (
      <>
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.background }}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <View style={styles.resultsHeader}>
            <ThemedText type="title" style={styles.resultsTitle}>
              Your Plan
            </ThemedText>
            <View style={[styles.creditsBadge, { backgroundColor: colors.tint }]}>
              <ThemedText style={styles.creditsBadgeText}>{localCredits} cr</ThemedText>
            </View>
          </View>
          <ThemedText style={[styles.semesterLabel, { color: colors.icon }]}>
            {result.semester_label}
          </ThemedText>

          {/* Warning */}
          {result.warning && (
            <View style={styles.warningBanner}>
              <ThemedText style={styles.warningText}>{result.warning}</ThemedText>
            </View>
          )}

          {/* Error */}
          {error && (
            <View style={styles.errorBanner}>
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            </View>
          )}

          {/* Course cards grouped by category */}
          {Object.entries(grouped).map(([category, courses]) => (
            <Collapsible key={category} title={category}>
              {courses.map((course) => (
                <CourseCard
                  key={course.course_id}
                  course={course}
                  colors={colors}
                  onSwap={course.swappable ? () => handleOpenSwap(course) : undefined}
                  onRemove={() => handleRemoveCourse(course)}
                />
              ))}
            </Collapsible>
          ))}

          {/* Excluded courses info strip */}
          {excludedCourseIds.length > 0 && (
            <View style={styles.excludedStrip}>
              <ThemedText style={styles.excludedStripText}>
                {excludedCourseIds.length} course
                {excludedCourseIds.length !== 1 ? "s" : ""} removed — tap Re-advise to get
                an updated plan
              </ThemedText>
            </View>
          )}

          {/* Notes field (editable in results phase) */}
          <TextInput
            style={[
              styles.textAreaSmall,
              {
                color: colors.text,
                borderColor: colors.icon,
                backgroundColor: "#f5f5f5"
              }
            ]}
            placeholder="Add notes for Re-advise (e.g. replace with something lighter)"
            placeholderTextColor={colors.icon}
            multiline
            numberOfLines={2}
            value={description}
            onChangeText={setDescription}
          />

          {/* Actions */}
          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: colors.tint }]}
            onPress={handleGenerate}
          >
            <ThemedText style={[styles.secondaryBtnText, { color: colors.tint }]}>
              Re-advise
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: colors.icon }]}
            onPress={() => setPhase("form")}
          >
            <ThemedText style={[styles.secondaryBtnText, { color: colors.icon }]}>
              Adjust &amp; Regenerate
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              { backgroundColor: colors.tint, opacity: enrolling ? 0.6 : 1 }
            ]}
            onPress={handleEnroll}
            disabled={enrolling}
          >
            {enrolling ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.primaryBtnText}>Enroll in Plan</ThemedText>
            )}
          </TouchableOpacity>
        </ScrollView>

        {/* Swap Modal */}
        <Modal visible={swapTarget !== null} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
              <ThemedText type="defaultSemiBold">
                Swap {swapTarget?.course_code}
              </ThemedText>
              {swapLoading && <ActivityIndicator color={colors.tint} />}
              {swapError && <ThemedText style={styles.errorText}>{swapError}</ThemedText>}
              {!swapLoading && alternatives.length === 0 && !swapError && (
                <ThemedText style={{ color: colors.icon }}>
                  No alternatives available.
                </ThemedText>
              )}
              <ScrollView style={{ maxHeight: 320 }}>
                {alternatives.map((alt) => (
                  <TouchableOpacity
                    key={alt.course_id}
                    style={[styles.altItem, { borderColor: colors.icon + "33" }]}
                    onPress={() => handleSelectAlternative(alt)}
                  >
                    <View style={styles.altItemHeader}>
                      <ThemedText type="defaultSemiBold">{alt.course_code}</ThemedText>
                      <View
                        style={[
                          styles.creditsPill,
                          { backgroundColor: colors.tint + "22" }
                        ]}
                      >
                        <ThemedText
                          style={[styles.creditsPillText, { color: colors.tint }]}
                        >
                          {alt.credits} cr
                        </ThemedText>
                      </View>
                    </View>
                    <ThemedText style={styles.courseName}>{alt.course_name}</ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: colors.tint, marginTop: 8 }]}
                onPress={() => setSwapTarget(null)}
              >
                <ThemedText style={[styles.secondaryBtnText, { color: colors.tint }]}>
                  Cancel
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </>
    )
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText type="title" style={styles.formTitle}>
          Plan a Semester
        </ThemedText>

        {/* Error */}
        {error && (
          <View style={styles.errorBanner}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        )}

        {/* Semester picker */}
        <ThemedText type="defaultSemiBold" style={styles.label}>
          Semester
        </ThemedText>
        <View style={styles.pillRow}>
          {(["Fall", "Spring", "Summer"] as SemesterType[]).map((s) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.pill,
                {
                  backgroundColor: semester === s ? colors.tint : "transparent",
                  borderColor: colors.tint
                }
              ]}
              onPress={() => handleSemesterChange(s)}
            >
              <ThemedText
                style={[
                  styles.pillText,
                  { color: semester === s ? "#fff" : colors.tint }
                ]}
              >
                {s}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        {/* Max credits */}
        <ThemedText type="defaultSemiBold" style={styles.label}>
          Max Credits
        </ThemedText>
        <View style={styles.pillRow}>
          {creditOptions.map((n) => (
            <TouchableOpacity
              key={n}
              style={[
                styles.pill,
                {
                  backgroundColor: maxCredits === n ? colors.tint : "transparent",
                  borderColor: colors.tint
                }
              ]}
              onPress={() => setMaxCredits(n)}
            >
              <ThemedText
                style={[
                  styles.pillText,
                  { color: maxCredits === n ? "#fff" : colors.tint }
                ]}
              >
                {n}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        {/* Description */}
        <ThemedText type="defaultSemiBold" style={styles.label}>
          Notes (optional)
        </ThemedText>
        <TextInput
          style={[
            styles.textArea,
            {
              color: colors.text,
              borderColor: colors.icon,
              backgroundColor: "#f5f5f5"
            }
          ]}
          placeholder="e.g. I want to focus on math this semester, or avoid early morning courses."
          placeholderTextColor={colors.icon}
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
        />

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.tint }]}
          onPress={handleGenerate}
        >
          <ThemedText style={styles.primaryBtnText}>Generate Plan</ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function CourseCard({
  course,
  colors,
  onSwap,
  onRemove
}: {
  course: SuggestedCourse
  colors: (typeof Colors)[keyof typeof Colors]
  onSwap?: () => void
  onRemove?: () => void
}) {
  return (
    <View style={[styles.courseCard, { borderColor: colors.icon + "33" }]}>
      <View style={styles.courseCardHeader}>
        <ThemedText type="defaultSemiBold">{course.course_code}</ThemedText>
        <View style={styles.courseCardHeaderRight}>
          <View style={[styles.creditsPill, { backgroundColor: colors.tint + "22" }]}>
            <ThemedText style={[styles.creditsPillText, { color: colors.tint }]}>
              {course.credits} cr
            </ThemedText>
          </View>
          {onSwap && (
            <TouchableOpacity
              style={[styles.swapBtn, { borderColor: colors.tint }]}
              onPress={onSwap}
            >
              <ThemedText style={[styles.swapBtnText, { color: colors.tint }]}>
                Swap
              </ThemedText>
            </TouchableOpacity>
          )}
          {onRemove && (
            <TouchableOpacity
              style={[styles.swapBtn, { borderColor: "#ef4444" }]}
              onPress={onRemove}
            >
              <ThemedText style={[styles.swapBtnText, { color: "#ef4444" }]}>
                Remove
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <ThemedText style={styles.courseName}>{course.course_name}</ThemedText>
      <ThemedText style={[styles.courseReason, { color: colors.icon }]}>
        {course.reason}
      </ThemedText>
    </View>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 16
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24
  },
  loadingText: {
    textAlign: "center",
    opacity: 0.7
  },
  checkmark: {
    fontSize: 72,
    color: "#22c55e"
  },
  successTitle: {
    textAlign: "center"
  },
  formTitle: {
    marginBottom: 4
  },
  label: {
    marginBottom: 4
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5
  },
  pillText: {
    fontWeight: "600",
    fontSize: 14
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    minHeight: 100,
    textAlignVertical: "top",
    fontSize: 14
  },
  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16
  },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1.5,
    marginTop: 8
  },
  secondaryBtnText: {
    fontWeight: "700",
    fontSize: 16
  },
  // Results
  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  resultsTitle: {
    flex: 1
  },
  creditsBadge: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  creditsBadgeText: {
    color: "#fff",
    fontWeight: "700"
  },
  semesterLabel: {
    fontSize: 15,
    marginTop: -4
  },
  warningBanner: {
    backgroundColor: "#fef3c7",
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b"
  },
  warningText: {
    color: "#92400e",
    fontSize: 13
  },
  errorBanner: {
    backgroundColor: "#fee2e2",
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#ef4444"
  },
  errorText: {
    color: "#991b1b",
    fontSize: 13
  },
  // Course card
  courseCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    gap: 4
  },
  courseCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  courseCardHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  courseName: {
    fontSize: 14
  },
  courseReason: {
    fontSize: 12,
    marginTop: 2
  },
  creditsPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  creditsPillText: {
    fontSize: 12,
    fontWeight: "600"
  },
  swapBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  swapBtnText: {
    fontSize: 12,
    fontWeight: "600"
  },
  // Excluded strip
  excludedStrip: {
    backgroundColor: "#fef3c7",
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b"
  },
  excludedStripText: {
    color: "#92400e",
    fontSize: 13
  },
  textAreaSmall: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    minHeight: 60,
    textAlignVertical: "top",
    fontSize: 13
  },
  // Swap modal
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)"
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 12,
    paddingBottom: 36
  },
  altItem: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 4
  },
  altItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  }
})
