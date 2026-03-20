import * as React from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, AlertTriangle, Upload, FileSpreadsheet } from "lucide-react";
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

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [importFile, setImportFile] = React.useState<File | null>(null);
  const [importPreview, setImportPreview] = React.useState<{ sheets: { sheetName: string; brand: string; rowCount: number }[]; detectedSeason: string; filename: string } | null>(null);
  const [selectedSheets, setSelectedSheets] = React.useState<string[]>([]);
  const [importSeason, setImportSeason] = React.useState("");
  const [previewing, setPreviewing] = React.useState(false);
  const [executing, setExecuting] = React.useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setPreviewing(true);
    try {
      const preview = await api.importPreview(file);
      setImportPreview(preview);
      setSelectedSheets(preview.sheets.map(s => s.sheetName));
      setImportSeason(preview.detectedSeason || SEASONS[2]);
      setImportOpen(true);
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setPreviewing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSheetToggle = (sheetName: string) => {
    setSelectedSheets(prev =>
      prev.includes(sheetName) ? prev.filter(s => s !== sheetName) : [...prev, sheetName]
    );
  };

  const handleImportExecute = async () => {
    if (!importFile || selectedSheets.length === 0 || !importSeason.trim()) return;
    setExecuting(true);
    try {
      const result = await api.importExecute(importFile, selectedSheets, importSeason.trim());
      const summary = result.results.map(r => `${r.projectName}: ${r.imported} products`).join(", ");
      toast({ title: "Import complete", description: summary });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setImportOpen(false);
      setImportFile(null);
      setImportPreview(null);
      setSelectedSheets([]);
      setImportSeason("");
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Projects</h1>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={previewing}
            >
              <Upload className="w-4 h-4 mr-1" />
              {previewing ? "Reading file..." : "Import Excel"}
            </Button>
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
        </div>

        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                Import Excel
              </DialogTitle>
            </DialogHeader>
            {importPreview && (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  File: <span className="font-medium text-foreground">{importPreview.filename}</span>
                </div>

                <div className="space-y-2">
                  <Label>Season</Label>
                  <Input
                    value={importSeason}
                    onChange={e => setImportSeason(e.target.value)}
                    placeholder="e.g. FW25"
                  />
                  {importPreview.detectedSeason && (
                    <p className="text-xs text-muted-foreground">Auto-detected from filename</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Sheets to import</Label>
                  <p className="text-xs text-muted-foreground">Each sheet will create a separate project</p>
                  <div className="space-y-2 border rounded-lg p-3">
                    {importPreview.sheets.map(sheet => (
                      <label key={sheet.sheetName} className="flex items-center gap-3 cursor-pointer">
                        <Checkbox
                          checked={selectedSheets.includes(sheet.sheetName)}
                          onCheckedChange={() => handleSheetToggle(sheet.sheetName)}
                        />
                        <div className="flex-1 flex items-center justify-between">
                          <div>
                            <span className="text-sm font-medium">{sheet.sheetName}</span>
                            <span className="text-xs text-muted-foreground ml-2">{sheet.brand}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{sheet.rowCount} rows</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {selectedSheets.length > 0 && importSeason.trim() && (
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Will create:</p>
                    {selectedSheets.map(name => {
                      const sheet = importPreview.sheets.find(s => s.sheetName === name);
                      return (
                        <p key={name} className="text-sm">
                          {sheet?.brand} {importSeason.trim()} <span className="text-muted-foreground">({sheet?.rowCount} rows)</span>
                        </p>
                      );
                    })}
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={handleImportExecute}
                  disabled={executing || selectedSheets.length === 0 || !importSeason.trim()}
                >
                  {executing ? "Importing..." : `Import ${selectedSheets.length} sheet${selectedSheets.length !== 1 ? "s" : ""}`}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : !projects?.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No projects yet. Create your first project to get started.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {projects.map((p: any) => {
              const { total, uploaded, delayed, notStarted, inTheStudio, readyForSelection, readyForRetouch, inPostProduction, postProductionDone, readyForUpload } = p.stats;
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
                    <div className="flex w-full h-2 rounded-full overflow-hidden bg-zinc-800 mt-2">
                      {uploaded > 0 && <div style={{ width: `${(uploaded / total) * 100}%`, backgroundColor: "#22c55e" }} />}
                      {readyForUpload > 0 && <div style={{ width: `${(readyForUpload / total) * 100}%`, backgroundColor: "#eab308" }} />}
                      {postProductionDone > 0 && <div style={{ width: `${(postProductionDone / total) * 100}%`, backgroundColor: "#8b5cf6" }} />}
                      {inPostProduction > 0 && <div style={{ width: `${(inPostProduction / total) * 100}%`, backgroundColor: "#3b82f6" }} />}
                      {readyForRetouch > 0 && <div style={{ width: `${(readyForRetouch / total) * 100}%`, backgroundColor: "#f97316" }} />}
                      {readyForSelection > 0 && <div style={{ width: `${(readyForSelection / total) * 100}%`, backgroundColor: "#ec4899" }} />}
                      {inTheStudio > 0 && <div style={{ width: `${(inTheStudio / total) * 100}%`, backgroundColor: "#06b6d4" }} />}
                      {notStarted > 0 && <div style={{ width: `${(notStarted / total) * 100}%`, backgroundColor: "#9ca3af" }} />}
                    </div>
                  )}
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-x-2 gap-y-1 mt-2">
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#9ca3af" }} />{notStarted} Not Started</span>
                    <span className="flex items-center gap-1 text-[10px]" style={{ color: "#0891b2" }}><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#06b6d4" }} />{inTheStudio} Studio</span>
                    <span className="flex items-center gap-1 text-[10px]" style={{ color: "#db2777" }}><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#ec4899" }} />{readyForSelection} Selection</span>
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
