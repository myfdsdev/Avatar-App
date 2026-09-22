import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import RequireAuth from "./RequireAuth";
import SignIn from "@/features/auth/SignIn";
import Home from "@/features/dashboard/Home";
import AvatarList from "@/features/avatars/AvatarList";
import AvatarDetail from "@/features/avatars/AvatarDetail";
import AvatarCreator from "@/features/studio/AvatarCreator";
import CallRoom from "@/features/call/CallRoom";
import TalkPage from "@/features/talk/TalkPage";
import Usage from "@/features/analytics/Usage";
import ConversationList from "@/features/conversations/ConversationList";
import ConversationDetail from "@/features/conversations/ConversationDetail";
import DesignPreview from "@/features/_design/DesignPreview";

/**
 * Signed-in pages live inside the shell; sign-in, the avatar creator and the
 * call room do not.
 *
 * The creator and the call room are deliberately outside: each wants the whole
 * window, and a sidebar beside them is navigation nobody is going to use.
 */
const app = (element, { wide = false } = {}) => (
  <RequireAuth>
    <AppShell wide={wide}>{element}</AppShell>
  </RequireAuth>
);

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<SignIn mode="login" />} />
      <Route path="/register" element={<SignIn mode="register" />} />

      {/* Public: anyone with an avatar's share link, no account needed. */}
      <Route path="/talk/:token" element={<TalkPage />} />

      <Route path="/" element={app(<Home />, { wide: true })} />
      <Route path="/avatars" element={app(<AvatarList />)} />
      <Route path="/avatars/:id" element={app(<AvatarDetail />, { wide: true })} />
      <Route
        path="/studio"
        element={
          <RequireAuth>
            <AvatarCreator />
          </RequireAuth>
        }
      />
      <Route path="/analytics" element={app(<Usage />)} />
      <Route path="/conversations" element={app(<ConversationList />)} />
      <Route path="/conversations/:id" element={app(<ConversationDetail />)} />

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
