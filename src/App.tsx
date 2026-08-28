import { ReactNode } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { StoreProvider, useStore } from "@/lib/store";
import PublicLayout from "@/layouts/PublicLayout";
import DashboardLayout from "@/layouts/DashboardLayout";
import Home from "@/pages/public/Home";
import { LoginPage, FormationsPage, TarifsPage, PreInscriptionPage } from "@/pages/public/PublicPages";
import { AdminDashboard, JournalPage, ParametresPage } from "@/pages/admin/Dashboard";
import { StudentsPage, TeachersPage, UsersPage } from "@/pages/admin/People";
import {
  ModulesPage, SchedulePage, AttendancePage, CoursesPage, TestsPage, GradesPage,
  PaymentsPage, CertificatesPage, ScholarshipsPage,
} from "@/pages/admin/Operations";
import { ContentEditor } from "@/pages/admin/ContentEditor";
import { AdvantagesManager, PartnersManager, AnnouncementsManager } from "@/pages/admin/ContentManagers";
import { InitializationPage } from "@/pages/admin/Initialization";
import { TeacherHoursPage } from "@/pages/admin/TeacherHours";
import { TeacherSubmissions, StudentSubmission } from "@/pages/shared/Submissions";
import { EniaPage, EniaAdminPage } from "@/pages/shared/Enia";
import { TeacherDashboard, TeacherClasses, TeacherStudents } from "@/pages/teacher/TeacherPages";
import { PartnerPortal } from "@/pages/partner/PartnerPortal";
import {
  PartnerAttendance,
  PartnerCertificates,
  PartnerCourses,
  PartnerDashboard,
  PartnerFormations,
  PartnerGrades,
  PartnerModules,
  PartnerProfile,
  PartnerReports,
  PartnerSchedule,
  PartnerScholarships,
  PartnerStudents,
  PartnerTeachers,
  PartnerTests,
} from "@/pages/partner/PartnerPages";
import {
  StudentDashboard, StudentProfile, MyFormation, MyModules, MySchedule, MyCourses,
  MyDocuments, MyAttendance, MyGrades, MyPayments, MyCertificate, MyScholarship,
} from "@/pages/student/StudentPages";
import { MessageCenter, NotificationsPage } from "@/pages/shared/Communication";
import { QrScannerPage } from "@/pages/shared/QrScanner";
import { ReportsPage } from "@/pages/shared/Reports";
import { VisualCalendar } from "@/pages/shared/Calendar";
import { BulletinsPage } from "@/pages/admin/BulletinPage";
import { ImportPage } from "@/pages/admin/ImportPage";
import { CertificateVerifyPage } from "@/pages/public/CertificateVerify";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

