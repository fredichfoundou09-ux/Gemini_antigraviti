import { ReactNode, Suspense, lazy } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { StoreProvider, useStore } from "@/lib/store";
import PublicLayout from "@/layouts/PublicLayout";
import DashboardLayout from "@/layouts/DashboardLayout";
import Home from "@/pages/public/Home";
import { LoginPage } from "@/pages/public/PublicPages";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { IntroSplash } from "@/components/IntroSplash";

// Public pages lazy loaded
const FormationsPage = lazy(() => import("@/pages/public/PublicPages").then((m) => ({ default: m.FormationsPage })));
const TarifsPage = lazy(() => import("@/pages/public/PublicPages").then((m) => ({ default: m.TarifsPage })));
const PreInscriptionPage = lazy(() => import("@/pages/public/PublicPages").then((m) => ({ default: m.PreInscriptionPage })));
const AccountActivationPage = lazy(() => import("@/pages/public/AccountActivation").then((m) => ({ default: m.AccountActivationPage })));
const TeacherAccessPage = lazy(() => import("@/pages/public/TeacherAccessPage").then((m) => ({ default: m.TeacherAccessPage })));
const CertificateVerifyPage = lazy(() => import("@/pages/public/CertificateVerify").then((m) => ({ default: m.CertificateVerifyPage })));

// Admin pages lazy loaded
const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard").then((m) => ({ default: m.AdminDashboard })));
const JournalPage = lazy(() => import("@/pages/admin/Dashboard").then((m) => ({ default: m.JournalPage })));
const ParametresPage = lazy(() => import("@/pages/admin/Dashboard").then((m) => ({ default: m.ParametresPage })));
const StudentsPage = lazy(() => import("@/pages/admin/People").then((m) => ({ default: m.StudentsPage })));
const TeachersPage = lazy(() => import("@/pages/admin/People").then((m) => ({ default: m.TeachersPage })));
const UsersPage = lazy(() => import("@/pages/admin/People").then((m) => ({ default: m.UsersPage })));

// Admin Operations
const ModulesPage = lazy(() => import("@/pages/admin/Operations").then((m) => ({ default: m.ModulesPage })));
const SchedulePage = lazy(() => import("@/pages/admin/Operations").then((m) => ({ default: m.SchedulePage })));
const AttendancePage = lazy(() => import("@/pages/admin/Operations").then((m) => ({ default: m.AttendancePage })));
const CoursesPage = lazy(() => import("@/pages/admin/Operations").then((m) => ({ default: m.CoursesPage })));
const GradesPage = lazy(() => import("@/pages/admin/Operations").then((m) => ({ default: m.GradesPage })));
const PaymentsPage = lazy(() => import("@/pages/admin/Operations").then((m) => ({ default: m.PaymentsPage })));
const CertificatesPage = lazy(() => import("@/pages/admin/Operations").then((m) => ({ default: m.CertificatesPage })));
const ScholarshipsPage = lazy(() => import("@/pages/admin/Operations").then((m) => ({ default: m.ScholarshipsPage })));

const ContentEditor = lazy(() => import("@/pages/admin/ContentEditor").then((m) => ({ default: m.ContentEditor })));
const InitializationPage = lazy(() => import("@/pages/admin/Initialization").then((m) => ({ default: m.InitializationPage })));
const TeacherHoursPage = lazy(() => import("@/pages/admin/TeacherHours").then((m) => ({ default: m.TeacherHoursPage })));
const SentinelAiAdminPage = lazy(() => import("@/pages/admin/SentinelAiAdminPage").then((m) => ({ default: m.SentinelAiAdminPage })));
const BulletinsPage = lazy(() => import("@/pages/admin/BulletinPage").then((m) => ({ default: m.BulletinsPage })));
const ImportPage = lazy(() => import("@/pages/admin/ImportPage").then((m) => ({ default: m.ImportPage })));

