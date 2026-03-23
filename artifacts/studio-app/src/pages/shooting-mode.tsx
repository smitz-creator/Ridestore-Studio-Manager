import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn, formatDate } from "@/lib/utils";
import {
  ArrowLeft, ArrowRight, Check, Copy, X, Camera,
  CheckCircle2, Circle, Loader2, ChevronDown, ChevronRight,
  AlertTriangle, Plus
} from "lucide-react";

const BRANDS = [
  { id: "DOPESNOW", label: "DOPE SNOW", brand: "Dope Snow" },
  { id: "MONTEC", label: "MONTEC", brand: "Montec" },
];

const GENDERS = [
  { id: "MEN", label: "MEN" },
  { id: "WOMEN", label: "WOMEN" },
];

const PRODUCT_TYPES = [
  { id: "JACKET", label: "JACKET", types: ["Snowboard Jacket"] },
  { id: "PANTS", label: "PANTS", types: ["Snowboard Pants"] },
  { id: "BASELAYER", label: "BASELAYER", types: ["Base Layer Pant", "Base Layer Top"], grouped: true },
  { id: "FLEECE", label: "FLEECE", types: ["Fleece Hoodie", "Fleece Sweater"], grouped: true },
  { id: "BEANIE", label: "BEANIE", types: ["Beanie"] },
  { id: "FACEMASK", label: "FACEMASK", types: ["Facemask"] },
  { id: "GLOVES", label: "GLOVES", types: ["Ski Gloves"] },
  { id: "GOGGLE", label: "GOGGLE", types: ["Ski Goggle"] },
  { id: "MITTENS", label: "MITTENS", types: ["Snow Mittens"] },
  { id: "LENS", label: "LENS", types: ["Replacement Lens Ski"] },
];

type ShootingStep = "suggest" | 1 | 2 | "confirm" | 3 | 4;

const RESHOOT_STATUSES = new Set([
  "ready_for_selection", "ready_for_retouch", "in_post_production",
  "post_production_done", "ready_for_upload", "uploaded",
]);

type ShootingState = {
  step: ShootingStep;
  brand: typeof BRANDS[number] | null;
  gender: typeof GENDERS[number] | null;
  productType: typeof PRODUCT_TYPES[number] | null;
  sessionName: string;
  selectedProductIds: number[];
  previousStatuses: Map<number, string>;
  continueMode: boolean;
};

function parseMulti(val: string | undefined | null): string[] {
  if (!val) return [];
  return val.split(",").map(s => s.trim()).filter(Boolean);
}

