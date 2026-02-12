import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startPhotoPath: string | null;
  endPhotoPath: string | null;
  startOdometerPhotoPath: string | null;
  endOdometerPhotoPath: string | null;
  title?: string;
};

async function createSignedUrl(path: string, expiresInSeconds: number) {
  const { data, error } = await supabase.storage
    .from("activity-photos")
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw error;
  if (!data?.signedUrl) throw new Error("Failed to create signed URL");
  return data.signedUrl;
}

export default function ActivityPhotosDialog({
  open,
  onOpenChange,
  startPhotoPath,
  endPhotoPath,
  startOdometerPhotoPath,
  endOdometerPhotoPath,
  title = "Fotos da atividade",
}: Props) {
  const enabled =
    open && (!!startPhotoPath || !!endPhotoPath || !!startOdometerPhotoPath || !!endOdometerPhotoPath);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "activity-photo-signed-urls",
      startPhotoPath,
      endPhotoPath,
      startOdometerPhotoPath,
      endOdometerPhotoPath,
    ],
    enabled,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const [startUrl, endUrl, startOdoUrl, endOdoUrl] = await Promise.all([
        startPhotoPath ? createSignedUrl(startPhotoPath, 60) : Promise.resolve(null),
        endPhotoPath ? createSignedUrl(endPhotoPath, 60) : Promise.resolve(null),
        startOdometerPhotoPath ? createSignedUrl(startOdometerPhotoPath, 60) : Promise.resolve(null),
        endOdometerPhotoPath ? createSignedUrl(endOdometerPhotoPath, 60) : Promise.resolve(null),
      ]);

      return { startUrl, endUrl, startOdoUrl, endOdoUrl };
    },
  });

  const message = useMemo(() => {
    const msg = (error as any)?.message;
    return msg ? String(msg) : null;
  }, [error]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            As imagens são abertas via links temporários (expiram em ~60s). Se expirar, clique em “Atualizar links”.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            A carregar…
          </div>
        ) : message ? (
          <div className="rounded-md border p-4 text-sm text-destructive">{message}</div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium">Selfie — Início</div>
              {data?.startUrl ? (
                <img src={data.startUrl} alt="Selfie de início" className="w-full rounded-lg border object-contain" />
              ) : (
                <div className="rounded-lg border p-6 text-sm text-muted-foreground">Sem selfie de início</div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Selfie — Fim</div>
              {data?.endUrl ? (
                <img src={data.endUrl} alt="Selfie de fim" className="w-full rounded-lg border object-contain" />
              ) : (
                <div className="rounded-lg border p-6 text-sm text-muted-foreground">Sem selfie de fim</div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Hodômetro — Início</div>
              {data?.startOdoUrl ? (
                <img src={data.startOdoUrl} alt="Foto do hodômetro de início" className="w-full rounded-lg border object-contain" />
              ) : (
                <div className="rounded-lg border p-6 text-sm text-muted-foreground">Sem foto do hodômetro de início</div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Hodômetro — Fim</div>
              {data?.endOdoUrl ? (
                <img src={data.endOdoUrl} alt="Foto do hodômetro de fim" className="w-full rounded-lg border object-contain" />
              ) : (
                <div className="rounded-lg border p-6 text-sm text-muted-foreground">Sem foto do hodômetro de fim</div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => refetch()} disabled={!enabled}>
            Atualizar links
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
