import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

export default function Login() {
  const { login } = useAuth();
  const { data: users, isLoading } = useQuery({ queryKey: ["users"], queryFn: api.getUsers });

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Ridestore Studio</h1>
          <p className="text-sm text-muted-foreground">Product Photography Tracker</p>
        </div>
        <div className="bg-card border rounded-lg p-6 space-y-4">
          <p className="text-sm font-medium text-center">Who are you?</p>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center">Loading...</p>
          ) : (
            <div className="grid gap-2">
              {users?.map((u: any) => (
                <button
                  key={u.id}
                  onClick={() => login(u)}
                  className="w-full px-4 py-3 text-sm font-medium rounded-md border bg-background hover:bg-secondary transition-colors text-left"
                >
                  {u.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
