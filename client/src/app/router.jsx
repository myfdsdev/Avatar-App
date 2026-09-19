import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import RequireAuth from "./RequireAuth";
import SignIn from "@/features/auth/SignIn";
import Home from "@/features/dashboard/Home";
import AvatarList from "@/features/avatars/AvatarList";
import AvatarStudio from "@/features/studio/AvatarStudio";
import CallRoom from "@/features/call/CallRoom";
import Usage from "@/features/analytics/Usage";
import DesignPreview from "@/features/_design/DesignPreview";

/**
 * Signed-in pages live inside the shell; sign-in and the call room do not.
 *
 * The call room is deliberately outside: a call wants the whole window, and a
 * sidebar during one is navigation nobody is going to use.
 */
const app = (element) => (
  <RequireAuth>
    <AppShell>{element}</AppShell>
  </RequireAuth>
);

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<SignIn mode="login" />} />
      <Route path="/register" element={<SignIn mode="register" />} />

      <Route path="/" element={app(<Home />)} />
      <Route path="/avatars" element={app(<AvatarList />)} />
      <Route path="/studio" element={app(<AvatarStudio />)} />
      <Route path="/analytics" element={app(<Usage />)} />

      <Route
        path="/call/:avatarId"
        element={
          <RequireAuth>
            <CallRoom />
          </RequireAuth>
        }
      />

      {/* Reference surface for the design system; not part of the product. */}
      <Route path="/_design" element={<DesignPreview />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
