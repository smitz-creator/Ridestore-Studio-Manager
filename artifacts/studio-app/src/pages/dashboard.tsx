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
                const { total, uploaded, delayed, notStarted, readyForRetouch, inPostProduction, readyToUpload } = p.stats;
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
                      <div className="flex w-full h-2 rounded-full overflow-hidden bg-gray-100">
                        {uploaded > 0 && <div className="bg-green-500" style={{ width: `${(uploaded / total) * 100}%` }} title={`Uploaded: ${uploaded}`} />}
                        {readyToUpload > 0 && <div className="bg-yellow-400" style={{ width: `${(readyToUpload / total) * 100}%` }} title={`Ready to Upload: ${readyToUpload}`} />}
                        {inPostProduction > 0 && <div className="bg-blue-500" style={{ width: `${(inPostProduction / total) * 100}%` }} title={`In Post Production: ${inPostProduction}`} />}
                        {readyForRetouch > 0 && <div className="bg-orange-400" style={{ width: `${(readyForRetouch / total) * 100}%` }} title={`Ready for Retouch: ${readyForRetouch}`} />}
                        {notStarted > 0 && <div className="bg-gray-300" style={{ width: `${(notStarted / total) * 100}%` }} title={`Not Started: ${notStarted}`} />}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                      {notStarted > 0 && <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-2 h-2 rounded-full bg-gray-300" />{notStarted} Not Started</span>}
                      {readyForRetouch > 0 && <span className="flex items-center gap-1 text-[10px] text-orange-600"><span className="w-2 h-2 rounded-full bg-orange-400" />{readyForRetouch} Retouch</span>}
                      {inPostProduction > 0 && <span className="flex items-center gap-1 text-[10px] text-blue-600"><span className="w-2 h-2 rounded-full bg-blue-500" />{inPostProduction} Post Prod</span>}
                      {readyToUpload > 0 && <span className="flex items-center gap-1 text-[10px] text-yellow-600"><span className="w-2 h-2 rounded-full bg-yellow-400" />{readyToUpload} Ready</span>}
                      {uploaded > 0 && <span className="flex items-center gap-1 text-[10px] text-green-600"><span className="w-2 h-2 rounded-full bg-green-500" />{uploaded} Uploaded</span>}
                    </div>
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
              Upcoming Sessions
            </h2>
            {dLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : !dashboard?.upcoming?.length ? (
              <p className="text-sm text-muted-foreground">No upcoming sessions.</p>
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
            <h2 className="text-lg font-semibold">Past Sessions</h2>
            {dLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : !dashboard?.past?.length ? (
              <p className="text-sm text-muted-foreground">No past sessions yet.</p>
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
