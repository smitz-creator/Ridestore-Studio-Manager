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
const MODELS = ["Alma", "Norton"];

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

  const [brands, setBrands] = React.useState<string[]>([]);
  const [genders, setGenders] = React.useState<string[]>([]);
  const [productTypes, setProductTypes] = React.useState<string[]>([]);
  const [selectedProductIds, setSelectedProductIds] = React.useState<Set<number>>(new Set());
  const [date, setDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [modelName, setModelName] = React.useState("");
  const [modelMode, setModelMode] = React.useState<"preset" | "other">("preset");
  const [shotTypes, setShotTypes] = React.useState<string[]>([]);
  const [notes, setNotes] = React.useState("");
  const [expandedStep, setExpandedStep] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (editingSession) {
      const eBrands = parseMulti(editingSession.brand);
      const eShotTypes = parseMulti(editingSession.shotType);
      const dateStr = editingSession.date ? new Date(editingSession.date).toISOString().split("T")[0] : "";
      setBrands(eBrands);
      setShotTypes(eShotTypes);
      setDate(dateStr);
      setNotes(editingSession.notes || "");
      const name = editingSession.modelName || "";
      if (MODELS.includes(name)) {
        setModelName(name);
        setModelMode("preset");
      } else {
        setModelName(name);
        setModelMode(name ? "other" : "preset");
      }
    }
  }, [editingSession]);

  React.useEffect(() => {
    if (editingSession && existingProductIds && allProducts.length > 0) {
      setSelectedProductIds(new Set(existingProductIds));
      if (existingProductIds.length > 0) {
        const existing = allProducts.filter(p => existingProductIds.includes(p.id));
        const g = [...new Set(existing.map(p => p.gender))];
        const pt = [...new Set(existing.map(p => p.productType))];
        if (g.length > 0) setGenders(g);
        if (pt.length > 0) setProductTypes(pt);
      }
    }
  }, [editingSession, existingProductIds, allProducts]);

  const availableBrands = React.useMemo(() => [...new Set(allProducts.map(p => p.brand))].sort(), [allProducts]);

  const filteredByBrand = React.useMemo(() => {
    if (brands.length === 0) return [];
    return allProducts.filter(p => brands.includes(p.brand));
  }, [allProducts, brands]);

  const availableGenders = React.useMemo(() => [...new Set(filteredByBrand.map(p => p.gender))].sort(), [filteredByBrand]);

  const filteredByGender = React.useMemo(() => {
    if (genders.length === 0) return [];
    return filteredByBrand.filter(p => genders.includes(p.gender));
  }, [filteredByBrand, genders]);

  const availableProductTypes = React.useMemo(() => [...new Set(filteredByGender.map(p => p.productType))].sort(), [filteredByGender]);

  const filteredProducts = React.useMemo(() => {
    if (productTypes.length === 0) return [];
    return filteredByGender.filter(p => productTypes.includes(p.productType));
  }, [filteredByGender, productTypes]);

  const resetFrom = (step: number) => {
    if (step <= 1) { setBrands([]); setGenders([]); setProductTypes([]); setSelectedProductIds(new Set()); setExpandedModels(new Set()); }
    else if (step <= 2) { setGenders([]); setProductTypes([]); setSelectedProductIds(new Set()); setExpandedModels(new Set()); }
    else if (step <= 3) { setProductTypes([]); setSelectedProductIds(new Set()); setExpandedModels(new Set()); }
    else if (step <= 4) { setSelectedProductIds(new Set()); setExpandedModels(new Set()); }
  };

  const toggleProduct = (id: number) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedProductIds(new Set(filteredProducts.map(p => p.id)));
  const deselectAll = () => setSelectedProductIds(new Set());

  const [expandedModels, setExpandedModels] = React.useState<Set<string>>(new Set());

  const modelGroups = React.useMemo(() => {
    const groups: Record<string, WizardProduct[]> = {};
    for (const p of filteredProducts) {
      const key = p.shortname;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredProducts]);

  const selectedModels = React.useMemo(() => {
    const full: string[] = [];
    const partial: string[] = [];
    for (const [model, products] of modelGroups) {
      const count = products.filter(p => selectedProductIds.has(p.id)).length;
      if (count === products.length) full.push(model);
      else if (count > 0) partial.push(model);
    }
    return { full, partial, any: [...full, ...partial] };
  }, [modelGroups, selectedProductIds]);

  const toggleModel = (model: string, products: WizardProduct[]) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      const allSelected = products.every(p => next.has(p.id));
      if (allSelected) {
        products.forEach(p => next.delete(p.id));
      } else {
        products.forEach(p => next.add(p.id));
      }
      return next;
    });
  };

  const selectAllModels = () => setSelectedProductIds(new Set(filteredProducts.map(p => p.id)));
  const clearAllModels = () => { setSelectedProductIds(new Set()); setExpandedModels(new Set()); setShowAllModels(false); };

  const hasAnyModelSelected = selectedModels.any.length > 0;
  const [showAllModels, setShowAllModels] = React.useState(false);

  const toggleExpandModel = (model: string) => {
    setExpandedModels(prev => {
      const next = new Set(prev);
      if (next.has(model)) next.delete(model); else next.add(model);
      return next;
    });
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

  const step1Done = brands.length > 0;
  const step2Done = genders.length > 0;
  const step3Done = productTypes.length > 0;
  const step4Done = selectedProductIds.size > 0;
  const showDetails = step4Done;

  const canSubmit = step1Done && step4Done && date && modelName.trim() && shotTypes.length > 0;

  const handleSubmit = () => {
    if (!date) { toast({ title: "Date is required", variant: "destructive" }); return; }
    if (!modelName.trim()) { toast({ title: "Model is required", variant: "destructive" }); return; }
    if (shotTypes.length === 0) { toast({ title: "Select at least one shot type", variant: "destructive" }); return; }

    const payload = {
      date,
      modelName,
      brand: brands.join(", "),
      shotType: shotTypes.join(", "),
      notes,
      productIds: [...selectedProductIds],
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
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Product Selection</div>

      <StepSection
        stepNum={1}
        title="Brand"
        done={step1Done}
        summary={step1Done ? brands.join(", ") : ""}
        expanded={expandedStep === 1 || !step1Done}
        onToggle={() => setExpandedStep(expandedStep === 1 ? null : 1)}
        onReset={() => { resetFrom(1); setExpandedStep(null); }}
      >
        <div className="flex flex-wrap gap-2">
          {availableBrands.map(b => (
            <ToggleChip
              key={b}
              label={b}
              selected={brands.includes(b)}
              onClick={() => { resetFrom(2); setBrands(prev => toggleInArray(prev, b)); }}
            />
          ))}
        </div>
      </StepSection>

      {step1Done && (
        <StepSection
          stepNum={2}
          title="Gender"
          done={step2Done}
          summary={step2Done ? genders.join(", ") : ""}
          expanded={expandedStep === 2 || (step1Done && !step2Done)}
          onToggle={() => setExpandedStep(expandedStep === 2 ? null : 2)}
          onReset={() => { resetFrom(2); setExpandedStep(null); }}
        >
          <div className="flex flex-wrap gap-2">
            {availableGenders.map(g => (
              <ToggleChip
                key={g}
                label={g}
                selected={genders.includes(g)}
                onClick={() => { resetFrom(3); setGenders(prev => toggleInArray(prev, g)); }}
              />
            ))}
          </div>
        </StepSection>
      )}

      {step1Done && step2Done && (
        <StepSection
          stepNum={3}
          title="Product Type"
          done={step3Done}
          summary={step3Done ? productTypes.join(", ") : ""}
          expanded={expandedStep === 3 || (step2Done && !step3Done)}
          onToggle={() => setExpandedStep(expandedStep === 3 ? null : 3)}
          onReset={() => { resetFrom(3); setExpandedStep(null); }}
        >
          <div className="flex flex-wrap gap-2">
            {availableProductTypes.map(pt => (
              <ToggleChip
                key={pt}
                label={pt}
                selected={productTypes.includes(pt)}
                onClick={() => { resetFrom(4); setProductTypes(prev => toggleInArray(prev, pt)); }}
              />
            ))}
          </div>
        </StepSection>
      )}

      {step1Done && step2Done && step3Done && (
        <StepSection
          stepNum={4}
          title="Products"
          done={step4Done}
          summary={step4Done ? `${selectedModels.any.length} model${selectedModels.any.length !== 1 ? "s" : ""}, ${selectedProductIds.size} products selected` : ""}
          expanded={expandedStep === 4 || (step3Done && !step4Done)}
          onToggle={() => setExpandedStep(expandedStep === 4 ? null : 4)}
          onReset={() => { resetFrom(4); setExpandedModels(new Set()); setExpandedStep(null); }}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{modelGroups.length} models, {filteredProducts.length} products</span>
              <div className="flex gap-2">
                <button type="button" className="text-xs text-emerald-400 hover:underline" onClick={selectAllModels}>Select All</button>
                {selectedProductIds.size > 0 && (
                  <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={clearAllModels}>Clear</button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {modelGroups.map(([model, products]) => {
                const isFull = selectedModels.full.includes(model);
                const isPartial = selectedModels.partial.includes(model);
                const isSelected = isFull || isPartial;
                if (hasAnyModelSelected && !isSelected && !showAllModels) return null;
                const selectedCount = products.filter(p => selectedProductIds.has(p.id)).length;
                return (
                  <div key={model} className="flex flex-col">
                    <ToggleChip
                      label={`${model} (${isPartial ? `${selectedCount}/` : ""}${products.length})`}
                      selected={isFull}
                      onClick={() => toggleModel(model, products)}
                    />
                  </div>
                );
              })}
            </div>

            {hasAnyModelSelected && !showAllModels && modelGroups.length > selectedModels.any.length && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                onClick={() => setShowAllModels(true)}
              >
                Show all models
              </button>
            )}

            {showAllModels && hasAnyModelSelected && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                onClick={() => setShowAllModels(false)}
              >
                Hide unselected
              </button>
            )}

            {selectedModels.any.length > 0 && (
              <div className="space-y-1">
                {selectedModels.any.map(model => {
                  const products = modelGroups.find(([m]) => m === model)?.[1] || [];
                  const isExpanded = expandedModels.has(model);
                  return (
                    <div key={model} className="border rounded-md bg-background overflow-hidden">
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-secondary/50 transition-colors"
                        onClick={() => toggleExpandModel(model)}
                      >
                        <span className="font-medium">{model} <span className="text-muted-foreground">({products.length})</span></span>
                        <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                      </button>
                      {isExpanded && (
                        <div className="border-t px-2 py-1 space-y-0.5 max-h-40 overflow-y-auto">
                          {products.map(p => {
                            const checked = selectedProductIds.has(p.id);
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
                                <span className="truncate flex-1">{p.colour || p.keyCode || "—"}</span>
                                {p.keyCode && p.colour && <span className="text-muted-foreground">{p.keyCode}</span>}
                                <Badge variant="secondary" className="text-[10px] px-1.5">{STATUS_LABELS[p.uploadStatus] || p.uploadStatus}</Badge>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {selectedProductIds.size > 0 && (
              <p className="text-xs font-medium text-emerald-400">{selectedProductIds.size} product{selectedProductIds.size !== 1 ? "s" : ""} selected</p>
            )}
          </div>
        </StepSection>
      )}

      {showDetails && (
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Shoot Details</div>

          <div className="space-y-1">
            <Label className="text-xs">Date</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 text-xs" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Model</Label>
            <div className="flex flex-wrap gap-2">
              {MODELS.map(m => (
                <ToggleChip
                  key={m}
                  label={m}
                  selected={modelMode === "preset" && modelName === m}
                  onClick={() => { setModelMode("preset"); setModelName(m); }}
                />
              ))}
              <ToggleChip
                label="Other"
                selected={modelMode === "other"}
                onClick={() => { setModelMode("other"); setModelName(""); }}
              />
            </div>
            {modelMode === "other" && (
              <Input value={modelName} onChange={e => setModelName(e.target.value)} placeholder="Enter model name" className="h-8 text-xs mt-2" />
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Shot Type</Label>
            <div className="flex flex-wrap gap-2">
              {SHOT_TYPES.map(s => (
                <ToggleChip
                  key={s}
                  label={s}
                  selected={shotTypes.includes(s)}
                  onClick={() => setShotTypes(prev => toggleInArray(prev, s))}
                  hint={s === "Mixed" ? "Gallery + Details in the same session" : undefined}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes..." className="text-xs min-h-[60px]" />
          </div>

          <Button onClick={handleSubmit} className="w-full" disabled={!canSubmit || isSubmitting}>
            {editingSession
              ? (isSubmitting ? "Saving..." : "Save Changes")
              : (isSubmitting ? "Booking..." : `Book Photo Shoot (${selectedProductIds.size} products)`)}
          </Button>
        </div>
      )}
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
  const [productTypeFilter, setProductTypeFilter] = React.useState<string>("all");

  const allProductTypes = React.useMemo(() => {
    if (!sessions) return [];
    const types = new Set<string>();
    for (const s of sessions as any[]) {
      for (const t of (s.productTypes || [])) types.add(t);
    }
    return [...types].sort();
  }, [sessions]);

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
  const filtered = sessions?.filter((s: any) =>
    productTypeFilter === "all" || (s.productTypes || []).includes(productTypeFilter)
  ) || [];
  const upcoming = filtered.filter((s: any) => new Date(s.date) >= today);
  const past = filtered.filter((s: any) => new Date(s.date) < today);

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Studio Photo Shoots</h1>
          <div className="flex items-center gap-2">
            <select
              value={productTypeFilter}
              onChange={e => setProductTypeFilter(e.target.value)}
              className="h-8 rounded-md border bg-background px-2 text-sm"
            >
              <option value="all">All Types</option>
              {allProductTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> Book a Photo Shoot</Button>
          </div>
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
