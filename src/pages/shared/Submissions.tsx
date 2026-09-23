import React from "react";
import { UnifiedAssessmentsAssignmentsPage } from "@/modules/unified-assessments/pages/UnifiedAssessmentsAssignmentsPage";
import { UnifiedStudentAssessmentsAssignmentsPage } from "@/modules/unified-assessments/pages/UnifiedStudentAssessmentsAssignmentsPage";

export function TeacherSubmissions() {
  return <UnifiedAssessmentsAssignmentsPage defaultTab="devoirs" />;
}

export function StudentSubmission() {
  return <UnifiedStudentAssessmentsAssignmentsPage defaultTab="devoirs" />;
}
