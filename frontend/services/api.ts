import Constants from 'expo-constants';

const API_PORT = 8000;

function getDebuggerHost(): string | null {
  const sources = [
    Constants.expoGoConfig?.debuggerHost,        // SDK 50+ (most reliable in SDK 54)
    Constants.expoConfig?.hostUri,               // SDK 50+ alternative
    Constants.manifest2?.extra?.expoGo?.debuggerHost, // SDK 46-49 EAS manifest
    Constants.manifest?.debuggerHost,            // SDK <46 legacy
  ];

  for (const host of sources) {
    if (host) {
      return host;
    }
  }
  return null;
}

export function getApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  if (__DEV__) {
    const debuggerHost = getDebuggerHost();
    if (debuggerHost) {
      const ip = debuggerHost.split(':')[0];
      const url = `http://${ip}:${API_PORT}`;
      console.log('[API] Auto-detected URL:', url);
      return url;
    }
    console.warn('[API] Could not detect IP, falling back to localhost');
  }

  return `http://localhost:${API_PORT}`;
}

export const API_BASE_URL = getApiUrl();

async function request<T>(path: string, options?: RequestInit, token?: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    ...options
  })

  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = await res.json()
      if (body.detail) detail = body.detail
    } catch {}
    throw new Error(detail)
  }

  return res.json() as Promise<T>
}

export interface User {
  id: string
  email: string
  full_name: string
  major_id: string | null
}

export interface Major {
  id: string
  name: string
  total_credits_required: number
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export function apiRegister(
  full_name: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ full_name, email, password })
  })
}

export function apiLogin(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  })
}

export function apiGetMajors(): Promise<Major[]> {
  return request<Major[]>("/majors")
}

export function apiSetMajor(major_id: string, token: string): Promise<User> {
  return request<User>("/users/me/major", { method: "POST", body: JSON.stringify({ major_id }) }, token)
}

// ── Advisor ───────────────────────────────────────────────────────────────────

export type SemesterType = 'Fall' | 'Spring' | 'Summer'

export interface SuggestedCourse {
  course_id: string
  course_code: string
  course_name: string
  credits: number
  requirement_category: string
  reason: string
  swappable: boolean
}

export interface GenerateResponse {
  suggested_courses: SuggestedCourse[]
  total_credits: number
  semester_label: string
  warning: string | null
}

export interface EnrollResponse {
  semester_id: string
  semester_label: string
  enrolled_count: number
}

export function apiGeneratePlan(
  semester: SemesterType,
  max_credits: number,
  description: string | null,
  token: string,
  exclude_course_ids: string[] = []
): Promise<GenerateResponse> {
  return request<GenerateResponse>(
    "/advisor/generate",
    { method: "POST", body: JSON.stringify({ semester, max_credits, description, exclude_course_ids }) },
    token
  )
}

export function apiEnrollPlan(
  semester_label: string,
  course_ids: string[],
  token: string
): Promise<EnrollResponse> {
  return request<EnrollResponse>(
    "/advisor/enroll",
    {
      method: "POST",
      body: JSON.stringify({
        semester_label,
        courses: course_ids.map((course_id) => ({ course_id })),
      }),
    },
    token
  )
}

export interface AlternativeCourse {
  course_id: string
  course_code: string
  course_name: string
  credits: number
  requirement_category: string
}

export interface AlternativesResponse {
  alternatives: AlternativeCourse[]
}

export function apiGetAlternatives(
  course_id: string,
  exclude_course_ids: string[],
  token: string
): Promise<AlternativesResponse> {
  return request<AlternativesResponse>(
    "/advisor/alternatives",
    { method: "POST", body: JSON.stringify({ course_id, exclude_course_ids }) },
    token
  )
}

// ── Semester History ──────────────────────────────────────────────────────────

export interface SemesterCourseDetail {
  course_id: string
  course_code: string
  course_name: string
  credits: number
  status: string
  grade: string | null
}

export interface SemesterDetail {
  id: string
  semester_label: string
  semester_gpa: number | null
  status: string
  total_credits: number
  courses: SemesterCourseDetail[]
}

export interface SemestersResponse {
  semesters: SemesterDetail[]
}

export interface UpdateSemesterStatusResponse {
  semester_id: string
  new_status: string
  updated_count: number
}

export function apiGetSemesters(token: string): Promise<SemestersResponse> {
  return request<SemestersResponse>('/advisor/semesters', {}, token)
}

export function apiUpdateSemesterStatus(
  semester_id: string,
  status: 'enrolled' | 'completed',
  token: string
): Promise<UpdateSemesterStatusResponse> {
  return request<UpdateSemesterStatusResponse>(
    `/advisor/semesters/${semester_id}/status`,
    { method: 'PATCH', body: JSON.stringify({ status }) },
    token
  )
}

export function apiCancelSemester(
  semester_id: string,
  token: string
): Promise<{ cancelled: boolean }> {
  return request<{ cancelled: boolean }>(
    `/advisor/semesters/${semester_id}`,
    { method: 'DELETE' },
    token
  )
}

// ── Complete Semester ─────────────────────────────────────────────────────────

export type GradeValue = 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D+' | 'D' | 'F'

export interface CourseGradeInput {
  course_id: string
  grade: GradeValue
}

export interface FailedCourseInfo {
  course_id: string
  course_code: string
  course_name: string
}

export interface CompleteSemesterResponse {
  semester_id: string
  semester_gpa: number
  new_cgpa: number
  failed_courses: FailedCourseInfo[]
  cancelled_semester_count: number
  warning_type: 'priority_warning' | 'plans_cancelled' | null
  warning_message: string | null
}

export function apiCompleteSemester(
  semester_id: string,
  course_grades: CourseGradeInput[],
  token: string
): Promise<CompleteSemesterResponse> {
  return request<CompleteSemesterResponse>(
    `/advisor/semesters/${semester_id}/complete`,
    { method: 'POST', body: JSON.stringify({ course_grades }) },
    token
  )
}
