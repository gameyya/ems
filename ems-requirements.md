# Feature Specification: Educational Institution Management System

**Feature Branch**: `001-ems-mvp`  
**Created**: 2026-04-08  
**Last updated**: 2026-04-13  
**Status**: Draft  
**Input**: User description: "Web-based system to manage classes, teachers, students, payments, and receipt printing for an educational institution"

> **Infrastructure context**: This spec assumes a **static-hosted SPA + Supabase (free tier)** deployment model with no dedicated backend server. See [`info-dir/infra-deployment-req.md`](info-dir/infra-deployment-req.md) for the full infrastructure constraints. Requirements below are written to be satisfiable entirely with browser-side code + PostgreSQL (RLS, constraints, functions).

## User Scenarios & Testing

### User Story 1 - Student Registration & Management (Priority: P1)

Staff can register new students, assign them unique auto-generated IDs, and manage their records (edit, search, delete). This is the foundational data entry point for the entire system.

**Why this priority**: Students are the core entity -- nothing else (classes, payments, receipts) works without them.

**Independent Test**: Register a student, verify the auto-generated ID, search for the student, edit their info, and confirm persistence.

**Acceptance Scenarios**:

1. **Given** a staff user is logged in, **When** they fill in the student form (Full Name, Phone, Parent Name, Parent Phone, Address, Notes) and submit, **Then** a new student record is created with an auto-generated unique Student ID and today's Enrollment Date.
2. **Given** a student exists, **When** staff searches by name or ID, **Then** the student record is displayed with all details.
3. **Given** a student exists, **When** staff edits and saves, **Then** the updated data is persisted.

---

### User Story 2 - Teacher Management (Priority: P1)

Staff can add, edit, delete, and search teacher records including their specialty and payment terms.

**Why this priority**: Teachers must exist before classes can be created and assigned.

**Independent Test**: Add a teacher with Full Name, Phone, Specialty, Salary/Payment Type, and Notes. Search and edit the record.

**Acceptance Scenarios**:

1. **Given** a staff user is logged in, **When** they submit the teacher form, **Then** a teacher record is created.
2. **Given** teachers exist, **When** staff searches by name or specialty, **Then** matching teachers are listed.

---

### User Story 3 - Class Management (Priority: P2)

Staff can create classes, assign a teacher, set a schedule, and enroll students into classes.

**Why this priority**: Classes link students and teachers together -- depends on both existing first.

**Independent Test**: Create a class, assign a teacher, enroll students, verify the class roster.

**Acceptance Scenarios**:

1. **Given** teachers and students exist, **When** staff creates a class with Name, Teacher, Schedule (Days & Time), and optional Capacity, **Then** the class is created.
2. **Given** a class exists, **When** staff assigns students to it, **Then** the class roster is updated.
3. **Given** a class is at capacity, **When** staff tries to enroll another student, **Then** the system warns about capacity.

---

### User Story 4 - Payment Registration (Priority: P2)

Finance users or staff can record manual payments against a student, with auto-generated receipt numbers and full payment details.

**Why this priority**: Payments are the primary revenue tracking mechanism and depend on students existing.

**Independent Test**: Select a student, record a payment (amount, method, date, notes), verify the receipt number is auto-generated and the record is persisted.

**Acceptance Scenarios**:

1. **Given** a student exists, **When** a finance user enters Amount, Payment Method (Cash/Other), Date, and Notes, **Then** a payment record is created with an auto-generated Receipt Number.
2. **Given** a payment exists, **When** a user attempts to delete it, **Then** the system prevents deletion (financial records are immutable).
3. **Given** a payment was made in error, **When** a user cancels it, **Then** the cancellation is recorded with an audit trail and the original record is preserved.

---

### User Story 5 - Receipt Printing & PDF Export (Priority: P3)

After a payment is recorded, users can view, print, or export a professional receipt as PDF, including institution branding.

**Why this priority**: Receipts are a read-only output of payments -- depends on payment records existing.

