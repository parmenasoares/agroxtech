import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";
import logoAgroX from "@/assets/agro-x-logo.png";
import {
  Cog,
  Database,
  LogOut,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";


type Props = {
  userName: string;
  userEmail: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  onNavigate: (path: string) => void;
  onLogout: () => void;
};

const DashboardHeader = ({
  userName,
  userEmail,
  isAdmin,
  isSuperAdmin,
  onNavigate,
  onLogout,
}: Props) => {
  const { t } = useLanguage();

  return (
    <header className="border-b bg-card sticky top-0 z-10">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <img
              src={logoAgroX}
              alt="AGRO-X CONTROL"
              className="h-7 w-auto shrink-0"
              loading="eager"
              decoding="async"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground">
                AGRO-X CONTROL
              </p>
              <h1 className="text-xl sm:text-2xl font-bold leading-tight">
                {t("appTitle")}
              </h1>
            </div>
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {t("welcomeBack")}
            {userName ? `, ${userName}` : ""}
          </p>
          {!!userEmail && (
            <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {isSuperAdmin && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="hidden sm:inline-flex"
                onClick={() => onNavigate("/admin/dashboard")}
                aria-label="Super admin dashboard"
              >
                <TrendingUp className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="hidden sm:inline-flex"
                onClick={() => onNavigate("/admin/machines")}
                aria-label="Máquinas"
              >
                <Cog className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="hidden sm:inline-flex"
                onClick={() => onNavigate("/admin/users")}
                aria-label={t("userManagement")}
              >
                <ShieldCheck className="h-5 w-5" />
              </Button>
            </>
          )}

          {isAdmin && (
            <Button
              variant="outline"
              size="icon"
              className="hidden sm:inline-flex"
              onClick={() => onNavigate("/admin/master-data")}
              aria-label="Cadastros"
            >
              <Database className="h-5 w-5" />
            </Button>
          )}

          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="h-5 w-5" />
            <span className="ml-2 hidden sm:inline">{t("logout")}</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
