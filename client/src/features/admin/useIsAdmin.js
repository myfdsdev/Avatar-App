import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/services/admin.api";
import { useAuth } from "@/store/auth.store";

/**
 * Whether the signed-in user is a platform admin. Only decides what to show -
 * the server checks again on every admin request.
 */
export function useIsAdmin() {
  const signedIn = useAuth((s) => Boolean(s.accessToken));
  const { data = false, isLoading } = useQuery({
    queryKey: ["admin-access"],
    queryFn: adminApi.access,
    enabled: signedIn,
    staleTime: 5 * 60 * 1000,
  });
  return { isAdmin: data, isLoading: signedIn && isLoading };
}
