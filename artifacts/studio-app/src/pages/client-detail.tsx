import * as React from "react";
import { useRoute, useLocation, Link } from "wouter";
import { Layout } from "@/components/layout";
import { 
  useGetClient, 
  useDeleteClient, 
  useListProjects,
  getListClientsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ClientForm } from "@/components/forms/client-form";
import { generateInitials, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, Edit, Trash2, Mail, Phone, Calendar, ImageIcon 
} from "lucide-react";

export default function ClientDetail() {
  const [, params] = useRoute("/clients/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const clientId = parseInt(params?.id || "0", 10);

  const { data: client, isLoading, isError } = useGetClient(clientId, { query: { enabled: !!clientId } });
  const { data: projects, isLoading: projectsLoading } = useListProjects({ clientId });
  
  const deleteMutation = useDeleteClient();

  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);

  if (isLoading) {
    return (
      <Layout>
        <div className="animate-pulse space-y-8 max-w-4xl mx-auto">
          <div className="h-48 bg-card rounded-2xl"></div>
          <div className="h-64 bg-card rounded-2xl"></div>
        </div>
      </Layout>
    );
  }

  if (isError || !client) {
    return (
      <Layout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold mb-2">Client Not Found</h2>
          <Button onClick={() => setLocation("/clients")} variant="outline">Back to Clients</Button>
        </div>
      </Layout>
    );
  }

  const handleDelete = () => {
    deleteMutation.mutate({ id: client.id }, {
      onSuccess: () => {
        toast({ title: "Client deleted" });
        queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
        setLocation("/clients");
      },
      onError: () => {
        toast({ title: "Failed to delete client. They might have active projects.", variant: "destructive" });
        setIsDeleteOpen(false);
      }
    });
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8">
        
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/clients")} className="text-muted-foreground -ml-3">
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

        {/* Client Profile Card */}
        <div className="bg-card rounded-3xl p-8 md:p-12 border border-border shadow-md flex flex-col md:flex-row gap-8 items-start relative overflow-hidden">
          {/* Decorative background element */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20"></div>

          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-tr from-primary to-primary/60 text-primary-foreground flex items-center justify-center font-display font-semibold text-3xl md:text-5xl shadow-xl shrink-0 z-10">
            {generateInitials(client.name)}
          </div>
          
          <div className="flex-1 z-10">
            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              {client.name}
            </h1>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-8 max-w-2xl">
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-foreground/70" />
                </div>
                <a href={`mailto:${client.email}`} className="hover:text-primary hover:underline font-medium">{client.email}</a>
              </div>
              
              {client.phone && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4 text-foreground/70" />
                  </div>
                  <a href={`tel:${client.phone}`} className="hover:text-primary hover:underline font-medium">{client.phone}</a>
                </div>
              )}
              
              <div className="flex items-center gap-3 text-muted-foreground sm:col-span-2 mt-2">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-foreground/70" />
                </div>
                <span className="text-sm">Client since {formatDate(client.createdAt, "MMMM yyyy")}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Client Notes */}
        {client.notes && (
          <div className="bg-secondary/30 rounded-2xl p-6 border border-border">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Client Notes & Preferences</h3>
            <p className="text-foreground whitespace-pre-wrap">{client.notes}</p>
          </div>
        )}

        {/* Projects Section */}
        <div className="space-y-4 pt-6 border-t border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-display font-semibold flex items-center gap-2">
              <ImageIcon className="w-6 h-6 text-primary" /> Associated Projects
            </h2>
            <Badge variant="secondary" className="px-3 py-1 text-sm">{projects?.length || 0}</Badge>
          </div>

          {projectsLoading ? (
            <div className="h-32 bg-card rounded-xl animate-pulse"></div>
          ) : projects?.length === 0 ? (
            <div className="bg-card rounded-xl border border-border border-dashed p-10 text-center">
              <p className="text-muted-foreground">This client has no projects yet.</p>
              <Button variant="outline" className="mt-4" onClick={() => setLocation("/projects")}>Go create a project</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects?.map(project => (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <div className="bg-card rounded-xl p-5 border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all group">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">{project.title}</h3>
                      <Badge variant={project.status as any} className="capitalize shadow-none scale-90 origin-top-right">
                        {project.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-4 mt-3">
                       <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5"/> {project.sessionDate ? formatDate(project.sessionDate, "MMM d, yyyy") : 'TBD'}</span>
                       <span className="capitalize bg-secondary px-2 py-0.5 rounded text-xs">{project.projectType.replace('_', ' ')}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          <ClientForm 
            initialData={client}
            onSuccess={() => setIsEditOpen(false)} 
            onCancel={() => setIsEditOpen(false)} 
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Client</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{client.name}</strong>? This action cannot be undone. 
              <br/><br/>
              <strong>Note:</strong> You may not be able to delete a client if they have associated projects.
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
