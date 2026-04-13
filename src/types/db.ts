// DB types — aligned with supabase/migrations/*.sql
// If you change migrations, update this file.

export type UserRole = "admin" | "staff" | "finance";
export type PaymentMethod = "cash" | "other";
export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  id: 1;
  institution_name: string;
  institution_name_ar: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  currency_code: string;
  receipt_page_size: "a4" | "a5" | "a6" | "letter";
  updated_at: string;
}

export interface Student {
  id: string;
  code: string;
  full_name: string;
  phone: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  address: string | null;
  notes: string | null;
  enrollment_date: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Teacher {
  id: string;
  full_name: string;
  phone: string | null;
  specialty: string | null;
  payment_type: string | null;
  salary: number | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClassRow {
  id: string;
  code: string;
  name: string;
  teacher_id: string | null;
  schedule_days: string[];
  schedule_time: string | null;
  capacity: number | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Enrollment {
  id: string;
  student_id: string;
  class_id: string;
  enrolled_at: string;
}

export interface Payment {
  id: string;
  receipt_code: string;
  student_id: string;
  amount: number;
  method: PaymentMethod;
  payment_date: string;
  notes: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Attendance {
  id: string;
  student_id: string;
  class_id: string;
  date: string;
  status: AttendanceStatus;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface ClassEnrollmentCount {
  class_id: string;
  name: string;
  capacity: number | null;
  enrolled: number;
}

export interface StudentBalance {
  student_id: string;
  full_name: string;
  total_paid: number;
  payment_count: number;
}

// ---- Database helper type for supabase-js ----
// Row = exact shape returned from the DB.
// Insert/Update are permissive (Partial) — app-level Zod schemas carry precise validation.

type Table<R> = { Row: R; Insert: Partial<R>; Update: Partial<R>; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile>;
      settings: Table<Settings>;
      students: Table<Student>;
      teachers: Table<Teacher>;
      classes: Table<ClassRow>;
      enrollments: Table<Enrollment>;
      payments: Table<Payment>;
      attendance: Table<Attendance>;
    };
    Views: {
      v_class_enrollment_counts: { Row: ClassEnrollmentCount; Relationships: [] };
      v_student_balance: { Row: StudentBalance; Relationships: [] };
    };
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      payment_method: PaymentMethod;
      attendance_status: AttendanceStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
