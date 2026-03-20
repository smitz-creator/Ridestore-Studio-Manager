import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { Check, CheckCheck, ChevronDown, ChevronRight, Copy, Clock } from "lucide-react";

interface Product {
  id: number;
  keyCode: string;
  colour: string;
  shortname: string;
  productType: string;
  galleryShots: string | null;
  detailsShots: string | null;
  miscShots: string | null;
  uploadStatus: string;
  isCarryOver: boolean;
}

interface RetouchSessionMeta {
  id: number;
  sessionName: string;
  sentTo: string | null;
  carryOversSourced: boolean;
}

interface SessionGroup {
  sessionName: string;
  products: Product[];
}

function groupByGallerySession(products: Product[]): SessionGroup[] {
  const map = new Map<string, Product[]>();
  for (const p of products) {
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
  return [...map.entries()]
    .map(([sessionName, products]) => ({ sessionName, products }))
    .sort((a, b) => b.products.length - a.products.length);
}

export default function Retouch() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [collapsedReady, setCollapsedReady] = React.useState<Set<string>>(new Set());
  const [collapsedPP, setCollapsedPP] = React.useState<Set<string>>(new Set());
  const [completedIds, setCompletedIds] = React.useState<Set<number>>(new Set());
  const autoPromotedRef = React.useRef<Set<number>>(new Set());

  React.useEffect(() => {
    if (user && user.name !== "Smitz") navigate("/");
  }, [user, navigate]);

  const { data: readyProducts = [] } = useQuery<Product[]>({
    queryKey: ["products", "ready_for_retouch"],
    queryFn: () => api.getProducts({ uploadStatus: "ready_for_retouch" }),
    refetchInterval: 5000,
    enabled: user?.name === "Smitz",
  });

  const { data: ppProducts = [] } = useQuery<Product[]>({
    queryKey: ["products", "in_post_production"],
    queryFn: () => api.getProducts({ uploadStatus: "in_post_production" }),
    refetchInterval: 5000,
    enabled: user?.name === "Smitz",
  });

  const { data: retouchMeta = [] } = useQuery<RetouchSessionMeta[]>({
    queryKey: ["retouch-sessions"],
    queryFn: () => api.getRetouchSessions(),
    refetchInterval: 5000,
    enabled: user?.name === "Smitz",
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

  const updateMetaMut = useMutation({
    mutationFn: ({ sessionName, data }: { sessionName: string; data: any }) =>
      api.updateRetouchSession(sessionName, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["retouch-sessions"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update session", description: err.message, variant: "destructive" });
    },
  });

  const readySessions = React.useMemo(() => groupByGallerySession(readyProducts), [readyProducts]);
  const ppSessions = React.useMemo(() => groupByGallerySession(ppProducts), [ppProducts]);

  const getMeta = (name: string) => retouchMeta.find(m => m.sessionName === name);

  React.useEffect(() => {
    const coIds = readyProducts.filter(p => p.isCarryOver).map(p => p.id);
    const newCoIds = coIds.filter(id => !autoPromotedRef.current.has(id));

    setCompletedIds(prev => {
      const remaining = new Set(readyProducts.map(p => p.id));
      const next = new Set<number>();
      for (const id of prev) {
        if (remaining.has(id)) next.add(id);
      }
      for (const id of coIds) next.add(id);
      return next;
    });

    if (newCoIds.length > 0) {
      for (const id of newCoIds) autoPromotedRef.current.add(id);
      api.bulkUpdateStatus(newCoIds, "in_post_production").then(() => {
        qc.invalidateQueries({ queryKey: ["products"] });
      });
    }
  }, [readyProducts, qc]);

  const toggleProduct = async (id: number) => {
    const product = readyProducts.find(p => p.id === id);
    if (completedIds.has(id)) {
      if (!product?.isCarryOver) return;
      setCompletedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      return;
    }
    setCompletedIds(prev => new Set(prev).add(id));
    try {
      await bulkUpdateMut.mutateAsync({ productIds: [id], uploadStatus: "in_post_production" });
      toast({ title: "Product moved to In Post Production" });
    } catch {
      setCompletedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const completeReadySession = async (products: Product[]) => {
    const ids = products.map(p => p.id).filter(id => !completedIds.has(id));
    if (ids.length === 0) return;
    setCompletedIds(prev => {
      const n = new Set(prev);
      for (const id of ids) n.add(id);
      return n;
    });
    try {
      await bulkUpdateMut.mutateAsync({ productIds: ids, uploadStatus: "in_post_production" });
      toast({ title: `${ids.length} product${ids.length !== 1 ? "s" : ""} moved to In Post Production` });
    } catch {
      setCompletedIds(prev => {
        const n = new Set(prev);
        for (const id of ids) n.delete(id);
        return n;
      });
    }
  };

  const handleSendTo = async (sessionName: string, target: "pixelz" | "masking") => {
    await updateMetaMut.mutateAsync({ sessionName, data: { sentTo: target } });
    toast({ title: `Session sent to ${target === "pixelz" ? "Pixelz" : "Masking"}` });
  };

  const handleCarryOversSourced = async (sessionName: string, value: boolean) => {
    await updateMetaMut.mutateAsync({ sessionName, data: { carryOversSourced: value } });
    toast({ title: value ? "Carry Overs marked as sourced" : "Carry Overs unmarked" });
  };

  const handleDoneSession = async (products: Product[]) => {
    const ids = products.map(p => p.id);
    await bulkUpdateMut.mutateAsync({ productIds: ids, uploadStatus: "post_production_done" });
    toast({ title: `${ids.length} product${ids.length !== 1 ? "s" : ""} moved to Post Production Done` });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const totalPipeline = readyProducts.length + ppProducts.length;

  if (user?.name !== "Smitz") return null;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Retouch</h1>
          <p className="text-muted-foreground text-sm mt-1">Post-production workflow</p>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Pipeline Overview</span>
            <span className="text-sm font-semibold">{totalPipeline} product{totalPipeline !== 1 ? "s" : ""} in retouch pipeline</span>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-500" />
            Ready for Retouch
            <span className="text-sm font-normal text-muted-foreground">({readyProducts.length})</span>
          </h2>

          {readySessions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground bg-card border rounded-lg">
              <CheckCheck className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No products waiting for retouch.</p>
            </div>
          )}

          <div className="space-y-3">
            {readySessions.map(session => {
              const isCollapsed = collapsedReady.has(session.sessionName);
              const doneInSession = session.products.filter(p => completedIds.has(p.id)).length;
              const allDone = doneInSession === session.products.length;

              return (
                <div key={session.sessionName} className="bg-card border rounded-lg overflow-hidden">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary/30 transition-colors"
                    onClick={() => setCollapsedReady(prev => {
                      const n = new Set(prev);
                      if (n.has(session.sessionName)) n.delete(session.sessionName); else n.add(session.sessionName);
                      return n;
                    })}
                  >
                    <div className="flex items-center gap-3">
                      {isCollapsed ? <ChevronRight className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                      <div>
                        <h3 className="font-semibold text-sm">{session.sessionName}</h3>
                        <p className="text-xs text-muted-foreground">
                          {session.products.length} product{session.products.length !== 1 ? "s" : ""} · {doneInSession}/{session.products.length} retouched
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 bg-zinc-700 rounded-full h-1.5">
                        <div className="bg-orange-500 h-1.5 rounded-full transition-all" style={{ width: `${(doneInSession / session.products.length) * 100}%` }} />
                      </div>
                      {!allDone && (
                        <button
                          onClick={(e) => { e.stopPropagation(); completeReadySession(session.products); }}
                          disabled={bulkUpdateMut.isPending}
                          className="px-3 py-1.5 text-xs font-medium bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                        >
                          Complete Session
                        </button>
                      )}
                      {allDone && <span className="text-xs font-medium text-green-600 px-3 py-1.5">All Done ✓</span>}
                    </div>
                  </div>
                  {!isCollapsed && (
                    <div className="border-t divide-y">
                      {session.products.map(p => {
                        const isDone = completedIds.has(p.id);
                        return (
                          <div key={p.id} className={`flex items-center gap-4 px-4 py-3 transition-colors ${isDone ? "bg-orange-900/20 opacity-60" : "hover:bg-secondary/20"}`}>
                            <button
                              onClick={() => toggleProduct(p.id)}
                              disabled={bulkUpdateMut.isPending || (isDone && !p.isCarryOver)}
                              className={`w-7 h-7 rounded-md flex items-center justify-center border-2 transition-all flex-shrink-0 ${isDone ? "bg-orange-600 border-orange-600 text-white" : "border-zinc-600 hover:border-orange-500 text-transparent hover:text-orange-500"}`}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-sm">{p.keyCode}</span>
                                <span className="text-sm text-muted-foreground">{p.colour}</span>
                                {p.isCarryOver && <span className="text-[10px] font-medium bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded">CO</span>}
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
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500" />
            In Post Production
            <span className="text-sm font-normal text-muted-foreground">({ppProducts.length})</span>
          </h2>

          {ppSessions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground bg-card border rounded-lg">
              <CheckCheck className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No sessions in post production.</p>
            </div>
          )}

          <div className="space-y-3">
            {ppSessions.map(session => {
              const isCollapsed = collapsedPP.has(session.sessionName);
              const meta = getMeta(session.sessionName);
              const coProducts = session.products.filter(p => p.isCarryOver);
              const hasNonCo = session.products.some(p => !p.isCarryOver);
              const onlyCarryOvers = !hasNonCo;
              const isWaiting = meta?.sentTo || (onlyCarryOvers && meta?.carryOversSourced);
              const canDone = !!isWaiting;

              return (
                <div key={session.sessionName} className="bg-card border rounded-lg overflow-hidden">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary/30 transition-colors"
                    onClick={() => setCollapsedPP(prev => {
                      const n = new Set(prev);
                      if (n.has(session.sessionName)) n.delete(session.sessionName); else n.add(session.sessionName);
                      return n;
                    })}
                  >
                    <div className="flex items-center gap-3">
                      {isCollapsed ? <ChevronRight className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                      <div>
                        <h3 className="font-semibold text-sm flex items-center gap-2">
                          {session.sessionName}
                          {meta?.sentTo && (
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${meta.sentTo === "pixelz" ? "bg-purple-900/30 text-purple-400" : "bg-teal-900/30 text-teal-400"}`}>
                              Sent to {meta.sentTo === "pixelz" ? "Pixelz" : "Masking"}
                            </span>
                          )}
                          {isWaiting && (
                            <span className="text-[10px] font-medium bg-yellow-900/30 text-yellow-400 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Waiting
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {session.products.length} product{session.products.length !== 1 ? "s" : ""}
                          {coProducts.length > 0 && ` · ${coProducts.length} carry over`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      {!meta?.sentTo && hasNonCo && (
                        <>
                          <button
                            onClick={() => handleSendTo(session.sessionName, "pixelz")}
                            disabled={updateMetaMut.isPending}
                            className="px-2.5 py-1.5 text-xs font-medium bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50"
                          >
                            Send to Pixelz
                          </button>
                          <button
                            onClick={() => handleSendTo(session.sessionName, "masking")}
                            disabled={updateMetaMut.isPending}
                            className="px-2.5 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors disabled:opacity-50"
                          >
                            Send to Masking
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDoneSession(session.products)}
                        disabled={!canDone || bulkUpdateMut.isPending}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${canDone ? "bg-green-600 text-white hover:bg-green-700" : "bg-zinc-700 text-zinc-500 cursor-not-allowed"}`}
                      >
                        Done
                      </button>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="border-t">
                      {coProducts.length > 0 && (
                        <div className="px-4 py-2 bg-blue-900/20 border-b flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={meta?.carryOversSourced || false}
                                onChange={(e) => handleCarryOversSourced(session.sessionName, e.target.checked)}
                                className="w-4 h-4 rounded border-zinc-600"
                              />
                              <span className="text-xs font-medium text-blue-400">Carry Overs Sourced</span>
                            </label>
                          </div>
                          <button
                            onClick={() => {
                              const codes = coProducts.map(p => p.keyCode).filter(Boolean).join("\n");
                              copyToClipboard(codes);
                            }}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-400 bg-blue-900/30 rounded hover:bg-blue-900/50 transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                            Copy all CO Key Codes
                          </button>
                        </div>
                      )}
                      <div className="divide-y">
                        {session.products.map(p => (
                          <div key={p.id} className="flex items-center gap-4 px-4 py-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`font-mono text-sm ${p.isCarryOver ? "font-bold text-blue-400" : "font-bold"}`}>{p.keyCode}</span>
                                <span className="text-sm text-muted-foreground">{p.colour}</span>
                                {p.isCarryOver && (
                                  <>
                                    <span className="text-[10px] font-medium bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded">CO</span>
                                    <button
                                      onClick={() => copyToClipboard(p.keyCode || "")}
                                      className="p-0.5 text-blue-500 hover:text-blue-700 transition-colors"
                                      title="Copy Key Code"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{p.shortname} · {p.productType}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}
