import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Camera, Loader2 } from "lucide-react";

import { useLanguage } from "@/hooks/useLanguage";
import { getPublicErrorMessage } from "@/lib/publicErrors";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BrandMark } from "@/components/BrandMark";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const MAX_IMAGE_SIZE_MB = 10;

type DamageStatus = "ABERTO" | "EM_ANALISE" | "RESOLVIDO";

type DamageItem = {
  id: string;
  report_text: string;
  photo_url: string | null;
  status: DamageStatus;
  created_at: string;
};

const Damages = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [reportText, setReportText] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [items, setItems] = useState<DamageItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const loadDamages = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("damage_reports")
      .select("id, report_text, photo_url, status, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(getPublicErrorMessage(error, t));
      setItems([]);
    } else {
      setMessage(null);
      setItems((data ?? []) as DamageItem[]);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    void loadDamages();
  }, []);

  const handlePhotoSelect = (selected: File | null) => {
    if (!selected) {
      setPhoto(null);
      return;
    }

    if (!selected.type.startsWith("image/")) {
      setMessage("Envie uma foto válida (imagem).");
      setPhoto(null);
      return;
    }

    if (selected.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      setMessage(`A foto deve ter no máximo ${MAX_IMAGE_SIZE_MB}MB.`);
      setPhoto(null);
      return;
    }

    setMessage(null);
    setPhoto(selected);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSaving) return;

    if (!reportText.trim()) {
      setMessage("Descreva o dano no relatório.");
      return;
    }

    if (!photo) {
      setMessage("Adicione uma foto do dano para concluir o envio.");
      return;
    }

    setIsSaving(true);

    let photoUrl: string | null = null;
    const extension = photo.name.split(".").pop();
    const filePath = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension ? `.${extension}` : ""}`;

    const { error: uploadError } = await supabase.storage
      .from("damage-reports")
      .upload(filePath, photo, { upsert: true });

    if (uploadError) {
      setMessage(getPublicErrorMessage(uploadError, t));
      setIsSaving(false);
      return;
    }

    const { data: photoData } = supabase.storage.from("damage-reports").getPublicUrl(filePath);
    photoUrl = photoData.publicUrl;

    const { error } = await supabase.from("damage_reports").insert({
      report_text: reportText.trim(),
      photo_url: photoUrl,
    });

    if (error) {
      setMessage(getPublicErrorMessage(error, t));
    } else {
      setMessage("Dano registrado com sucesso.");
      setReportText("");
      setPhoto(null);
      await loadDamages();
    }

    setIsSaving(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <BrandMark />
          <h1 className="text-2xl font-bold">{t("damages")}</h1>
        </div>
      </header>

      <main className="container mx-auto space-y-6 px-4 py-8">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h2 className="text-lg font-semibold">Registre um dano causado em seu equipamento</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="damage-report">Relatório</Label>
              <Textarea
                id="damage-report"
                placeholder="Descreva o ocorrido e como o dano aconteceu..."
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="damage-photo" className="flex items-center gap-2">
                <Camera className="h-4 w-4" /> Foto do dano
              </Label>
              <Input id="damage-photo" type="file" accept="image/*" onChange={(e) => handlePhotoSelect(e.target.files?.[0] ?? null)} />
              {photo && <p className="text-xs text-muted-foreground">Foto selecionada: {photo.name}</p>}
            </div>

            <Button type="submit" variant="destructive" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar dano
            </Button>
          </form>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-lg font-semibold">Histórico de danos</h2>

          {message && <p className="mb-3 text-sm text-muted-foreground">{message}</p>}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando danos...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum dano registado.</p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-lg border p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="font-semibold">Dano reportado</p>
                    <Badge variant={item.status === "RESOLVIDO" ? "default" : item.status === "EM_ANALISE" ? "secondary" : "destructive"}>
                      {item.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.report_text}</p>
                  {item.photo_url && (
                    <a
                      className="mt-2 inline-block text-sm font-medium text-primary underline"
                      href={item.photo_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver foto enviada
                    </a>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("pt-PT")}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
};

export default Damages;
