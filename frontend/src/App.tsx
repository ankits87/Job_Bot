import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import AuthGuard from "./components/AuthGuard";
import Landing from "./pages/Landing";
import Onboarding from "./pages/Onboarding";
import ResumeUpload from "./pages/ResumeUpload";
import JobList from "./pages/JobList";
import JobConfirmation from "./pages/JobConfirmation";
import ApplicationStatus from "./pages/ApplicationStatus";
import Profile from "./pages/Profile";

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />

      {/* Requires login */}
      <Route element={<AuthGuard />}>
        {/* Post-login onboarding flow — no layout chrome */}
        <Route path="/resume" element={<ResumeUpload />} />
        <Route path="/onboarding" element={<Onboarding />} />

        {/* Main app with layout */}
        <Route element={<Layout />}>
          <Route path="/profile" element={<Profile />} />
          <Route path="/jobs" element={<JobList />} />
          <Route path="/confirm" element={<JobConfirmation />} />
          <Route path="/applications" element={<ApplicationStatus />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
