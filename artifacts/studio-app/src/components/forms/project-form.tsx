import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useCreateProject, 
  useUpdateProject, 
  useListClients,
  getListProjectsQueryKey, 
  Project,
  ProjectStatus,
  ProjectProjectType
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const projectSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  status: z.enum([ProjectStatus.inquiry, ProjectStatus.booked, ProjectStatus.in_progress, ProjectStatus.editing, ProjectStatus.delivered, ProjectStatus.archived]),
  projectType: z.enum([ProjectProjectType.wedding, ProjectProjectType.portrait, ProjectProjectType.commercial, ProjectProjectType.event, ProjectProjectType.product, ProjectProjectType.fashion, ProjectProjectType.real_estate, ProjectProjectType.other]),
  clientId: z.coerce.number().optional().nullable().transform(val => val === 0 ? null : val),
  sessionDate: z.string().optional().nullable().transform(val => val === "" ? null : val),
  location: z.string().optional().nullable(),
  price: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

interface ProjectFormProps {
  initialData?: Project;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ProjectForm({ initialData, onSuccess, onCancel }: ProjectFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: clients } = useListClients();
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();

  const isPending = createMutation.isPending || updateMutation.isPending;

  // Format date for input[type="datetime-local"] if it exists
  const defaultDate = initialData?.sessionDate 
    ? new Date(initialData.sessionDate).toISOString().slice(0, 16) 
    : "";

  const { register, handleSubmit, control, formState: { errors } } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || "",
      status: initialData?.status || ProjectStatus.inquiry,
      projectType: initialData?.projectType || ProjectProjectType.portrait,
      clientId: initialData?.clientId || null,
      sessionDate: defaultDate,
      location: initialData?.location || "",
      price: initialData?.price || "",
      notes: initialData?.notes || "",
    },
  });

  const onSubmit = (data: ProjectFormValues) => {
    // Ensure date is properly formatted as ISO string if present
    if (data.sessionDate) {
      data.sessionDate = new Date(data.sessionDate).toISOString();
    }

    if (initialData) {
      updateMutation.mutate(
        { id: initialData.id, data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
            queryClient.invalidateQueries({ queryKey: [`/api/projects/${initialData.id}`] });
            toast({ title: "Project updated successfully" });
            onSuccess();
          },
          onError: (error) => {
            toast({ title: "Failed to update project", variant: "destructive" });
          }
        }
      );
    } else {
      createMutation.mutate(
        { data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
            toast({ title: "Project created successfully" });
            onSuccess();
          },
          onError: (error) => {
            toast({ title: "Failed to create project", variant: "destructive" });
          }
        }
      );
    }
  };

  const inputClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 transition-colors";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium">Project Title *</label>
          <input {...register("title")} className={inputClass} placeholder="Summer Editorial Shoot" />
          {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Type *</label>
          <select {...register("projectType")} className={inputClass}>
            {Object.values(ProjectProjectType).map(type => (
              <option key={type} value={type}>{type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Status *</label>
          <select {...register("status")} className={inputClass}>
            {Object.values(ProjectStatus).map(status => (
              <option key={status} value={status}>{status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Client</label>
          <select {...register("clientId")} className={inputClass}>
            <option value="">No Client Assigned</option>
            {clients?.map(client => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Session Date & Time</label>
          <input type="datetime-local" {...register("sessionDate")} className={inputClass} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Location</label>
          <input {...register("location")} className={inputClass} placeholder="Studio A / Central Park" />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Price/Budget</label>
          <input {...register("price")} className={inputClass} placeholder="1500.00" type="number" step="0.01" />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>
        <textarea {...register("description")} className={cn(inputClass, "min-h-[80px] py-3")} placeholder="Brief overview of the project goals..." />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Internal Notes</label>
        <textarea {...register("notes")} className={cn(inputClass, "min-h-[80px] py-3")} placeholder="Equipment needs, moodboard links, etc." />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : initialData ? "Update Project" : "Create Project"}
        </Button>
      </div>
    </form>
  );
}
