import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Camera, Calendar as CalendarIcon, Layers } from "lucide-react";

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

const statusLabel = (v: string) => UPLOAD_STATUSES.find(s => s.value === v)?.label || v;

const statusColor = (v: string) => {
  switch (v) {
    case "uploaded": return "bg-green-900/30 text-green-400";
    case "ready_for_upload": return "bg-yellow-900/30 text-yellow-400";
    case "post_production_done": return "bg-purple-900/30 text-purple-400";
    case "in_post_production": return "bg-blue-900/30 text-blue-400";
    case "ready_for_retouch": return "bg-orange-900/30 text-orange-400";
    case "ready_for_selection": return "bg-pink-900/30 text-pink-400";
    case "in_the_studio": return "bg-cyan-900/30 text-cyan-400";
    default: return "bg-zinc-800 text-zinc-400";
  }
};

const shotTypeBadge = (type: string) => {
  switch (type) {
    case "Gallery": return "bg-indigo-900/30 text-indigo-400";
    case "Details": return "bg-teal-900/30 text-teal-400";
    case "Misc": return "bg-pink-900/30 text-pink-400";
    default: return "bg-zinc-800 text-zinc-400";
  }
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function CaptureSessions() {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["capture-sessions"],
    queryFn: api.getCaptureSessions,
  });

  const [expandedSession, setExpandedSession] = React.useState<string | null>(null);
  const [filterShotType, setFilterShotType] = React.useState<string>("all");
  const [searchText, setSearchText] = React.useState("");

  const filtered = React.useMemo(() => {
    if (!sessions) return [];
    return sessions.filter((s: any) => {
      if (filterShotType !== "all" && !s.shotTypes.includes(filterShotType)) return false;
      if (searchText && !s.sessionName.toLowerCase().includes(searchText.toLowerCase())) return false;
      return true;
    });
  }, [sessions, filterShotType, searchText]);

  return (
    <Layout>
      <div className="space-y-4 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Camera className="w-6 h-6" />
            Capture Sessions
          </h1>
          <span className="text-sm text-muted-foreground">
            {filtered?.length || 0} sessions
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Search sessions..."
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring flex-1 min-w-[200px]"
          />
          <Select value={filterShotType} onValueChange={setFilterShotType}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="Gallery">Gallery</SelectItem>
              <SelectItem value="Details">Details</SelectItem>
              <SelectItem value="Misc">Misc</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading capture sessions...</p>
        ) : !filtered?.length ? (
          <p className="text-sm text-muted-foreground">No capture sessions found. Sessions are automatically created from Gallery, Details, and Misc shot fields on products.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((session: any) => {
              const isExpanded = expandedSession === session.sessionName;
              return (
                <CaptureSessionCard
                  key={session.sessionName}
                  session={session}
                  isExpanded={isExpanded}
                  onToggle={() => setExpandedSession(isExpanded ? null : session.sessionName)}
                />
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

function CaptureSessionCard({ session, isExpanded, onToggle }: {
  session: any;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: products } = useQuery({
    queryKey: ["all-products"],
    queryFn: () => api.getProducts(),
  });

  const bulkMut = useMutation({
    mutationFn: ({ productIds, uploadStatus }: { productIds: number[]; uploadStatus: string }) =>
      api.bulkUpdateStatus(productIds, uploadStatus),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["capture-sessions"] });
      qc.invalidateQueries({ queryKey: ["all-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast({ title: `Updated ${vars.productIds.length} products to ${statusLabel(vars.uploadStatus)}` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const sessionProducts = React.useMemo(() => {
    if (!products) return [];
    return products.filter((p: any) => {
      return p.galleryShots?.trim() === session.sessionName
        || p.detailsShots?.trim() === session.sessionName
        || p.miscShots?.trim() === session.sessionName;
    });
  }, [products, session]);

  const getProductShotTypes = (p: any): string[] => {
    const types: string[] = [];
    if (p.galleryShots?.trim() === session.sessionName) types.push("Gallery");
    if (p.detailsShots?.trim() === session.sessionName) types.push("Details");
    if (p.miscShots?.trim() === session.sessionName) types.push("Misc");
    return types;
  };

  const statusSummary = Object.entries(session.statusBreakdown as Record<string, number>)
    .sort((a, b) => {
      const order = ["not_started", "in_the_studio", "ready_for_selection", "ready_for_retouch", "in_post_production", "post_production_done", "ready_for_upload", "uploaded"];
      return order.indexOf(a[0]) - order.indexOf(b[0]);
    });

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-medium text-sm truncate">{session.sessionName}</span>
            {session.shotTypes.map((type: string) => (
              <Badge key={type} variant="outline" className={cn("text-xs shrink-0", shotTypeBadge(type))}>
                {type}
              </Badge>
            ))}
            {session.date && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <CalendarIcon className="w-3 h-3" />
                {formatDate(session.date)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Layers className="w-3 h-3" />
              {session.count}
            </span>
            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {statusSummary.map(([status, count]) => (
            <span key={status} className={cn("text-[10px] px-1.5 py-0.5 rounded-full", statusColor(status))}>
              {count} {statusLabel(status)}
            </span>
          ))}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t px-4 py-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Change status for all:</span>
            <Select
              onValueChange={v => {
                bulkMut.mutate({ productIds: session.productIds, uploadStatus: v });
              }}
              disabled={bulkMut.isPending}
            >
              <SelectTrigger className="w-[220px] h-8 text-xs">
                <SelectValue placeholder={bulkMut.isPending ? "Updating..." : "Select new status..."} />
              </SelectTrigger>
              <SelectContent>
                {UPLOAD_STATUSES.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {sessionProducts.length > 0 ? (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-xs text-muted-foreground">
                    <th className="text-left px-3 py-1.5 font-medium">Product</th>
                    <th className="text-left px-3 py-1.5 font-medium">Key Code</th>
                    <th className="text-left px-3 py-1.5 font-medium">Colour</th>
                    <th className="text-left px-3 py-1.5 font-medium">Shot Types</th>
                    <th className="text-left px-3 py-1.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionProducts.map((p: any) => (
                    <tr key={p.id} className="border-t">
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{p.shortname}</span>
                          {p.isReshoot && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-900/30 text-orange-400">Reshoot</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground font-mono text-xs">{p.keyCode || "–"}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{p.colour || "–"}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex gap-1">
                          {getProductShotTypes(p).map(t => (
                            <span key={t} className={cn("text-[10px] px-1.5 py-0.5 rounded-full", shotTypeBadge(t))}>{t}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full", statusColor(p.uploadStatus))}>
                          {statusLabel(p.uploadStatus)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Loading products...</p>
          )}
        </div>
      )}
    </div>
  );
}
