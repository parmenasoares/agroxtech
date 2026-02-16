import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardList, Loader2, PlusCircle } from "lucide-react";

import { useLanguage } from "@/hooks/useLanguage";
import { getPublicErrorMessage } from "@/lib/publicErrors";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BrandMark } from "@/components/BrandMark";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const ORDER_TYPES = ["Folga", "Ferias", "Ferramenta", "Outros"] as const;

type OrderType = (typeof ORDER_TYPES)[number];

type OrderStatus = "PENDENTE" | "APROVADO" | "REPROVADO";

type OrderRequest = {
  id: string;
  request_type: string;
  details: string | null;
  status: OrderStatus;
  review_reason: string | null;
  created_at: string;
};

const Orders = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [requestType, setRequestType] = useState<OrderType>("Folga");
  const [details, setDetails] = useState("");
  const [items, setItems] = useState<OrderRequest[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const statusVariant = useMemo(
    () =>
      ({
        PENDENTE: "secondary",
        APROVADO: "default",
        REPROVADO: "destructive",
      }) as Record<OrderStatus, "default" | "secondary" | "destructive" | "outline">,
    []
  );

  const loadOrders = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("order_requests")
      .select("id, request_type, details, status, review_reason, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(getPublicErrorMessage(error, t));
      setItems([]);
    } else {
      setMessage(null);
      setItems((data ?? []) as OrderRequest[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    void loadOrders();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSaving) return;

    if (!details.trim()) {
      setMessage("Descreva seu pedido para que a equipe avalie.");
      return;
    }

    setIsSaving(true);

    const { error } = await supabase.from("order_requests").insert({
      request_type: requestType,
      details: details.trim(),
    });

    if (error) {
      setMessage(getPublicErrorMessage(error, t));
    } else {
      setMessage("Pedido enviado com sucesso. Acompanhe a situação abaixo.");
      setDetails("");
      setRequestType("Folga");
      await loadOrders();
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
          <h1 className="text-2xl font-bold">{t("orders")}</h1>
        </div>
      </header>

      <main className="container mx-auto space-y-6 px-4 py-8">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Fazer pedido</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="order-type">Tipo</Label>
              <select
                id="order-type"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={requestType}
                onChange={(e) => setRequestType(e.target.value as OrderType)}
              >
                {ORDER_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="order-details">Descrição</Label>
              <Input
                id="order-details"
                placeholder="Ex.: Solicito ferramenta X para atividade de amanhã"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            </div>

            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar pedido
            </Button>
          </form>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Acompanhar situação</h2>
          </div>

          {message && <p className="mb-4 text-sm text-muted-foreground">{message}</p>}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando pedidos...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Você ainda não fez pedidos.</p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-lg border p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="font-semibold">{item.request_type}</p>
                    <Badge variant={statusVariant[item.status]}>{item.status}</Badge>
                  </div>
                  {item.details && <p className="text-sm text-muted-foreground">{item.details}</p>}
                  {item.status === "REPROVADO" && item.review_reason && (
                    <p className="mt-2 text-sm font-medium text-destructive">Motivo: {item.review_reason}</p>
                  )}
                  {item.status === "APROVADO" && item.review_reason && (
                    <p className="mt-2 text-sm font-medium text-green-700">Observação: {item.review_reason}</p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleString("pt-PT")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
};

export default Orders;