**Independent Test**: Record a payment, generate the receipt, verify it includes Institution Name & Logo, Receipt Number, Student Name, Amount, Date, and Signature/Stamp area. Export as PDF and print.

**Acceptance Scenarios**:

1. **Given** a payment record exists, **When** the user clicks "Print Receipt", **Then** a formatted receipt is displayed with all required fields.
2. **Given** a receipt is displayed, **When** the user clicks "Export PDF", **Then** a PDF file is downloaded.
3. **Given** a receipt is displayed, **When** the user clicks "Print", **Then** the browser print dialog opens with a clean print layout.

---

### User Story 6 - Reports (Priority: P3)

Admin and finance users can generate filtered reports: student list, class list, payment reports (daily/monthly/custom range), and optionally outstanding balances.

**Why this priority**: Reports are read-only views over existing data -- depends on all other modules having data.

**Independent Test**: Generate a student list report, a payments report filtered by date range, and verify data accuracy.

**Acceptance Scenarios**:

1. **Given** students exist, **When** a user opens the Student List report, **Then** all students are listed with search and filter support.
2. **Given** payments exist, **When** a user filters the Payments report by date range, **Then** only matching payments are shown with totals.
3. **Given** a report is displayed, **When** the user clicks "Export to Excel", **Then** the data is downloaded as an Excel file.

---

### User Story 7 - User Roles & Access Control (Priority: P1)

The system supports three roles (Admin, Staff, Finance) with appropriate permissions. Admin has full access, Staff manages students/teachers/classes and registers payments, Finance handles payments/receipts/reports.

**Why this priority**: Role-based access is a cross-cutting concern that must be in place before any module is usable in production.

**Independent Test**: Log in as each role and verify access restrictions match the defined permissions.

**Acceptance Scenarios**:

1. **Given** a user with the Staff role, **When** they try to access financial reports, **Then** access is denied.
2. **Given** an Admin user, **When** they access any module, **Then** full access is granted.
3. **Given** a Finance user, **When** they access student management, **Then** they have read-only access (or no access, per policy).

---

### User Story 8 - Attendance Tracking (Priority: P4)

Teachers or staff can mark student attendance per class session with a simple present/absent system.

**Why this priority**: Optional for MVP. Enhances class management but not required for core operations.

**Independent Test**: Open a class session, mark students present/absent, verify the attendance record is saved.

**Acceptance Scenarios**:

1. **Given** a class with enrolled students, **When** staff opens the attendance view for a date, **Then** all enrolled students are listed with present/absent toggles.
2. **Given** attendance is marked, **When** saved, **Then** the attendance record is persisted and viewable in history.

---

### Edge Cases

- What happens when a student is deleted who has payment records? (Soft-delete only, financial records preserved)
- What happens when a teacher assigned to active classes is deleted? (Prevent deletion or reassign first)
- What happens when duplicate student names are entered? (Allow, but warn -- unique ID differentiates them)
- What happens when the system is used in Arabic? (RTL layout, Arabic labels, bidirectional text support)

## Requirements

### Functional Requirements

