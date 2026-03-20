import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { Check, CheckCheck, ChevronDown, ChevronRight } from "lucide-react";

interface Product {
  id: number;
  keyCode: string;
  colour: string;
  shortname: string;
  productType: string;
  galleryShots: string | null;
  uploadStatus: string;
  isCarryOver: boolean;
}

interface SessionGroup {
  sessionName: string;
  products: Product[];
}

export default function Upload() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [collapsedSessions, setCollapsedSessions] = React.useState<Set<string>>(new Set());
  const [completedIds, setCompletedIds] = React.useState<Set<number>>(new Set());
  const autoPromotedRef = React.useRef<Set<number>>(new Set());

  React.useEffect(() => {
    if (user && user.name !== "Oskar") navigate("/");
  }, [user, navigate]);

  const { data: allProducts = [], isLoading } = useQuery<Product[]>({
    queryKey: ["products", "upload"],
    queryFn: () => api.getProducts({ uploadStatus: "ready_for_upload" }),
    refetchInterval: 5000,
    enabled: user?.name === "Oskar",
  });

  const bulkUpdateMut = useMutation({
    mutationFn: ({ productIds, uploadStatus }: { productIds: number[]; uploadStatus: string }) =>
      api.bulkUpdateStatus(productIds, uploadStatus),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
  });

  const sessions = React.useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of allProducts) {
      const names = new Set<string>();
      if (p.galleryShots?.trim()) {
        for (const s of p.galleryShots.split(",")) {
          const t = s.trim();
          if (t) names.add(t);
        }
      }
      if (names.size === 0) names.add("No Session");
      for (const name of names) {
        if (!map.has(name)) map.set(name, []);
        const arr = map.get(name)!;
        if (!arr.some(x => x.id === p.id)) arr.push(p);
      }
    }
    const groups: SessionGroup[] = [];
    for (const [sessionName, products] of map) {
      groups.push({ sessionName, products });
    }
    groups.sort((a, b) => b.products.length - a.products.length);
    return groups;
  }, [allProducts]);

  const totalProducts = allProducts.length;
  const uploadedCount = completedIds.size;

  React.useEffect(() => {
    const coIds = allProducts.filter(p => p.isCarryOver).map(p => p.id);
    const newCoIds = coIds.filter(id => !autoPromotedRef.current.has(id));

    setCompletedIds(prev => {
      const remaining = new Set(allProducts.map(p => p.id));
      const next = new Set<number>();
      for (const id of prev) {
        if (remaining.has(id)) next.add(id);
      }
      for (const id of coIds) next.add(id);
      return next;
    });

    if (newCoIds.length > 0) {
      for (const id of newCoIds) autoPromotedRef.current.add(id);
      api.bulkUpdateStatus(newCoIds, "uploaded").then(() => {
        qc.invalidateQueries({ queryKey: ["products"] });
      });
    }
  }, [allProducts, qc]);

  const toggleProduct = async (id: number) => {
    const product = allProducts.find(p => p.id === id);
    if (completedIds.has(id)) {
      if (!product?.isCarryOver) return;
      setCompletedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      return;
    }
    setCompletedIds(prev => new Set(prev).add(id));
    try {
      await bulkUpdateMut.mutateAsync({ productIds: [id], uploadStatus: "uploaded" });
      toast({ title: "Product marked as Uploaded" });
    } catch {
      setCompletedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const completeSession = async (products: Product[]) => {
    const ids = products.map(p => p.id).filter(id => !completedIds.has(id));
    if (ids.length === 0) return;
    setCompletedIds(prev => {
      const n = new Set(prev);
      for (const id of ids) n.add(id);
      return n;
    });
    try {
      await bulkUpdateMut.mutateAsync({ productIds: ids, uploadStatus: "uploaded" });
      toast({ title: `${ids.length} product${ids.length !== 1 ? "s" : ""} marked as Uploaded` });
    } catch {
      setCompletedIds(prev => {
        const n = new Set(prev);
        for (const id of ids) n.delete(id);
        return n;
      });
    }
  };

  const toggleCollapse = (name: string) => {
    setCollapsedSessions(prev => {
      const n = new Set(prev);
      if (n.has(name)) n.delete(name); else n.add(name);
      return n;
    });
  };

  if (user?.name !== "Oskar") return null;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Upload</h1>
          <p className="text-muted-foreground text-sm mt-1">Upload finished assets and mark products as complete</p>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm font-semibold">{uploadedCount}/{totalProducts} products uploaded</span>
          </div>
          <div className="w-full bg-zinc-700 rounded-full h-2.5">
            <div
              className="bg-green-500 h-2.5 rounded-full transition-all duration-300"
              style={{ width: totalProducts > 0 ? `${(uploadedCount / totalProducts) * 100}%` : "0%" }}
            />
          </div>
        </div>

        {isLoading && (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        )}

        {!isLoading && sessions.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <CheckCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">All caught up!</p>
            <p className="text-sm">No products waiting for upload.</p>
          </div>
        )}

        {sessions.map(session => {
          const isCollapsed = collapsedSessions.has(session.sessionName);
          const doneInSession = session.products.filter(p => completedIds.has(p.id)).length;
          const allDone = doneInSession === session.products.length;

          return (
            <div key={session.sessionName} className="bg-card border rounded-lg overflow-hidden">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary/30 transition-colors"
                onClick={() => toggleCollapse(session.sessionName)}
              >
                <div className="flex items-center gap-3">
                  {isCollapsed
                    ? <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    : <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  }
                  <div>
                    <h3 className="font-semibold text-sm">{session.sessionName}</h3>
                    <p className="text-xs text-muted-foreground">
                      {session.products.length} product{session.products.length !== 1 ? "s" : ""} · {doneInSession}/{session.products.length} uploaded
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 bg-zinc-700 rounded-full h-1.5">
                    <div
                      className="bg-green-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${(doneInSession / session.products.length) * 100}%` }}
                    />
                  </div>
                  {!allDone && (
                    <button
                      onClick={(e) => { e.stopPropagation(); completeSession(session.products); }}
                      disabled={bulkUpdateMut.isPending}
                      className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      Complete Session
                    </button>
                  )}
                  {allDone && (
                    <span className="text-xs font-medium text-green-600 px-3 py-1.5">All Done ✓</span>
                  )}
                </div>
              </div>

              {!isCollapsed && (
                <div className="border-t divide-y">
                  {session.products.map(p => {
                    const isDone = completedIds.has(p.id);
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center gap-4 px-4 py-3 transition-colors ${isDone ? "bg-green-900/20 opacity-60" : "hover:bg-secondary/20"}`}
                      >
                        <button
                          onClick={() => toggleProduct(p.id)}
                          disabled={bulkUpdateMut.isPending || (isDone && !p.isCarryOver)}
                          className={`w-7 h-7 rounded-md flex items-center justify-center border-2 transition-all flex-shrink-0 ${
                            isDone
                              ? "bg-green-600 border-green-600 text-white"
                              : "border-zinc-600 hover:border-green-500 text-transparent hover:text-green-500"
                          }`}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm">{p.keyCode}</span>
                            <span className="text-sm text-muted-foreground">{p.colour}</span>
                            {p.isCarryOver && (
                              <span className="text-[10px] font-medium bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded">CO</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{p.shortname} · {p.productType}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
