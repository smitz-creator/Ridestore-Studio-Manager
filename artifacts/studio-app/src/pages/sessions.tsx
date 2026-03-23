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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Calendar, Trash2 } from "lucide-react";

const BRANDS = ["Dope Snow", "Montec"];
const SHOT_TYPES = ["Gallery", "Details", "Misc", "Mixed"];

export default function Sessions() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: sessions, isLoading } = useQuery({ queryKey: ["sessions"], queryFn: api.getSessions });

  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    date: "", modelName: "", brand: BRANDS[0], shotType: SHOT_TYPES[0], notes: "",
  });

  const createMut = useMutation({
    mutationFn: (data: any) => api.createSession(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setForm({ date: "", modelName: "", brand: BRANDS[0], shotType: SHOT_TYPES[0], notes: "" });
      toast({ title: "Photo shoot booked" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.deleteSession(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: "Photo shoot deleted" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date) {
      toast({ title: "Date is required", variant: "destructive" });
      return;
    }
    if (!form.modelName.trim()) {
      toast({ title: "Model Name is required", variant: "destructive" });
      return;
    }
    createMut.mutate({ ...form, createdById: user?.id });
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = sessions?.filter((s: any) => new Date(s.date + "T00:00:00") >= today) || [];
  const past = sessions?.filter((s: any) => new Date(s.date + "T00:00:00") < today) || [];

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Studio Photo Shoots</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Book a Photo Shoot</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Book a Photo Shoot</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Model Name</Label>
                  <Input value={form.modelName} onChange={e => setForm(f => ({ ...f, modelName: e.target.value }))} placeholder="e.g. Akin Jacket" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Brand</Label>
                    <Select value={form.brand} onValueChange={v => setForm(f => ({ ...f, brand: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {BRANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Shot Type</Label>
                    <Select value={form.shotType} onValueChange={v => setForm(f => ({ ...f, shotType: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SHOT_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any notes..." />
                </div>
                <Button type="submit" className="w-full" disabled={createMut.isPending}>
                  {createMut.isPending ? "Booking..." : "Book Photo Shoot"}
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
                    <SessionCard key={s.id} session={s} onDelete={() => deleteMut.mutate(s.id)} />
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
                    <SessionCard key={s.id} session={s} onDelete={() => deleteMut.mutate(s.id)} past />
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

function SessionCard({ session: s, onDelete, past }: { session: any; onDelete: () => void; past?: boolean }) {
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
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="secondary" className="text-xs">{s.brand}</Badge>
              <span className="text-xs text-muted-foreground">{s.shotType}</span>
              {s.createdByName && <span className="text-xs text-muted-foreground">&middot; by {s.createdByName}</span>}
            </div>
            {s.notes && <p className="text-xs text-muted-foreground mt-1">{s.notes}</p>}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-muted-foreground hover:text-destructive">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
