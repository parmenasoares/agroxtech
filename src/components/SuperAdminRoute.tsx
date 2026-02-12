import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface SuperAdminRouteProps {
  children: React.ReactNode;
}

const SuperAdminRoute = ({ children }: SuperAdminRouteProps) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const authed = !!session;
      if (cancelled) return;

      setAuthenticated(authed);
      if (!authed) {
        setIsSuperAdmin(false);
        setLoading(false);
        return;
      }

      const userId = session!.user.id;
      const { data, error } = await supabase.rpc("is_user_role", {
        _user_id: userId,
        _role: "SUPER_ADMIN",
      });

      if (cancelled) return;
      setIsSuperAdmin(!error && !!data);
      setLoading(false);
    };

    check();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      check();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!authenticated) return <Navigate to="/login" replace />;
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

export default SuperAdminRoute;