- **FR-001**: System MUST auto-generate unique IDs for Students, Classes, and Receipt Numbers. Generation MUST happen **at the database level** (sequences, `gen_random_uuid()`, or DB functions) since no application server is available to coordinate.
- **FR-002**: System MUST prevent deletion of financial records; only cancellation with audit trail is allowed. Enforcement MUST be at the **database layer** (RLS policies + triggers/constraints), not only in the UI.
- **FR-003**: System MUST support Arabic UI with RTL layout. Localization runs **client-side** (no server rendering).
- **FR-004**: System MUST provide search and filtering on all list views, implemented as Supabase/Postgres queries from the browser.
- **FR-005**: System MUST support role-based access control (Admin, Staff, Finance). Roles MUST be enforced by **Supabase Auth + PostgreSQL Row Level Security (RLS)** — the UI layer is not trusted as a security boundary.
- **FR-006**: System MUST generate printable receipts with Institution Name, Logo, Receipt Number, Student Name, Amount, Date, and Signature/Stamp area. Rendering happens **in the browser**.
- **FR-007**: System MUST export receipts as PDF, generated **client-side** (no server rendering).
- **FR-008**: System MUST support Excel export for reports, generated **client-side**.
- **FR-009**: System MUST be web-based and backed by **Supabase-managed PostgreSQL**. No alternative database engine is in scope.
- **FR-010**: System MUST support fast data entry with optimized forms.
- **FR-011**: System MUST be designed for future integration with payment gateways and SMS/WhatsApp notifications. Such integrations MUST be deferred to **Cloudflare Pages Functions** or an external service — they will not run in the browser.
- **FR-012**: System MUST be deliverable as a **static bundle** (HTML/JS/CSS) hostable on Cloudflare Pages; no Node.js runtime is assumed in production.
- **FR-013**: System MUST NOT ship any privileged credentials (Supabase service-role keys, admin secrets) in the client bundle. Only the public anon key may be embedded.
- **FR-014**: System MUST treat the institution logo and branding as runtime configuration stored in Supabase (Storage + a settings table), not baked into the static bundle.

### Key Entities

- **Student**: Core entity. Full Name, Phone, Parent Name, Parent Phone, Address, Enrollment Date, Notes. Has many Payments, belongs to many Classes. Soft-delete only (to preserve financial history).
- **Teacher**: Full Name, Phone, Specialty/Subject, Salary/Payment Type, Notes. Has many Classes.
- **Class**: Class Name, Teacher (FK), Schedule (Days & Time), Capacity, Notes. Has many Students (M2M), belongs to one Teacher.
- **Payment**: Receipt Number (auto, DB-generated), Student (FK), Amount, Payment Date, Payment Method, Notes, Cancelled flag + cancellation metadata. Immutable once created (enforced by RLS + triggers).
- **User**: Managed by **Supabase Auth**. Role (Admin/Staff/Finance) stored in a linked profile row or JWT claim; used by RLS policies.
- **Settings**: Institution Name, Logo (Storage path), other branding. Editable by Admin; read by all authenticated roles.
- **Attendance** (optional): Student (FK), Class (FK), Date, Status (Present/Absent).

## Success Criteria

### Measurable Outcomes

- **SC-001**: Staff can register a new student in under 1 minute.
- **SC-002**: A payment can be recorded and receipt printed in under 2 minutes.
- **SC-003**: All list views load and respond to search/filter in under 2 seconds.
- **SC-004**: Receipt PDF output is clean, professional, and print-ready.
- **SC-005**: Role-based access correctly restricts all unauthorized actions with zero bypass, verified by RLS policy tests against the database directly (not just UI tests).
- **SC-006**: Application is deployable to Cloudflare Pages from a clean `git push` with no manual build steps.
- **SC-007**: Total monthly infrastructure cost for the MVP is **$0** (free tiers only).

## Assumptions

- Users have access to a modern web browser (Chrome, Firefox, Edge) with JavaScript enabled.
- The system is deployed as a **static SPA on Cloudflare Pages** talking directly to **Supabase (free tier)**. No dedicated backend server is operated.
- The Supabase project's usage will fit within free-tier limits for the MVP.
- Internet connectivity is required; no offline mode for MVP.
- Arabic is the primary UI language; English support is secondary / not required for MVP.
- No online payment gateway integration in MVP -- all payments are manual entry.
- Mobile app, SMS/WhatsApp notifications, and parent portal are out of scope for MVP.
- Institution logo and name are stored in Supabase (Storage + settings table) and editable by Admin at runtime.
- Security-critical rules (role checks, payment immutability, unique receipt numbers) are enforced in **PostgreSQL** (RLS, constraints, triggers, functions) — the browser client is treated as untrusted.

## References

- [`info-dir/infra-deployment-req.md`](info-dir/infra-deployment-req.md) — infrastructure & deployment constraints driving the requirements above.
