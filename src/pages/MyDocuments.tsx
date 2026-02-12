import { useEffect, useMemo, useRef, useState } from "react";
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

import { ArrowLeft, FileUp, Loader2, Trash2 } from "lucide-react";


type DocType = (typeof Constants.public.Enums.document_type)[number];

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

type VerificationRow = {
  status: "PENDING" | "APPROVED" | "REJECTED";
  submitted_at: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
};

type DocumentFileRow = {
  doc_type: DocType;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

const MAX_BYTES = 10 * 1024 * 1024;

function isAllowedMime(file: File) {
  return file.type === "application/pdf" || file.type.startsWith("image/");
}

const MyDocuments = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingDocType, setUploadingDocType] = useState<DocType | null>(null);
  const [removingDocType, setRemovingDocType] = useState<DocType | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [compliance, setCompliance] = useState<ComplianceRow>({
    nif_last4: null,
    niss_last4: null,
    iban_last4: null,
    address_line1: null,
    address_line2: null,
    city: null,
    postal_code: null,
    country: null,
  });

  // Sensitive fields are never read back from the database (only entered and encrypted on save)
  const [pii, setPii] = useState<{ nif: string; niss: string; iban: string }>({
    nif: "",
    niss: "",
    iban: "",
  });
  const [verification, setVerification] = useState<VerificationRow | null>(null);
  const [docs, setDocs] = useState<Record<string, DocumentFileRow>>({});

  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const docTypes = useMemo(() => {
    return [...Constants.public.Enums.document_type] as DocType[];
  }, []);

  const reload = async (uid: string) => {
    const [complianceRes, verificationRes, docsRes] = await Promise.all([
      supabase
        .from("user_compliance")
        .select("nif_last4,niss_last4,iban_last4,address_line1,address_line2,city,postal_code,country")
        .eq("user_id", uid)
        .maybeSingle(),
      supabase.from("user_verifications").select("status,submitted_at,reviewed_at,review_notes").eq("user_id", uid).maybeSingle(),
      supabase.from("user_document_files").select("doc_type,storage_path,file_name,mime_type,size_bytes,created_at").eq("user_id", uid),
    ]);

    if (complianceRes.error) throw complianceRes.error;
    if (verificationRes.error) throw verificationRes.error;
    if (docsRes.error) throw docsRes.error;

    setCompliance((prev) => ({
      ...prev,
      ...(complianceRes.data ?? {}),
    }));

    setVerification((verificationRes.data as any) ?? null);

    const map: Record<string, DocumentFileRow> = {};
    for (const row of docsRes.data ?? []) {
      map[row.doc_type] = row as any;
    }
    setDocs(map);
  };

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          navigate("/login", { replace: true });
          return;
        }

        const uid = session.user.id;
        if (cancelled) return;

        setUserId(uid);

        // Ensure base rows exist
        const [{ error: e1 }, { error: e2 }] = await Promise.all([
          supabase.rpc("ensure_current_user_row"),
          supabase.rpc("ensure_user_compliance_rows"),
        ]);
        if (e1) throw e1;
        if (e2) throw e2;

        await reload(uid);
      } catch (err: any) {
        console.error(err);
        toast({
          title: t("error"),
          description: getPublicErrorMessage(err, t),
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [navigate, t, toast]);

  const onSaveCompliance = async () => {
    if (!userId || saving) return;
    setSaving(true);
    try {
      // Save PII via backend function (encrypted at rest)
      const { error } = await supabase.functions.invoke("compliance-upsert", {
        body: {
          nif: pii.nif,
          niss: pii.niss,
          iban: pii.iban,
          address_line1: compliance.address_line1,
          address_line2: compliance.address_line2,
          city: compliance.city,
          postal_code: compliance.postal_code,
          country: compliance.country,
        },
      });
      if (error) throw error;

      toast({ title: t("success"), description: t("saved") });
      setPii({ nif: "", niss: "", iban: "" });
      await reload(userId);
    } catch (err: any) {
      console.error(err);
      toast({ title: t("error"), description: getPublicErrorMessage(err, t), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePickFile = (docType: DocType) => {
    fileInputs.current[docType]?.click();
  };

  const removeDoc = async (docType: DocType) => {
    if (!userId || removingDocType) return;
    const existing = docs[docType];
    if (!existing) return;

    setRemovingDocType(docType);
    try {
      // Delete storage object first
      const { error: storageErr } = await supabase.storage.from("user-documents").remove([existing.storage_path]);
      if (storageErr) throw storageErr;

      // Delete metadata row
      const { error: metaErr } = await supabase
        .from("user_document_files")
        .delete()
        .eq("user_id", userId)
        .eq("doc_type", docType);
      if (metaErr) throw metaErr;

      toast({ title: t("success"), description: t("removed") });
      await reload(userId);
    } catch (err: any) {
      console.error(err);
      toast({ title: t("error"), description: getPublicErrorMessage(err, t), variant: "destructive" });
    } finally {
      setRemovingDocType(null);
    }
  };

  const uploadDoc = async (docType: DocType, file: File) => {
    if (!userId) return;

    if (file.size > MAX_BYTES) {
      toast({ title: t("error"), description: t("fileTooLarge"), variant: "destructive" });
      return;
    }
    if (!isAllowedMime(file)) {
      toast({ title: t("error"), description: t("fileTypeNotAllowed"), variant: "destructive" });
      return;
    }

    setUploadingDocType(docType);

    try {
      const existing = docs[docType];
      if (existing?.storage_path) {
        // best-effort delete old object to prevent orphans
        await supabase.storage.from("user-documents").remove([existing.storage_path]);
      }

      const safeName = file.name.replace(/\s+/g, "-");
      const path = `${userId}/${docType}/${crypto.randomUUID()}-${safeName}`;

      const { error: uploadErr } = await supabase.storage.from("user-documents").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (uploadErr) throw uploadErr;

      const { error: metaErr } = await supabase.from("user_document_files").upsert(
        {
          user_id: userId,
          doc_type: docType as any,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
        },
        { onConflict: "user_id,doc_type" },
      );
      if (metaErr) throw metaErr;

      toast({ title: t("success"), description: t("uploaded") });
      await reload(userId);
    } catch (err: any) {
      console.error(err);
      toast({ title: t("error"), description: getPublicErrorMessage(err, t), variant: "destructive" });
    } finally {
      setUploadingDocType(null);
    }
  };

  const submitForApproval = async () => {
    if (!userId || submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("user_verifications")
        .update({
          status: "PENDING",
          submitted_at: new Date().toISOString(),
          reviewed_at: null,
          reviewed_by: null,
          review_notes: null,
        })
        .eq("user_id", userId);

      if (error) throw error;

      toast({ title: t("success"), description: t("submitted") });
      await reload(userId);
    } catch (err: any) {
      console.error(err);
      toast({ title: t("error"), description: getPublicErrorMessage(err, t), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">{t("loading")}</div>
      </div>
    );
  }

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
              <h1 className="text-2xl font-bold">{t("myDocuments")}</h1>
              <p className="text-sm text-muted-foreground">{t("complianceAndUploads")}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold">{t("complianceData")}</h2>
          <p className="text-sm text-muted-foreground">{t("complianceDataDesc")}</p>

          <Separator className="my-5" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nif">NIF</Label>
                <Input
                  id="nif"
                  value={pii.nif}
                  placeholder={compliance.nif_last4 ? `••••${compliance.nif_last4}` : ""}
                  onChange={(e) => setPii((p) => ({ ...p, nif: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="niss">NISS</Label>
                <Input
                  id="niss"
                  value={pii.niss}
                  placeholder={compliance.niss_last4 ? `••••${compliance.niss_last4}` : ""}
                  onChange={(e) => setPii((p) => ({ ...p, niss: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="iban">IBAN</Label>
                <Input
                  id="iban"
                  value={pii.iban}
                  placeholder={compliance.iban_last4 ? `••••${compliance.iban_last4}` : ""}
                  onChange={(e) => setPii((p) => ({ ...p, iban: e.target.value }))}
                />
              </div>
            <div className="space-y-2">
              <Label htmlFor="country">{t("country")}</Label>
              <Input id="country" value={compliance.country ?? ""} onChange={(e) => setCompliance((p) => ({ ...p, country: e.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address1">{t("addressLine1")}</Label>
              <Input id="address1" value={compliance.address_line1 ?? ""} onChange={(e) => setCompliance((p) => ({ ...p, address_line1: e.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address2">{t("addressLine2")}</Label>
              <Input id="address2" value={compliance.address_line2 ?? ""} onChange={(e) => setCompliance((p) => ({ ...p, address_line2: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postal">{t("postalCode")}</Label>
              <Input id="postal" value={compliance.postal_code ?? ""} onChange={(e) => setCompliance((p) => ({ ...p, postal_code: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">{t("city")}</Label>
              <Input id="city" value={compliance.city ?? ""} onChange={(e) => setCompliance((p) => ({ ...p, city: e.target.value }))} />
            </div>
          </div>

          <div className="mt-5">
            <Button onClick={onSaveCompliance} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("save")}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">{t("documents")}</h2>
          <p className="text-sm text-muted-foreground">{t("documentsDesc")}</p>

          <Separator className="my-5" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {docTypes.map((docType) => {
              const existing = docs[docType];
              const busy = uploadingDocType === docType || removingDocType === docType;

              return (
                <Card key={docType} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold">{docType}</p>
                      <p className="text-sm text-muted-foreground">
                        {existing
                          ? `${t("uploadedAt")} ${new Date(existing.created_at).toLocaleDateString()}`
                          : t("notUploaded")}
                      </p>
                      {existing?.file_name && <p className="text-xs text-muted-foreground truncate">{existing.file_name}</p>}
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <input
                        ref={(el) => {
                          fileInputs.current[docType] = el;
                        }}
                        type="file"
                        className="hidden"
                        accept="application/pdf,image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          // allow re-selecting same file later
                          e.currentTarget.value = "";
                          uploadDoc(docType, f);
                        }}
                      />

                      <Button variant="outline" onClick={() => handlePickFile(docType)} disabled={busy}>
                        {uploadingDocType === docType ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <FileUp className="mr-2 h-4 w-4" />
                        )}
                        {existing ? t("replace") : t("upload")}
                      </Button>

                      <Button
                        variant="ghost"
                        onClick={() => removeDoc(docType)}
                        disabled={!existing || busy}
                        aria-label={t("remove")}
                      >
                        {removingDocType === docType ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">{t("verificationStatus")}</h2>
          <p className="text-sm text-muted-foreground">{t("verificationStatusDesc")}</p>

          <Separator className="my-5" />

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">{t("status")}: </span>
              <span className="text-sm font-semibold">
                {verification?.status === "APPROVED"
                  ? t("verificationApproved")
                  : verification?.status === "REJECTED"
                    ? t("verificationRejected")
                    : t("verificationPending")}
              </span>
            </div>

            {verification?.review_notes && (
              <Card className="p-4">
                <p className="text-sm font-semibold">{t("reviewNotes")}</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{verification.review_notes}</p>
              </Card>
            )}

            <div>
              <Button onClick={submitForApproval} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("submitForApproval")}
              </Button>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default MyDocuments;