export default function ShootingMode() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: sessions } = useQuery({
    queryKey: ["sessions"],
    queryFn: api.getSessions,
  });

  const todaySessions = React.useMemo(() => {
    if (!sessions) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return sessions.filter((s: any) => {
      const d = new Date(s.date);
      return d >= today && d < tomorrow && (s.productCount || 0) > 0;
    });
  }, [sessions]);

  const hasSuggestions = todaySessions.length > 0;

  const [state, setState] = React.useState<ShootingState>({
    step: 1,
    brand: null,
    gender: null,
    productType: null,
    sessionName: "",
    selectedProductIds: [],
    previousStatuses: new Map(),
    continueMode: false,
  });

  const [initialStepResolved, setInitialStepResolved] = React.useState(false);

  React.useEffect(() => {
    if (sessions && !initialStepResolved) {
      setInitialStepResolved(true);
      if (hasSuggestions) {
        setState(s => ({ ...s, step: "suggest" }));
      }
    }
  }, [sessions, hasSuggestions, initialStepResolved]);

  const { data: allProducts } = useQuery({
    queryKey: ["all-products"],
    queryFn: () => api.getProducts(),
  });

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: api.getProjects,
  });

  const bulkUpdateMut = useMutation({
    mutationFn: ({ productIds, uploadStatus }: { productIds: number[]; uploadStatus: string }) =>
      api.bulkUpdateStatus(productIds, uploadStatus),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const updateProductMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      api.updateProduct(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const filteredProducts = React.useMemo(() => {
    if (!allProducts || !state.brand) return [];

    const brandProjects = projects?.filter((p: any) => p.brand === state.brand!.brand) || [];
    const projectIds = new Set(brandProjects.map((p: any) => p.id));

    if (state.continueMode) {
      return allProducts.filter((p: any) => projectIds.has(p.projectId));
    }

    let products = allProducts.filter((p: any) =>
      projectIds.has(p.projectId) && !p.factoryDelayed
    );

    if (state.gender) {
      products = products.filter((p: any) =>
        p.gender?.toLowerCase() === state.gender!.id.toLowerCase()
      );
    }

    if (state.productType) {
      const typeNames = state.productType.types.map(t => t.toLowerCase());
      products = products.filter((p: any) =>
        typeNames.includes(p.productType?.toLowerCase())
      );
    }

    return products;
  }, [allProducts, projects, state.brand, state.gender, state.productType, state.continueMode]);

  const models = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const p of filteredProducts) {
      const key = p.shortname || "Unknown";
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredProducts]);

  const [step2Selected, setStep2Selected] = React.useState<Set<number>>(new Set());
  const [confirmAvailable, setConfirmAvailable] = React.useState<Set<number>>(new Set());

  const handleSelectBrand = (brand: typeof BRANDS[number]) => {
    setState(s => ({ ...s, brand, gender: null, productType: null }));
  };

  const handleSelectGender = (gender: typeof GENDERS[number]) => {
    setState(s => ({ ...s, gender, productType: null }));
  };

  const handleSelectProductType = (pt: typeof PRODUCT_TYPES[number]) => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const month = now.getMonth();
    const seasonPrefix = month >= 3 && month <= 8 ? "SS" : "FW";
    const yr = String(now.getFullYear()).slice(-2);
    const name = `${state.brand!.id}_${state.gender!.id}_${pt.id}_${seasonPrefix}${yr}_${dd}.${mm}`;
    setState(s => ({
      ...s,
      productType: pt,
      sessionName: name,
      step: 2,
    }));
    setStep2Selected(new Set());
  };

  const handleStep2Toggle = (id: number) => {
    setStep2Selected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleModel = (modelName: string) => {
    const modelProducts = filteredProducts.filter((p: any) =>
      (p.shortname || "Unknown") === modelName && !state.selectedProductIds.includes(p.id)
    );
    const modelIds = modelProducts.map((p: any) => p.id);
    const allSelected = modelIds.every(id => step2Selected.has(id));

    setStep2Selected(prev => {
      const next = new Set(prev);
      if (allSelected) {
        modelIds.forEach(id => next.delete(id));
      } else {
        modelIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const availableIds = filteredProducts
      .filter((p: any) => !state.selectedProductIds.includes(p.id))
      .map((p: any) => p.id);
    const allSelected = availableIds.every(id => step2Selected.has(id));
    if (allSelected) {
      setStep2Selected(new Set());
    } else {
      setStep2Selected(new Set(availableIds));
    }
  };

  const handleGoToConfirm = () => {
    if (step2Selected.size === 0) return;
    setConfirmAvailable(new Set(step2Selected));
    setState(s => ({ ...s, step: "confirm" }));
  };

  const handleConfirmToggle = (id: number) => {
    setConfirmAvailable(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirmAndStart = async () => {
    const availableIds = [...confirmAvailable];
    const unavailableIds = [...step2Selected].filter(id => !confirmAvailable.has(id));

    if (availableIds.length === 0) return;

    for (const id of unavailableIds) {
      await updateProductMut.mutateAsync({
        id,
        data: { factoryDelayed: true, deliveryStatus: "delayed_at_factory" },
      });
    }
    if (unavailableIds.length > 0) {
      toast({ title: `${unavailableIds.length} product${unavailableIds.length !== 1 ? "s" : ""} marked as factory delayed` });
    }

    const prevStatuses = new Map<number, string>();
    const reshootIds: number[] = [];
    for (const id of availableIds) {
      const product = allProducts?.find((p: any) => p.id === id);
      if (product) {
        prevStatuses.set(id, product.uploadStatus);
        if (RESHOOT_STATUSES.has(product.uploadStatus)) {
          reshootIds.push(id);
        }
      }
    }

    for (const id of reshootIds) {
      await updateProductMut.mutateAsync({ id, data: { isReshoot: true } });
    }
    if (reshootIds.length > 0) {
      toast({ title: `${reshootIds.length} product${reshootIds.length !== 1 ? "s" : ""} tagged as reshoot` });
    }

    setState(s => ({
      ...s,
      step: 3,
      selectedProductIds: [...s.selectedProductIds, ...availableIds],
      previousStatuses: new Map([...s.previousStatuses, ...prevStatuses]),
    }));

    await bulkUpdateMut.mutateAsync({ productIds: availableIds, uploadStatus: "in_the_studio" });
    toast({ title: `${availableIds.length} products moved to "In the Studio"` });
  };

  const handleEndSession = () => {
    setState(s => ({ ...s, step: 4 }));
  };

  const handleBackToSelection = () => {
    setState(s => ({
      ...s,
      step: 2,
      continueMode: true,
    }));
    setStep2Selected(new Set());
  };

  const handleContinue = () => {
    setState(s => ({
      ...s,
      step: 2,
      continueMode: true,
    }));
    setStep2Selected(new Set());
  };

  const productHasAnyShot = React.useCallback((id: number) => {
    const p = allProducts?.find((pr: any) => pr.id === id);
    if (!p) return false;
    const sn = state.sessionName;
    const inField = (field: string) => {
      const val = p[field];
      if (!val) return false;
      return val.split(",").map((s: string) => s.trim()).filter(Boolean).includes(sn);
    };
    return inField("galleryShots") || inField("detailsShots") || inField("miscShots") || p.isCarryOver;
  }, [allProducts, state.sessionName]);

  const handleCloseSession = async () => {
    const shotIds = state.selectedProductIds.filter(id => productHasAnyShot(id));
    const uncheckedIds = state.selectedProductIds.filter(id => !productHasAnyShot(id));

    if (shotIds.length > 0) {
      await bulkUpdateMut.mutateAsync({ productIds: shotIds, uploadStatus: "ready_for_selection" });
      toast({ title: `${shotIds.length} product${shotIds.length !== 1 ? "s" : ""} moved to "Ready for Selection"` });
    }

    if (uncheckedIds.length > 0) {
      for (const id of uncheckedIds) {
        const prevStatus = state.previousStatuses.get(id) || "not_started";
        await bulkUpdateMut.mutateAsync({ productIds: [id], uploadStatus: prevStatus });
      }
      toast({ title: `${uncheckedIds.length} product${uncheckedIds.length !== 1 ? "s" : ""} without shots reverted to previous status` });
    }

    setState({
      step: 1,
      brand: null,
      gender: null,
      productType: null,
      sessionName: "",
      selectedProductIds: [],
      previousStatuses: new Map(),
      continueMode: false,
    });
  };

  const handleCopySessionName = () => {
    navigator.clipboard.writeText(state.sessionName);
    toast({ title: "Session name copied" });
  };

  const handleBackToStep1 = () => {
    setState({
      step: 1,
      brand: null,
      gender: null,
      productType: null,
      sessionName: "",
      selectedProductIds: [],
      previousStatuses: new Map(),
      continueMode: false,
    });
  };

  const sessionName = React.useMemo(() => {
    if (!state.brand || !state.gender || !state.productType) return "";
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const month = now.getMonth();
    const seasonPrefix = month >= 3 && month <= 8 ? "SS" : "FW";
    const yr = String(now.getFullYear()).slice(-2);
    return `${state.brand.id}_${state.gender.id}_${state.productType.id}_${seasonPrefix}${yr}_${dd}.${mm}`;
  }, [state.brand, state.gender, state.productType]);

  const handleUseSuggestion = async (session: any) => {
    const products = await api.getSessionProducts(session.id);
    const productIds = products.map((p: any) => p.id);
    if (productIds.length === 0) {
      toast({ title: "No products linked to this shoot", variant: "destructive" });
      return;
    }

    const brandNames = parseMulti(session.brand);
    const brand = BRANDS.find(b => brandNames.includes(b.brand)) || null;

    const firstProduct = products[0];
    const genderKey = firstProduct?.gender?.toUpperCase();
    const gender = GENDERS.find(g => g.id === genderKey) || null;

    const productTypeNames = [...new Set(products.map((p: any) => p.productType?.toLowerCase()))];
    const pt = PRODUCT_TYPES.find(t => t.types.some(tt => productTypeNames.includes(tt.toLowerCase()))) || null;

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const month = now.getMonth();
    const seasonPrefix = month >= 3 && month <= 8 ? "SS" : "FW";
    const yr = String(now.getFullYear()).slice(-2);
    const sName = brand && gender && pt
      ? `${brand.id}_${gender.id}_${pt.id}_${seasonPrefix}${yr}_${dd}.${mm}`
      : `SHOOT_${seasonPrefix}${yr}_${dd}.${mm}`;

    setState(s => ({
      ...s,
      step: 2,
      brand,
      gender,
      productType: pt,
      sessionName: sName,
    }));
    setStep2Selected(new Set(productIds));
  };

  const handleSkipSuggestions = () => {
    setState(s => ({ ...s, step: 1 }));
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        {state.step === "suggest" && (
          <StepSuggestion
            sessions={todaySessions}
            onUseSuggestion={handleUseSuggestion}
            onSkip={handleSkipSuggestions}
          />
        )}

        {state.step === 1 && (
          <Step1
            state={state}
            sessionName={sessionName}
            onSelectBrand={handleSelectBrand}
            onSelectGender={handleSelectGender}
            onSelectProductType={handleSelectProductType}
          />
        )}

        {state.step === 2 && (
          <Step2
            state={state}
            products={filteredProducts}
            models={models}
            selected={step2Selected}
            onToggle={handleStep2Toggle}
            onToggleModel={handleToggleModel}
            onSelectAll={handleSelectAll}
            onNext={handleGoToConfirm}
            onBack={() => state.continueMode ? setState(s => ({ ...s, step: 3 })) : handleBackToStep1()}
            loading={bulkUpdateMut.isPending}
          />
        )}

        {state.step === "confirm" && (
          <StepConfirm
            state={state}
            allProducts={allProducts || []}
            selected={step2Selected}
            available={confirmAvailable}
            onToggle={handleConfirmToggle}
            onConfirm={handleConfirmAndStart}
            onBack={() => setState(s => ({ ...s, step: 2 }))}
            loading={bulkUpdateMut.isPending || updateProductMut.isPending}
          />
        )}

        {state.step === 3 && (
          <Step3
            state={state}
            products={allProducts || []}
            onUpdateProduct={(id: number, data: any) => updateProductMut.mutateAsync({ id, data })}
            onCopy={handleCopySessionName}
            onEnd={handleEndSession}
            onAddMore={handleBackToSelection}
            onClose={handleCloseSession}
            updating={updateProductMut.isPending}
            closingLoading={bulkUpdateMut.isPending || updateProductMut.isPending}
          />
        )}

        {state.step === 4 && (
          <Step4
            state={state}
            products={allProducts || []}
            onContinue={handleContinue}
            onClose={handleCloseSession}
            loading={bulkUpdateMut.isPending}
          />
        )}
      </div>
    </Layout>
  );
}

function Step1({ state, sessionName, onSelectBrand, onSelectGender, onSelectProductType }: {
  state: ShootingState;
  sessionName: string;
  onSelectBrand: (b: typeof BRANDS[number]) => void;
  onSelectGender: (g: typeof GENDERS[number]) => void;
  onSelectProductType: (pt: typeof PRODUCT_TYPES[number]) => void;
}) {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Camera className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Shooting Mode</h1>
        </div>
        <p className="text-muted-foreground">Set up your studio session</p>
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">1. Brand</h2>
          <div className="grid grid-cols-2 gap-3">
            {BRANDS.map(b => (
              <button
                key={b.id}
                onClick={() => onSelectBrand(b)}
                className={cn(
                  "p-6 rounded-xl text-lg font-bold border-2 transition-all",
                  state.brand?.id === b.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50 hover:bg-secondary"
                )}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {state.brand && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">2. Gender</h2>
            <div className="grid grid-cols-2 gap-3">
              {GENDERS.map(g => (
                <button
                  key={g.id}
                  onClick={() => onSelectGender(g)}
                  className={cn(
                    "p-6 rounded-xl text-lg font-bold border-2 transition-all",
                    state.gender?.id === g.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50 hover:bg-secondary"
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {state.brand && state.gender && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">3. Product Type</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PRODUCT_TYPES.map(pt => (
                <button
                  key={pt.id}
                  onClick={() => onSelectProductType(pt)}
                  className={cn(
                    "p-4 rounded-xl text-sm font-bold border-2 transition-all",
                    state.productType?.id === pt.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50 hover:bg-secondary"
                  )}
                >
                  {pt.label}
                  {pt.grouped && (
                    <span className="block text-[10px] font-normal text-muted-foreground mt-1">
                      {pt.types.join(" + ")}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {sessionName && (
          <div className="bg-muted/50 rounded-lg p-4 text-center animate-in fade-in">
            <p className="text-xs text-muted-foreground mb-1">Session Name</p>
            <div className="flex items-center justify-center gap-2">
              <p className="text-lg font-mono font-bold">{sessionName}</p>
              <button
                onClick={() => { navigator.clipboard.writeText(sessionName); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Copy session name"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Step2({ state, products, models, selected, onToggle, onToggleModel, onSelectAll, onNext, onBack, loading }: {
  state: ShootingState;
  products: any[];
  models: [string, number][];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onToggleModel: (model: string) => void;
  onSelectAll: () => void;
  onNext: () => void;
  onBack: () => void;
  loading: boolean;
}) {
  const [expandedModels, setExpandedModels] = React.useState<Set<string>>(new Set());

  const toggleExpand = (model: string) => {
    setExpandedModels(prev => {
      const next = new Set(prev);
      if (next.has(model)) next.delete(model);
      else next.add(model);
      return next;
    });
  };

  const productsByModel = React.useMemo(() => {
    const map = new Map<string, any[]>();
    for (const p of products) {
      const key = p.shortname || "Unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [products]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Select Products</h1>
            <p className="text-sm text-muted-foreground font-mono">{state.sessionName}</p>
          </div>
        </div>
        <Badge variant="outline">{selected.size} selected</Badge>
      </div>

      {state.continueMode && (
        <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3 text-sm text-blue-300">
          All product types for {state.brand?.label} are now available.
        </div>
      )}

      {state.productType?.grouped && !state.continueMode && (
        <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-3 text-sm text-amber-300">
          This includes both {state.productType.types.join(" and ")}.
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onSelectAll}>
          {selected.size > 0 && products.filter(p => !state.selectedProductIds.includes(p.id)).every(p => selected.has(p.id)) ? "Deselect All" : "Select All"}
        </Button>
        <span className="text-xs text-muted-foreground">{models.length} models, {products.length} products</span>
      </div>

      <div className="border rounded-lg overflow-hidden max-h-[55vh] overflow-y-auto">
        {models.length === 0 ? (
          <p className="p-6 text-center text-muted-foreground text-sm">No matching products found</p>
        ) : (
          <div className="divide-y">
            {models.map(([modelName]) => {
              const modelProducts = productsByModel.get(modelName) || [];
              const selectableProducts = modelProducts.filter(p => !state.selectedProductIds.includes(p.id));
              const selectedInModel = selectableProducts.filter(p => selected.has(p.id)).length;
              const isExpanded = expandedModels.has(modelName);
              const allModelSelected = selectableProducts.length > 0 && selectedInModel === selectableProducts.length;
              const inSessionCount = modelProducts.filter(p => state.selectedProductIds.includes(p.id)).length;

              return (
                <div key={modelName}>
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors">
                    <Checkbox
                      checked={allModelSelected}
                      onCheckedChange={() => onToggleModel(modelName)}
                      disabled={selectableProducts.length === 0}
                    />
                    <button
                      onClick={() => toggleExpand(modelName)}
                      className="flex-1 flex items-center gap-2 text-left"
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      <span className="font-medium text-sm">{modelName}</span>
                      <span className="text-xs text-muted-foreground">({modelProducts.length} items)</span>
                      {selectedInModel > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{selectedInModel} selected</Badge>
                      )}
                      {inSessionCount > 0 && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-cyan-100 text-cyan-800 hover:bg-cyan-100">{inSessionCount} in session</Badge>
                      )}
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="bg-background">
                      {modelProducts.map(p => {
                        const isSelected = selected.has(p.id);
                        const alreadyInSession = state.selectedProductIds.includes(p.id);
                        const statusLabel = p.uploadStatus?.replace(/_/g, " ");
                        return (
                          <div
                            key={p.id}
                            onClick={() => !alreadyInSession && onToggle(p.id)}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 pl-12 border-t transition-colors text-sm",
                              alreadyInSession ? "cursor-default bg-cyan-900/20" : isSelected ? "bg-primary/5 cursor-pointer" : "hover:bg-secondary/50 cursor-pointer"
                            )}
                          >
                            {alreadyInSession ? (
                              <CheckCircle2 className="w-4 h-4 text-cyan-600 shrink-0" />
                            ) : (
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => onToggle(p.id)}
                              />
                            )}
                            <span className="flex-1">{p.productType}</span>
                            <span className="text-muted-foreground">{p.colour || "–"}</span>
                            <span className="text-xs text-muted-foreground font-mono">{p.keyCode || ""}</span>
                            {alreadyInSession ? (
                              <Badge className="text-[10px] bg-cyan-100 text-cyan-800 hover:bg-cyan-100 shrink-0">In session</Badge>
                            ) : statusLabel && statusLabel !== "not started" ? (
                              <Badge variant="outline" className="text-[10px] shrink-0">{statusLabel}</Badge>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Button
        className="w-full"
        size="lg"
        onClick={onNext}
        disabled={selected.size === 0 || loading}
      >
        <ArrowRight className="w-4 h-4 mr-2" />
        Review Selection ({selected.size} products)
      </Button>
    </div>
  );
}

function StepConfirm({ state, allProducts, selected, available, onToggle, onConfirm, onBack, loading }: {
  state: ShootingState;
  allProducts: any[];
  selected: Set<number>;
  available: Set<number>;
  onToggle: (id: number) => void;
  onConfirm: () => void;
  onBack: () => void;
  loading: boolean;
}) {
  const selectedProducts = allProducts.filter(p => selected.has(p.id));
  const unavailableCount = selected.size - available.size;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Confirm Availability</h1>
            <p className="text-sm text-muted-foreground font-mono">{state.sessionName}</p>
          </div>
        </div>
        <Badge variant="outline">{available.size}/{selected.size} available</Badge>
      </div>

      <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-3 text-sm text-amber-300 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>Uncheck any products that are not available. They will be marked as "Delayed at Factory" and removed from the session.</span>
      </div>

      <div className="border rounded-lg overflow-hidden max-h-[50vh] overflow-y-auto">
        <div className="divide-y">
          {selectedProducts.map(p => {
            const isAvailable = available.has(p.id);
            return (
              <div
                key={p.id}
                onClick={() => onToggle(p.id)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors",
                  !isAvailable ? "bg-red-900/20" : "hover:bg-secondary/50"
                )}
              >
                <Checkbox
                  checked={isAvailable}
                  onCheckedChange={() => onToggle(p.id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("font-medium text-sm", !isAvailable && "line-through text-muted-foreground")}>{p.shortname}</span>
                    <span className="text-xs text-muted-foreground">{p.productType}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {p.colour && <span>{p.colour}</span>}
                    {p.keyCode && <span className="font-mono">{p.keyCode}</span>}
                  </div>
                </div>
                {!isAvailable && (
                  <Badge variant="destructive" className="text-[10px]">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Will mark delayed
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {unavailableCount > 0 && (
        <p className="text-xs text-destructive text-center">
          {unavailableCount} product{unavailableCount !== 1 ? "s" : ""} will be marked as factory delayed
        </p>
      )}

      <Button
        className="w-full"
        size="lg"
        onClick={onConfirm}
        disabled={available.size === 0 || loading}
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Setting up...</>
        ) : (
          <><Camera className="w-4 h-4 mr-2" /> Confirm & Start Shooting ({available.size} products)</>
        )}
      </Button>
    </div>
  );
}

function Step3({ state, products, onUpdateProduct, onCopy, onEnd, onAddMore, onClose, updating, closingLoading }: {
  state: ShootingState;
  products: any[];
  onUpdateProduct: (id: number, data: any) => void;
  onCopy: () => void;
  onEnd: () => void;
  onAddMore: () => void;
  onClose: () => void;
  updating: boolean;
  closingLoading: boolean;
}) {
  const sessionProducts = React.useMemo(
    () => products.filter(p => state.selectedProductIds.includes(p.id)),
    [products, state.selectedProductIds]
  );
  const { toast } = useToast();
  const total = state.selectedProductIds.length;
  const sessionName = state.sessionName;

  const hasShot = (p: any, field: string) => {
    const val = p[field];
    if (!val) return false;
    return val.split(",").map((s: string) => s.trim()).filter(Boolean).includes(sessionName);
  };

  const isComplete = (p: any) =>
    (hasShot(p, "galleryShots") && hasShot(p, "detailsShots")) || p.isCarryOver;
  const completeCount = sessionProducts.filter(isComplete).length;
  const progress = total > 0 ? (completeCount / total) * 100 : 0;

  const toggleShot = (product: any, field: string) => {
    const current = product[field] || "";
    const parts = current.split(",").map((s: string) => s.trim()).filter(Boolean);
    if (parts.includes(sessionName)) {
      const next = parts.filter((s: string) => s !== sessionName).join(", ");
      onUpdateProduct(product.id, { [field]: next });
    } else {
      const next = parts.length > 0 ? `${current}, ${sessionName}` : sessionName;
      onUpdateProduct(product.id, { [field]: next });
    }
  };

  const toggleCarryOver = (product: any) => {
    onUpdateProduct(product.id, { isCarryOver: !product.isCarryOver });
  };

  const keyCodes = sessionProducts.map((p: any) => p.keyCode).filter(Boolean);

  const copyForGallery = () => {
    navigator.clipboard.writeText(keyCodes.join("\n"));
    toast({ title: `Copied ${keyCodes.length} Key Codes for Gallery` });
  };

  const copyForDetails = () => {
    navigator.clipboard.writeText(keyCodes.map((k: string) => `${k}_DETAILS`).join("\n"));
    toast({ title: `Copied ${keyCodes.length} Key Codes for Details` });
  };

  const allComplete = total > 0 && sessionProducts.every(isComplete);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Camera className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Live Tracking</h1>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-muted-foreground">{sessionName}</span>
              <button onClick={onCopy} className="text-muted-foreground hover:text-foreground transition-colors">
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onAddMore}>
            <Plus className="w-4 h-4 mr-1" />
            Add More
          </Button>
          <Button variant="outline" size="sm" onClick={onEnd} disabled={updating}>
            End Session
          </Button>
        </div>
      </div>

      <div className="bg-card border rounded-lg p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{completeCount}/{total} complete</span>
          <span className="text-muted-foreground">{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-3 rounded-full overflow-hidden bg-zinc-800">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, backgroundColor: "#22c55e" }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={copyForGallery} disabled={keyCodes.length === 0}>
          <Copy className="w-4 h-4 mr-1.5" />
          Copy all for Gallery
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={copyForDetails} disabled={keyCodes.length === 0}>
          <Copy className="w-4 h-4 mr-1.5" />
          Copy all for Details
        </Button>
      </div>

      {allComplete && (
        <div className="bg-green-900/20 border border-green-800 rounded-lg p-4 text-center text-green-300 space-y-3">
          <CheckCircle2 className="w-8 h-8 mx-auto" />
          <p className="font-medium">All products complete!</p>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" onClick={onAddMore}>
              <Plus className="w-4 h-4 mr-1" />
              Add More Products
            </Button>
            <Button size="sm" onClick={onClose} disabled={closingLoading}>
              {closingLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
              Close Session
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-1">
        {sessionProducts.map(p => {
          const gActive = hasShot(p, "galleryShots");
          const dActive = hasShot(p, "detailsShots");
          const mActive = hasShot(p, "miscShots");
          const coActive = p.isCarryOver;
          const anyActive = gActive || dActive || mActive || coActive;
          return (
            <div
              key={p.id}
              className={cn(
                "w-full flex items-center gap-2 p-3 rounded-lg border transition-all select-none",
                anyActive
                  ? "bg-green-900/20 border-green-800/50"
                  : "bg-card border-border"
              )}
            >
              {p.keyCode && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => { navigator.clipboard.writeText(p.keyCode); toast({ title: `Copied ${p.keyCode}` }); }}
                    className="flex items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-muted"
                    title="Copy Key Code"
                  >
                    <Copy className="w-3 h-3" /><span className="text-[10px] font-medium">G</span>
                  </button>
                  <button
                    onClick={() => { navigator.clipboard.writeText(`${p.keyCode}_DETAILS`); toast({ title: `Copied ${p.keyCode}_DETAILS` }); }}
                    className="flex items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-muted"
                    title="Copy Key Code for Details"
                  >
                    <Copy className="w-3 h-3" /><span className="text-[10px] font-medium">D</span>
                  </button>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold font-mono">
                    {p.keyCode || "—"}
                  </span>
                  {p.colour && (
                    <span className="text-sm text-foreground">· {p.colour}</span>
                  )}
                  {p.isReshoot && (
                    <Badge className="text-[10px] px-1.5 py-0 bg-orange-900/30 text-orange-400 hover:bg-orange-900/30 shrink-0">Reshoot</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{p.shortname}</span>
                  <span>· {p.productType}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleShot(p, "galleryShots")}
                  className={cn(
                    "w-8 h-7 rounded text-xs font-bold transition-all",
                    gActive
                      ? "bg-green-600 text-white shadow-sm"
                      : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
                  )}
                  title={gActive ? "Gallery ✓ — click to remove" : "Mark Gallery shot"}
                >
                  G
                </button>
                <button
                  onClick={() => toggleShot(p, "detailsShots")}
                  className={cn(
                    "w-8 h-7 rounded text-xs font-bold transition-all",
                    dActive
                      ? "bg-green-600 text-white shadow-sm"
                      : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
                  )}
                  title={dActive ? "Details ✓ — click to remove" : "Mark Details shot"}
                >
                  D
                </button>
                <button
                  onClick={() => toggleShot(p, "miscShots")}
                  className={cn(
                    "w-8 h-7 rounded text-xs font-bold transition-all",
                    mActive
                      ? "bg-green-600 text-white shadow-sm"
                      : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
                  )}
                  title={mActive ? "Misc ✓ — click to remove" : "Mark Misc shot"}
                >
                  M
                </button>
                <button
                  onClick={() => toggleCarryOver(p)}
                  className={cn(
                    "w-8 h-7 rounded text-[10px] font-bold transition-all",
                    coActive
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
                  )}
                  title={coActive ? "Carry Over ✓ — click to remove" : "Mark as Carry Over"}
                >
                  CO
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SuggestionCard({ session, onUse }: { session: any; onUse: () => void }) {
  const brandParts = parseMulti(session.brand);
  const shotParts = parseMulti(session.shotType);
  const [products, setProducts] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api.getSessionProducts(session.id).then(p => { setProducts(p); setLoading(false); });
  }, [session.id]);

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="p-5 space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">{session.modelName}</h2>
          <p className="text-xs text-muted-foreground">Booked for today</p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground">Brand</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {brandParts.map(b => (
                <Badge key={b} variant="secondary" className="text-xs">{b}</Badge>
              ))}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Shot Type</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {shotParts.map(s => (
                <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
              ))}
            </div>
          </div>
        </div>

        {!loading && products.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Products</span>
              <span className="text-xs font-medium text-emerald-400">{products.length} products</span>
            </div>
            <div className="max-h-32 overflow-y-auto border rounded-md p-2 bg-background space-y-1">
              {products.map((p: any) => (
                <div key={p.id} className="flex items-center gap-2 text-xs py-0.5">
                  <span className="font-medium truncate flex-1">{p.shortname}</span>
                  {p.keyCode && <span className="text-muted-foreground">{p.keyCode}</span>}
                  {p.colour && <span className="text-muted-foreground">{p.colour}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {session.notes && (
          <div>
            <span className="text-xs text-muted-foreground">Notes</span>
            <p className="text-xs mt-0.5">{session.notes}</p>
          </div>
        )}

        <Button onClick={onUse} className="w-full" size="sm">
          <Camera className="w-4 h-4 mr-1" />
          Create session based on this suggestion
        </Button>
      </div>
    </div>
  );
}

function StepSuggestion({ sessions, onUseSuggestion, onSkip }: {
  sessions: any[];
  onUseSuggestion: (session: any) => void;
  onSkip: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Camera className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Shooting Mode</h1>
        </div>
        <p className="text-muted-foreground">You have {sessions.length === 1 ? "a shoot" : `${sessions.length} shoots`} planned for today</p>
      </div>

      <div className="space-y-3">
        {sessions.map((s: any) => (
          <SuggestionCard key={s.id} session={s} onUse={() => onUseSuggestion(s)} />
        ))}
      </div>

      <div className="text-center">
        <Button variant="outline" onClick={onSkip} size="sm">
          I want to do it my own way
        </Button>
      </div>
    </div>
  );
}

function Step4({ state, products, onContinue, onClose, loading }: {
  state: ShootingState;
  products: any[];
  onContinue: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  const sessionProducts = products.filter(p => state.selectedProductIds.includes(p.id));
  const total = state.selectedProductIds.length;
  const hasShot = (p: any, field: string) => {
    const val = p[field];
    if (!val) return false;
    return val.split(",").map((s: string) => s.trim()).filter(Boolean).includes(state.sessionName);
  };
  const shotCount = sessionProducts.filter(p => hasShot(p, "galleryShots") || hasShot(p, "detailsShots") || hasShot(p, "miscShots") || p.isCarryOver).length;
  const unchecked = total - shotCount;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <Camera className="w-12 h-12 text-primary mx-auto" />
        <h1 className="text-2xl font-bold">Session Complete</h1>
        <p className="text-muted-foreground font-mono">{state.sessionName}</p>
      </div>

      <div className="bg-card border rounded-lg p-6 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Products shot</span>
          <span className="font-medium text-green-600">{shotCount}</span>
        </div>
        {unchecked > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Not completed</span>
            <span className="font-medium text-orange-600">{unchecked}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total</span>
          <span className="font-medium">{total}</span>
        </div>
      </div>

      {unchecked > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Closing will revert {unchecked} unchecked product{unchecked !== 1 ? "s" : ""} to their previous status.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          size="lg"
          onClick={onContinue}
          className="h-auto py-4 flex-col gap-1"
        >
          <ArrowRight className="w-5 h-5" />
          <span className="text-sm font-medium">Continue Shooting</span>
          <span className="text-[10px] text-muted-foreground">Different products</span>
        </Button>
        <Button
          size="lg"
          onClick={onClose}
          disabled={loading}
          className="h-auto py-4 flex-col gap-1"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          <span className="text-sm font-medium">Close Session</span>
          <span className="text-[10px] text-muted-foreground/80">Finish & save</span>
        </Button>
      </div>
    </div>
  );
}
