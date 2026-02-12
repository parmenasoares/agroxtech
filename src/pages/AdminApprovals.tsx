import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Constants } from "@/integrations/supabase/types";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/hooks/use-toast";
import { getPublicErrorMessage } from "@/lib/publicErrors";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { BrandMark } from "@/components/BrandMark";

import { ArrowLeft, ExternalLink, Loader2, ThumbsDown, ThumbsUp } from "lucide-react";


type DocType = (typeof Constants.public.Enums.document_type)[number];

type PendingRow = {
  user_id: string;
  status: "PENDING";
  submitted_at: string | null;
};

type UserRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
};

type ComplianceRow = {
  nif_last4: string | null;
  niss_last4: string | null;
  iban_last4: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
};

type DocumentFileRow = {
  doc_type: DocType;
  storage_path: string;
  file_name: string | null;
  created_at: string;
};

const AdminApprovals = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loadingList, setLoadingList] = useState(true);
  const [pending, setPending] = useState<PendingRow[]>([]);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [user, setUser] = useState<UserRow | null>(null);
  const [compliance, setCompliance] = useState<ComplianceRow | null>(null);
  const [docs, setDocs] = useState<DocumentFileRow[]>([]);
  const [reviewNotes, setReviewNotes] = useState("");
  const [deciding, setDeciding] = useState<"APPROVE" | "REJECT" | null>(null);

  const docTypes = useMemo(() => [...Constants.public.Enums.document_type] as DocType[], []);

  const loadList = async () => {
    setLoadingList(true);
    try {
      const { data, error } = await supabase
        .from("user_verifications")
        .select("user_id,status,submitted_at")
        .eq("status", "PENDING")
        .order("submitted_at", { ascending: false, nullsFirst: false });

      if (error) throw error;
      setPending((data as any) ?? []);

      if (!selectedUserId && data?.[0]?.user_id) {
        setSelectedUserId(data[0].user_id);
      }
    } catch (err: any) {
      console.error(err);
      toast({
        title: t("error"),
        description: getPublicErrorMessage(err, t),
        variant: "destructive",
      });
    } finally {
      setLoadingList(false);
    }
  };

  const loadDetail = async (uid: string) => {
    setLoadingDetail(true);
    setUser(null);
    setCompliance(null);
    setDocs([]);
    setReviewNotes("");

    try {
      const [userRes, complianceRes, docsRes] = await Promise.all([
        supabase.from("users").select("id,email,first_name,last_name").eq("id", uid).maybeSingle(),
        supabase
          .from("user_compliance")
          .select("nif_last4,niss_last4,iban_last4,address_line1,address_line2,city,postal_code,country")
          .eq("user_id", uid)
          .maybeSingle(),
        supabase.from("user_document_files").select("doc_type,storage_path,file_name,created_at").eq("user_id", uid),
      ]);

      if (userRes.error) throw userRes.error;
      if (complianceRes.error) throw complianceRes.error;
      if (docsRes.error) throw docsRes.error;

      setUser((userRes.data as any) ?? null);
      setCompliance((complianceRes.data as any) ?? null);
      setDocs(((docsRes.data as any) ?? []) as DocumentFileRow[]);
    } catch (err: any) {
      console.error(err);
      toast({
        title: t("error"),
        description: getPublicErrorMessage(err, t),
        variant: "destructive",
      });
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      loadDetail(selectedUserId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId]);

  const openSignedUrl = async (path: string) => {
    try {
      const { data, error } = await supabase.storage.from("user-documents").createSignedUrl(path, 60);
      if (error) throw error;
      if (!data?.signedUrl) throw new Error("signed_url_missing");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      console.error(err);
      toast({ title: t("error"), description: getPublicErrorMessage(err, t), variant: "destructive" });
    }
  };

  const decide = async (status: "APPROVED" | "REJECTED") => {
    if (!selectedUserId || deciding) return;
    if (status === "REJECTED" && reviewNotes.trim().length === 0) {
      toast({ title: t("error"), description: t("rejectionNotesRequired"), variant: "destructive" });
      return;
    }

    setDeciding(status === "APPROVED" ? "APPROVE" : "REJECT");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("not_authenticated");

      const { error } = await supabase
        .from("user_verifications")
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          reviewed_by: session.user.id,
          review_notes: reviewNotes.trim() || null,
        })
        .eq("user_id", selectedUserId);

      if (error) throw error;

      toast({ title: t("success"), description: status === "APPROVED" ? t("verificationApproved") : t("verificationRejected") });

      // Refresh list + clear selection if it disappeared
      await loadList();
      setSelectedUserId((prev) => {
        const stillThere = pending.some((p) => p.user_id === prev);
        if (!stillThere) return null;
        return prev;
      });

      // Reload detail if still selected
      if (selectedUserId) {
        await loadDetail(selectedUserId);
      }
    } catch (err: any) {
      console.error(err);
      toast({ title: t("error"), description: getPublicErrorMessage(err, t), variant: "destructive" });
    } finally {
      setDeciding(null);
    }
  };

  const docsByType = useMemo(() => {
    const map = new Map<DocType, DocumentFileRow>();
    for (const d of docs) map.set(d.doc_type, d);
    return map;
  }, [docs]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} aria-label="Back to dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <BrandMark />
            <div>
              <h1 className="text-2xl font-bold">{t("approvals")}</h1>
              <p className="text-sm text-muted-foreground">{t("approvalsDesc")}</p>
            </div>
          </div>

          <Button variant="outline" onClick={loadList} disabled={loadingList}>
            {loadingList && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("refresh")}
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-4 lg:col-span-1">
            <h2 className="font-semibold">{t("pendingApprovals")}</h2>
            <p className="text-sm text-muted-foreground">{t("pendingApprovalsHint")}</p>
            <Separator className="my-4" />

            {loadingList ? (
              <div className="animate-pulse text-muted-foreground">{t("loading")}</div>
            ) : pending.length === 0 ? (
              <div className="text-sm text-muted-foreground">{t("noPendingVerifications")}</div>
            ) : (
              <div className="space-y-2">
                {pending.map((p) => (
                  <Button
                    key={p.user_id}
                    variant={selectedUserId === p.user_id ? "default" : "outline"}
                    className="w-full justify-start"
                    onClick={() => setSelectedUserId(p.user_id)}
                  >
                    <span className="truncate">{p.user_id}</span>
                  </Button>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6 lg:col-span-2">
            {!selectedUserId ? (
              <div className="text-sm text-muted-foreground">{t("selectUser")}</div>
            ) : loadingDetail ? (
              <div className="animate-pulse text-muted-foreground">{t("loading")}</div>
            ) : (
              <div className="space-y-6">
                <section>
                  <h2 className="text-lg font-semibold">{t("user")}</h2>
                  <p className="text-sm text-muted-foreground">
                    {(user?.first_name || user?.last_name)
                      ? `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim()
                      : user?.email ?? selectedUserId}
                  </p>
                  {!!user?.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
                </section>

                <Separator />

                <section>
                  <h2 className="text-lg font-semibold">{t("complianceData")}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div>
                      <p className="text-xs text-muted-foreground">NIF</p>
                      <p className="text-sm font-medium">{compliance?.nif_last4 ? `••••${compliance.nif_last4}` : "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">NISS</p>
                      <p className="text-sm font-medium">{compliance?.niss_last4 ? `••••${compliance.niss_last4}` : "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">IBAN</p>
                      <p className="text-sm font-medium">{compliance?.iban_last4 ? `••••${compliance.iban_last4}` : "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("country")}</p>
                      <p className="text-sm font-medium">{compliance?.country ?? "-"}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-xs text-muted-foreground">{t("address")}</p>
                      <p className="text-sm font-medium">
                        {[
                          compliance?.address_line1,
                          compliance?.address_line2,
                          compliance?.postal_code,
                          compliance?.city,
                        ]
                          .filter(Boolean)
                          .join(", ") || "-"}
                      </p>
                    </div>
                  </div>
                </section>

                <Separator />

                <section>
                  <h2 className="text-lg font-semibold">{t("documents")}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    {docTypes.map((dt) => {
                      const row = docsByType.get(dt);
                      return (
                        <Card key={dt} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold">{dt}</p>
                              <p className="text-xs text-muted-foreground truncate">{row?.file_name ?? t("notUploaded")}</p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => row?.storage_path && openSignedUrl(row.storage_path)}
                              disabled={!row?.storage_path}
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              {t("open")}
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </section>

                <Separator />

                <section className="space-y-3">
                  <h2 className="text-lg font-semibold">{t("decision")}</h2>
                  <div className="space-y-2">
                    <Label htmlFor="reviewNotes">{t("reviewNotes")}</Label>
                    <Input
                      id="reviewNotes"
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder={t("reviewNotesPlaceholder")}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button onClick={() => decide("APPROVED")} disabled={!!deciding} className="sm:flex-1">
                      {deciding === "APPROVE" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ThumbsUp className="mr-2 h-4 w-4" />
                      )}
                      {t("approve")}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => decide("REJECTED")}
                      disabled={!!deciding}
                      className="sm:flex-1"
                    >
                      {deciding === "REJECT" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ThumbsDown className="mr-2 h-4 w-4" />
                      )}
                      {t("reject")}
                    </Button>
                  </div>
                </section>
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AdminApprovals;
