import * as React from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowRight, Calendar } from "lucide-react";

export default function Dashboard() {
  const { data: projects, isLoading: pLoading } = useQuery({ queryKey: ["projects"], queryFn: api.getProjects });
  const { data: dashboard, isLoading: dLoading } = useQuery({ queryKey: ["dashboard"], queryFn: api.getDashboard });

  const delayedProjects = projects?.filter((p: any) => p.stats.delayed > 0) || [];

  return (
    <Layout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold">Dashboard</h1>

        {delayedProjects.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-destructive font-medium text-sm">
              <AlertTriangle className="w-4 h-4" />
              Factory Delayed Products
            </div>
            {delayedProjects.map((p: any) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="block text-sm hover:underline">
                {p.name}: {p.stats.delayed} product{p.stats.delayed > 1 ? "s" : ""} delayed
              </Link>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Project Progress</h2>
            <Link href="/projects" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
              All projects <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {pLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : !projects?.length ? (
            <p className="text-sm text-muted-foreground">No projects yet. Create one from the Projects page.</p>
          ) : (
            <div className="grid gap-3">
              {projects.map((p: any) => {
                const { total, uploaded, delayed, notStarted, readyForRetouch, inPostProduction, postProductionDone, readyForUpload, hasGallery, hasDetails, hasMisc } = p.stats;
                return (
                  <Link key={p.id} href={`/projects/${p.id}`} className="bg-card border rounded-lg p-4 hover:shadow-sm transition-shadow block">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-medium text-sm">{p.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{p.brand} &middot; {p.season}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{uploaded}/{total} uploaded</span>
                    </div>
                    {total > 0 && (
                      <div className="flex w-full h-2.5 rounded-full overflow-hidden bg-gray-100">
                        {uploaded > 0 && <div style={{ width: `${(uploaded / total) * 100}%`, backgroundColor: "#22c55e" }} title={`Uploaded: ${uploaded}`} />}
                        {readyForUpload > 0 && <div style={{ width: `${(readyForUpload / total) * 100}%`, backgroundColor: "#eab308" }} title={`Ready for Upload: ${readyForUpload}`} />}
                        {postProductionDone > 0 && <div style={{ width: `${(postProductionDone / total) * 100}%`, backgroundColor: "#8b5cf6" }} title={`Post Production - Done: ${postProductionDone}`} />}
                        {inPostProduction > 0 && <div style={{ width: `${(inPostProduction / total) * 100}%`, backgroundColor: "#3b82f6" }} title={`In Post Production: ${inPostProduction}`} />}
                        {readyForRetouch > 0 && <div style={{ width: `${(readyForRetouch / total) * 100}%`, backgroundColor: "#f97316" }} title={`Ready for Retouch: ${readyForRetouch}`} />}
                        {notStarted > 0 && <div style={{ width: `${(notStarted / total) * 100}%`, backgroundColor: "#9ca3af" }} title={`Not Started: ${notStarted}`} />}
                      </div>
                    )}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-2 gap-y-1 mt-2">
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#9ca3af" }} />{notStarted} Not Started</span>
                      <span className="flex items-center gap-1 text-[10px]" style={{ color: "#ea580c" }}><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#f97316" }} />{readyForRetouch} Retouch</span>
                      <span className="flex items-center gap-1 text-[10px]" style={{ color: "#2563eb" }}><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#3b82f6" }} />{inPostProduction} Post Prod</span>
                      <span className="flex items-center gap-1 text-[10px]" style={{ color: "#7c3aed" }}><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#8b5cf6" }} />{postProductionDone} PP Done</span>
                      <span className="flex items-center gap-1 text-[10px]" style={{ color: "#ca8a04" }}><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#eab308" }} />{readyForUpload} Ready</span>
                      <span className="flex items-center gap-1 text-[10px]" style={{ color: "#16a34a" }}><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#22c55e" }} />{uploaded} Uploaded</span>
                    </div>
                    {total > 0 && (
                      <div className="flex items-center gap-3 mt-2 pt-2 border-t">
                        <span className="text-[10px] text-muted-foreground font-medium">Shots:</span>
                        <span className="flex items-center gap-1 text-[10px]">
                          <span className={`w-2 h-2 rounded-full ${hasGallery === total ? "bg-green-500" : hasGallery > 0 ? "bg-yellow-400" : "bg-gray-300"}`} />
                          <span className="text-muted-foreground">G {hasGallery}/{total}</span>
                        </span>
                        <span className="flex items-center gap-1 text-[10px]">
                          <span className={`w-2 h-2 rounded-full ${hasDetails === total ? "bg-green-500" : hasDetails > 0 ? "bg-yellow-400" : "bg-gray-300"}`} />
                          <span className="text-muted-foreground">D {hasDetails}/{total}</span>
                        </span>
                        <span className="flex items-center gap-1 text-[10px]">
                          <span className={`w-2 h-2 rounded-full ${hasMisc === total ? "bg-green-500" : hasMisc > 0 ? "bg-yellow-400" : "bg-gray-300"}`} />
                          <span className="text-muted-foreground">M {hasMisc}/{total}</span>
                        </span>
                      </div>
                    )}
                    {delayed > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-destructive">
                        <AlertTriangle className="w-3 h-3" />
                        {delayed} delayed
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Upcoming Photo Shoots
            </h2>
            {dLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : !dashboard?.upcoming?.length ? (
              <p className="text-sm text-muted-foreground">No upcoming photo shoots.</p>
            ) : (
              <div className="space-y-2">
                {dashboard.upcoming.map((s: any) => (
                  <div key={s.id} className="bg-card border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{s.modelName}</span>
                      <Badge variant="secondary" className="text-xs">{s.brand}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatDate(s.date)} &middot; {s.shotType}
                    </div>
                    {s.notes && <p className="text-xs text-muted-foreground mt-1">{s.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Past Photo Shoots</h2>
            {dLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : !dashboard?.past?.length ? (
              <p className="text-sm text-muted-foreground">No past photo shoots yet.</p>
            ) : (
              <div className="space-y-2">
                {dashboard.past.slice(0, 5).map((s: any) => (
                  <div key={s.id} className="bg-card border rounded-lg p-3 opacity-70">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{s.modelName}</span>
                      <Badge variant="outline" className="text-xs">{s.brand}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatDate(s.date)} &middot; {s.shotType}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
