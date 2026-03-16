import * as React from "react";
import { useRoute, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { 
  useGetProject, 
  useDeleteProject, 
  useUpdateProject,
  getListProjectsQueryKey,
  ProjectStatus
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ProjectForm } from "@/components/forms/project-form";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { 
  Calendar, MapPin, DollarSign, User, FileText, 
  Edit, Trash2, ArrowLeft, Clock, CheckCircle2 
} from "lucide-react";

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const projectId = parseInt(params?.id || "0", 10);

  const { data: project, isLoading, isError } = useGetProject(projectId, { query: { enabled: !!projectId } });
  const deleteMutation = useDeleteProject();
  const updateMutation = useUpdateProject();

  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);

  if (isLoading) {
    return (
      <Layout>
        <div className="animate-pulse space-y-8 max-w-5xl mx-auto">
          <div className="h-32 bg-card rounded-2xl"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 h-96 bg-card rounded-2xl"></div>
            <div className="h-96 bg-card rounded-2xl"></div>
          </div>
        </div>
      </Layout>
    );
  }

  if (isError || !project) {
    return (
      <Layout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold mb-2">Project Not Found</h2>
          <Button onClick={() => setLocation("/projects")} variant="outline">Back to Projects</Button>
        </div>
      </Layout>
    );
  }

  const handleDelete = () => {
    deleteMutation.mutate({ id: project.id }, {
      onSuccess: () => {
        toast({ title: "Project deleted" });
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        setLocation("/projects");
      }
    });
  };

  const handleStatusChange = (newStatus: typeof ProjectStatus[keyof typeof ProjectStatus]) => {
    updateMutation.mutate(
      { id: project.id, data: { status: newStatus } },
      {
        onSuccess: () => {
          toast({ title: "Status updated" });
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}`] });
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        }
      }
    );
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header Action Bar */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/projects")} className="text-muted-foreground -ml-3">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)}>
              <Edit className="w-4 h-4 mr-2" /> Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setIsDeleteOpen(true)}>
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </Button>
          </div>
        </div>

        {/* Hero Section */}
        {/* landing page hero scenic photography studio aesthetic */}
        <div className="relative rounded-3xl overflow-hidden bg-card border border-border shadow-sm">
          <div className="h-48 w-full bg-secondary/50 relative">
             <img 
               src={`${import.meta.env.BASE_URL}images/studio-hero.png`} 
               alt="Studio vibe" 
               className="w-full h-full object-cover opacity-60 mix-blend-overlay"
             />
             <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
          </div>
          
          <div className="px-6 md:px-10 pb-8 pt-4 relative -mt-16 sm:-mt-20">
            <div className="bg-background inline-flex p-1 rounded-full mb-4 shadow-sm">
               <Badge variant={project.status as any} className="text-sm px-4 py-1.5 capitalize rounded-full shadow-none border-2 border-background">
                 {project.status.replace('_', ' ')}
               </Badge>
            </div>
            <h1 className="text-3xl md:text-5xl font-display font-bold text-foreground mb-2 drop-shadow-sm">
              {project.title}
            </h1>
            <p className="text-muted-foreground text-lg flex items-center gap-2 capitalize">
               {project.projectType.replace('_', ' ')} Project
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Content (Left, 2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card rounded-2xl p-6 md:p-8 border border-border shadow-sm">
              <h2 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> Overview
              </h2>
              <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none text-muted-foreground whitespace-pre-wrap">
                {project.description ? project.description : <span className="italic">No description provided for this project.</span>}
              </div>
            </div>

            <div className="bg-card rounded-2xl p-6 md:p-8 border border-border shadow-sm">
              <h2 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> Internal Notes
              </h2>
              <div className="bg-secondary/30 rounded-xl p-5 text-sm text-foreground/80 font-mono whitespace-pre-wrap border border-secondary/50">
                {project.notes ? project.notes : <span className="italic text-muted-foreground">No notes recorded.</span>}
              </div>
            </div>
          </div>

          {/* Sidebar Metadata (Right, 1 col) */}
          <div className="space-y-6">
            <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
              <h3 className="text-lg font-display font-semibold mb-6">Details</h3>
              
              <div className="space-y-5">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Client</p>
                    <p className="font-medium text-foreground">
                      {project.clientName ? (
                        <span className="hover:text-primary cursor-pointer transition-colors" onClick={() => setLocation(`/clients/${project.clientId}`)}>
                          {project.clientName}
                        </span>
                      ) : 'Unassigned'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Session Date</p>
                    <p className="font-medium text-foreground">
                      {project.sessionDate ? formatDate(project.sessionDate, "EEEE, MMMM d, yyyy 'at' h:mm a") : 'TBD'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Location</p>
                    <p className="font-medium text-foreground">{project.location || 'TBD'}</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <DollarSign className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Budget / Price</p>
                    <p className="font-medium text-foreground">{formatCurrency(project.price)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Status Update */}
            <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
              <h3 className="text-lg font-display font-semibold mb-4">Quick Status</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.values(ProjectStatus).map(s => {
                  const isActive = project.status === s;
                  return (
                    <button
                      key={s}
                      disabled={updateMutation.isPending}
                      onClick={() => handleStatusChange(s)}
                      className={`px-3 py-2 rounded-lg text-sm text-left font-medium transition-all ${
                        isActive 
                          ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary ring-offset-2 ring-offset-background" 
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-transparent hover:border-border"
                      }`}
                    >
                      <span className="capitalize">{s.replace('_', ' ')}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <ProjectForm 
            initialData={project}
            onSuccess={() => setIsEditOpen(false)} 
            onCancel={() => setIsEditOpen(false)} 
          />
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{project.title}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={deleteMutation.isPending}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete Permanently"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
