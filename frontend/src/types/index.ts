export interface User {
  id: number
  email: string
  full_name: string
  role: string
  is_active: boolean
  created_at: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface Token {
  access_token: string
  token_type: string
}

export interface Detection {
  id: number
  zone_id?: number
  original_image_path: string
  result_image_path?: string
  detected_objects: DetectedObject[]
  persons: PersonPPEStatus[]
  violations: string[]
  person_count: number
  violation_count: number
  has_violation: boolean
  processing_time_ms?: number
  summary?: DetectionSummary
  created_at: string
}

export interface DetectedObject {
  class_id: number
  class_name: string
  class_name_thai?: string
  confidence: number
  bbox: number[]
  is_violation: boolean
  is_person: boolean
  is_ppe?: boolean
}

export interface PersonPPEStatus {
  id: number
  bbox: number[]
  confidence: number
  wearing: string[]
  not_wearing: string[]
  is_compliant: boolean
}

export interface DetectionSummary {
  message: string
  status: string
  total_persons: number
  compliant_persons: number
  non_compliant_persons: number
  violation_breakdown: Record<string, number>
}

export interface DetectionStats {
  total_detections: number
  total_persons: number
  total_violations: number
  compliance_rate: number
  violation_by_type: Record<string, number>
}

export interface Zone {
  id: number
  name: string
  description?: string
  required_ppe: string[]
  is_active: boolean
  created_at: string
}

export interface Alert {
  id: number
  detection_id: number
  alert_type: string
  message?: string
  status: string
  created_at: string
}

export interface UserSettings {
  id: number
  user_id: number
  alert_sound: boolean
  save_evidence: boolean
  confidence_threshold: number
  ppe_detection_sensitivity: number
  active_ppe_rules: Record<string, boolean>
  created_at: string
}