import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface CoordinatorRouteProps {
  children: React.ReactNode;
}

const CoordinatorRoute = ({ children }: CoordinatorRouteProps) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [allowed, setAllowed] = useState(false);

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
        setAllowed(false);
        setLoading(false);
        return;
      }

      const userId = session!.user.id;
      const { data, error } = await supabase.rpc("is_coordenador_or_above", { _user_id: userId });
      if (cancelled) return;

      setAllowed(!error && !!data);
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
  if (!allowed) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

export default CoordinatorRoute;
