import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Calendar, Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

const BRANDS = ["Dope Snow", "Montec"];
const SHOT_TYPES = ["Gallery", "Details", "Mixed", "Misc"];

function ToggleChip({ label, selected, onClick, hint }: { label: string; selected: boolean; onClick: () => void; hint?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className={cn(
        "px-3 py-1.5 rounded-md text-xs font-medium border transition-all",
        selected
          ? "bg-emerald-600 border-emerald-600 text-white"
          : "bg-secondary border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground"
      )}
    >
      {label}
    </button>
  );
}

function parseMulti(val: string | undefined | null): string[] {
  if (!val) return [];
  return val.split(",").map(s => s.trim()).filter(Boolean);
}

function toggleInArray(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
}

export default function Sessions() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: sessions, isLoading } = useQuery({ queryKey: ["sessions"], queryFn: api.getSessions });

  const [open, setOpen] = React.useState(false);
  const [editingSession, setEditingSession] = React.useState<any>(null);
  const [form, setForm] = React.useState({
    date: "", modelName: "", brands: [] as string[], shotTypes: [] as string[], notes: "",
  });

  const emptyForm = { date: "", modelName: "", brands: [] as string[], shotTypes: [] as string[], notes: "" };

  const createMut = useMutation({
    mutationFn: (data: any) => api.createSession(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setEditingSession(null);
      setForm(emptyForm);
      toast({ title: "Photo shoot booked" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updateSession(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setEditingSession(null);
      setForm(emptyForm);
      toast({ title: "Photo shoot updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openEdit = (session: any) => {
    const dateStr = session.date ? new Date(session.date).toISOString().split("T")[0] : "";
    setForm({
      date: dateStr,
      modelName: session.modelName || "",
      brands: parseMulti(session.brand),
      shotTypes: parseMulti(session.shotType),
      notes: session.notes || "",
    });
    setEditingSession(session);
    setOpen(true);
  };

  const openCreate = () => {
    setForm(emptyForm);
    setEditingSession(null);
    setOpen(true);
  };

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.deleteSession(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: "Photo shoot deleted" });
    },
  });

  const canSubmit = form.date && form.modelName.trim() && form.brands.length > 0 && form.shotTypes.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date) { toast({ title: "Date is required", variant: "destructive" }); return; }
    if (!form.modelName.trim()) { toast({ title: "Model - Product is required", variant: "destructive" }); return; }
    if (form.brands.length === 0) { toast({ title: "Select at least one brand", variant: "destructive" }); return; }
    if (form.shotTypes.length === 0) { toast({ title: "Select at least one shot type", variant: "destructive" }); return; }

    const payload = {
      date: form.date,
      modelName: form.modelName,
      brand: form.brands.join(", "),
      shotType: form.shotTypes.join(", "),
      notes: form.notes,
    };

    if (editingSession) {
      updateMut.mutate({ id: editingSession.id, data: payload });
    } else {
      createMut.mutate({ ...payload, createdById: user?.id });
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = sessions?.filter((s: any) => new Date(s.date) >= today) || [];
  const past = sessions?.filter((s: any) => new Date(s.date) < today) || [];

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Studio Photo Shoots</h1>
          <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> Book a Photo Shoot</Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingSession(null); }}>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingSession ? "Edit Photo Shoot" : "Book a Photo Shoot"}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Model - Product</Label>
                  <Input value={form.modelName} onChange={e => setForm(f => ({ ...f, modelName: e.target.value }))} placeholder="e.g. Akin Jacket" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Brand</Label>
                    <div className="flex flex-wrap gap-2">
                      {BRANDS.map(b => (
                        <ToggleChip
                          key={b}
                          label={b}
                          selected={form.brands.includes(b)}
                          onClick={() => setForm(f => ({ ...f, brands: toggleInArray(f.brands, b) }))}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Shot Type</Label>
                    <div className="flex flex-wrap gap-2">
                      {SHOT_TYPES.map(s => (
                        <ToggleChip
                          key={s}
                          label={s}
                          selected={form.shotTypes.includes(s)}
                          onClick={() => setForm(f => ({ ...f, shotTypes: toggleInArray(f.shotTypes, s) }))}
                          hint={s === "Mixed" ? "Gallery + Details in the same session" : undefined}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any notes..." />
                </div>
                <Button type="submit" className="w-full" disabled={!canSubmit || createMut.isPending || updateMut.isPending}>
                  {editingSession
                    ? (updateMut.isPending ? "Saving..." : "Save Changes")
                    : (createMut.isPending ? "Booking..." : "Book Photo Shoot")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Upcoming ({upcoming.length})
              </h2>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming photo shoots.</p>
              ) : (
                <div className="grid gap-2">
                  {[...upcoming].reverse().map((s: any) => (
                    <SessionCard key={s.id} session={s} onEdit={() => openEdit(s)} onDelete={() => deleteMut.mutate(s.id)} />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Past Photo Shoots ({past.length})</h2>
              {past.length === 0 ? (
                <p className="text-sm text-muted-foreground">No past photo shoots.</p>
              ) : (
                <div className="grid gap-2">
                  {past.map((s: any) => (
                    <SessionCard key={s.id} session={s} onEdit={() => openEdit(s)} onDelete={() => deleteMut.mutate(s.id)} past />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

function SessionCard({ session: s, onEdit, onDelete, past }: { session: any; onEdit: () => void; onDelete: () => void; past?: boolean }) {
  const brandParts = parseMulti(s.brand);
  const shotParts = parseMulti(s.shotType);

  return (
    <div className={`bg-card border rounded-lg p-4 ${past ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-center w-12">
            <div className="text-xs text-muted-foreground uppercase">{formatDate(s.date, "MMM")}</div>
            <div className="text-lg font-bold">{formatDate(s.date, "d")}</div>
          </div>
          <div>
            <div className="font-medium text-sm">{s.modelName}</div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {brandParts.map(b => (
                <Badge key={b} variant="secondary" className="text-xs">{b}</Badge>
              ))}
              <span className="text-xs text-muted-foreground">{shotParts.join(", ")}</span>
              {s.createdByName && <span className="text-xs text-muted-foreground">&middot; by {s.createdByName}</span>}
            </div>
            {s.notes && <p className="text-xs text-muted-foreground mt-1">{s.notes}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit} className="text-muted-foreground hover:text-foreground">
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
