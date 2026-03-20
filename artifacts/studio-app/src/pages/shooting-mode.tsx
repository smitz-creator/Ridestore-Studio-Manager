import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, ArrowRight, Check, Copy, X, Camera,
  CheckCircle2, Circle, Loader2
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

type ShootingState = {
  step: 1 | 2 | 3 | 4;
  brand: typeof BRANDS[number] | null;
  gender: typeof GENDERS[number] | null;
  productType: typeof PRODUCT_TYPES[number] | null;
  sessionName: string;
  selectedProductIds: number[];
  checkedProductIds: Set<number>;
  previousStatuses: Map<number, string>;
  continueMode: boolean;
};

export default function ShootingMode() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [state, setState] = React.useState<ShootingState>({
    step: 1,
    brand: null,
    gender: null,
    productType: null,
    sessionName: "",
    selectedProductIds: [],
    checkedProductIds: new Set(),
    previousStatuses: new Map(),
    continueMode: false,
  });

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

  const filteredProducts = React.useMemo(() => {
    if (!allProducts || !state.brand) return [];

    const brandProjects = projects?.filter((p: any) => p.brand === state.brand!.brand) || [];
    const projectIds = new Set(brandProjects.map((p: any) => p.id));

    let products = allProducts.filter((p: any) =>
      projectIds.has(p.projectId) && !p.factoryDelayed
    );

    if (state.gender) {
      products = products.filter((p: any) =>
        p.gender?.toLowerCase() === state.gender!.id.toLowerCase()
      );
    }

    if (state.continueMode) {
      return products;
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
    const set = new Set(filteredProducts.map((p: any) => p.shortname).filter(Boolean));
    return [...set].sort();
  }, [filteredProducts]);

  const [modelFilter, setModelFilter] = React.useState<string>("all");
  const [step2Selected, setStep2Selected] = React.useState<Set<number>>(new Set());
  const [groupedPromptAnswered, setGroupedPromptAnswered] = React.useState(false);

  const displayProducts = React.useMemo(() => {
    if (modelFilter === "all") return filteredProducts;
    return filteredProducts.filter((p: any) => p.shortname === modelFilter);
  }, [filteredProducts, modelFilter]);

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
    setModelFilter("all");
  };

  const handleStep2Toggle = (id: number) => {
    setStep2Selected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (step2Selected.size === displayProducts.length) {
      setStep2Selected(new Set());
    } else {
      setStep2Selected(new Set(displayProducts.map((p: any) => p.id)));
    }
  };

  const handleStartShooting = async () => {
    const ids = [...step2Selected];
    if (ids.length === 0) return;

    const prevStatuses = new Map<number, string>();
    for (const id of ids) {
      const product = allProducts?.find((p: any) => p.id === id);
      if (product) prevStatuses.set(id, product.uploadStatus);
    }

    setState(s => ({
      ...s,
      step: 3,
      selectedProductIds: [...s.selectedProductIds, ...ids],
      checkedProductIds: new Set(s.checkedProductIds),
      previousStatuses: new Map([...s.previousStatuses, ...prevStatuses]),
    }));

    await bulkUpdateMut.mutateAsync({ productIds: ids, uploadStatus: "in_the_studio" });
    toast({ title: `${ids.length} products moved to "In the Studio"` });
  };

  const handleCheckProduct = async (id: number) => {
    setState(s => {
      const next = new Set(s.checkedProductIds);
      next.add(id);
      return { ...s, checkedProductIds: next };
    });

    await bulkUpdateMut.mutateAsync({ productIds: [id], uploadStatus: "ready_for_selection" });
  };

  const handleUncheckProduct = async (id: number) => {
    setState(s => {
      const next = new Set(s.checkedProductIds);
      next.delete(id);
      return { ...s, checkedProductIds: next };
    });

    await bulkUpdateMut.mutateAsync({ productIds: [id], uploadStatus: "in_the_studio" });
  };

  const allChecked = state.selectedProductIds.length > 0 &&
    state.selectedProductIds.every(id => state.checkedProductIds.has(id));

  const handleEndSession = () => {
    setState(s => ({ ...s, step: 4 }));
  };

  const handleContinue = () => {
    setState(s => ({
      ...s,
      step: 2,
      continueMode: true,
    }));
    setStep2Selected(new Set());
    setModelFilter("all");
  };

  const handleCloseSession = async () => {
    const uncheckedIds = state.selectedProductIds.filter(id => !state.checkedProductIds.has(id));

    if (uncheckedIds.length > 0) {
      for (const id of uncheckedIds) {
        const prevStatus = state.previousStatuses.get(id) || "not_started";
        await bulkUpdateMut.mutateAsync({ productIds: [id], uploadStatus: prevStatus });
      }
      toast({ title: `${uncheckedIds.length} unchecked products reverted to previous status` });
    }

    setState({
      step: 1,
      brand: null,
      gender: null,
      productType: null,
      sessionName: "",
      selectedProductIds: [],
      checkedProductIds: new Set(),
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
      checkedProductIds: new Set(),
      previousStatuses: new Map(),
      continueMode: false,
    });
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
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
            products={displayProducts}
            allFilteredProducts={filteredProducts}
            models={models}
            modelFilter={modelFilter}
            selected={step2Selected}
            onModelFilter={setModelFilter}
            onToggle={handleStep2Toggle}
            onSelectAll={handleSelectAll}
            onStart={handleStartShooting}
            onBack={() => state.continueMode ? setState(s => ({ ...s, step: 3 })) : handleBackToStep1()}
            loading={bulkUpdateMut.isPending}
          />
        )}

        {state.step === 3 && (
          <Step3
            state={state}
            products={allProducts || []}
            onCheck={handleCheckProduct}
            onUncheck={handleUncheckProduct}
            onCopy={handleCopySessionName}
            onEnd={handleEndSession}
            allChecked={allChecked}
          />
        )}

        {state.step === 4 && (
          <Step4
            state={state}
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

function Step2({ state, products, allFilteredProducts, models, modelFilter, selected, onModelFilter, onToggle, onSelectAll, onStart, onBack, loading }: {
  state: ShootingState;
  products: any[];
  allFilteredProducts: any[];
  models: string[];
  modelFilter: string;
  selected: Set<number>;
  onModelFilter: (v: string) => void;
  onToggle: (id: number) => void;
  onSelectAll: () => void;
  onStart: () => void;
  onBack: () => void;
  loading: boolean;
}) {
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
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          Continue mode: All product types for {state.brand?.label} are available.
        </div>
      )}

      {state.productType?.grouped && !state.continueMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          This includes both {state.productType.types.join(" and ")}.
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={modelFilter}
          onChange={e => onModelFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="all">All Models ({allFilteredProducts.length})</option>
          {models.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={onSelectAll}>
          {selected.size === products.length ? "Deselect All" : "Select All"}
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden max-h-[50vh] overflow-y-auto">
        {products.length === 0 ? (
          <p className="p-6 text-center text-muted-foreground text-sm">No matching products found (factory delayed products excluded)</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr className="text-xs text-muted-foreground">
                <th className="w-10 px-3 py-2"></th>
                <th className="text-left px-3 py-2 font-medium">Model</th>
                <th className="text-left px-3 py-2 font-medium">Type</th>
                <th className="text-left px-3 py-2 font-medium">Colour</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p: any) => {
                const isSelected = selected.has(p.id);
                const alreadyInSession = state.selectedProductIds.includes(p.id);
                return (
                  <tr
                    key={p.id}
                    className={cn(
                      "border-t cursor-pointer transition-colors",
                      alreadyInSession ? "opacity-40" : isSelected ? "bg-primary/5" : "hover:bg-secondary/50"
                    )}
                    onClick={() => !alreadyInSession && onToggle(p.id)}
                  >
                    <td className="px-3 py-2 text-center">
                      <Checkbox
                        checked={isSelected}
                        disabled={alreadyInSession}
                        onCheckedChange={() => onToggle(p.id)}
                      />
                    </td>
                    <td className="px-3 py-2 font-medium">{p.shortname}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.productType}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.colour || "–"}</td>
                    <td className="px-3 py-2">
                      <span className="text-xs text-muted-foreground">{p.uploadStatus?.replace(/_/g, " ")}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Button
        className="w-full"
        size="lg"
        onClick={onStart}
        disabled={selected.size === 0 || loading}
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Setting up...</>
        ) : (
          <><Camera className="w-4 h-4 mr-2" /> Start Shooting ({selected.size} products)</>
        )}
      </Button>
    </div>
  );
}

function Step3({ state, products, onCheck, onUncheck, onCopy, onEnd, allChecked }: {
  state: ShootingState;
  products: any[];
  onCheck: (id: number) => void;
  onUncheck: (id: number) => void;
  onCopy: () => void;
  onEnd: () => void;
  allChecked: boolean;
}) {
  const sessionProducts = products.filter(p => state.selectedProductIds.includes(p.id));
  const checked = state.checkedProductIds.size;
  const total = state.selectedProductIds.length;
  const progress = total > 0 ? (checked / total) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Camera className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Live Tracking</h1>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-muted-foreground">{state.sessionName}</span>
              <button onClick={onCopy} className="text-muted-foreground hover:text-foreground transition-colors">
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onEnd}>
          End Session
        </Button>
      </div>

      <div className="bg-card border rounded-lg p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{checked}/{total} shot</span>
          <span className="text-muted-foreground">{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-3 rounded-full overflow-hidden bg-gray-100">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, backgroundColor: "#22c55e" }}
          />
        </div>
      </div>

      {allChecked && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center text-green-800 space-y-2">
          <CheckCircle2 className="w-8 h-8 mx-auto" />
          <p className="font-medium">All products shot!</p>
          <Button onClick={onEnd} size="sm">
            Complete Session
          </Button>
        </div>
      )}

      <div className="space-y-1">
        {sessionProducts.map(p => {
          const isChecked = state.checkedProductIds.has(p.id);
          return (
            <button
              key={p.id}
              onClick={() => isChecked ? onUncheck(p.id) : onCheck(p.id)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                isChecked
                  ? "bg-green-50 border-green-200"
                  : "bg-card border-border hover:border-primary/50"
              )}
            >
              {isChecked ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn("font-medium text-sm", isChecked && "line-through text-muted-foreground")}>
                    {p.shortname}
                  </span>
                  <span className="text-xs text-muted-foreground">{p.productType}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {p.colour && <span>{p.colour}</span>}
                  {p.keyCode && <span className="font-mono">{p.keyCode}</span>}
                </div>
              </div>
              <Badge variant="outline" className={cn("text-[10px] shrink-0", isChecked ? "bg-green-100 text-green-800" : "bg-cyan-100 text-cyan-800")}>
                {isChecked ? "Ready for Selection" : "In the Studio"}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Step4({ state, onContinue, onClose, loading }: {
  state: ShootingState;
  onContinue: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  const checked = state.checkedProductIds.size;
  const total = state.selectedProductIds.length;
  const unchecked = total - checked;

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
          <span className="font-medium text-green-600">{checked}</span>
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
