export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      academic_record_versions: {
        Row: {
          anchor_status: string
          commitment_environment: string | null
          content_commitment: string
          correction_reason_code: string | null
          created_at: string
          created_by: string
          id: string
          institution_commitment: string | null
          institution_commitment_algorithm: string | null
          institution_commitment_key_version: number | null
          institution_id: string
          is_current: boolean
          previous_version_id: string | null
          published_at: string | null
          salt_reference: string
          source_grade_record_id: string | null
          status: string
          student_commitment: string | null
          student_commitment_algorithm: string | null
          student_commitment_key_version: number | null
          student_id: string
          superseded_at: string | null
          version_number: number
        }
        Insert: {
          anchor_status?: string
          commitment_environment?: string | null
          content_commitment: string
          correction_reason_code?: string | null
          created_at?: string
          created_by: string
          id?: string
          institution_commitment?: string | null
          institution_commitment_algorithm?: string | null
          institution_commitment_key_version?: number | null
          institution_id: string
          is_current?: boolean
          previous_version_id?: string | null
          published_at?: string | null
          salt_reference: string
          source_grade_record_id?: string | null
          status?: string
          student_commitment?: string | null
          student_commitment_algorithm?: string | null
          student_commitment_key_version?: number | null
          student_id: string
          superseded_at?: string | null
          version_number: number
        }
        Update: {
          anchor_status?: string
          commitment_environment?: string | null
          content_commitment?: string
          correction_reason_code?: string | null
          created_at?: string
          created_by?: string
          id?: string
          institution_commitment?: string | null
          institution_commitment_algorithm?: string | null
          institution_commitment_key_version?: number | null
          institution_id?: string
          is_current?: boolean
          previous_version_id?: string | null
          published_at?: string | null
          salt_reference?: string
          source_grade_record_id?: string | null
          status?: string
          student_commitment?: string | null
          student_commitment_algorithm?: string | null
          student_commitment_key_version?: number | null
          student_id?: string
          superseded_at?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "academic_record_versions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_record_versions_previous_version_id_fkey"
            columns: ["previous_version_id"]
            isOneToOne: false
            referencedRelation: "academic_record_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_record_versions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_dashboard_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "academic_record_versions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_terms: {
        Row: {
          add_drop_deadline: string | null
          code: string
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          ends_on: string
          grades_due_at: string | null
          id: string
          institution_id: string
          max_credits: number
          min_credits: number
          name: string
          registration_closes_at: string | null
          registration_opens_at: string | null
          starts_on: string
          status: string
          updated_at: string
          updated_by: string | null
          withdrawal_deadline: string | null
        }
        Insert: {
          add_drop_deadline?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          ends_on: string
          grades_due_at?: string | null
          id?: string
          institution_id: string
          max_credits?: number
          min_credits?: number
          name: string
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          starts_on: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          withdrawal_deadline?: string | null
        }
        Update: {
          add_drop_deadline?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          ends_on?: string
          grades_due_at?: string | null
          id?: string
          institution_id?: string
          max_credits?: number
          min_credits?: number
          name?: string
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          starts_on?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          withdrawal_deadline?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academic_terms_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      advisor_assignments: {
        Row: {
          advisor_role_assignment_id: string
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          ends_at: string | null
          id: string
          institution_id: string
          starts_at: string
          status: string
          student_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          advisor_role_assignment_id: string
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          ends_at?: string | null
          id?: string
          institution_id: string
          starts_at?: string
          status?: string
          student_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          advisor_role_assignment_id?: string
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          ends_at?: string | null
          id?: string
          institution_id?: string
          starts_at?: string
          status?: string
          student_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advisor_assignments_advisor_role_assignment_id_fkey"
            columns: ["advisor_role_assignment_id"]
            isOneToOne: false
            referencedRelation: "staff_role_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisor_assignments_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisor_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_dashboard_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "advisor_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      advisor_notes: {
        Row: {
          advisor_role_assignment_id: string
          created_at: string
          deactivated_at: string | null
          encryption_reference: string
          id: string
          institution_id: string
          note_ciphertext: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          advisor_role_assignment_id: string
          created_at?: string
          deactivated_at?: string | null
          encryption_reference: string
          id?: string
          institution_id: string
          note_ciphertext: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          advisor_role_assignment_id?: string
          created_at?: string
          deactivated_at?: string | null
          encryption_reference?: string
          id?: string
          institution_id?: string
          note_ciphertext?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "advisor_notes_advisor_role_assignment_id_fkey"
            columns: ["advisor_role_assignment_id"]
            isOneToOne: false
            referencedRelation: "staff_role_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisor_notes_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisor_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_dashboard_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "advisor_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_inference_runs: {
        Row: {
          completed_at: string | null
          correlation_id: string
          created_at: string
          error_category: string | null
          human_review_status: string
          id: string
          institution_id: string
          model: string
          provider: string
          request_commitment: string
          response_commitment: string | null
          schema_validation_status: string
          student_id: string
          verification_mode: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_category?: string | null
          human_review_status?: string
          id?: string
          institution_id: string
          model: string
          provider: string
          request_commitment: string
          response_commitment?: string | null
          schema_validation_status: string
          student_id: string
          verification_mode: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_category?: string | null
          human_review_status?: string
          id?: string
          institution_id?: string
          model?: string
          provider?: string
          request_commitment?: string
          response_commitment?: string | null
          schema_validation_status?: string
          student_id?: string
          verification_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_inference_runs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_inference_runs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_dashboard_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "ai_inference_runs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          correlation_id: string
          entity_id: string | null
          entity_type: string
          id: string
          institution_id: string | null
          metadata: Json
          occurred_at: string
          outcome: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          correlation_id?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          institution_id?: string | null
          metadata?: Json
          occurred_at?: string
          outcome: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          correlation_id?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          institution_id?: string | null
          metadata?: Json
          occurred_at?: string
          outcome?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      blockchain_anchors: {
        Row: {
          academic_record_version_id: string | null
          chain_id: number
          commitment: string
          confirmed_at: string | null
          contract_address: string | null
          created_at: string
          error_category: string | null
          id: string
          institution_id: string
          record_type: string
          retry_count: number
          status: string
          transaction_hash: string | null
          updated_at: string
        }
        Insert: {
          academic_record_version_id?: string | null
          chain_id: number
          commitment: string
          confirmed_at?: string | null
          contract_address?: string | null
          created_at?: string
          error_category?: string | null
          id?: string
          institution_id: string
          record_type: string
          retry_count?: number
          status?: string
          transaction_hash?: string | null
          updated_at?: string
        }
        Update: {
          academic_record_version_id?: string | null
          chain_id?: number
          commitment?: string
          confirmed_at?: string | null
          contract_address?: string | null
          created_at?: string
          error_category?: string | null
          id?: string
          institution_id?: string
          record_type?: string
          retry_count?: number
          status?: string
          transaction_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blockchain_anchors_academic_record_version_id_fkey"
            columns: ["academic_record_version_id"]
            isOneToOne: false
            referencedRelation: "academic_record_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blockchain_anchors_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      course_prerequisites: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          id: string
          institution_id: string
          kind: string
          minimum_grade_points: number
          prerequisite_course_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          id?: string
          institution_id: string
          kind?: string
          minimum_grade_points?: number
          prerequisite_course_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          id?: string
          institution_id?: string
          kind?: string
          minimum_grade_points?: number
          prerequisite_course_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_prerequisites_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_prerequisites_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_prerequisites_prerequisite_course_id_fkey"
            columns: ["prerequisite_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_sections: {
        Row: {
          capacity: number
          course_id: string
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          delivery_mode: string
          enrolled_count: number
          id: string
          institution_id: string
          location: string | null
          restriction_rules: Json
          section_code: string
          status: string
          term_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          capacity: number
          course_id: string
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          delivery_mode?: string
          enrolled_count?: number
          id?: string
          institution_id: string
          location?: string | null
          restriction_rules?: Json
          section_code: string
          status?: string
          term_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          capacity?: number
          course_id?: string
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          delivery_mode?: string
          enrolled_count?: number
          id?: string
          institution_id?: string
          location?: string | null
          restriction_rules?: Json
          section_code?: string
          status?: string
          term_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_sections_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_sections_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_sections_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "academic_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          credit_hours: number
          deactivated_at: string | null
          department_id: string
          description: string | null
          id: string
          institution_id: string
          repeat_policy: string
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          credit_hours: number
          deactivated_at?: string | null
          department_id: string
          description?: string | null
          id?: string
          institution_id: string
          repeat_policy?: string
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          credit_hours?: number
          deactivated_at?: string | null
          department_id?: string
          description?: string | null
          id?: string
          institution_id?: string
          repeat_policy?: string
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      degree_audit_snapshots: {
        Row: {
          academic_record_version_id: string
          calculated_at: string
          created_at: string
          created_by: string | null
          credits_earned: number
          credits_required: number
          gpa: number | null
          id: string
          institution_id: string
          progress_percent: number
          requirement_results: Json
          student_id: string
          student_program_id: string
        }
        Insert: {
          academic_record_version_id: string
          calculated_at?: string
          created_at?: string
          created_by?: string | null
          credits_earned: number
          credits_required: number
          gpa?: number | null
          id?: string
          institution_id: string
          progress_percent: number
          requirement_results?: Json
          student_id: string
          student_program_id: string
        }
        Update: {
          academic_record_version_id?: string
          calculated_at?: string
          created_at?: string
          created_by?: string | null
          credits_earned?: number
          credits_required?: number
          gpa?: number | null
          id?: string
          institution_id?: string
          progress_percent?: number
          requirement_results?: Json
          student_id?: string
          student_program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "degree_audit_snapshots_academic_record_version_id_fkey"
            columns: ["academic_record_version_id"]
            isOneToOne: false
            referencedRelation: "academic_record_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "degree_audit_snapshots_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "degree_audit_snapshots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_dashboard_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "degree_audit_snapshots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "degree_audit_snapshots_student_program_id_fkey"
            columns: ["student_program_id"]
            isOneToOne: false
            referencedRelation: "student_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          id: string
          institution_id: string
          name: string
          parent_department_id: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          id?: string
          institution_id: string
          name: string
          parent_department_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          id?: string
          institution_id?: string
          name?: string
          parent_department_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_parent_department_id_fkey"
            columns: ["parent_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          created_at: string
          created_by: string | null
          credit_hours: number
          enrolled_at: string | null
          id: string
          idempotency_key: string
          institution_id: string
          section_id: string
          status: string
          student_id: string
          updated_at: string
          updated_by: string | null
          withdrawn_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credit_hours: number
          enrolled_at?: string | null
          id?: string
          idempotency_key: string
          institution_id: string
          section_id: string
          status?: string
          student_id: string
          updated_at?: string
          updated_by?: string | null
          withdrawn_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credit_hours?: number
          enrolled_at?: string | null
          id?: string
          idempotency_key?: string
          institution_id?: string
          section_id?: string
          status?: string
          student_id?: string
          updated_at?: string
          updated_by?: string | null
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "course_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "student_current_courses"
            referencedColumns: ["section_id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_dashboard_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      ens_identities: {
        Row: {
          created_at: string
          id: string
          institution_id: string
          name_hash: string
          network: string
          public_name: string | null
          resolved_at: string | null
          status: string
          student_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution_id: string
          name_hash: string
          network?: string
          public_name?: string | null
          resolved_at?: string | null
          status?: string
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          institution_id?: string
          name_hash?: string
          network?: string
          public_name?: string | null
          resolved_at?: string | null
          status?: string
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ens_identities_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ens_identities_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_dashboard_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "ens_identities_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_records: {
        Row: {
          correction_reason_code: string | null
          created_at: string
          created_by: string
          credit_hours_earned: number
          enrollment_id: string
          grade_code: string
          grade_points: number | null
          grade_submission_id: string
          id: string
          institution_id: string
          is_current: boolean
          previous_grade_record_id: string | null
          published_at: string
          superseded_at: string | null
          version_number: number
        }
        Insert: {
          correction_reason_code?: string | null
          created_at?: string
          created_by: string
          credit_hours_earned?: number
          enrollment_id: string
          grade_code: string
          grade_points?: number | null
          grade_submission_id: string
          id?: string
          institution_id: string
          is_current?: boolean
          previous_grade_record_id?: string | null
          published_at: string
          superseded_at?: string | null
          version_number: number
        }
        Update: {
          correction_reason_code?: string | null
          created_at?: string
          created_by?: string
          credit_hours_earned?: number
          enrollment_id?: string
          grade_code?: string
          grade_points?: number | null
          grade_submission_id?: string
          id?: string
          institution_id?: string
          is_current?: boolean
          previous_grade_record_id?: string | null
          published_at?: string
          superseded_at?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "grade_records_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_records_grade_submission_id_fkey"
            columns: ["grade_submission_id"]
            isOneToOne: false
            referencedRelation: "grade_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_records_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_records_previous_grade_record_id_fkey"
            columns: ["previous_grade_record_id"]
            isOneToOne: false
            referencedRelation: "grade_records"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_submissions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assignment_average: number | null
          correction_reason_code: string | null
          created_at: string
          created_by: string | null
          draft_revision: number
          enrollment_id: string
          final_exam_score: number | null
          grade_code: string | null
          grade_points: number | null
          id: string
          idempotency_key: string
          institution_id: string
          participation_score: number | null
          previous_grade_submission_id: string | null
          published_at: string | null
          published_by: string | null
          state: string
          submitted_at: string | null
          submitted_by: string
          total_score: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assignment_average?: number | null
          correction_reason_code?: string | null
          created_at?: string
          created_by?: string | null
          draft_revision?: number
          enrollment_id: string
          final_exam_score?: number | null
          grade_code?: string | null
          grade_points?: number | null
          id?: string
          idempotency_key?: string
          institution_id: string
          participation_score?: number | null
          previous_grade_submission_id?: string | null
          published_at?: string | null
          published_by?: string | null
          state?: string
          submitted_at?: string | null
          submitted_by: string
          total_score?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assignment_average?: number | null
          correction_reason_code?: string | null
          created_at?: string
          created_by?: string | null
          draft_revision?: number
          enrollment_id?: string
          final_exam_score?: number | null
          grade_code?: string | null
          grade_points?: number | null
          id?: string
          idempotency_key?: string
          institution_id?: string
          participation_score?: number | null
          previous_grade_submission_id?: string | null
          published_at?: string | null
          published_by?: string | null
          state?: string
          submitted_at?: string | null
          submitted_by?: string
          total_score?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grade_submissions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_submissions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          institution_id: string
          key_hash: string
          operation: string
          request_commitment: string
          result: Json | null
          result_reference: string | null
          status: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          institution_id: string
          key_hash: string
          operation: string
          request_commitment: string
          result?: Json | null
          result_reference?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          institution_id?: string
          key_hash?: string
          operation?: string
          request_commitment?: string
          result?: Json | null
          result_reference?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "idempotency_keys_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_memberships: {
        Row: {
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          id: string
          institution_id: string
          role: string
          status: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          id?: string
          institution_id: string
          role: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          id?: string
          institution_id?: string
          role?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "institution_memberships_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          id: string
          name: string
          public_commitment: string | null
          slug: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          id?: string
          name: string
          public_commitment?: string | null
          slug: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          id?: string
          name?: string
          public_commitment?: string | null
          slug?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      integration_capabilities: {
        Row: {
          created_at: string
          detail: string
          id: string
          institution_id: string
          last_checked_at: string | null
          provider: string
          state: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          detail: string
          id?: string
          institution_id: string
          last_checked_at?: string | null
          provider: string
          state: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          detail?: string
          id?: string
          institution_id?: string
          last_checked_at?: string | null
          provider?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_capabilities_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      outbox_events: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          attempts: number
          available_at: string
          claim_owner: string | null
          claim_phase: string | null
          completed_at: string | null
          correlation_id: string
          created_at: string
          dead_lettered_at: string | null
          event_type: string
          first_attempt_at: string | null
          id: string
          idempotency_key: string
          institution_id: string
          last_attempt_at: string | null
          last_error_category: string | null
          last_error_code: string | null
          lease_expires_at: string | null
          locked_at: string | null
          manual_retry_count: number
          manual_retry_eligible: boolean
          max_attempts: number
          payload: Json
          retry_generation: number
          schema_version: number
          status: string
          trace_id: string
          updated_at: string
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          attempts?: number
          available_at?: string
          claim_owner?: string | null
          claim_phase?: string | null
          completed_at?: string | null
          correlation_id?: string
          created_at?: string
          dead_lettered_at?: string | null
          event_type: string
          first_attempt_at?: string | null
          id?: string
          idempotency_key: string
          institution_id: string
          last_attempt_at?: string | null
          last_error_category?: string | null
          last_error_code?: string | null
          lease_expires_at?: string | null
          locked_at?: string | null
          manual_retry_count?: number
          manual_retry_eligible?: boolean
          max_attempts?: number
          payload: Json
          retry_generation?: number
          schema_version?: number
          status?: string
          trace_id?: string
          updated_at?: string
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          attempts?: number
          available_at?: string
          claim_owner?: string | null
          claim_phase?: string | null
          completed_at?: string | null
          correlation_id?: string
          created_at?: string
          dead_lettered_at?: string | null
          event_type?: string
          first_attempt_at?: string | null
          id?: string
          idempotency_key?: string
          institution_id?: string
          last_attempt_at?: string | null
          last_error_category?: string | null
          last_error_code?: string | null
          lease_expires_at?: string | null
          locked_at?: string | null
          manual_retry_count?: number
          manual_retry_eligible?: boolean
          max_attempts?: number
          payload?: Json
          retry_generation?: number
          schema_version?: number
          status?: string
          trace_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbox_events_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          deactivated_at: string | null
          display_name: string
          id: string
          initials: string
          locale: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deactivated_at?: string | null
          display_name: string
          id: string
          initials: string
          locale?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deactivated_at?: string | null
          display_name?: string
          id?: string
          initials?: string
          locale?: string
          updated_at?: string
        }
        Relationships: []
      }
      program_requirements: {
        Row: {
          course_id: string | null
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          id: string
          institution_id: string
          minimum_credits: number
          program_version_id: string
          requirement_group: string
          rule_config: Json
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          id?: string
          institution_id: string
          minimum_credits?: number
          program_version_id: string
          requirement_group: string
          rule_config?: Json
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          id?: string
          institution_id?: string
          minimum_credits?: number
          program_version_id?: string
          requirement_group?: string
          rule_config?: Json
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_requirements_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_requirements_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_requirements_program_version_id_fkey"
            columns: ["program_version_id"]
            isOneToOne: false
            referencedRelation: "program_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      program_versions: {
        Row: {
          created_at: string
          created_by: string | null
          effective_term_id: string
          id: string
          institution_id: string
          program_id: string
          published_at: string | null
          required_credits: number
          status: string
          updated_at: string
          updated_by: string | null
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_term_id: string
          id?: string
          institution_id: string
          program_id: string
          published_at?: string | null
          required_credits: number
          status?: string
          updated_at?: string
          updated_by?: string | null
          version_number: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_term_id?: string
          id?: string
          institution_id?: string
          program_id?: string
          published_at?: string | null
          required_credits?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_versions_effective_term_id_fkey"
            columns: ["effective_term_id"]
            isOneToOne: false
            referencedRelation: "academic_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_versions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_versions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          credential_type: string
          deactivated_at: string | null
          department_id: string
          id: string
          institution_id: string
          name: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          credential_type: string
          deactivated_at?: string | null
          department_id: string
          id?: string
          institution_id: string
          name: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          credential_type?: string
          deactivated_at?: string | null
          department_id?: string
          id?: string
          institution_id?: string
          name?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      record_documents: {
        Row: {
          academic_record_version_id: string
          ciphertext_sha256: string
          created_at: string
          created_by: string | null
          encryption_mode: string
          id: string
          institution_id: string
          object_reference: string
          object_type: string
          status: string
          storage_provider: string
          updated_at: string
          wrapping_key_reference: string
        }
        Insert: {
          academic_record_version_id: string
          ciphertext_sha256: string
          created_at?: string
          created_by?: string | null
          encryption_mode: string
          id?: string
          institution_id: string
          object_reference: string
          object_type: string
          status?: string
          storage_provider: string
          updated_at?: string
          wrapping_key_reference: string
        }
        Update: {
          academic_record_version_id?: string
          ciphertext_sha256?: string
          created_at?: string
          created_by?: string | null
          encryption_mode?: string
          id?: string
          institution_id?: string
          object_reference?: string
          object_type?: string
          status?: string
          storage_provider?: string
          updated_at?: string
          wrapping_key_reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_documents_academic_record_version_id_fkey"
            columns: ["academic_record_version_id"]
            isOneToOne: false
            referencedRelation: "academic_record_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_documents_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      record_share_access_logs: {
        Row: {
          access_result: string
          id: string
          institution_id: string
          occurred_at: string
          request_fingerprint_hash: string | null
          requested_scopes: string[]
          share_grant_id: string
        }
        Insert: {
          access_result: string
          id?: string
          institution_id: string
          occurred_at?: string
          request_fingerprint_hash?: string | null
          requested_scopes?: string[]
          share_grant_id: string
        }
        Update: {
          access_result?: string
          id?: string
          institution_id?: string
          occurred_at?: string
          request_fingerprint_hash?: string | null
          requested_scopes?: string[]
          share_grant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_share_access_logs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_share_access_logs_share_grant_id_fkey"
            columns: ["share_grant_id"]
            isOneToOne: false
            referencedRelation: "record_share_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      record_share_grants: {
        Row: {
          academic_record_version_id: string
          commitment_environment: string | null
          created_at: string
          created_by: string
          expires_at: string
          grant_commitment: string
          id: string
          institution_commitment: string | null
          institution_commitment_algorithm: string | null
          institution_commitment_key_version: number | null
          institution_id: string
          recipient_label: string
          revoked_at: string | null
          scopes: string[]
          status: string
          student_commitment: string | null
          student_commitment_algorithm: string | null
          student_commitment_key_version: number | null
          student_id: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          academic_record_version_id: string
          commitment_environment?: string | null
          created_at?: string
          created_by: string
          expires_at: string
          grant_commitment: string
          id?: string
          institution_commitment?: string | null
          institution_commitment_algorithm?: string | null
          institution_commitment_key_version?: number | null
          institution_id: string
          recipient_label: string
          revoked_at?: string | null
          scopes: string[]
          status?: string
          student_commitment?: string | null
          student_commitment_algorithm?: string | null
          student_commitment_key_version?: number | null
          student_id: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          academic_record_version_id?: string
          commitment_environment?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          grant_commitment?: string
          id?: string
          institution_commitment?: string | null
          institution_commitment_algorithm?: string | null
          institution_commitment_key_version?: number | null
          institution_id?: string
          recipient_label?: string
          revoked_at?: string | null
          scopes?: string[]
          status?: string
          student_commitment?: string | null
          student_commitment_algorithm?: string | null
          student_commitment_key_version?: number | null
          student_id?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_share_grants_academic_record_version_id_fkey"
            columns: ["academic_record_version_id"]
            isOneToOne: false
            referencedRelation: "academic_record_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_share_grants_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_share_grants_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_dashboard_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "record_share_grants_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_requests: {
        Row: {
          created_at: string
          created_by: string
          id: string
          idempotency_key: string
          institution_id: string
          requested_section_ids: string[]
          result: Json
          status: string
          student_id: string
          term_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          idempotency_key: string
          institution_id: string
          requested_section_ids: string[]
          result: Json
          status: string
          student_id: string
          term_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          idempotency_key?: string
          institution_id?: string
          requested_section_ids?: string[]
          result?: Json
          status?: string
          student_id?: string
          term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_requests_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_dashboard_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "registration_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_requests_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "academic_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      section_instructors: {
        Row: {
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          id: string
          institution_id: string
          is_primary: boolean
          section_id: string
          staff_role_assignment_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          id?: string
          institution_id: string
          is_primary?: boolean
          section_id: string
          staff_role_assignment_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          id?: string
          institution_id?: string
          is_primary?: boolean
          section_id?: string
          staff_role_assignment_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "section_instructors_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_instructors_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "course_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_instructors_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "student_current_courses"
            referencedColumns: ["section_id"]
          },
          {
            foreignKeyName: "section_instructors_staff_role_assignment_id_fkey"
            columns: ["staff_role_assignment_id"]
            isOneToOne: false
            referencedRelation: "staff_role_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      section_meetings: {
        Row: {
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          ends_at: string
          ends_on: string | null
          id: string
          institution_id: string
          location: string | null
          section_id: string
          starts_at: string
          starts_on: string | null
          updated_at: string
          updated_by: string | null
          weekday: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          ends_at: string
          ends_on?: string | null
          id?: string
          institution_id: string
          location?: string | null
          section_id: string
          starts_at: string
          starts_on?: string | null
          updated_at?: string
          updated_by?: string | null
          weekday: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          ends_at?: string
          ends_on?: string | null
          id?: string
          institution_id?: string
          location?: string | null
          section_id?: string
          starts_at?: string
          starts_on?: string | null
          updated_at?: string
          updated_by?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "section_meetings_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_meetings_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "course_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_meetings_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "student_current_courses"
            referencedColumns: ["section_id"]
          },
        ]
      }
      staff_role_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          id: string
          institution_id: string
          role: string
          status: string
          updated_at: string
          updated_by: string | null
          user_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          id?: string
          institution_id: string
          role: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          id?: string
          institution_id?: string
          role?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_role_assignments_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      student_holds: {
        Row: {
          created_at: string
          created_by: string | null
          hold_type: string
          id: string
          institution_id: string
          is_blocking: boolean
          placed_at: string
          reason_code: string
          released_at: string | null
          status: string
          student_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          hold_type: string
          id?: string
          institution_id: string
          is_blocking?: boolean
          placed_at?: string
          reason_code: string
          released_at?: string | null
          status?: string
          student_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          hold_type?: string
          id?: string
          institution_id?: string
          is_blocking?: boolean
          placed_at?: string
          reason_code?: string
          released_at?: string | null
          status?: string
          student_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_holds_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_holds_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_dashboard_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_holds_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_programs: {
        Row: {
          assigned_at: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          institution_id: string
          program_version_id: string
          status: string
          student_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_at?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          institution_id: string
          program_version_id: string
          status?: string
          student_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_at?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          institution_id?: string
          program_version_id?: string
          status?: string
          student_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_programs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_programs_program_version_id_fkey"
            columns: ["program_version_id"]
            isOneToOne: false
            referencedRelation: "program_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_programs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_dashboard_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_programs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_verifications: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          institution_id: string
          provider: string
          provider_subject_hash: string
          status: string
          student_id: string
          updated_at: string
          verification_type: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          institution_id: string
          provider: string
          provider_subject_hash: string
          status: string
          student_id: string
          updated_at?: string
          verification_type: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          institution_id?: string
          provider?: string
          provider_subject_hash?: string
          status?: string
          student_id?: string
          updated_at?: string
          verification_type?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_verifications_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_verifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_dashboard_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_verifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_wallets: {
        Row: {
          address: string
          chain_id: number
          created_at: string
          id: string
          institution_id: string
          nonce_hash: string | null
          revoked_at: string | null
          status: string
          student_id: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          address: string
          chain_id: number
          created_at?: string
          id?: string
          institution_id: string
          nonce_hash?: string | null
          revoked_at?: string | null
          status?: string
          student_id: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          address?: string
          chain_id?: number
          created_at?: string
          id?: string
          institution_id?: string
          nonce_hash?: string | null
          revoked_at?: string | null
          status?: string
          student_id?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_wallets_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_wallets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_dashboard_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_wallets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          academic_status: string
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          expected_completion_date: string | null
          id: string
          institution_id: string
          pseudonymous_id: string
          student_number: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          academic_status?: string
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          expected_completion_date?: string | null
          id?: string
          institution_id: string
          pseudonymous_id: string
          student_number: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          academic_status?: string
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          expected_completion_date?: string | null
          id?: string
          institution_id?: string
          pseudonymous_id?: string
          student_number?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      world_verifications: {
        Row: {
          action_id: string
          created_at: string
          credential_type: string
          id: string
          institution_id: string
          nullifier_hash: string
          signal_hash: string
          status: string
          student_id: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          action_id: string
          created_at?: string
          credential_type: string
          id?: string
          institution_id: string
          nullifier_hash: string
          signal_hash: string
          status: string
          student_id: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          action_id?: string
          created_at?: string
          credential_type?: string
          id?: string
          institution_id?: string
          nullifier_hash?: string
          signal_hash?: string
          status?: string
          student_id?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "world_verifications_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_verifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_dashboard_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "world_verifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      zero_g_objects: {
        Row: {
          created_at: string
          encryption_mode: string
          id: string
          institution_id: string
          object_type: string
          owner_student_id: string | null
          root_hash: string
          status: string
          updated_at: string
          wrapping_key_reference: string
        }
        Insert: {
          created_at?: string
          encryption_mode: string
          id?: string
          institution_id: string
          object_type: string
          owner_student_id?: string | null
          root_hash: string
          status?: string
          updated_at?: string
          wrapping_key_reference: string
        }
        Update: {
          created_at?: string
          encryption_mode?: string
          id?: string
          institution_id?: string
          object_type?: string
          owner_student_id?: string | null
          root_hash?: string
          status?: string
          updated_at?: string
          wrapping_key_reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "zero_g_objects_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zero_g_objects_owner_student_id_fkey"
            columns: ["owner_student_id"]
            isOneToOne: false
            referencedRelation: "student_dashboard_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "zero_g_objects_owner_student_id_fkey"
            columns: ["owner_student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      instructor_assigned_sections: {
        Row: {
          capacity: number | null
          course_code: string | null
          course_title: string | null
          institution_id: string | null
          institution_name: string | null
          last_saved_at: string | null
          lifecycle_state: string | null
          location: string | null
          roster_count: number | null
          schedule: string | null
          section_code: string | null
          section_id: string | null
          section_status: string | null
          term_id: string | null
          term_name: string | null
        }
        Relationships: []
      }
      instructor_section_gradebook: {
        Row: {
          assignment_average: number | null
          correction_reason_code: string | null
          course_code: string | null
          course_title: string | null
          current_grade_record_id: string | null
          current_grade_record_version: number | null
          draft_revision: number | null
          enrollment_id: string | null
          final_exam_score: number | null
          grade_code: string | null
          grade_points: number | null
          grade_submission_id: string | null
          institution_id: string | null
          institution_name: string | null
          last_saved_at: string | null
          lifecycle_state: string | null
          location: string | null
          participation_score: number | null
          previous_grade_submission_id: string | null
          row_status: string | null
          schedule: string | null
          section_code: string | null
          section_id: string | null
          student_display_name: string | null
          student_id: string | null
          student_initials: string | null
          term_id: string | null
          term_name: string | null
          total_score: number | null
        }
        Relationships: []
      }
      registrar_attention_queue: {
        Row: {
          course_code: string | null
          course_title: string | null
          institution_id: string | null
          item_id: string | null
          record_type: string | null
          status: string | null
          student_display_name: string | null
          student_id: string | null
          submitted_at: string | null
          submitted_by_display_name: string | null
          updated_at: string | null
          version_number: number | null
        }
        Relationships: []
      }
      registrar_audit_activity: {
        Row: {
          action: string | null
          activity_id: string | null
          actor_display_name: string | null
          actor_role: string | null
          entity_id: string | null
          entity_type: string | null
          institution_id: string | null
          occurred_at: string | null
          outcome: string | null
        }
        Relationships: []
      }
      registrar_registration_activity: {
        Row: {
          created_at: string | null
          institution_id: string | null
          request_id: string | null
          section_count: number | null
          status: string | null
          student_display_name: string | null
          student_id: string | null
          term_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registration_requests_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_dashboard_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "registration_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      registrar_grade_queue: {
        Row: {
          approved_at: string | null
          correction_reason_code: string | null
          course_code: string | null
          course_title: string | null
          current_grade_record_id: string | null
          current_grade_record_version: number | null
          grade_code: string | null
          grade_points: number | null
          grade_submission_id: string | null
          institution_id: string | null
          previous_grade_submission_id: string | null
          section_code: string | null
          section_id: string | null
          state: string | null
          student_display_name: string | null
          student_id: string | null
          submitted_at: string | null
          submitted_by_display_name: string | null
          term_name: string | null
          total_score: number | null
        }
        Relationships: []
      }
      registrar_section_directory: {
        Row: {
          capacity: number | null
          course_code: string | null
          course_id: string | null
          course_title: string | null
          delivery_mode: string | null
          enrolled_count: number | null
          institution_id: string | null
          instructors: string | null
          location: string | null
          schedule: string | null
          section_code: string | null
          section_id: string | null
          status: string | null
          term_id: string | null
          term_name: string | null
        }
        Relationships: []
      }
      registrar_student_directory: {
        Row: {
          academic_status: string | null
          display_name: string | null
          expected_completion_date: string | null
          institution_id: string | null
          program_name: string | null
          program_version_number: number | null
          student_id: string | null
          student_number: string | null
        }
        Relationships: []
      }
      registrar_workspace_summary: {
        Row: {
          active_student_count: number | null
          add_drop_deadline: string | null
          course_section_count: number | null
          ends_on: string | null
          grades_due_at: string | null
          institution_id: string | null
          institution_name: string | null
          records_awaiting_publication: number | null
          registration_closes_at: string | null
          registration_opens_at: string | null
          starts_on: string | null
          term_id: string | null
          term_name: string | null
          term_status: string | null
          withdrawal_deadline: string | null
        }
        Relationships: []
      }
      student_current_courses: {
        Row: {
          code: string | null
          instructor: string | null
          location: string | null
          schedule: string | null
          section_code: string | null
          section_id: string | null
          student_id: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_dashboard_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_academic_record: {
        Row: {
          academic_record_version: number | null
          academic_record_version_id: string | null
          anchor_status: string | null
          attempted_credit_hours: number | null
          correction_reason_code: string | null
          course_code: string | null
          course_id: string | null
          course_title: string | null
          credit_hours_earned: number | null
          grade_code: string | null
          grade_points: number | null
          grade_record_id: string | null
          institution_id: string | null
          is_current: boolean | null
          previous_grade_record_id: string | null
          published_at: string | null
          student_id: string | null
          superseded_at: string | null
          term_name: string | null
          version_number: number | null
        }
        Relationships: []
      }
      student_dashboard_summary: {
        Row: {
          academic_status: string | null
          active_hold_count: number | null
          active_share_count: number | null
          credits_earned: number | null
          credits_required: number | null
          display_name: string | null
          gpa: number | null
          initials: string | null
          institution_id: string | null
          institution_name: string | null
          private_advisor_note_count: number | null
          program_name: string | null
          progress_percent: number | null
          student_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      student_degree_progress: {
        Row: {
          academic_record_version_id: string | null
          calculated_at: string | null
          credits_earned: number | null
          credits_required: number | null
          degree_audit_snapshot_id: string | null
          gpa: number | null
          institution_id: string | null
          program_name: string | null
          program_version: number | null
          progress_percent: number | null
          requirement_results: Json | null
          student_id: string | null
        }
        Relationships: []
      }
      student_recent_activity: {
        Row: {
          activity_id: string | null
          detail: string | null
          occurred_at: string | null
          student_id: string | null
          title: string | null
          tone: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      activate_sensitive_share_with_outbox: {
        Args: {
          p_commitment_environment: string
          p_correlation_id: string
          p_draft_id: string
          p_grant_commitment: string
          p_institution_commitment: string
          p_institution_commitment_key_version: number
          p_student_commitment: string
          p_student_commitment_key_version: number
          p_token_hash: string
          p_trace_id: string
        }
        Returns: Json
      }
      approve_grade_submission: {
        Args: { p_grade_submission_id: string; p_idempotency_key: string }
        Returns: Json
      }
      check_registration_eligibility: {
        Args: { requested_section_ids?: string[]; section_id: string }
        Returns: Json
      }
      claim_m6_outbox_events: {
        Args: {
          p_batch_size: number
          p_lease_seconds: number
          p_phase: string
          p_worker_id: string
        }
        Returns: {
          aggregate_id: string
          aggregate_type: string
          attempt_number: number
          available_at: string
          correlation_id: string
          created_at: string
          event_id: string
          event_type: string
          first_attempt_at: string
          idempotency_key: string
          institution_id: string
          last_attempt_at: string
          lease_expires_at: string
          payload: Json
          schema_version: number
          trace_id: string
        }[]
      }
      complete_m6_outbox_event: {
        Args: {
          p_attempt_number: number
          p_chain_id: number
          p_confirmation_count: number
          p_error_code: string
          p_event_id: string
          p_expected_confirmations: number
          p_outcome: string
          p_provider_operation_id: string
          p_receipt_state: string
          p_retry_after_seconds: number
          p_transaction_hash: string
          p_worker_id: string
        }
        Returns: Json
      }
      get_m6_outbox_metrics: { Args: never; Returns: Json }
      get_registration_catalog: {
        Args: { p_term_id?: string }
        Returns: {
          add_drop_deadline: string
          available_seats: number
          capacity: number
          course_code: string
          course_id: string
          course_title: string
          credit_hours: number
          delivery_mode: string
          eligibility: Json
          enrolled_count: number
          enrollment_id: string
          enrollment_status: string
          institution_id: string
          instructor: string
          location: string
          meetings: Json
          prerequisites: Json
          registration_closes_at: string
          section_code: string
          section_id: string
          section_status: string
          student_id: string
          term_id: string
          term_name: string
        }[]
      }
      manual_retry_m6_outbox_event: {
        Args: { p_event_id: string; p_reason_code: string }
        Returns: Json
      }
      publish_grade_submission_with_anchor: {
        Args: {
          p_commitment_environment: string
          p_content_commitment: string
          p_correlation_id: string
          p_grade_submission_id: string
          p_idempotency_key: string
          p_institution_commitment: string
          p_institution_commitment_key_version: number
          p_salt_reference: string
          p_student_commitment: string
          p_student_commitment_key_version: number
          p_trace_id: string
        }
        Returns: Json
      }
      register_for_sections: {
        Args: { p_idempotency_key: string; p_section_ids: string[] }
        Returns: Json
      }
      renew_m6_outbox_lease: {
        Args: {
          p_attempt_number: number
          p_event_id: string
          p_lease_seconds: number
          p_worker_id: string
        }
        Returns: string
      }
      save_grade_drafts: {
        Args: {
          p_grades: Json
          p_idempotency_key: string
          p_section_id: string
        }
        Returns: Json
      }
      revoke_sensitive_share_with_outbox: {
        Args: {
          p_correlation_id: string
          p_idempotency_key: string
          p_share_grant_id: string
          p_trace_id: string
        }
        Returns: Json
      }
      start_grade_correction: {
        Args: {
          p_grade_record_id: string
          p_idempotency_key: string
          p_reason_code: string
        }
        Returns: Json
      }
      submit_section_grades: {
        Args: { p_idempotency_key: string; p_section_id: string }
        Returns: Json
      }
      withdraw_from_section: {
        Args: { p_enrollment_id: string; p_idempotency_key: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

