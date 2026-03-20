import * as React from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Search, Filter, X, MessageSquare, AlertTriangle,
  ChevronDown, ChevronUp, ArrowLeft, Trash2, Upload, RotateCcw
} from "lucide-react";

const GENDERS = ["Men", "Women", "Unisex"];
const DELIVERY_STATUSES = [
  { value: "not_ordered", label: "Not Ordered" },
  { value: "ordered", label: "Ordered" },
  { value: "in_transit", label: "In Transit" },
  { value: "delayed_at_factory", label: "Delayed at Factory" },
  { value: "delivered", label: "Delivered/In GBG" },
];
const UPLOAD_STATUSES = [
  { value: "not_started", label: "Not Started" },
  { value: "in_the_studio", label: "In the Studio" },
  { value: "ready_for_selection", label: "Ready for Selection" },
  { value: "ready_for_retouch", label: "Ready for Retouch" },
  { value: "in_post_production", label: "In Post Production" },
  { value: "post_production_done", label: "Post Production - Done" },
  { value: "ready_for_upload", label: "Ready for Upload" },
  { value: "uploaded", label: "Uploaded" },
];

const deliveryLabel = (v: string) => DELIVERY_STATUSES.find(s => s.value === v)?.label || v;
const uploadLabel = (v: string) => UPLOAD_STATUSES.find(s => s.value === v)?.label || v;

