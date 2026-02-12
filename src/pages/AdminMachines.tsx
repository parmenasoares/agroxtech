import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/hooks/use-toast";
import { getPublicErrorMessage } from "@/lib/publicErrors";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BrandMark } from "@/components/BrandMark";
import { ArrowLeft, Plus, Pencil, Trash2, RefreshCcw } from "lucide-react";


type Machine = {
  id: string;
  internal_id: string | null;
  brand: string | null;
  name: string;
  model: string | null;
  plate: string | null;
  serial_number: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
};

type MachineFormData = {
  internal_id: string;
  brand: string;
  name: string;
  model: string;
  plate: string;
  serial_number: string;
  status: string;
};

const AdminMachines = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [deletingMachineId, setDeletingMachineId] = useState<string | null>(null);

  const [formData, setFormData] = useState<MachineFormData>({
    internal_id: "",
    brand: "",
    name: "",
    model: "",
    plate: "",
    serial_number: "",
    status: "ACTIVE",
  });

  const { data: machines, isLoading, refetch } = useQuery({
    queryKey: ["admin", "machines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machines")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Machine[];
    },
  });

  const resetForm = () => {
    setFormData({
      internal_id: "",
      brand: "",
      name: "",
      model: "",
      plate: "",
      serial_number: "",
      status: "ACTIVE",
    });
    setEditingMachine(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (machine: Machine) => {
    setEditingMachine(machine);
    setFormData({
      internal_id: machine.internal_id ?? "",
      brand: machine.brand ?? "",
      name: machine.name ?? "",
      model: machine.model ?? "",
      plate: machine.plate ?? "",
      serial_number: machine.serial_number ?? "",
      status: machine.status ?? "ACTIVE",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (editingMachine) {
        const { error } = await supabase
          .from("machines")
          .update({
            internal_id: formData.internal_id || null,
            brand: formData.brand || null,
            name: formData.name,
            model: formData.model || null,
            plate: formData.plate || null,
            serial_number: formData.serial_number || null,
            status: formData.status,
          })
          .eq("id", editingMachine.id);

        if (error) throw error;

        toast({
          title: t("success"),
          description: "Máquina atualizada com sucesso!",
        });
      } else {
        const { error } = await supabase.from("machines").insert({
          internal_id: formData.internal_id || null,
          brand: formData.brand || null,
          name: formData.name,
          model: formData.model || null,
          plate: formData.plate || null,
          serial_number: formData.serial_number || null,
          status: formData.status,
        });

        if (error) throw error;

        toast({
          title: t("success"),
          description: "Máquina criada com sucesso!",
        });
      }

      setDialogOpen(false);
      resetForm();
      await qc.invalidateQueries({ queryKey: ["admin", "machines"] });
    } catch (err: any) {
      console.error(err);
      toast({
        title: t("error"),
        description: getPublicErrorMessage(err, t),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingMachineId) return;

    try {
      const { error } = await supabase.from("machines").delete().eq("id", deletingMachineId);

      if (error) throw error;

      toast({
        title: t("success"),
        description: "Máquina eliminada com sucesso!",
      });

      setDeleteDialogOpen(false);
      setDeletingMachineId(null);
      await qc.invalidateQueries({ queryKey: ["admin", "machines"] });
    } catch (err: any) {
      console.error(err);
      toast({
        title: t("error"),
        description: getPublicErrorMessage(err, t),
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string | null) => {
    const s = status ?? "ACTIVE";
    const colors: Record<string, string> = {
      ACTIVE: "bg-green-500/10 text-green-600 border-green-500/20",
      MAINTENANCE: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
      INACTIVE: "bg-gray-500/10 text-gray-600 border-gray-500/20",
    };
    const labels: Record<string, string> = {
      ACTIVE: "Ativa",
      MAINTENANCE: "Manutenção",
      INACTIVE: "Inativa",
    };
    return (
      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colors[s]}`}>
        {labels[s]}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}> 
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <BrandMark />
            <div>
              <h1 className="text-2xl font-bold">Gestão de Máquinas</h1>
              <p className="text-sm text-muted-foreground">Registo e gestão completa</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Máquina
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID Interno</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Nome/Modelo</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>Nº Série</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    A carregar...
                  </TableCell>
                </TableRow>
              ) : machines && machines.length > 0 ? (
                machines.map((machine) => (
                  <TableRow key={machine.id}>
                    <TableCell className="font-medium">{machine.internal_id || "—"}</TableCell>
                    <TableCell>{machine.brand || "—"}</TableCell>
                    <TableCell>
                      <div className="leading-tight">
                        <div className="font-medium">{machine.name}</div>
                        {machine.model && <div className="text-xs text-muted-foreground">{machine.model}</div>}
                      </div>
                    </TableCell>
                    <TableCell>{machine.plate || "—"}</TableCell>
                    <TableCell className="text-xs">{machine.serial_number || "—"}</TableCell>
                    <TableCell>{getStatusBadge(machine.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(machine)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setDeletingMachineId(machine.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    Nenhuma máquina cadastrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </main>

      {/* Dialog Criar/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingMachine ? "Editar Máquina" : "Nova Máquina"}</DialogTitle>
            <DialogDescription>Preencha os dados da máquina</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="internal_id">ID Interno</Label>
              <Input
                id="internal_id"
                placeholder="AT12J0001"
                value={formData.internal_id}
                onChange={(e) => setFormData({ ...formData, internal_id: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand">Marca</Label>
              <Input
                id="brand"
                placeholder="JOHN DEERE"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                placeholder="Trator 5120"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Modelo</Label>
              <Input
                id="model"
                placeholder="5120 M"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plate">Matrícula</Label>
              <Input
                id="plate"
                placeholder="AX3685"
                value={formData.plate}
                onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="serial_number">Nº Série</Label>
              <Input
                id="serial_number"
                placeholder="JD66652R125438"
                value={formData.serial_number}
                onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="status">Estado</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Ativa</SelectItem>
                  <SelectItem value="MAINTENANCE">Em Manutenção</SelectItem>
                  <SelectItem value="INACTIVE">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.name}>
              {editingMachine ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Eliminar */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminação</DialogTitle>
            <DialogDescription>Tem certeza que deseja eliminar esta máquina? Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminMachines;
