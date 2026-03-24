import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Upload, Check, RotateCcw, ChevronLeft, ChevronRight, X,
  FolderOpen, Image as ImageIcon, AlertTriangle
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/../api";

function ImageUrl(objectPath: string) {
  return `${API_BASE}/storage${objectPath}`;
}

export default function PreProduction() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: products, isLoading } = useQuery({
    queryKey: ["pre-production-products"],
    queryFn: api.getPreProductionProducts,
  });

  const [brandFilter, setBrandFilter] = React.useState<string>("all");
  const [genderFilter, setGenderFilter] = React.useState<string>("all");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [galleryProduct, setGalleryProduct] = React.useState<any | null>(null);
  const [lightboxImages, setLightboxImages] = React.useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = React.useState(0);
  const [uploading, setUploading] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const reviewMut = useMutation({
    mutationFn: ({ productId, decision }: { productId: number; decision: "keep" | "reshoot" }) =>
      api.reviewProduct(productId, decision),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pre-production-products"] });
    },
  });

  const finalizeMut = useMutation({
    mutationFn: () => api.finalizePreProduction(),
    onSuccess: () => {
      toast({ title: "Pre-production review finalized" });
      qc.invalidateQueries({ queryKey: ["pre-production-products"] });
    },
  });

  const brands = React.useMemo(() => {
    if (!products) return [];
    return [...new Set((products as any[]).map((p: any) => p.brand))].sort();
  }, [products]);

  const genders = React.useMemo(() => {
    if (!products) return [];
    return [...new Set((products as any[]).map((p: any) => p.gender))].sort();
  }, [products]);

  const productTypes = React.useMemo(() => {
    if (!products) return [];
    return [...new Set((products as any[]).map((p: any) => p.productType))].sort();
  }, [products]);

  const filtered = React.useMemo(() => {
    if (!products) return [];
    return (products as any[]).filter((p: any) => {
      if (brandFilter !== "all" && p.brand !== brandFilter) return false;
      if (genderFilter !== "all" && p.gender !== genderFilter) return false;
      if (typeFilter !== "all" && p.productType !== typeFilter) return false;
      return true;
    });
  }, [products, brandFilter, genderFilter, typeFilter]);

  const parseFolderName = (folderName: string): { keyCode: string; imageType: "gallery" | "detail" } => {
    const lower = folderName.toLowerCase();
    if (lower.includes("details")) {
      const keyCode = folderName.split(/\s+/)[0];
      return { keyCode, imageType: "detail" };
    }
    return { keyCode: folderName.trim(), imageType: "gallery" };
  };

  const isJpeg = (file: File) =>
    file.type === "image/jpeg" ||
    file.name.toLowerCase().endsWith(".jpg") ||
    file.name.toLowerCase().endsWith(".jpeg");

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!products || uploading) return;
    setUploading(true);

    try {
      const items = e.dataTransfer.items;
      const fileEntries: { file: File; keyCode: string; imageType: "gallery" | "detail" }[] = [];

      const readDir = (dirEntry: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> => {
        return new Promise((resolve) => {
          const reader = dirEntry.createReader();
          const allEntries: FileSystemEntry[] = [];
          const readBatch = () => {
            reader.readEntries((entries) => {
              if (entries.length === 0) {
                resolve(allEntries);
              } else {
                allEntries.push(...entries);
                readBatch();
              }
            });
          };
          readBatch();
        });
      };

      const collectFromDir = async (dirEntry: FileSystemDirectoryEntry, keyCode: string, imageType: "gallery" | "detail") => {
        const entries = await readDir(dirEntry);
        for (const entry of entries) {
          if (entry.isFile) {
            const file = await new Promise<File>((resolve) => {
              (entry as FileSystemFileEntry).file(resolve);
            });
            if (isJpeg(file)) {
              fileEntries.push({ file, keyCode, imageType });
            }
          }
        }
      };

      const topLevelPromises: Promise<void>[] = [];

      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry();
        if (!entry) continue;

        if (entry.isDirectory) {
          const dirEntry = entry as FileSystemDirectoryEntry;
          console.log(`[PreProd Upload] Dropped directory: "${dirEntry.name}"`);
          const subEntries = await readDir(dirEntry);

          const hasSubDirs = subEntries.some(e => e.isDirectory);
          console.log(`[PreProd Upload] Contains ${subEntries.length} entries, ${hasSubDirs ? "has subdirectories" : "flat (no subdirs)"}`);

          if (hasSubDirs) {
            for (const sub of subEntries) {
              if (sub.isDirectory) {
                const { keyCode, imageType } = parseFolderName(sub.name);
                console.log(`[PreProd Upload] Subfolder: "${sub.name}" → keyCode="${keyCode}", type=${imageType}`);
                topLevelPromises.push(collectFromDir(sub as FileSystemDirectoryEntry, keyCode, imageType));
              }
            }
          } else {
            const { keyCode, imageType } = parseFolderName(dirEntry.name);
            console.log(`[PreProd Upload] Direct folder: "${dirEntry.name}" → keyCode="${keyCode}", type=${imageType}`);
            topLevelPromises.push(collectFromDir(dirEntry, keyCode, imageType));
          }
        }
      }

      await Promise.all(topLevelPromises);

      console.log(`[PreProd Upload] Collected ${fileEntries.length} JPG files total`);
      if (fileEntries.length > 0) {
        const sample = fileEntries.slice(0, 5).map(f => `${f.keyCode} (${f.imageType}): ${f.file.name}`);
        console.log(`[PreProd Upload] Sample files:`, sample);
      }

      if (fileEntries.length === 0) {
        toast({ title: "No JPG images found in dropped folders", variant: "destructive" });
        setUploading(false);
        return;
      }

      const dbKeyCodes = (products as any[]).map((p: any) => p.keyCode).filter(Boolean);
      console.log(`[PreProd Upload] DB key codes (${dbKeyCodes.length}):`, dbKeyCodes.slice(0, 20));
      const extractedKeyCodes = [...new Set(fileEntries.map(f => f.keyCode))];
      console.log(`[PreProd Upload] Extracted key codes from folders:`, extractedKeyCodes);

      let matched = 0;
      let unmatched = 0;
      const matchedProductIds = new Set<number>();
      const unmatchedKeyCodes = new Set<string>();

      for (const { file, keyCode, imageType } of fileEntries) {
        const product = (products as any[]).find((p: any) =>
          p.keyCode && p.keyCode.toLowerCase() === keyCode.toLowerCase()
        );

        if (!product) {
          unmatched++;
          unmatchedKeyCodes.add(keyCode);
          continue;
        }

        try {
          const { uploadURL, objectPath } = await api.requestUploadUrl({
            name: file.name,
            size: file.size,
            contentType: file.type || "image/jpeg",
          });

          await fetch(uploadURL, {
            method: "PUT",
            headers: { "Content-Type": file.type || "image/jpeg" },
            body: file,
          });

          await api.addPreProductionImage({
            productId: product.id,
            objectPath,
            fileName: file.name,
            imageType,
          });

          matched++;
          matchedProductIds.add(product.id);
        } catch (err) {
          console.error("Upload error for", file.name, err);
        }
      }

      if (matchedProductIds.size > 0) {
        try {
          await api.autoPopulateShots([...matchedProductIds]);
        } catch (err) {
          console.error("Auto-populate shots error", err);
        }
      }

      if (unmatchedKeyCodes.size > 0) {
        console.log(`[PreProd Upload] Unmatched key codes:`, [...unmatchedKeyCodes]);
      }
      console.log(`[PreProd Upload] Result: ${matched} matched, ${unmatched} unmatched, ${matchedProductIds.size} unique products`);

      qc.invalidateQueries({ queryKey: ["pre-production-products"] });
      toast({
        title: `Upload complete: ${matched} images matched to ${matchedProductIds.size} products`,
        description: unmatched > 0 ? `${unmatched} images unmatched (key codes: ${[...unmatchedKeyCodes].slice(0, 5).join(", ")}${unmatchedKeyCodes.size > 5 ? "..." : ""})` : undefined,
      });
    } catch (err) {
      console.error("Drop error", err);
      toast({ title: "Upload failed", variant: "destructive" });
    }

    setUploading(false);
  };

  const openGallery = (product: any) => {
    setGalleryProduct(product);
  };

  const openLightbox = (images: string[], index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
  };

  return (
    <Layout>
      <div className="space-y-4 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderOpen className="w-6 h-6" />
            Pre Production
          </h1>
          <span className="text-sm text-muted-foreground">
            {filtered.length} carry over products
          </span>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
            uploading ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"
          )}
        >
          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          {uploading ? (
            <p className="text-sm text-primary font-medium">Uploading images...</p>
          ) : (
            <>
              <p className="text-sm font-medium">Drag & drop product folders here</p>
              <p className="text-xs text-muted-foreground mt-1">
                Drop a parent folder containing subfolders like H1892/ (gallery) and H1892 details/ (details). Images are matched by folder name.
              </p>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-sm">
            <option value="all">All Brands</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={genderFilter} onChange={e => setGenderFilter(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-sm">
            <option value="all">All Genders</option>
            {genders.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-sm">
            <option value="all">All Types</option>
            {productTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading carry over products...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">No carry over products found</p>
            <p className="text-sm">Products marked as Carry Over will appear here for review.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filtered.map((p: any) => {
                const status = p.preProductionStatus;
                const isKept = status === "kept" || status === "finalized";
                const isReshoot = status === "reshoot";
                const isFinalized = status === "finalized";
                const firstImage = p.images?.[0];
                return (
                  <div key={p.id} className={cn(
                    "bg-card border rounded-lg overflow-hidden transition-all",
                    isKept && "ring-2 ring-emerald-500/50",
                    isReshoot && "ring-2 ring-orange-500/50"
                  )}>
                    <button
                      onClick={() => p.images?.length > 0 && openGallery(p)}
                      className="w-full aspect-square bg-muted/30 flex items-center justify-center overflow-hidden"
                    >
                      {firstImage ? (
                        <img
                          src={ImageUrl(firstImage.objectPath)}
                          alt={p.keyCode}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-10 h-10 text-muted-foreground/30" />
                      )}
                    </button>
                    <div className="p-2 space-y-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold truncate">{p.keyCode || "No Key"}</span>
                        {p.images?.length > 0 && (
                          <Badge variant="secondary" className="text-[10px] shrink-0">{p.images.length}</Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{p.shortname}</p>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant={isKept ? "default" : "outline"}
                          className={cn(
                            "flex-1 h-7 text-[10px] px-1",
                            isKept && "bg-emerald-600 hover:bg-emerald-700 text-white"
                          )}
                          onClick={() => reviewMut.mutate({ productId: p.id, decision: "keep" })}
                          disabled={reviewMut.isPending || isFinalized}
                        >
                          <Check className="w-3 h-3 mr-0.5" />
                          Keep CO
                        </Button>
                        <Button
                          size="sm"
                          variant={isReshoot ? "default" : "outline"}
                          className={cn(
                            "flex-1 h-7 text-[10px] px-1",
                            isReshoot && "bg-orange-600 hover:bg-orange-700 text-white"
                          )}
                          onClick={() => reviewMut.mutate({ productId: p.id, decision: "reshoot" })}
                          disabled={reviewMut.isPending || isFinalized}
                        >
                          <RotateCcw className="w-3 h-3 mr-0.5" />
                          Reshoot
                        </Button>
                      </div>
                      {(isKept || isReshoot) && (
                        <div className={cn(
                          "text-[10px] text-center font-medium rounded py-0.5",
                          isKept ? "bg-emerald-900/30 text-emerald-400" : "bg-orange-900/30 text-orange-400"
                        )}>
                          {isFinalized ? "Finalized — CO" : isKept ? "Keeping as CO" : "Marked for reshoot"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="sticky bottom-4 flex justify-center">
              <Button
                size="lg"
                onClick={() => setShowConfirm(true)}
                className="shadow-lg"
              >
                Done — Finalize Review
              </Button>
            </div>
          </>
        )}
      </div>

      {galleryProduct && (
        <GalleryModal
          product={galleryProduct}
          onClose={() => setGalleryProduct(null)}
          onOpenLightbox={openLightbox}
        />
      )}

      {lightboxImages.length > 0 && (
        <Lightbox
          images={lightboxImages}
          index={lightboxIndex}
          onClose={() => setLightboxImages([])}
          onNavigate={setLightboxIndex}
        />
      )}

      {showConfirm && (
        <ConfirmDialog
          onConfirm={() => { finalizeMut.mutate(); setShowConfirm(false); }}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </Layout>
  );
}

function GalleryModal({ product, onClose, onOpenLightbox }: {
  product: any;
  onClose: () => void;
  onOpenLightbox: (images: string[], index: number) => void;
}) {
  const galleryImages = (product.images || []).filter((i: any) => i.imageType === "gallery");
  const detailImages = (product.images || []).filter((i: any) => i.imageType === "detail");
  const allImages = [...galleryImages, ...detailImages];
  const allUrls = allImages.map((i: any) => ImageUrl(i.objectPath));

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b p-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold">{product.keyCode}</h2>
            <p className="text-sm text-muted-foreground">{product.shortname} — {product.colour}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-4 space-y-6">
          {galleryImages.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Gallery Shots</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {galleryImages.map((img: any, idx: number) => (
                  <button
                    key={img.id}
                    onClick={() => onOpenLightbox(allUrls, idx)}
                    className="aspect-square rounded-md overflow-hidden border hover:ring-2 hover:ring-primary transition-all"
                  >
                    <img src={ImageUrl(img.objectPath)} alt={img.fileName} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {detailImages.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Detail Shots</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {detailImages.map((img: any, idx: number) => (
                  <button
                    key={img.id}
                    onClick={() => onOpenLightbox(allUrls, galleryImages.length + idx)}
                    className="aspect-square rounded-md overflow-hidden border hover:ring-2 hover:ring-primary transition-all"
                  >
                    <img src={ImageUrl(img.objectPath)} alt={img.fileName} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {allImages.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No images uploaded for this product yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Lightbox({ images, index, onClose, onNavigate }: {
  images: string[];
  index: number;
  onClose: () => void;
  onNavigate: (idx: number) => void;
}) {
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) onNavigate(index - 1);
      if (e.key === "ArrowRight" && index < images.length - 1) onNavigate(index + 1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [index, images.length, onClose, onNavigate]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center" onClick={onClose}>
      <button
        className="absolute top-4 right-4 text-white/70 hover:text-white z-10"
        onClick={onClose}
      >
        <X className="w-6 h-6" />
      </button>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
        {index + 1} / {images.length}
      </div>

      {index > 0 && (
        <button
          className="absolute left-0 top-0 bottom-0 w-1/4 flex items-center justify-start pl-4 text-white/40 hover:text-white transition-colors"
          onClick={(e) => { e.stopPropagation(); onNavigate(index - 1); }}
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}

      {index < images.length - 1 && (
        <button
          className="absolute right-0 top-0 bottom-0 w-1/4 flex items-center justify-end pr-4 text-white/40 hover:text-white transition-colors"
          onClick={(e) => { e.stopPropagation(); onNavigate(index + 1); }}
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}

      <img
        src={images[index]}
        alt=""
        className="max-w-[90vw] max-h-[90vh] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function ConfirmDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-card border rounded-lg p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold">Finalize Review</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Are you sure you are happy with this selection? This will lock in all Keep Carry Over and Reshoot decisions.
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" onClick={onConfirm}>Yes, Finalize</Button>
        </div>
      </div>
    </div>
  );
}
