import * as React from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useListProjects, useListClients, ProjectStatus } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Users, Image as ImageIcon, CalendarClock, ArrowRight, Activity } from "lucide-react";

export default function Dashboard() {
  const { data: projects, isLoading: projectsLoading } = useListProjects();
  const { data: clients, isLoading: clientsLoading } = useListClients();

  const activeProjects = projects?.filter(p => !['delivered', 'archived'].includes(p.status)) || [];
  const upcomingSessions = projects?.filter(p => p.sessionDate && new Date(p.sessionDate) >= new Date())
    .sort((a, b) => new Date(a.sessionDate!).getTime() - new Date(b.sessionDate!).getTime()) || [];
  
  const recentProjects = projects?.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5) || [];

  return (
    <Layout>
      <div className="space-y-8">
        
        {/* Welcome Section */}
        <div className="relative rounded-2xl overflow-hidden bg-primary/5 border border-primary/10 p-8 sm:p-10">
           <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
           <div className="relative z-10 max-w-2xl">
              <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-3">
                Welcome back to Lumina
              </h1>
              <p className="text-muted-foreground text-lg mb-6">
                You have {activeProjects.length} active projects and {upcomingSessions.length} upcoming sessions this week.
              </p>
           </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <StatCard 
            title="Total Projects" 
            value={projects?.length.toString() || "0"} 
            icon={ImageIcon} 
            loading={projectsLoading} 
          />
          <StatCard 
            title="Active Clients" 
            value={clients?.length.toString() || "0"} 
            icon={Users} 
            loading={clientsLoading} 
          />
          <StatCard 
            title="Active Projects" 
            value={activeProjects.length.toString()} 
            icon={Activity} 
            loading={projectsLoading} 
          />
          <StatCard 
            title="Upcoming Sessions" 
            value={upcomingSessions.length.toString()} 
            icon={CalendarClock} 
            loading={projectsLoading} 
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Projects */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-display font-semibold">Recent Projects</h2>
              <Link href="/projects" className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1">
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              {projectsLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading projects...</div>
              ) : recentProjects.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No projects yet.</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {recentProjects.map((project) => (
                    <Link 
                      key={project.id} 
                      href={`/projects/${project.id}`}
                      className="block p-4 hover:bg-secondary/50 transition-colors group"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {project.title}
                          </h3>
                          <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                            <span>{project.clientName || 'No client'}</span>
                            <span className="w-1 h-1 rounded-full bg-border"></span>
                            <span className="capitalize">{project.projectType.replace('_', ' ')}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-4 min-w-[200px]">
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <CalendarClock className="w-4 h-4" />
                            {project.sessionDate ? formatDate(project.sessionDate, "MMM d") : 'TBD'}
                          </div>
                          <Badge variant={project.status as any} className="capitalize">
                            {project.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Sessions Sidebar */}
          <div className="space-y-4">
            <h2 className="text-xl font-display font-semibold">Upcoming Sessions</h2>
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              {projectsLoading ? (
                <div className="text-center text-muted-foreground py-4">Loading...</div>
              ) : upcomingSessions.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <CalendarClock className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p>No upcoming sessions scheduled.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {upcomingSessions.slice(0, 5).map(project => (
                    <div key={project.id} className="flex gap-4">
                      <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary shrink-0">
                        <span className="text-xs font-bold uppercase leading-none">{formatDate(project.sessionDate, "MMM")}</span>
                        <span className="text-lg font-bold leading-none mt-1">{formatDate(project.sessionDate, "d")}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link href={`/projects/${project.id}`} className="font-medium text-sm text-foreground hover:text-primary truncate block">
                          {project.title}
                        </Link>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{project.location || 'Location TBD'}</p>
                        <p className="text-xs text-muted-foreground truncate">{project.clientName}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function StatCard({ title, value, icon: Icon, loading }: { title: string, value: string, icon: any, loading: boolean }) {
  return (
    <div className="bg-card rounded-xl p-5 border border-border shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-lg bg-secondary text-secondary-foreground">
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      </div>
      <div className="text-3xl font-display font-bold text-foreground">
        {loading ? <span className="text-muted animate-pulse">...</span> : value}
      </div>
    </div>
  );
}
