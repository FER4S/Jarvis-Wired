export interface UserProfile {
  fullName: string
  email: string
  company: string
  role: string
  projects: string
  keyPeople: string
  priorities: string
  notes: string
  updatedAt: string
}

const STORAGE_KEY = 'jarvis_user_profile'

export const EMPTY_USER_PROFILE: UserProfile = {
  fullName: '',
  email: '',
  company: '',
  role: '',
  projects: '',
  keyPeople: '',
  priorities: '',
  notes: '',
  updatedAt: ''
}

export function getUserProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...EMPTY_USER_PROFILE }
    const parsed = JSON.parse(raw) as Partial<UserProfile>
    return { ...EMPTY_USER_PROFILE, ...parsed }
  } catch {
    return { ...EMPTY_USER_PROFILE }
  }
}

export function saveUserProfile(profile: Omit<UserProfile, 'updatedAt'>): UserProfile {
  const saved: UserProfile = {
    ...EMPTY_USER_PROFILE,
    ...profile,
    updatedAt: new Date().toISOString()
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  return saved
}

export function clearUserProfile(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function formatProfileSummary(profile: UserProfile): string {
  const lines: string[] = []
  if (profile.fullName) lines.push(`Name: ${profile.fullName}`)
  if (profile.email) lines.push(`Email: ${profile.email}`)
  if (profile.company) lines.push(`Company: ${profile.company}`)
  if (profile.role) lines.push(`Role: ${profile.role}`)
  if (profile.projects.trim()) lines.push(`Projects: ${profile.projects.trim()}`)
  if (profile.keyPeople.trim()) lines.push(`Key people: ${profile.keyPeople.trim()}`)
  if (profile.priorities.trim()) lines.push(`Priorities: ${profile.priorities.trim()}`)
  if (profile.notes.trim()) lines.push(`Notes: ${profile.notes.trim()}`)
  return lines.join('\n')
}
