import * as React from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useListProjects, ProjectStatus, ProjectProjectType } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProjectForm } from "@/components/forms/project-form";
import { formatDate } from "@/lib/utils";
import { Plus, Search, Calendar, MapPin, FilterX } from "lucide-react";

export default function Projects() {
  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [typeFilter, setTypeFilter] = React.useState<string>("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  const { data: projects, isLoading } = useListProjects({ 
    status: statusFilter ? (statusFilter as any) : undefined 
  });

  const filteredProjects = React.useMemo(() => {
    if (!projects) return [];
    return projects.filter(p => {
      const matchesType = typeFilter ? p.projectType === typeFilter : true;
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        p.title.toLowerCase().includes(searchLower) || 
        (p.clientName && p.clientName.toLowerCase().includes(searchLower)) ||
        (p.location && p.location.toLowerCase().includes(searchLower));
      return matchesType && matchesSearch;
    });
  }, [projects, typeFilter, searchQuery]);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Projects</h1>
            <p className="text-muted-foreground mt-1">Manage and track all your photography assignments.</p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} className="shrink-0 gap-2 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
            <Plus className="w-4 h-4" /> New Project
          </Button>
        </div>

        {/* Filters Bar */}
        <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Search projects, clients, locations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <div className="flex gap-3">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer min-w-[140px]"
            >
              <option value="">All Statuses</option>
              {Object.values(ProjectStatus).map(s => (
                <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
              ))}
            </select>
            <select 
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer min-w-[140px]"
            >
              <option value="">All Types</option>
              {Object.values(ProjectProjectType).map(t => (
                <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
              ))}
            </select>
            {(statusFilter || typeFilter || searchQuery) && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => { setStatusFilter(""); setTypeFilter(""); setSearchQuery(""); }}
                title="Clear filters"
              >
                <FilterX className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Projects Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-card rounded-2xl h-64 border border-border animate-pulse"></div>
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border border-dashed p-12 text-center">
            <div className="w-16 h-16 bg-secondary text-muted-foreground rounded-full flex items-center justify-center mx-auto mb-4">
              <ImageIcon className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No projects found</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Get started by creating your first photography project to track details, sessions, and client info.
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>Create Project</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <div className="bg-card group rounded-2xl p-6 border border-border shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300 h-full flex flex-col cursor-pointer">
                  <div className="flex justify-between items-start mb-4">
                    <Badge variant={project.status as any} className="capitalize shadow-none">
                      {project.status.replace('_', ' ')}
                    </Badge>
                    <span className="text-xs font-medium text-muted-foreground bg-secondary px-2 py-1 rounded-md capitalize">
                      {project.projectType.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <h3 className="text-xl font-display font-semibold text-foreground mb-1 group-hover:text-primary transition-colors line-clamp-1">
                    {project.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2 min-h-[40px]">
                    {project.description || "No description provided."}
                  </p>
                  
                  <div className="mt-auto space-y-3 pt-4 border-t border-border/50">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Client:</span>
                      <span className="font-medium truncate max-w-[150px]">{project.clientName || 'Unassigned'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5"/> Date:</span>
                      <span className="font-medium">{project.sessionDate ? formatDate(project.sessionDate) : 'TBD'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5"/> Location:</span>
                      <span className="font-medium truncate max-w-[140px]">{project.location || 'TBD'}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          <ProjectForm 
            onSuccess={() => setIsCreateOpen(false)} 
            onCancel={() => setIsCreateOpen(false)} 
          />
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
