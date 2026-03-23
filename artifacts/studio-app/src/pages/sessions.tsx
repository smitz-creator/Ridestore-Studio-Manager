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
import { Plus, Calendar, Trash2, Pencil, Check, ChevronDown, ChevronUp, Package } from "lucide-react";
import { cn } from "@/lib/utils";

const SHOT_TYPES = ["Gallery", "Details", "Mixed", "Misc"];

function ToggleChip({ label, selected, onClick, hint }: { label: string; selected: boolean; onClick: () => void; hint?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors",
        selected
          ? "border-transparent bg-emerald-900/30 text-emerald-400"
          : "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80"
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

interface WizardProduct {
  id: number;
  gender: string;
  productType: string;
  shortname: string;
  keyCode: string | null;
  colour: string | null;
  uploadStatus: string;
  isCarryOver: boolean;
  brand: string;
}

interface WizardState {
  shotTypes: string[];
  brands: string[];
  genders: string[];
  productTypes: string[];
  selectedProductIds: Set<number>;
  date: string;
  modelName: string;
  notes: string;
}

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started",
  in_the_studio: "In Studio",
  ready_for_selection: "Selection",
  ready_for_retouch: "Retouch",
  in_post_production: "Post-Prod",
  post_production_done: "Post Done",
  ready_for_upload: "Ready",
  uploaded: "Uploaded",
};

function BookingWizard({ editingSession, onClose }: { editingSession: any | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: allProducts = [] } = useQuery<WizardProduct[]>({
    queryKey: ["wizard-products"],
    queryFn: api.getWizardProducts,
  });

  const { data: existingProductIds } = useQuery<number[]>({
    queryKey: ["session-products", editingSession?.id],
    queryFn: async () => {
      if (!editingSession) return [];
      const products = await api.getSessionProducts(editingSession.id);
      return products.map((p: any) => p.id);
    },
    enabled: !!editingSession,
  });

  const [wiz, setWiz] = React.useState<WizardState>({
    shotTypes: [], brands: [], genders: [], productTypes: [],
    selectedProductIds: new Set(),
    date: new Date().toISOString().split("T")[0],
    modelName: "", notes: "",
  });

  const [expandedStep, setExpandedStep] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (editingSession) {
      const brands = parseMulti(editingSession.brand);
      const shotTypes = parseMulti(editingSession.shotType);
      const dateStr = editingSession.date ? new Date(editingSession.date).toISOString().split("T")[0] : "";
      setWiz(prev => ({
        ...prev,
        shotTypes,
        brands,
        date: dateStr,
        modelName: editingSession.modelName || "",
        notes: editingSession.notes || "",
      }));
    }
  }, [editingSession]);

  React.useEffect(() => {
    if (editingSession && existingProductIds) {
      const pids = new Set(existingProductIds);
      setWiz(prev => ({ ...prev, selectedProductIds: pids }));

      if (existingProductIds.length > 0) {
        const existingProducts = allProducts.filter(p => existingProductIds.includes(p.id));
        const genders = [...new Set(existingProducts.map(p => p.gender))];
        const productTypes = [...new Set(existingProducts.map(p => p.productType))];
        setWiz(prev => ({
          ...prev,
          genders: genders.length > 0 ? genders : prev.genders,
          productTypes: productTypes.length > 0 ? productTypes : prev.productTypes,
        }));
      }
    }
  }, [editingSession, existingProductIds, allProducts]);

  const availableBrands = React.useMemo(() => {
    const brands = [...new Set(allProducts.map(p => p.brand))];
    return brands.sort();
  }, [allProducts]);

  const filteredByBrand = React.useMemo(() => {
    if (wiz.brands.length === 0) return [];
    return allProducts.filter(p => wiz.brands.includes(p.brand));
  }, [allProducts, wiz.brands]);

  const availableGenders = React.useMemo(() => {
    const genders = [...new Set(filteredByBrand.map(p => p.gender))];
    return genders.sort();
  }, [filteredByBrand]);

  const filteredByGender = React.useMemo(() => {
    if (wiz.genders.length === 0) return [];
    return filteredByBrand.filter(p => wiz.genders.includes(p.gender));
  }, [filteredByBrand, wiz.genders]);

  const availableProductTypes = React.useMemo(() => {
    const types = [...new Set(filteredByGender.map(p => p.productType))];
    return types.sort();
  }, [filteredByGender]);

  const filteredProducts = React.useMemo(() => {
    if (wiz.productTypes.length === 0) return [];
    return filteredByGender.filter(p => wiz.productTypes.includes(p.productType));
  }, [filteredByGender, wiz.productTypes]);

  const resetFrom = (step: number) => {
    setWiz(prev => {
      const next = { ...prev };
      if (step <= 2) { next.brands = []; next.genders = []; next.productTypes = []; next.selectedProductIds = new Set(); }
      else if (step <= 3) { next.genders = []; next.productTypes = []; next.selectedProductIds = new Set(); }
      else if (step <= 4) { next.productTypes = []; next.selectedProductIds = new Set(); }
      else if (step <= 5) { next.selectedProductIds = new Set(); }
      return next;
    });
  };

  const toggleProduct = (id: number) => {
    setWiz(prev => {
      const next = new Set(prev.selectedProductIds);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...prev, selectedProductIds: next };
    });
  };

  const selectAll = () => {
    setWiz(prev => ({
      ...prev,
      selectedProductIds: new Set(filteredProducts.map(p => p.id)),
    }));
  };

  const deselectAll = () => {
    setWiz(prev => ({ ...prev, selectedProductIds: new Set() }));
  };

  const createMut = useMutation({
    mutationFn: (data: any) => api.createSession(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: "Photo shoot booked" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updateSession(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: "Photo shoot updated" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const step1Done = wiz.shotTypes.length > 0;
  const step2Done = wiz.brands.length > 0;
  const step3Done = wiz.genders.length > 0;
  const step4Done = wiz.productTypes.length > 0;
  const step5Done = wiz.selectedProductIds.size > 0;
  const canSubmit = step1Done && step2Done && wiz.date && wiz.modelName.trim();

  const handleSubmit = () => {
    if (!wiz.date) { toast({ title: "Date is required", variant: "destructive" }); return; }
    if (!wiz.modelName.trim()) { toast({ title: "Model - Product is required", variant: "destructive" }); return; }

    const payload = {
      date: wiz.date,
      modelName: wiz.modelName,
      brand: wiz.brands.join(", "),
      shotType: wiz.shotTypes.join(", "),
      notes: wiz.notes,
      productIds: [...wiz.selectedProductIds],
      createdById: user?.id,
    };

    if (editingSession) {
      updateMut.mutate({ id: editingSession.id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const isSubmitting = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <StepSection
        stepNum={1}
        title="Shot Type"
        done={step1Done}
        summary={step1Done ? wiz.shotTypes.join(", ") : ""}
        expanded={expandedStep === 1 || !step1Done}
        onToggle={() => { setExpandedStep(expandedStep === 1 ? null : 1); }}
        onReset={() => { resetFrom(1); setExpandedStep(null); }}
      >
        <div className="flex flex-wrap gap-2">
          {SHOT_TYPES.map(s => (
            <ToggleChip
              key={s}
              label={s}
              selected={wiz.shotTypes.includes(s)}
              onClick={() => setWiz(prev => ({ ...prev, shotTypes: toggleInArray(prev.shotTypes, s) }))}
              hint={s === "Mixed" ? "Gallery + Details in the same session" : undefined}
            />
          ))}
        </div>
      </StepSection>

      {step1Done && (
        <StepSection
          stepNum={2}
          title="Brand"
          done={step2Done}
          summary={step2Done ? wiz.brands.join(", ") : ""}
          expanded={expandedStep === 2 || (step1Done && !step2Done)}
          onToggle={() => setExpandedStep(expandedStep === 2 ? null : 2)}
          onReset={() => { resetFrom(2); setExpandedStep(null); }}
        >
          <div className="flex flex-wrap gap-2">
            {availableBrands.map(b => (
              <ToggleChip
                key={b}
                label={b}
                selected={wiz.brands.includes(b)}
                onClick={() => {
                  resetFrom(3);
                  setWiz(prev => ({ ...prev, brands: toggleInArray(prev.brands, b) }));
                }}
              />
            ))}
          </div>
        </StepSection>
      )}

      {step1Done && step2Done && (
        <StepSection
          stepNum={3}
          title="Gender"
          done={step3Done}
          summary={step3Done ? wiz.genders.join(", ") : ""}
          expanded={expandedStep === 3 || (step2Done && !step3Done)}
          onToggle={() => setExpandedStep(expandedStep === 3 ? null : 3)}
          onReset={() => { resetFrom(3); setExpandedStep(null); }}
        >
          <div className="flex flex-wrap gap-2">
            {availableGenders.map(g => (
              <ToggleChip
                key={g}
                label={g}
                selected={wiz.genders.includes(g)}
                onClick={() => {
                  resetFrom(4);
                  setWiz(prev => ({ ...prev, genders: toggleInArray(prev.genders, g) }));
                }}
              />
            ))}
          </div>
        </StepSection>
      )}

      {step1Done && step2Done && step3Done && (
        <StepSection
          stepNum={4}
          title="Product Type"
          done={step4Done}
          summary={step4Done ? wiz.productTypes.join(", ") : ""}
          expanded={expandedStep === 4 || (step3Done && !step4Done)}
          onToggle={() => setExpandedStep(expandedStep === 4 ? null : 4)}
          onReset={() => { resetFrom(4); setExpandedStep(null); }}
        >
          <div className="flex flex-wrap gap-2">
            {availableProductTypes.map(pt => (
              <ToggleChip
                key={pt}
                label={pt}
                selected={wiz.productTypes.includes(pt)}
                onClick={() => {
                  resetFrom(5);
                  setWiz(prev => ({ ...prev, productTypes: toggleInArray(prev.productTypes, pt) }));
                }}
              />
            ))}
          </div>
        </StepSection>
      )}

      {step1Done && step2Done && step3Done && step4Done && (
        <StepSection
          stepNum={5}
          title="Products"
          done={step5Done}
          summary={step5Done ? `${wiz.selectedProductIds.size} selected` : ""}
          expanded={expandedStep === 5 || (step4Done && !step5Done)}
          onToggle={() => setExpandedStep(expandedStep === 5 ? null : 5)}
          onReset={() => { resetFrom(5); setExpandedStep(null); }}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{filteredProducts.length} products available</span>
              <div className="flex gap-2">
                <button type="button" className="text-xs text-emerald-400 hover:underline" onClick={selectAll}>Select All</button>
                <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={deselectAll}>Clear</button>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-2 bg-background">
              {filteredProducts.map(p => {
                const checked = wiz.selectedProductIds.has(p.id);
                return (
                  <label
                    key={p.id}
                    className={cn(
                      "flex items-center gap-2 p-1.5 rounded cursor-pointer text-xs transition-colors",
                      checked ? "bg-emerald-900/20" : "hover:bg-secondary"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                      checked ? "bg-emerald-600 border-emerald-600" : "border-border"
                    )}>
                      {checked && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleProduct(p.id)} />
                    <span className="font-medium truncate flex-1">{p.shortname}</span>
                    {p.keyCode && <span className="text-muted-foreground">{p.keyCode}</span>}
                    {p.colour && <span className="text-muted-foreground">{p.colour}</span>}
                    <Badge variant="secondary" className="text-[10px] px-1.5">{STATUS_LABELS[p.uploadStatus] || p.uploadStatus}</Badge>
                  </label>
                );
              })}
            </div>
            {wiz.selectedProductIds.size > 0 && (
              <p className="text-xs font-medium text-emerald-400">{wiz.selectedProductIds.size} product{wiz.selectedProductIds.size !== 1 ? "s" : ""} selected</p>
            )}
          </div>
        </StepSection>
      )}

      <div className="space-y-3 pt-2 border-t border-border">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Details</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Date</Label>
            <Input type="date" value={wiz.date} onChange={e => setWiz(prev => ({ ...prev, date: e.target.value }))} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Model - Product</Label>
            <Input value={wiz.modelName} onChange={e => setWiz(prev => ({ ...prev, modelName: e.target.value }))} placeholder="e.g. Akin Jacket" className="h-8 text-xs" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Notes</Label>
          <Textarea value={wiz.notes} onChange={e => setWiz(prev => ({ ...prev, notes: e.target.value }))} placeholder="Any notes..." className="text-xs min-h-[60px]" />
        </div>
        <Button onClick={handleSubmit} className="w-full" disabled={!canSubmit || isSubmitting}>
          {editingSession
            ? (isSubmitting ? "Saving..." : "Save Changes")
            : (isSubmitting ? "Booking..." : `Book Photo Shoot${wiz.selectedProductIds.size > 0 ? ` (${wiz.selectedProductIds.size} products)` : ""}`)}
        </Button>
      </div>
    </div>
  );
}

function StepSection({ stepNum, title, done, summary, expanded, onToggle, onReset, children }: {
  stepNum: number; title: string; done: boolean; summary: string; expanded: boolean;
  onToggle: () => void; onReset: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <button
        type="button"
        className="w-full flex items-center justify-between p-3 text-left hover:bg-secondary/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
            done ? "bg-emerald-600 text-white" : "bg-secondary text-muted-foreground"
          )}>
            {done ? <Check className="w-3 h-3" /> : stepNum}
          </div>
          <span className="text-sm font-medium">{title}</span>
          {done && summary && <span className="text-xs text-muted-foreground ml-1">— {summary}</span>}
        </div>
        <div className="flex items-center gap-1">
          {done && (
            <button
              type="button"
              className="text-[10px] text-muted-foreground hover:text-foreground px-1"
              onClick={e => { e.stopPropagation(); onReset(); }}
            >
              Change
            </button>
          )}
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>
      {expanded && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

export default function Sessions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: sessions, isLoading } = useQuery({ queryKey: ["sessions"], queryFn: api.getSessions });

  const [open, setOpen] = React.useState(false);
  const [editingSession, setEditingSession] = React.useState<any>(null);

  const openEdit = (session: any) => {
    setEditingSession(session);
    setOpen(true);
  };

  const openCreate = () => {
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
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>{editingSession ? "Edit Photo Shoot" : "Book a Photo Shoot"}</DialogTitle></DialogHeader>
              {open && <BookingWizard editingSession={editingSession} onClose={() => { setOpen(false); setEditingSession(null); }} />}
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
              {s.productCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Package className="w-3 h-3" />{s.productCount}
                </span>
              )}
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
