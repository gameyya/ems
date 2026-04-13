import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AppLayout } from "@/components/layout/app-layout";
import { ProtectedRoute } from "@/components/layout/protected-route";
import { LoginPage } from "@/pages/login";

const DashboardPage = lazy(() =>
  import("@/pages/dashboard").then((m) => ({ default: m.DashboardPage })),
);
const StudentsPage = lazy(() =>
  import("@/pages/students").then((m) => ({ default: m.StudentsPage })),
);
const StudentDetailPage = lazy(() =>
  import("@/pages/student-detail").then((m) => ({ default: m.StudentDetailPage })),
);
const TeachersPage = lazy(() =>
  import("@/pages/teachers").then((m) => ({ default: m.TeachersPage })),
);
const ClassesPage = lazy(() =>
  import("@/pages/classes").then((m) => ({ default: m.ClassesPage })),
);
const PaymentsPage = lazy(() =>
  import("@/pages/payments").then((m) => ({ default: m.PaymentsPage })),
);
const ReceiptPage = lazy(() =>
  import("@/pages/receipt").then((m) => ({ default: m.ReceiptPage })),
);
const AttendancePage = lazy(() =>
  import("@/pages/attendance").then((m) => ({ default: m.AttendancePage })),
);
const ReportsPage = lazy(() =>
  import("@/pages/reports").then((m) => ({ default: m.ReportsPage })),
);
const SettingsPage = lazy(() =>
  import("@/pages/settings").then((m) => ({ default: m.SettingsPage })),
);

function PageFallback() {
  return <div className="p-8 text-sm text-[color:var(--color-muted-foreground)]">…</div>;
}

export default function App() {
  return (
    <>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="students/:studentId" element={<StudentDetailPage />} />
            <Route path="teachers" element={<TeachersPage />} />
            <Route path="classes" element={<ClassesPage />} />
            <Route
              path="payments"
              element={
                <ProtectedRoute allow={["admin", "staff", "finance"]}>
                  <PaymentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="receipts/:paymentId"
              element={
                <ProtectedRoute allow={["admin", "staff", "finance"]}>
                  <ReceiptPage />
                </ProtectedRoute>
              }
            />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route
              path="settings"
              element={
                <ProtectedRoute allow={["admin"]}>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </Suspense>
      <Toaster position="top-center" richColors dir="rtl" />
    </>
  );
}
