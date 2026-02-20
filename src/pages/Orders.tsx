import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardList, Loader2, Send } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getPublicErrorMessage, isBackendCompatibilityError } from "@/lib/publicErrors";
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

type OrdersAdapter = {
  table: string;
  listSelect: string;
  mapRow: (row: Record<string, unknown>) => OrderRequest;
  buildInsert: (input: { userId: string; requestType: OrderRequestType; description: string }) => Record<string, unknown>;
};

const normalizeRequestType = (value: unknown): OrderRequestType => {
  const normalized = String(value ?? "OUTROS").toUpperCase();
  if (normalized === "FOLGA" || normalized === "FERIAS" || normalized === "FERRAMENTA" || normalized === "OUTROS") {
    return normalized;
  }
  return "OUTROS";
};

const ORDERS_ADAPTERS: OrdersAdapter[] = [
  {
    table: "order_requests",
    listSelect: "id, created_at, request_type, description, status, decision_reason, reviewed_at",
    mapRow: (row) => ({
      id: String(row.id),
      created_at: String(row.created_at),
      request_type: normalizeRequestType(row.request_type),
      description: String(row.description ?? ""),
      status: String(row.status ?? "PENDING"),
      decision_reason: (row.decision_reason as string | null) ?? null,
      reviewed_at: (row.reviewed_at as string | null) ?? null,
    }),
    buildInsert: ({ userId, requestType, description }) => ({
      user_id: userId,
      request_type: requestType,
      description,
    }),
  },
  {
    table: "requests",
    listSelect: "id, created_at, type, description, status, reason, reviewed_at",
    mapRow: (row) => ({
      id: String(row.id),
      created_at: String(row.created_at),
      request_type: normalizeRequestType(row.type),
      description: String(row.description ?? ""),
      status: String(row.status ?? "PENDING"),
      decision_reason: (row.reason as string | null) ?? null,
      reviewed_at: (row.reviewed_at as string | null) ?? null,
    }),
    buildInsert: ({ userId, requestType, description }) => ({
      user_id: userId,
      type: requestType,
      description,
    }),
  },
  {
    table: "orders",
    listSelect: "*",
    mapRow: (row) => ({
      id: String(row.id),
      created_at: String(row.created_at ?? new Date().toISOString()),
      request_type: normalizeRequestType(row.request_type ?? row.type ?? row.category),
      description: String(row.description ?? row.details ?? ""),
      status: String(row.status ?? "PENDING"),
      decision_reason: (row.decision_reason as string | null) ?? (row.reason as string | null) ?? null,
      reviewed_at: (row.reviewed_at as string | null) ?? null,
    }),
    buildInsert: ({ userId, requestType, description }) => ({
      user_id: userId,
      request_type: requestType,
      type: requestType,
      description,
      details: description,
    }),
  },
];

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
  const [activeAdapter, setActiveAdapter] = useState<OrdersAdapter | null>(null);
  const [moduleUnavailable, setModuleUnavailable] = useState(false);

  const canSubmit = useMemo(() => !!userId && description.trim().length > 0, [description, userId]);

  const loadRequests = async (uid: string) => {
    setIsLoadingRequests(true);
    try {
      for (const adapter of ORDERS_ADAPTERS) {
        const selectCandidates = [adapter.listSelect, "*"];

        for (const selectExpr of selectCandidates) {
          const { data, error } = await (supabase as any)
            .from(adapter.table)
            .select(selectExpr)
            .eq("user_id", uid)
            .order("created_at", { ascending: false });

          if (!error) {
            setActiveAdapter(adapter);
            setModuleUnavailable(false);
            setRequests(((data ?? []) as Record<string, unknown>[]).map(adapter.mapRow));
            return;
          }

          if (!isBackendCompatibilityError(error)) {
            throw error;
          }
        }
      }

      setModuleUnavailable(true);
      setRequests([]);
    } catch (error) {
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

    setIsSubmitting(true);
    try {
      const adaptersToTry = activeAdapter
        ? [activeAdapter, ...ORDERS_ADAPTERS.filter((adapter) => adapter.table !== activeAdapter.table)]
        : ORDERS_ADAPTERS;

      let insertError: unknown = null;
      for (const adapter of adaptersToTry) {
        const { error } = await (supabase as any).from(adapter.table).insert(
          adapter.buildInsert({
            userId,
            requestType,
            description: description.trim(),
          })
        );

        if (!error) {
          setActiveAdapter(adapter);
          setModuleUnavailable(false);
          insertError = null;
          break;
        }

        insertError = error;
        if (!isBackendCompatibilityError(error)) {
          throw error;
        }
      }

      if (insertError) {
        setModuleUnavailable(true);
        toast({
          title: t("error"),
          description: "Módulo de pedidos em configuração. Tente novamente mais tarde.",
          variant: "destructive",
        });
        return;
      }

      toast({ title: t("success"), description: "Pedido enviado com sucesso." });
      setRequestType("FOLGA");
      setDescription("");
      await loadRequests(userId);
    } catch (error) {
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