const deliveryColor = (v: string) => {
  switch (v) {
    case "delivered": return "bg-green-100 text-green-800";
    case "delayed_at_factory": return "bg-red-100 text-red-800";
    case "in_transit": return "bg-blue-100 text-blue-800";
    case "ordered": return "bg-yellow-100 text-yellow-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

const uploadColor = (v: string) => {
  switch (v) {
    case "uploaded": return "bg-green-100 text-green-800";
    case "ready_for_upload": return "bg-yellow-100 text-yellow-800";
    case "post_production_done": return "bg-purple-100 text-purple-800";
    case "in_post_production": return "bg-blue-100 text-blue-800";
    case "ready_for_retouch": return "bg-orange-100 text-orange-800";
    case "ready_for_selection": return "bg-pink-100 text-pink-800";
    case "in_the_studio": return "bg-cyan-100 text-cyan-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

const REQUIRES_DETAILS_TYPES = ["jacket", "pants", "pant"];

function getMissingShots(product: { productType: string; galleryShots: string | null; detailsShots: string | null }): string | null {
  const needsGallery = !product.galleryShots?.trim();
  const needsDetails = REQUIRES_DETAILS_TYPES.some(t => product.productType.toLowerCase().includes(t)) && !product.detailsShots?.trim();
  if (needsGallery && needsDetails) return "Missing Gallery & Details";
  if (needsGallery) return "Missing Gallery";
  if (needsDetails) return "Missing Details";
  return null;
}

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const id = parseInt(params?.id || "0");
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: project } = useQuery({ queryKey: ["project", id], queryFn: () => api.getProject(id), enabled: !!id });

  const [filters, setFilters] = React.useState<Record<string, string>>({});
  const [searchText, setSearchText] = React.useState("");
  const [showFilters, setShowFilters] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());

  const queryParams = React.useMemo(() => {
    const p: Record<string, string> = { projectId: String(id) };
    if (filters.gender) p.gender = filters.gender;
    if (filters.productType) p.productType = filters.productType;
    if (filters.shortname) p.shortname = filters.shortname;
    if (filters.deliveryStatus) p.deliveryStatus = filters.deliveryStatus;
    if (filters.uploadStatus) p.uploadStatus = filters.uploadStatus;
    if (filters.delayed) p.delayed = "true";
    if (filters.reshoot) p.reshoot = "true";
    if (filters.shotMissing) p.shotMissing = filters.shotMissing;
    if (searchText.trim()) p.search = searchText.trim();
    return p;
  }, [id, filters, searchText]);

  const { data: products, isLoading } = useQuery({
    queryKey: ["products", queryParams],
    queryFn: () => api.getProducts(queryParams),
    enabled: !!id,
  });

  const allProducts = useQuery({
    queryKey: ["products", { projectId: String(id) }],
    queryFn: () => api.getProducts({ projectId: String(id) }),
    enabled: !!id,
  });

  React.useEffect(() => {
    if (!products) return;
    const visibleIds = new Set(products.map((p: any) => p.id));
    setSelectedIds(prev => {
      const next = new Set<number>();
      prev.forEach(id => { if (visibleIds.has(id)) next.add(id); });
      return next.size !== prev.size ? next : prev;
    });
  }, [products]);

  const productTypes = React.useMemo(() => {
    if (!allProducts.data) return [];
    return [...new Set(allProducts.data.map((p: any) => p.productType))].sort();
  }, [allProducts.data]);

  const shortnames = React.useMemo(() => {
    if (!allProducts.data) return [];
    return [...new Set(allProducts.data.map((p: any) => p.shortname))].sort();
  }, [allProducts.data]);

  const [addOpen, setAddOpen] = React.useState(false);
  const [addForm, setAddForm] = React.useState({
    gender: "Men", productType: "", shortname: "", style: "", design: "",
    keyCode: "", colour: "",
  });

  const createMut = useMutation({
    mutationFn: (data: any) => api.createProduct(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      setAddOpen(false);
      setAddForm({ gender: "Men", productType: "", shortname: "", style: "", design: "", keyCode: "", colour: "" });
      toast({ title: "Product added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const bulkMut = useMutation({
    mutationFn: ({ productIds, updates }: { productIds: number[]; updates: Record<string, any> }) =>
      api.bulkUpdateProducts(productIds, updates),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      if (data.reverted > 0) {
        toast({
          title: `${data.updated} product${data.updated !== 1 ? "s" : ""} updated. ${data.reverted} moved back to Not Started due to missing shots.`,
          description: data.revertedProducts.map((p: any) => `${p.shortname}${p.keyCode ? ` ${p.keyCode}` : ""}: ${p.reason}`).join("; "),
        });
      } else {
        toast({ title: `Updated ${data.updated} product${data.updated !== 1 ? "s" : ""}` });
      }
      setSelectedIds(new Set());
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMut.mutate({ ...addForm, projectId: id });
  };

  const [expandedId, setExpandedId] = React.useState<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [importing, setImporting] = React.useState(false);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const result = await api.importExcel(id, file);
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast({ title: "Import complete", description: `${result.imported} products imported from sheet "${result.sheetUsed}"${result.skipped > 0 ? `, ${result.skipped} rows skipped` : ""}` });
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length + (searchText.trim() ? 1 : 0);

  const clearFilters = () => {
    setFilters({});
    setSearchText("");
  };

  const handleToggleSelect = (productId: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const handleToggleAll = () => {
    if (!products) return;
    const visibleIds = products.map((p: any) => p.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id: number) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleIds));
    }
  };

  const allVisibleSelected = products?.length > 0 && products.every((p: any) => selectedIds.has(p.id));

  const handleBulkUploadStatus = (status: string) => {
    const ids = [...selectedIds];
    bulkMut.mutate({ productIds: ids, updates: { uploadStatus: status } });
  };

  const handleBulkDeliveryStatus = (status: string) => {
    const ids = [...selectedIds];
    const updates: Record<string, any> = { deliveryStatus: status };
    if (status === "delayed_at_factory") updates.factoryDelayed = true;
    bulkMut.mutate({ productIds: ids, updates });
  };

  const handleBulkToggleDelayed = () => {
    const ids = [...selectedIds];
    const selectedProducts = products?.filter((p: any) => selectedIds.has(p.id)) || [];
    const anyNotDelayed = selectedProducts.some((p: any) => !p.factoryDelayed);
    bulkMut.mutate({ productIds: ids, updates: { factoryDelayed: anyNotDelayed } });
  };

  const handleBulkRemoveReshoot = () => {
    const ids = [...selectedIds];
    bulkMut.mutate({ productIds: ids, updates: { isReshoot: false } });
  };

  if (!project) {
    return <Layout><p className="text-muted-foreground">Loading...</p></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-4 max-w-6xl mx-auto pb-20">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/projects" className="hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Projects
          </Link>
          <span>/</span>
          <span className="text-foreground">{project.name}</span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">{project.brand}</Badge>
              <Badge variant="outline">{project.season}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImport}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              <Upload className="w-4 h-4 mr-1" />
              {importing ? "Importing..." : "Import Excel"}
            </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add Product</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Add Product</DialogTitle></DialogHeader>
              <form onSubmit={handleAddSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Gender</Label>
                    <Select value={addForm.gender} onValueChange={v => setAddForm(f => ({ ...f, gender: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Product Type</Label>
                    <Input value={addForm.productType} onChange={e => setAddForm(f => ({ ...f, productType: e.target.value }))} placeholder="e.g. Jacket" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Shortname (Model)</Label>
                  <Input value={addForm.shortname} onChange={e => setAddForm(f => ({ ...f, shortname: e.target.value }))} placeholder="e.g. Akin" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Style</Label>
                    <Input value={addForm.style} onChange={e => setAddForm(f => ({ ...f, style: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Design</Label>
                    <Input value={addForm.design} onChange={e => setAddForm(f => ({ ...f, design: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Key Code</Label>
                    <Input value={addForm.keyCode} onChange={e => setAddForm(f => ({ ...f, keyCode: e.target.value }))} placeholder="e.g. H0851" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Colour</Label>
                    <Input value={addForm.colour} onChange={e => setAddForm(f => ({ ...f, colour: e.target.value }))} />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createMut.isPending}>
                  {createMut.isPending ? "Adding..." : "Add Product"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder="Search products..."
                className="pl-9"
              />
            </div>
            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-1" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 bg-primary-foreground text-primary rounded-full w-5 h-5 text-xs flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" /> Clear
              </Button>
            )}
          </div>

          {showFilters && (
            <div className="bg-card border rounded-lg p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Gender</Label>
                <Select value={filters.gender || ""} onValueChange={v => setFilters(f => ({ ...f, gender: v === "all" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Product Type</Label>
                <Select value={filters.productType || ""} onValueChange={v => setFilters(f => ({ ...f, productType: v === "all" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {productTypes.map((t: string) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Model</Label>
                <Select value={filters.shortname || ""} onValueChange={v => setFilters(f => ({ ...f, shortname: v === "all" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {shortnames.map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Delivery Status</Label>
                <Select value={filters.deliveryStatus || ""} onValueChange={v => setFilters(f => ({ ...f, deliveryStatus: v === "all" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {DELIVERY_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Upload Status</Label>
                <Select value={filters.uploadStatus || ""} onValueChange={v => setFilters(f => ({ ...f, uploadStatus: v === "all" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {UPLOAD_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Shot Missing</Label>
                <Select value={filters.shotMissing || ""} onValueChange={v => setFilters(f => ({ ...f, shotMissing: v === "all" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any</SelectItem>
                    <SelectItem value="required">Missing Required</SelectItem>
                    <SelectItem value="gallery">Gallery</SelectItem>
                    <SelectItem value="details">Details</SelectItem>
                    <SelectItem value="misc">Misc</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-1 gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={!!filters.delayed}
                    onCheckedChange={(c) => setFilters(f => ({ ...f, delayed: c ? "true" : "" }))}
                  />
                  Delayed only
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={!!filters.reshoot}
                    onCheckedChange={(c) => setFilters(f => ({ ...f, reshoot: c ? "true" : "" }))}
                  />
                  Reshoot only
                </label>
              </div>
            </div>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading products...</p>
        ) : !products?.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No products found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={handleToggleAll}
                />
                <span className="text-xs text-muted-foreground">
                  {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}
                </span>
              </label>
              <span className="text-xs text-muted-foreground">&middot; {products.length} product{products.length !== 1 ? "s" : ""}</span>
            </div>
            {products.map((product: any) => (
              <ProductRow
                key={product.id}
                product={product}
                expanded={expandedId === product.id}
                onToggle={() => setExpandedId(expandedId === product.id ? null : product.id)}
                userId={user?.id}
                isSelected={selectedIds.has(product.id)}
                onSelect={() => handleToggleSelect(product.id)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t shadow-lg">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium shrink-0">{selectedIds.size} selected</span>
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <Select onValueChange={handleBulkUploadStatus} disabled={bulkMut.isPending}>
                <SelectTrigger className="w-[200px] h-8 text-xs">
                  <SelectValue placeholder="Change Upload Status" />
                </SelectTrigger>
                <SelectContent>
                  {UPLOAD_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select onValueChange={handleBulkDeliveryStatus} disabled={bulkMut.isPending}>
                <SelectTrigger className="w-[200px] h-8 text-xs">
                  <SelectValue placeholder="Change Delivery Status" />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERY_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkToggleDelayed}
                disabled={bulkMut.isPending}
                className="text-xs h-8"
              >
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                Toggle Factory Delayed
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkRemoveReshoot}
                disabled={bulkMut.isPending}
                className="text-xs h-8"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Remove Reshoot
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs h-8 shrink-0"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      )}
    </Layout>
  );
}

function ProductRow({ product, expanded, onToggle, userId, isSelected, onSelect }: {
  product: any; expanded: boolean; onToggle: () => void; userId?: number;
  isSelected: boolean; onSelect: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const updateMut = useMutation({
    mutationFn: (data: any) => api.updateProduct(product.id, data),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      if (data._reverted) {
        toast({
          title: `${product.shortname}${product.keyCode ? ` ${product.keyCode}` : ""} moved back to Not Started`,
          description: data._missingReason,
          variant: "destructive",
        });
      }
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.deleteProduct(product.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast({ title: "Product deleted" });
    },
  });

  const { data: comments } = useQuery({
    queryKey: ["comments", product.id],
    queryFn: () => api.getComments(product.id),
    enabled: expanded,
  });

  const [commentText, setCommentText] = React.useState("");
  const commentMut = useMutation({
    mutationFn: (data: any) => api.createComment(product.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", product.id] });
      setCommentText("");
    },
  });

  return (
    <div className={cn("bg-card border rounded-lg overflow-hidden", isSelected && "ring-2 ring-primary/50")}>
      <div className="flex items-center">
        <div className="pl-3 py-3 flex items-center shrink-0">
          <Checkbox checked={isSelected} onCheckedChange={onSelect} />
        </div>
        <button
          onClick={onToggle}
          className="flex-1 text-left px-3 py-3 hover:bg-secondary/50 transition-colors min-w-0"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="font-medium text-sm">{product.shortname}</span>
              {product.keyCode && <span className="text-xs text-muted-foreground font-mono">{product.keyCode}</span>}
              <Badge variant="outline" className="text-xs">{product.gender}</Badge>
              <span className="text-xs text-muted-foreground">{product.productType}</span>
              {product.colour && <span className="text-xs text-muted-foreground">&middot; {product.colour}</span>}
              {product.isReshoot && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-800">Reshoot</span>
              )}
              {product.factoryDelayed && (
                <span className="flex items-center gap-1 text-xs text-destructive">
                  <AlertTriangle className="w-3 h-3" /> Delayed
                </span>
              )}
              {getMissingShots(product) && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">{getMissingShots(product)}</span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 mr-1" title={`Gallery: ${product.galleryShots || "–"} | Details: ${product.detailsShots || "–"} | Misc: ${product.miscShots || "–"}`}>
                <span className="flex items-center gap-0.5">
                  <span className={cn("w-2 h-2 rounded-full", product.galleryShots?.trim() ? "bg-green-500" : "bg-gray-300")} />
                  <span className="text-[10px] text-muted-foreground">G</span>
                </span>
                <span className="flex items-center gap-0.5">
                  <span className={cn("w-2 h-2 rounded-full", product.detailsShots?.trim() ? "bg-green-500" : "bg-gray-300")} />
                  <span className="text-[10px] text-muted-foreground">D</span>
                </span>
                <span className="flex items-center gap-0.5">
                  <span className={cn("w-2 h-2 rounded-full", product.miscShots?.trim() ? "bg-green-500" : "bg-gray-300")} />
                  <span className="text-[10px] text-muted-foreground">M</span>
                </span>
              </div>
              <span className={cn("text-xs px-2 py-0.5 rounded-full", deliveryColor(product.deliveryStatus))}>
                {deliveryLabel(product.deliveryStatus)}
              </span>
              <span className={cn("text-xs px-2 py-0.5 rounded-full", uploadColor(product.uploadStatus))}>
                {uploadLabel(product.uploadStatus)}
              </span>
              {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>
          </div>
        </button>
      </div>

      {expanded && (
        <div className="border-t px-4 py-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-sm">
            <div>
              <Label className="text-xs text-muted-foreground">Style</Label>
              <Input
                defaultValue={product.style || ""}
                onBlur={e => { if (e.target.value !== (product.style || "")) updateMut.mutate({ style: e.target.value }); }}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Design</Label>
              <Input
                defaultValue={product.design || ""}
                onBlur={e => { if (e.target.value !== (product.design || "")) updateMut.mutate({ design: e.target.value }); }}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Key Code</Label>
              <Input
                defaultValue={product.keyCode || ""}
                onBlur={e => { if (e.target.value !== (product.keyCode || "")) updateMut.mutate({ keyCode: e.target.value }); }}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Colour</Label>
              <Input
                defaultValue={product.colour || ""}
                onBlur={e => { if (e.target.value !== (product.colour || "")) updateMut.mutate({ colour: e.target.value }); }}
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Gallery Shots</Label>
              <Input
                defaultValue={product.galleryShots || ""}
                onBlur={e => updateMut.mutate({ galleryShots: e.target.value })}
                placeholder="Session/folder name"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Details Shots</Label>
              <Input
                defaultValue={product.detailsShots || ""}
                onBlur={e => updateMut.mutate({ detailsShots: e.target.value })}
                placeholder="Session/folder name"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Misc Shots</Label>
              <Input
                defaultValue={product.miscShots || ""}
                onBlur={e => updateMut.mutate({ miscShots: e.target.value })}
                placeholder="Session/folder name"
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Delivery Status</Label>
              <Select value={product.deliveryStatus} onValueChange={v => updateMut.mutate({ deliveryStatus: v, factoryDelayed: v === "delayed_at_factory" ? true : product.factoryDelayed })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DELIVERY_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Upload Status</Label>
              <Select value={product.uploadStatus} onValueChange={v => updateMut.mutate({ uploadStatus: v })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UPLOAD_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end pb-1 gap-4 flex-wrap">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={product.factoryDelayed}
                  onCheckedChange={c => updateMut.mutate({ factoryDelayed: !!c })}
                />
                Factory Delayed
              </label>
              {product.isReshoot && (
                <button
                  onClick={() => updateMut.mutate({ isReshoot: false })}
                  className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 hover:bg-orange-200 transition-colors"
                  title="Remove reshoot tag"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reshoot
                  <X className="w-3 h-3" />
                </button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => { if (confirm("Delete this product?")) deleteMut.mutate(); }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-1">
              <MessageSquare className="w-4 h-4" /> Comments
            </h4>
            {comments?.length > 0 && (
              <div className="space-y-2">
                {comments.map((c: any) => (
                  <div key={c.id} className="bg-secondary/50 rounded-md p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{c.userName}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(c.createdAt, "MMM d, HH:mm")}</span>
                    </div>
                    <p className="text-sm">{c.text}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                className="h-8 text-sm"
                onKeyDown={e => {
                  if (e.key === "Enter" && commentText.trim() && userId) {
                    commentMut.mutate({ userId, text: commentText.trim() });
                  }
                }}
              />
              <Button
                size="sm"
                disabled={!commentText.trim() || commentMut.isPending}
                onClick={() => {
                  if (commentText.trim() && userId) {
                    commentMut.mutate({ userId, text: commentText.trim() });
                  }
                }}
              >
                Send
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
