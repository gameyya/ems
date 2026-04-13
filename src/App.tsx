import { Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AppLayout } from "@/components/layout/app-layout";
import { ProtectedRoute } from "@/components/layout/protected-route";
import { AttendancePage } from "@/pages/attendance";
import { ClassesPage } from "@/pages/classes";
import { DashboardPage } from "@/pages/dashboard";
import { LoginPage } from "@/pages/login";
import { PaymentsPage } from "@/pages/payments";
import { ReceiptPage } from "@/pages/receipt";
import { ReportsPage } from "@/pages/reports";
import { SettingsPage } from "@/pages/settings";
import { StudentDetailPage } from "@/pages/student-detail";
import { StudentsPage } from "@/pages/students";
import { TeachersPage } from "@/pages/teachers";

export default function App() {
  return (
    <>
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
      <Toaster position="top-center" richColors dir="rtl" />
    </>
  );
}