// Shared pages
const TeacherSubmissions = lazy(() => import("@/pages/shared/Submissions").then((m) => ({ default: m.TeacherSubmissions })));
const StudentSubmission = lazy(() => import("@/pages/shared/Submissions").then((m) => ({ default: m.StudentSubmission })));
const EniaPage = lazy(() => import("@/pages/shared/Enia").then((m) => ({ default: m.EniaPage })));
const EniaAdminPage = lazy(() => import("@/pages/shared/Enia").then((m) => ({ default: m.EniaAdminPage })));
const UnifiedProfilePage = lazy(() => import("@/pages/shared/UserProfile").then((m) => ({ default: m.UnifiedProfilePage })));
const MessageCenter = lazy(() => import("@/pages/shared/Communication").then((m) => ({ default: m.MessageCenter })));
const NotificationsPage = lazy(() => import("@/pages/shared/Communication").then((m) => ({ default: m.NotificationsPage })));
const QrScannerPage = lazy(() => import("@/pages/shared/QrScanner").then((m) => ({ default: m.QrScannerPage })));
const ReportsPage = lazy(() => import("@/pages/shared/Reports").then((m) => ({ default: m.ReportsPage })));
const VisualCalendar = lazy(() => import("@/pages/shared/Calendar").then((m) => ({ default: m.VisualCalendar })));

// Teacher pages
const TeacherDashboard = lazy(() => import("@/pages/teacher/TeacherPages").then((m) => ({ default: m.TeacherDashboard })));
const TeacherClasses = lazy(() => import("@/pages/teacher/TeacherPages").then((m) => ({ default: m.TeacherClasses })));
const TeacherStudents = lazy(() => import("@/pages/teacher/TeacherPages").then((m) => ({ default: m.TeacherStudents })));
const TeacherProfile = lazy(() => import("@/pages/teacher/TeacherPages").then((m) => ({ default: m.TeacherProfile })));

// Partner pages
const PartnerPortal = lazy(() => import("@/pages/partner/PartnerPortal").then((m) => ({ default: m.PartnerPortal })));
const PartnerDashboard = lazy(() => import("@/pages/partner/PartnerPages").then((m) => ({ default: m.PartnerDashboard })));
const PartnerStudents = lazy(() => import("@/pages/partner/PartnerPages").then((m) => ({ default: m.PartnerStudents })));
const PartnerTeachers = lazy(() => import("@/pages/partner/PartnerPages").then((m) => ({ default: m.PartnerTeachers })));
const PartnerFormations = lazy(() => import("@/pages/partner/PartnerPages").then((m) => ({ default: m.PartnerFormations })));
const PartnerModules = lazy(() => import("@/pages/partner/PartnerPages").then((m) => ({ default: m.PartnerModules })));
const PartnerSchedule = lazy(() => import("@/pages/partner/PartnerPages").then((m) => ({ default: m.PartnerSchedule })));
const PartnerAttendance = lazy(() => import("@/pages/partner/PartnerPages").then((m) => ({ default: m.PartnerAttendance })));
const PartnerCourses = lazy(() => import("@/pages/partner/PartnerPages").then((m) => ({ default: m.PartnerCourses })));
const PartnerTests = lazy(() => import("@/pages/partner/PartnerPages").then((m) => ({ default: m.PartnerTests })));
const PartnerGrades = lazy(() => import("@/pages/partner/PartnerPages").then((m) => ({ default: m.PartnerGrades })));
const PartnerCertificates = lazy(() => import("@/pages/partner/PartnerPages").then((m) => ({ default: m.PartnerCertificates })));
const PartnerScholarships = lazy(() => import("@/pages/partner/PartnerPages").then((m) => ({ default: m.PartnerScholarships })));
const PartnerReports = lazy(() => import("@/pages/partner/PartnerPages").then((m) => ({ default: m.PartnerReports })));
const PartnerProfile = lazy(() => import("@/pages/partner/PartnerPages").then((m) => ({ default: m.PartnerProfile })));

