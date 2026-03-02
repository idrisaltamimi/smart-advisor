import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Collapsible } from '@/components/ui/collapsible';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  GenerateResponse,
  SemesterType,
  SuggestedCourse,
  apiEnrollPlan,
  apiGeneratePlan,
} from '@/services/api';

type Phase = 'form' | 'loading' | 'results' | 'success';

const SUMMER_CAP = 9;
const MAX_CREDITS = 19;

const ALL_CREDIT_OPTIONS = [3, 6, 9, 12, 15, 18, 19];
const SUMMER_CREDIT_OPTIONS = [3, 6, 9];

export default function AdvisorScreen() {
  const { token } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [phase, setPhase] = useState<Phase>('form');
  const [semester, setSemester] = useState<SemesterType>('Fall');
  const [maxCredits, setMaxCredits] = useState(15);
  const [description, setDescription] = useState('');
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const creditOptions =
    semester === 'Summer' ? SUMMER_CREDIT_OPTIONS : ALL_CREDIT_OPTIONS;

  function handleSemesterChange(s: SemesterType) {
    setSemester(s);
    if (s === 'Summer' && maxCredits > SUMMER_CAP) {
      setMaxCredits(SUMMER_CAP);
    }
  }

  async function handleGenerate() {
    if (!token) return;
    setError(null);
    setPhase('loading');
    try {
      const res = await apiGeneratePlan(
        semester,
        maxCredits,
        description.trim() || null,
        token
      );
      setResult(res);
      setPhase('results');
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
      setPhase('form');
    }
  }

  async function handleEnroll() {
    if (!token || !result) return;
    setEnrolling(true);
    setError(null);
    try {
      await apiEnrollPlan(
        result.semester_label,
        result.suggested_courses.map((c) => c.course_id),
        token
      );
      setPhase('success');
    } catch (e: any) {
      setError(e.message ?? 'Enrollment failed');
    } finally {
      setEnrolling(false);
    }
  }

  function handleReset() {
    setResult(null);
    setError(null);
    setPhase('form');
  }

  // ── Phases ─────────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.tint} />
        <ThemedText style={styles.loadingText}>
          Generating your personalized plan...
        </ThemedText>
      </ThemedView>
    );
  }

  if (phase === 'success' && result) {
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
          onPress={handleReset}>
          <ThemedText style={styles.primaryBtnText}>Plan Another Semester</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  if (phase === 'results' && result) {
    // Group courses by category
    const grouped: Record<string, SuggestedCourse[]> = {};
    for (const c of result.suggested_courses) {
      if (!grouped[c.requirement_category]) grouped[c.requirement_category] = [];
      grouped[c.requirement_category].push(c);
    }

    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.resultsHeader}>
          <ThemedText type="title" style={styles.resultsTitle}>
            Your Plan
          </ThemedText>
          <View style={[styles.creditsBadge, { backgroundColor: colors.tint }]}>
            <ThemedText style={styles.creditsBadgeText}>
              {result.total_credits} cr
            </ThemedText>
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
              <CourseCard key={course.course_id} course={course} colors={colors} />
            ))}
          </Collapsible>
        ))}

        {/* Actions */}
        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: colors.tint }]}
          onPress={() => setPhase('form')}>
          <ThemedText style={[styles.secondaryBtnText, { color: colors.tint }]}>
            Adjust &amp; Regenerate
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.primaryBtn,
            { backgroundColor: colors.tint, opacity: enrolling ? 0.6 : 1 },
          ]}
          onPress={handleEnroll}
          disabled={enrolling}>
          {enrolling ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.primaryBtnText}>Enroll in Plan</ThemedText>
          )}
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.scrollContent}>
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
        {(['Fall', 'Spring', 'Summer'] as SemesterType[]).map((s) => (
          <TouchableOpacity
            key={s}
            style={[
              styles.pill,
              {
                backgroundColor:
                  semester === s ? colors.tint : 'transparent',
                borderColor: colors.tint,
              },
            ]}
            onPress={() => handleSemesterChange(s)}>
            <ThemedText
              style={[
                styles.pillText,
                { color: semester === s ? '#fff' : colors.tint },
              ]}>
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
                backgroundColor:
                  maxCredits === n ? colors.tint : 'transparent',
                borderColor: colors.tint,
              },
            ]}
            onPress={() => setMaxCredits(n)}>
            <ThemedText
              style={[
                styles.pillText,
                { color: maxCredits === n ? '#fff' : colors.tint },
              ]}>
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
            backgroundColor: colorScheme === 'dark' ? '#1e1e1e' : '#f5f5f5',
          },
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
        onPress={handleGenerate}>
        <ThemedText style={styles.primaryBtnText}>Generate Plan</ThemedText>
      </TouchableOpacity>
    </ScrollView>
  );
}

function CourseCard({
  course,
  colors,
}: {
  course: SuggestedCourse;
  colors: (typeof Colors)[keyof typeof Colors];
}) {
  return (
    <View style={[styles.courseCard, { borderColor: colors.icon + '33' }]}>
      <View style={styles.courseCardHeader}>
        <ThemedText type="defaultSemiBold">{course.course_code}</ThemedText>
        <View style={[styles.creditsPill, { backgroundColor: colors.tint + '22' }]}>
          <ThemedText style={[styles.creditsPillText, { color: colors.tint }]}>
            {course.credits} cr
          </ThemedText>
        </View>
      </View>
      <ThemedText style={styles.courseName}>{course.course_name}</ThemedText>
      <ThemedText style={[styles.courseReason, { color: colors.icon }]}>
        {course.reason}
      </ThemedText>
    </View>
  );
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
    gap: 16,
    padding: 24,
  },
  loadingText: {
    textAlign: 'center',
    opacity: 0.7,
  },
  checkmark: {
    fontSize: 72,
    color: '#22c55e',
  },
  successTitle: {
    textAlign: 'center',
  },
  formTitle: {
    marginBottom: 4,
  },
  label: {
    marginBottom: 4,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  pillText: {
    fontWeight: '600',
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    marginTop: 8,
  },
  secondaryBtnText: {
    fontWeight: '700',
    fontSize: 16,
  },
  // Results
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultsTitle: {
    flex: 1,
  },
  creditsBadge: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  creditsBadgeText: {
    color: '#fff',
    fontWeight: '700',
  },
  semesterLabel: {
    fontSize: 15,
    marginTop: -4,
  },
  warningBanner: {
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  warningText: {
    color: '#92400e',
    fontSize: 13,
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
  // Course card
  courseCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    gap: 4,
  },
  courseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  courseName: {
    fontSize: 14,
  },
  courseReason: {
    fontSize: 12,
    marginTop: 2,
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
});
