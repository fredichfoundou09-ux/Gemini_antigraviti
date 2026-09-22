import React from "react";
import { AssignmentsManagementPage } from "@/modules/assignments/pages/AssignmentsManagementPage";
import { StudentAssignmentsPage } from "@/modules/assignments/pages/StudentAssignmentsPage";

export function TeacherSubmissions() {
  return <AssignmentsManagementPage />;
}

export function StudentSubmission() {
  return <StudentAssignmentsPage />;
}