function Gate({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { user } = useStore();
  const { profile } = useAuth();
  const role = user?.role || profile?.role;
  if (!user && !profile) return <Navigate to="/connexion" replace />;
  if (role && !roles.includes(role)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10">
          <ShieldCheck size={28} className="text-red-400" />
        </div>
        <h2 className="font-display text-xl font-black text-white">Accès non autorisé</h2>
        <p className="mt-2 max-w-sm text-sm text-slate-400">
          Votre rôle ne vous permet pas d'accéder à cette section. Contactez l'administration si vous pensez qu'il s'agit d'une erreur.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}

function RoleDashboard() {
  const { user } = useStore();
  const { profile } = useAuth();
  const role = user?.role || profile?.role;
  if (role === "teacher") return <TeacherDashboard />;
  if (role === "student") return <StudentDashboard />;
  if (role === "partner" || role === "partner_admin") return <PartnerPortal />;
  return <AdminDashboard />;
}

function MyCoursesRoute() {
  const { user } = useStore();
  return user?.role === "student" ? <MyCourses /> : <CoursesPage />;
}

function ScheduleRoute() {
  const { user } = useStore();
  return user?.role === "student" ? <MySchedule /> : <SchedulePage />;
}

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Routes>
          {/* Public */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/formations" element={<FormationsPage />} />
            <Route path="/tarifs" element={<TarifsPage />} />
            <Route path="/pre-inscription" element={<PreInscriptionPage />} />
            <Route path="/connexion" element={<LoginPage />} />
            <Route path="/verifier-certificat" element={<CertificateVerifyPage />} />
          </Route>

          {/* App */}
          <Route
            path="/app"
            element={
              <Gate roles={["superadmin", "admin", "partner_admin", "partner", "teacher", "student"]}>
                <DashboardLayout />
              </Gate>
            }
          >
            <Route path="dashboard" element={<RoleDashboard />} />
            <Route path="vitrine" element={<Gate roles={["superadmin", "admin", "partner_admin", "partner"]}><PartnerPortal /></Gate>} />
            <Route path="partner/dashboard" element={<Gate roles={["partner", "partner_admin"]}><PartnerDashboard /></Gate>} />
            <Route path="partner/apprenants" element={<Gate roles={["partner", "partner_admin"]}><PartnerStudents /></Gate>} />
            <Route path="partner/enseignants" element={<Gate roles={["partner", "partner_admin"]}><PartnerTeachers /></Gate>} />
            <Route path="partner/formations" element={<Gate roles={["partner", "partner_admin"]}><PartnerFormations /></Gate>} />
            <Route path="partner/modules" element={<Gate roles={["partner", "partner_admin"]}><PartnerModules /></Gate>} />
            <Route path="partner/emploi-du-temps" element={<Gate roles={["partner", "partner_admin"]}><PartnerSchedule /></Gate>} />
            <Route path="partner/presences" element={<Gate roles={["partner", "partner_admin"]}><PartnerAttendance /></Gate>} />
            <Route path="partner/cours" element={<Gate roles={["partner", "partner_admin"]}><PartnerCourses /></Gate>} />
            <Route path="partner/supports" element={<Gate roles={["partner", "partner_admin"]}><PartnerCourses /></Gate>} />
            <Route path="partner/tests" element={<Gate roles={["partner", "partner_admin"]}><PartnerTests /></Gate>} />
            <Route path="partner/notes" element={<Gate roles={["partner", "partner_admin"]}><PartnerGrades /></Gate>} />
            <Route path="partner/certificats" element={<Gate roles={["partner", "partner_admin"]}><PartnerCertificates /></Gate>} />
            <Route path="partner/bourses" element={<Gate roles={["partner", "partner_admin"]}><PartnerScholarships /></Gate>} />
            <Route path="partner/rapports" element={<Gate roles={["partner", "partner_admin"]}><PartnerReports /></Gate>} />
            <Route path="partner/enya" element={<Gate roles={["partner", "partner_admin"]}><EniaPage /></Gate>} />
            <Route path="partner/profil" element={<Gate roles={["partner", "partner_admin"]}><PartnerProfile /></Gate>} />
            <Route path="etudiants" element={<Gate roles={["superadmin", "admin"]}><StudentsPage /></Gate>} />
            <Route path="enseignants" element={<Gate roles={["superadmin", "admin"]}><TeachersPage /></Gate>} />
            <Route path="enseignants-heures" element={<Gate roles={["superadmin", "admin"]}><TeacherHoursPage /></Gate>} />
            <Route path="modules" element={<Gate roles={["superadmin", "admin"]}><ModulesPage /></Gate>} />
            <Route path="emploi-du-temps" element={<ScheduleRoute />} />
            <Route path="calendrier" element={<Gate roles={["superadmin", "admin", "teacher", "student"]}><VisualCalendar /></Gate>} />
            <Route path="bulletins" element={<Gate roles={["superadmin", "admin"]}><BulletinsPage /></Gate>} />
            <Route path="import" element={<Gate roles={["superadmin", "admin"]}><ImportPage /></Gate>} />
            <Route path="presences" element={<Gate roles={["superadmin", "admin", "teacher"]}><AttendancePage /></Gate>} />
            <Route path="cours" element={<Gate roles={["superadmin", "admin", "teacher"]}><CoursesPage /></Gate>} />
            <Route path="devoirs" element={<Gate roles={["superadmin", "admin", "teacher"]}><TeacherSubmissions /></Gate>} />
            <Route path="qr-scanner" element={<Gate roles={["superadmin", "admin", "teacher"]}><QrScannerPage /></Gate>} />
            <Route path="mes-cours" element={<Gate roles={["teacher", "student"]}><MyCoursesRoute /></Gate>} />
            <Route path="mes-devoirs" element={<Gate roles={["student"]}><StudentSubmission /></Gate>} />
            <Route path="tests" element={<Gate roles={["superadmin", "admin", "teacher"]}><TestsPage /></Gate>} />
            <Route path="notes" element={<Gate roles={["superadmin", "admin", "teacher"]}><GradesPage /></Gate>} />
            <Route path="paiements" element={<Gate roles={["superadmin", "admin"]}><PaymentsPage /></Gate>} />
            <Route path="certificats" element={<Gate roles={["superadmin", "admin", "partner_admin"]}><CertificatesPage /></Gate>} />
            <Route path="bourses" element={<Gate roles={["superadmin", "admin", "partner_admin"]}><ScholarshipsPage /></Gate>} />
            <Route path="enia" element={<Gate roles={["superadmin", "admin", "partner_admin", "partner", "teacher", "student"]}><EniaPage /></Gate>} />
            <Route path="enia-admin" element={<Gate roles={["superadmin", "admin"]}><EniaAdminPage /></Gate>} />
            <Route path="messages" element={<MessageCenter />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="utilisateurs" element={<Gate roles={["superadmin"]}><UsersPage /></Gate>} />
            <Route path="contenu" element={<Gate roles={["superadmin", "admin"]}><ContentEditor /></Gate>} />
            <Route path="avantages" element={<Gate roles={["superadmin", "admin"]}><AdvantagesManager /></Gate>} />
            <Route path="partenaires" element={<Gate roles={["superadmin", "admin"]}><PartnersManager /></Gate>} />
            <Route path="annonces" element={<Gate roles={["superadmin", "admin"]}><AnnouncementsManager /></Gate>} />
            <Route path="initialisation" element={<Gate roles={["superadmin"]}><InitializationPage /></Gate>} />
            <Route path="journal" element={<Gate roles={["superadmin", "admin"]}><JournalPage /></Gate>} />
            <Route path="rapports" element={<Gate roles={["superadmin", "admin", "partner_admin"]}><ReportsPage /></Gate>} />
            <Route path="parametres" element={<Gate roles={["superadmin", "admin"]}><ParametresPage /></Gate>} />
            <Route path="mes-classes" element={<Gate roles={["teacher"]}><TeacherClasses /></Gate>} />
            <Route path="mes-apprenants" element={<Gate roles={["teacher"]}><TeacherStudents /></Gate>} />
            <Route path="mon-profil" element={<Gate roles={["student"]}><StudentProfile /></Gate>} />
            <Route path="ma-formation" element={<Gate roles={["student"]}><MyFormation /></Gate>} />
            <Route path="mes-modules" element={<Gate roles={["student"]}><MyModules /></Gate>} />
            <Route path="mes-documents" element={<Gate roles={["student"]}><MyDocuments /></Gate>} />
            <Route path="mes-presences" element={<Gate roles={["student"]}><MyAttendance /></Gate>} />
            <Route path="mes-notes" element={<Gate roles={["student"]}><MyGrades /></Gate>} />
            <Route path="mes-paiements" element={<Gate roles={["student"]}><MyPayments /></Gate>} />
            <Route path="mon-certificat" element={<Gate roles={["student"]}><MyCertificate /></Gate>} />
            <Route path="ma-bourse" element={<Gate roles={["student"]}><MyScholarship /></Gate>} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </StoreProvider>
  );
}