// Student pages
const StudentDashboard = lazy(() => import("@/pages/student/StudentPages").then((m) => ({ default: m.StudentDashboard })));
const StudentProfile = lazy(() => import("@/pages/student/StudentPages").then((m) => ({ default: m.StudentProfile })));
const MyFormation = lazy(() => import("@/pages/student/StudentPages").then((m) => ({ default: m.MyFormation })));
const MyModules = lazy(() => import("@/pages/student/StudentPages").then((m) => ({ default: m.MyModules })));
const MySchedule = lazy(() => import("@/pages/student/StudentPages").then((m) => ({ default: m.MySchedule })));
const MyCourses = lazy(() => import("@/pages/student/StudentPages").then((m) => ({ default: m.MyCourses })));
const MyDocuments = lazy(() => import("@/pages/student/StudentPages").then((m) => ({ default: m.MyDocuments })));
const MyAttendance = lazy(() => import("@/pages/student/StudentPages").then((m) => ({ default: m.MyAttendance })));
const MyGrades = lazy(() => import("@/pages/student/StudentPages").then((m) => ({ default: m.MyGrades })));
const MyPayments = lazy(() => import("@/pages/student/StudentPages").then((m) => ({ default: m.MyPayments })));
const MyCertificate = lazy(() => import("@/pages/student/StudentPages").then((m) => ({ default: m.MyCertificate })));
const MyScholarship = lazy(() => import("@/pages/student/StudentPages").then((m) => ({ default: m.MyScholarship })));
const MyTeachers = lazy(() => import("@/pages/student/StudentPages").then((m) => ({ default: m.MyTeachers })));

// Unified assessments
const UnifiedAssessmentsAssignmentsPage = lazy(() =>
  import("@/modules/unified-assessments/pages/UnifiedAssessmentsAssignmentsPage").then((m) => ({
    default: m.UnifiedAssessmentsAssignmentsPage,
  }))
);
const UnifiedStudentAssessmentsAssignmentsPage = lazy(() =>
  import("@/modules/unified-assessments/pages/UnifiedStudentAssessmentsAssignmentsPage").then((m) => ({
    default: m.UnifiedStudentAssessmentsAssignmentsPage,
  }))
);

function PageLoader() {
  return (
    <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      <span className="text-xs font-medium text-slate-400">Chargement de la page...</span>
    </div>
  );
}


