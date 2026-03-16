import * as React from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useListClients } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClientForm } from "@/components/forms/client-form";
import { generateInitials } from "@/lib/utils";
import { Plus, Search, Mail, Phone, ChevronRight, UserPlus } from "lucide-react";

export default function Clients() {
  const { data: clients, isLoading } = useListClients();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  const filteredClients = React.useMemo(() => {
    if (!clients) return [];
    const lowerQ = searchQuery.toLowerCase();
    return clients.filter(c => 
      c.name.toLowerCase().includes(lowerQ) || 
      c.email.toLowerCase().includes(lowerQ) ||
      (c.phone && c.phone.includes(lowerQ))
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, searchQuery]);

  return (
    <Layout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Clients</h1>
            <p className="text-muted-foreground mt-1">Manage your client relationships and contact info.</p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} className="shrink-0 gap-2 shadow-lg shadow-primary/20 hover:shadow-xl transition-all">
            <Plus className="w-4 h-4" /> Add Client
          </Button>
        </div>

        <div className="bg-card p-4 rounded-xl border border-border shadow-sm">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Search by name, email, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-20 bg-card rounded-xl border border-border animate-pulse"></div>
            ))}
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border border-dashed p-12 text-center">
            <div className="w-16 h-16 bg-secondary text-muted-foreground rounded-full flex items-center justify-center mx-auto mb-4">
              <UserPlus className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No clients found</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              {searchQuery ? "Try adjusting your search criteria." : "Add your first client to start organizing your photography contacts."}
            </p>
            {!searchQuery && <Button onClick={() => setIsCreateOpen(true)}>Add Client</Button>}
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="divide-y divide-border/50">
              {filteredClients.map((client) => (
                <Link 
                  key={client.id} 
                  href={`/clients/${client.id}`}
                  className="flex flex-col sm:flex-row sm:items-center p-4 hover:bg-secondary/40 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/80 to-primary text-primary-foreground flex items-center justify-center font-display font-semibold text-lg shadow-sm shrink-0">
                      {generateInitials(client.name)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate text-lg">
                        {client.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5 truncate">
                          <Mail className="w-3.5 h-3.5" />
                          <span className="truncate">{client.email}</span>
                        </div>
                        {client.phone && (
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <Phone className="w-3.5 h-3.5" />
                            <span>{client.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="hidden sm:flex shrink-0 ml-4 text-muted-foreground/30 group-hover:text-primary transition-colors">
                    <ChevronRight className="w-6 h-6" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
          </DialogHeader>
          <ClientForm 
            onSuccess={() => setIsCreateOpen(false)} 
            onCancel={() => setIsCreateOpen(false)} 
          />
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
