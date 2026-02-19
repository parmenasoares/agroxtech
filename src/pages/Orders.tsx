import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardList, Loader2, Send } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getPublicErrorMessage, isMissingBackendObjectError } from "@/lib/publicErrors";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type OrderRequestType = "FOLGA" | "FERIAS" | "FERRAMENTA" | "OUTROS";

type OrderRequest = {
  id: string;
  created_at: string;
  request_type: OrderRequestType;
  description: string;
  status: string;
  decision_reason: string | null;
  reviewed_at: string | null;
};

const requestTypeLabels: Record<OrderRequestType, string> = {
  FOLGA: "Folga",
  FERIAS: "Férias",
  FERRAMENTA: "Ferramenta",
  OUTROS: "Outros",
};

const statusLabel = (status: string) => {
  if (status === "APPROVED") return "Aprovado";
  if (status === "REJECTED") return "Rejeitado";
  return "Pendente";
};

const Orders = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [userId, setUserId] = useState<string | null>(null);
  const [requestType, setRequestType] = useState<OrderRequestType>("FOLGA");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [requests, setRequests] = useState<OrderRequest[]>([]);
  const [moduleUnavailable, setModuleUnavailable] = useState(false);

  const canSubmit = useMemo(() => !!userId && description.trim().length > 0, [description, userId]);

  const loadRequests = async (uid: string) => {
    setIsLoadingRequests(true);
    try {
      const { data, error } = await supabase
        .from("order_requests")
        .select("id, created_at, request_type, description, status, decision_reason, reviewed_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setModuleUnavailable(false);
      setRequests((data ?? []) as OrderRequest[]);
    } catch (error) {
      if (isMissingBackendObjectError(error)) {
        setModuleUnavailable(true);
        setRequests([]);
        return;
      }
      toast({
        title: t("error"),
        description: getPublicErrorMessage(error, t),
        variant: "destructive",
      });
    } finally {
      setIsLoadingRequests(false);
    }
  };

  useEffect(() => {
    const loadUserAndRequests = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        toast({
          title: t("error"),
          description: error ? getPublicErrorMessage(error, t) : t("sessionLoadFailed"),
          variant: "destructive",
        });
        return;
      }

      setUserId(user.id);
      await loadRequests(user.id);
    };

    loadUserAndRequests();
  }, []);

  const handleSubmit = async () => {
    if (!userId || !canSubmit) return;

    if (moduleUnavailable) {
      toast({
        title: t("error"),
        description: "Módulo de pedidos em configuração. Tente novamente mais tarde.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("order_requests").insert({
        user_id: userId,
        request_type: requestType,
        description: description.trim(),
      });

      if (error) throw error;

      setModuleUnavailable(false);
      toast({ title: t("success"), description: "Pedido enviado com sucesso." });
      setRequestType("FOLGA");
      setDescription("");
      await loadRequests(userId);
    } catch (error) {
      if (isMissingBackendObjectError(error)) {
        setModuleUnavailable(true);
        toast({
          title: t("error"),
          description: "Módulo de pedidos em configuração. Tente novamente mais tarde.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: t("error"),
        description: getPublicErrorMessage(error, t),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <BrandMark />
          <h1 className="text-2xl font-bold">{t("orders")}</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="request" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="request">Fazer Pedido</TabsTrigger>
            <TabsTrigger value="track">Acompanhar Situação</TabsTrigger>
          </TabsList>

          <TabsContent value="request">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" /> Novo pedido
                </CardTitle>
                <CardDescription>Escolha o tipo de pedido e descreva os detalhes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="request-type">Tipo de pedido</Label>
                  <Select value={requestType} onValueChange={(value) => setRequestType(value as OrderRequestType)}>
                    <SelectTrigger id="request-type">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FOLGA">Folga</SelectItem>
                      <SelectItem value="FERIAS">Férias</SelectItem>
                      <SelectItem value="FERRAMENTA">Ferramenta</SelectItem>
                      <SelectItem value="OUTROS">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="request-description">Descrição</Label>
                  <Textarea
                    id="request-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Ex.: Solicito folga no dia 20 por motivo pessoal."
                    rows={4}
                  />
                </div>

                <Button className="w-full" onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...
                    </>
                  ) : (
                    "Enviar pedido"
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="track">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" /> Situação dos pedidos
                </CardTitle>
                <CardDescription>Veja se o pedido foi aprovado ou rejeitado e o motivo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {moduleUnavailable && (
                  <p className="text-sm text-muted-foreground">
                    Módulo de pedidos em configuração. Solicite ao suporte a atualização da base de dados.
                  </p>
                )}

                {isLoadingRequests && <p className="text-sm text-muted-foreground">{t("loading")}</p>}

                {!moduleUnavailable && !isLoadingRequests && requests.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum pedido enviado até o momento.</p>
                )}

                {requests.map((request) => (
                  <Card key={request.id} className="border-muted">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">{new Date(request.created_at).toLocaleString()}</p>
                        <Badge
                          variant={
                            request.status === "APPROVED"
                              ? "default"
                              : request.status === "REJECTED"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {statusLabel(request.status)}
                        </Badge>
                      </div>

                      <p className="text-sm">
                        <strong>Tipo:</strong> {requestTypeLabels[request.request_type]}
                      </p>
                      <p className="text-sm">{request.description}</p>

                      <div className="rounded-md border bg-muted/30 p-3">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Motivo da decisão</p>
                        <p className="mt-1 text-sm">
                          {request.decision_reason || "Ainda em análise. Aguarde resposta da coordenação."}
                        </p>
                        {request.reviewed_at && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Atualizado em: {new Date(request.reviewed_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Orders;