function Gate({ roles, moduleKey, children }: { roles: string[]; moduleKey?: string; children: ReactNode }) {
  const { user, isModuleBlockedForUser } = useStore();
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

  if (moduleKey) {
    const blockCheck = isModuleBlockedForUser(moduleKey, user);
    if (blockCheck.blocked) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
            <ShieldCheck size={28} className="text-amber-400" />
          </div>
          <h2 className="font-display text-xl font-black text-white">Module temporairement restreint</h2>
          <p className="mt-2 max-w-md text-sm text-amber-300 font-medium">
            {blockCheck.reason}
          </p>
          <p className="mt-2 max-w-sm text-xs text-slate-400">
            L'accès à cette section est suspendu par la direction administrative. Les tentatives d'accès direct par URL sont systématiquement interceptées.
          </p>
        </div>
      );
    }
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
      <IntroSplash />
      <HashRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/formations" element={<FormationsPage />} />
              <Route path="/tarifs" element={<TarifsPage />} />
              <Route path="/pre-inscription" element={<PreInscriptionPage />} />
              <Route path="/connexion" element={<LoginPage />} />
              <Route path="/activer-compte" element={<AccountActivationPage />} />
              <Route path="/acces-formateur" element={<TeacherAccessPage />} />
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
              <Route index element={<RoleDashboard />} />
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
              <Route path="presences" element={<Gate roles={["superadmin", "admin", "teacher"]} moduleKey="presences"><AttendancePage /></Gate>} />
              <Route path="cours" element={<Gate roles={["superadmin", "admin", "teacher"]} moduleKey="cours"><CoursesPage /></Gate>} />
              <Route path="evaluations-devoirs" element={<Gate roles={["superadmin", "admin", "teacher"]} moduleKey="evaluations"><UnifiedAssessmentsAssignmentsPage /></Gate>} />
              <Route path="devoirs" element={<Gate roles={["superadmin", "admin", "teacher"]} moduleKey="evaluations"><TeacherSubmissions /></Gate>} />
              <Route path="qr-scanner" element={<Gate roles={["superadmin", "admin", "teacher"]} moduleKey="presences"><QrScannerPage /></Gate>} />
              <Route path="mes-cours" element={<Gate roles={["teacher", "student"]} moduleKey="cours"><MyCoursesRoute /></Gate>} />
              <Route path="mes-evaluations-devoirs" element={<Gate roles={["student"]} moduleKey="evaluations"><UnifiedStudentAssessmentsAssignmentsPage /></Gate>} />
              <Route path="mes-devoirs" element={<Gate roles={["student"]} moduleKey="evaluations"><StudentSubmission /></Gate>} />
              <Route path="tests" element={<Navigate to="/app/evaluations-devoirs" replace />} />
              <Route path="evaluations" element={<Navigate to="/app/evaluations-devoirs" replace />} />
              <Route path="mes-evaluations" element={<Gate roles={["student"]} moduleKey="evaluations"><UnifiedStudentAssessmentsAssignmentsPage defaultTab="tests" /></Gate>} />
              <Route path="notes" element={<Gate roles={["superadmin", "admin", "teacher"]} moduleKey="evaluations"><GradesPage /></Gate>} />
              <Route path="paiements" element={<Gate roles={["superadmin", "admin"]} moduleKey="finances"><PaymentsPage /></Gate>} />
              <Route path="certificats" element={<Gate roles={["superadmin", "admin", "partner_admin"]}><CertificatesPage /></Gate>} />
              <Route path="bourses" element={<Gate roles={["superadmin", "admin", "partner_admin"]}><ScholarshipsPage /></Gate>} />
              <Route path="enia" element={<Gate roles={["superadmin", "admin", "partner_admin", "partner", "teacher", "student"]} moduleKey="ia"><EniaPage /></Gate>} />
              <Route path="enia-admin" element={<Gate roles={["superadmin", "admin"]} moduleKey="ia"><EniaAdminPage /></Gate>} />
              <Route path="sentinel-ai-admin" element={<Gate roles={["superadmin", "admin"]} moduleKey="ia"><SentinelAiAdminPage /></Gate>} />
              <Route path="messages" element={<Gate roles={["superadmin", "admin", "teacher", "student"]} moduleKey="messages"><MessageCenter /></Gate>} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="utilisateurs" element={<Gate roles={["superadmin"]}><UsersPage /></Gate>} />
              <Route path="contenu" element={<Gate roles={["superadmin", "admin"]}><ContentEditor /></Gate>} />
              <Route path="avantages" element={<Navigate to="/app/contenu" replace />} />
              <Route path="partenaires" element={<Navigate to="/app/contenu" replace />} />
              <Route path="annonces" element={<Navigate to="/app/contenu" replace />} />
              <Route path="initialisation" element={<Gate roles={["superadmin"]}><InitializationPage /></Gate>} />
              <Route path="journal" element={<Gate roles={["superadmin", "admin"]}><JournalPage /></Gate>} />
              <Route path="rapports" element={<Gate roles={["superadmin", "admin", "partner_admin"]}><ReportsPage /></Gate>} />
              <Route path="parametres" element={<Gate roles={["superadmin", "admin"]}><ParametresPage /></Gate>} />
              <Route path="mes-classes" element={<Gate roles={["teacher"]}><TeacherClasses /></Gate>} />
              <Route path="mes-apprenants" element={<Gate roles={["teacher"]}><TeacherStudents /></Gate>} />
              <Route path="profil" element={<UnifiedProfilePage />} />
              <Route path="mon-profil-formateur" element={<Gate roles={["teacher"]}><TeacherProfile /></Gate>} />
              <Route path="mon-profil" element={<Gate roles={["student"]}><StudentProfile /></Gate>} />
              <Route path="ma-formation" element={<Gate roles={["student"]}><MyFormation /></Gate>} />
              <Route path="mes-modules" element={<Gate roles={["student"]}><MyModules /></Gate>} />
              <Route path="mes-formateurs" element={<Gate roles={["student"]}><MyTeachers /></Gate>} />
              <Route path="mes-documents" element={<Gate roles={["student"]}><MyDocuments /></Gate>} />
              <Route path="mes-presences" element={<Gate roles={["student"]}><MyAttendance /></Gate>} />
              <Route path="mes-notes" element={<Gate roles={["student"]}><MyGrades /></Gate>} />
              <Route path="mes-paiements" element={<Gate roles={["student"]}><MyPayments /></Gate>} />
              <Route path="etudiant/finances" element={<Gate roles={["student"]}><MyPayments /></Gate>} />
              <Route path="mon-certificat" element={<Gate roles={["student"]}><MyCertificate /></Gate>} />
              <Route path="ma-bourse" element={<Gate roles={["student"]}><MyScholarship /></Gate>} />
              <Route path="finances" element={<Navigate to="/app/paiements" replace />} />
              <Route path="messagerie" element={<Navigate to="/app/messages" replace />} />
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </StoreProvider>
  );
}
