import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/hooks/useLanguage";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import SuperAdminRoute from "@/components/SuperAdminRoute";
import CoordinatorRoute from "@/components/CoordinatorRoute";
import LanguageSelect from "./pages/LanguageSelect";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Activity from "./pages/Activity";
import CloseActivity from "./pages/CloseActivity";
import Maintenance from "./pages/Maintenance";
import Damages from "./pages/Damages";
import Fuel from "./pages/Fuel";
import Orders from "./pages/Orders";
import Support from "./pages/Support";
import MyDocuments from "./pages/MyDocuments";
import AdminApprovals from "./pages/AdminApprovals";
import AdminActivitiesValidation from "./pages/AdminActivitiesValidation";
import AdminUsers from "./pages/AdminUsers";
import AdminMachines from "./pages/AdminMachines";
import AdminMasterData from "./pages/AdminMasterData";
import RolesAudit from "./pages/RolesAudit";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LanguageProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LanguageSelect />} />
            <Route path="/login" element={<Login />} />

            {/* Coordinator entry route (avoid 404 when users bookmark /coordinator) */}
            <Route
              path="/coordinator"
              element={
                <CoordinatorRoute>
                  <Navigate to="/admin/approvals" replace />
                </CoordinatorRoute>
              }
            />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/activity"
              element={
                <ProtectedRoute>
                  <Activity />
                </ProtectedRoute>
              }
            />
            <Route
              path="/activity/close"
              element={
                <ProtectedRoute>
                  <CloseActivity />
                </ProtectedRoute>
              }
            />
            <Route
              path="/maintenance"
              element={
                <ProtectedRoute>
                  <Maintenance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/damages"
              element={
                <ProtectedRoute>
                  <Damages />
                </ProtectedRoute>
              }
            />
            <Route
              path="/fuel"
              element={
                <ProtectedRoute>
                  <Fuel />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <ProtectedRoute>
                  <Orders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/support"
              element={
                <ProtectedRoute>
                  <Support />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-documents"
              element={
                <ProtectedRoute>
                  <MyDocuments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/approvals"
              element={
                <CoordinatorRoute>
                  <AdminApprovals />
                </CoordinatorRoute>
              }
            />
            <Route
              path="/admin/activities"
              element={
                <AdminRoute>
                  <AdminActivitiesValidation />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/master-data"
              element={
                <AdminRoute>
                  <AdminMasterData />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <SuperAdminRoute>
                  <AdminUsers />
                </SuperAdminRoute>
              }
            />
            <Route
              path="/admin/roles-audit"
              element={
                <SuperAdminRoute>
                  <RolesAudit />
                </SuperAdminRoute>
              }
            />
            <Route
              path="/admin/dashboard"
              element={
                <SuperAdminRoute>
                  <SuperAdminDashboard />
                </SuperAdminRoute>
              }
            />
            <Route
              path="/admin/machines"
              element={
                <SuperAdminRoute>
                  <AdminMachines />
                </SuperAdminRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
