import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getPublicErrorMessage } from "@/lib/publicErrors";
import { Loader2 } from "lucide-react";
import logoAgroX from "@/assets/agro-x-logo.png";


const Login = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    confirmPassword: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const email = formData.email.trim();
    const password = formData.password;

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        // Try to ensure base rows exist for users (roles/compliance),
        // but do not block login if this background bootstrap fails.
        const [{ error: e1 }, { error: e2 }] = await Promise.all([
          supabase.rpc('ensure_current_user_row'),
          supabase.rpc('ensure_user_compliance_rows'),
        ]);
        if (e1 || e2) {
          console.warn('Post-login bootstrap warning:', { e1, e2 });
        }

        toast({
          title: t('success'),
          description: t('login') + ' ' + t('success').toLowerCase(),
        });

        navigate('/dashboard');
        return;
      }

      if (password !== formData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
          },
        },
      });
      if (error) throw error;

      toast({
        title: t('success'),
        description: 'Account created! Please check your email to verify.',
      });

      setFormData((prev) => ({
        ...prev,
        password: '',
        confirmPassword: '',
      }));
      setIsLogin(true);
    } catch (err: unknown) {
      // Avoid leaking internal error details to end users
      console.error(err);

      // Preserve local validation message
      const message =
        typeof err === "object" && err && "message" in err && String((err as any).message) === "Passwords do not match"
          ? "Passwords do not match"
          : getPublicErrorMessage(err, t);

      toast({
        title: t("error"),
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="mb-4 text-center">
          <img
            src={logoAgroX}
            alt="AGRO-X CONTROL"
            className="mx-auto h-10 w-auto"
            loading="eager"
            decoding="async"
          />
          <p className="mt-2 text-xs font-semibold tracking-wide text-muted-foreground">
            AGRO-X CONTROL
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
            {isLogin ? t("login") : t("signup")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("appTagline")}
          </p>
        </div>

        <Card className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t("firstName")}</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required={!isLogin}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{t("lastName")}</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required={!isLogin}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLogin ? t("login") : t("signup")}
            </Button>
          </form>

          <div className="mt-5 text-center text-sm">
            {isLogin ? (
              <p>
                {t("dontHaveAccount")} {" "}
                <button
                  type="button"
                  onClick={() => setIsLogin(false)}
                  className="text-primary hover:underline font-semibold"
                >
                  {t("signUpHere")}
                </button>
              </p>
            ) : (
              <p>
                {t("alreadyHaveAccount")} {" "}
                <button
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className="text-primary hover:underline font-semibold"
                >
                  {t("signInHere")}
                </button>
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Login;
