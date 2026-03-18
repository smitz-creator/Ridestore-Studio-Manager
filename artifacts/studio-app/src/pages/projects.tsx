import * as React from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BRANDS = ["Dope Snow", "Montec"];
const SEASONS = ["FW24", "SS25", "FW25", "SS26", "FW26"];

export default function Projects() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: projects, isLoading } = useQuery({ queryKey: ["projects"], queryFn: api.getProjects });
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", brand: BRANDS[0], season: SEASONS[2] });

  const createMut = useMutation({
    mutationFn: (data: any) => api.createProject(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setOpen(false);
      setForm({ name: "", brand: BRANDS[0], season: SEASONS[2] });
      toast({ title: "Project created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    createMut.mutate(form);
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Projects</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Project</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Project</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Project Name</Label>
                  <Input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Dope Snow FW25"
                  />
                </div>
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
                  <Label>Season</Label>
                  <Select value={form.season} onValueChange={v => setForm(f => ({ ...f, season: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SEASONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={createMut.isPending}>
                  {createMut.isPending ? "Creating..." : "Create Project"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : !projects?.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No projects yet. Create your first project to get started.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {projects.map((p: any) => {
              const { total, uploaded, delayed, notStarted, readyForRetouch, inPostProduction, postProductionDone, readyForUpload } = p.stats;
              return (
                <Link key={p.id} href={`/projects/${p.id}`} className="bg-card border rounded-lg p-4 hover:shadow-sm transition-shadow block">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.name}</span>
                      <Badge variant="secondary" className="text-xs">{p.brand}</Badge>
                      <Badge variant="outline" className="text-xs">{p.season}</Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">{total} products</span>
                  </div>
                  {total > 0 && (
                    <div className="flex w-full h-2 rounded-full overflow-hidden bg-gray-100 mt-2">
                      {uploaded > 0 && <div style={{ width: `${(uploaded / total) * 100}%`, backgroundColor: "#22c55e" }} />}
                      {readyForUpload > 0 && <div style={{ width: `${(readyForUpload / total) * 100}%`, backgroundColor: "#eab308" }} />}
                      {postProductionDone > 0 && <div style={{ width: `${(postProductionDone / total) * 100}%`, backgroundColor: "#8b5cf6" }} />}
                      {inPostProduction > 0 && <div style={{ width: `${(inPostProduction / total) * 100}%`, backgroundColor: "#3b82f6" }} />}
                      {readyForRetouch > 0 && <div style={{ width: `${(readyForRetouch / total) * 100}%`, backgroundColor: "#f97316" }} />}
                      {notStarted > 0 && <div style={{ width: `${(notStarted / total) * 100}%`, backgroundColor: "#9ca3af" }} />}
                    </div>
                  )}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-2 gap-y-1 mt-2">
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#9ca3af" }} />{notStarted} Not Started</span>
                    <span className="flex items-center gap-1 text-[10px]" style={{ color: "#ea580c" }}><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#f97316" }} />{readyForRetouch} Retouch</span>
                    <span className="flex items-center gap-1 text-[10px]" style={{ color: "#2563eb" }}><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#3b82f6" }} />{inPostProduction} Post Prod</span>
                    <span className="flex items-center gap-1 text-[10px]" style={{ color: "#7c3aed" }}><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#8b5cf6" }} />{postProductionDone} PP Done</span>
                    <span className="flex items-center gap-1 text-[10px]" style={{ color: "#ca8a04" }}><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#eab308" }} />{readyForUpload} Ready</span>
                    <span className="flex items-center gap-1 text-[10px]" style={{ color: "#16a34a" }}><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#22c55e" }} />{uploaded} Uploaded</span>
                  </div>
                  {delayed > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-destructive">
                      <AlertTriangle className="w-3 h-3" />
                      {delayed} delayed at factory
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
