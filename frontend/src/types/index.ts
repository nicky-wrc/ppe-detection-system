export type UserRole = 'admin' | 'safety_officer' | 'viewer'

export interface User {
  id: number
  email: string
  full_name: string
  role: UserRole
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
  result_video_path?: string
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
  polygon_points?: number[][]
  risk_level?: string
  rules_config?: Record<string, unknown>
  total_violations?: number
  is_active: boolean
  created_at: string
}

export interface Alert {
  id: number
  detection_id: number
  violation_log_id?: number
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

export interface EdgeCamera {
  id: number
  owner_id?: number
  name: string
  source_type: 'usb' | 'rtsp' | 'file'
  device_index?: number
  rtsp_url?: string
  location?: string
  zone_id?: number
  config: Record<string, unknown>
  is_active: boolean
  is_online: boolean
  last_seen?: string
  started_at?: string
  last_error?: string
  measured_fps: number
  frames_analyzed: number
  created_at: string
}

export interface CameraTestResult {
  ok: boolean
  width?: number
  height?: number
  fps?: number
  error?: string
}

export interface ViolationEvent {
  id: number
  user_id?: number
  camera_id?: number
  zone_id?: number
  detection_id?: number
  violation_type: string
  track_id?: number
  confidence_score: number
  person_count: number
  snapshot_path?: string
  evidence_clip_path?: string
  bbox_data?: number[]
  model_version?: string
  status: 'new' | 'acknowledged' | 'resolved'
  acknowledged_by?: number
  acknowledged_at?: string
  resolved_by?: number
  resolved_at?: string
  notes?: string
  first_seen?: string
  last_seen?: string
  created_at: string
}
