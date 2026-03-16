import * as React from "react";

type User = { id: number; name: string };

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = React.createContext<AuthContextType>({
  user: null,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(() => {
    const stored = localStorage.getItem("ridestore_user");
    return stored ? JSON.parse(stored) : null;
  });

  const login = React.useCallback((u: User) => {
    setUser(u);
    localStorage.setItem("ridestore_user", JSON.stringify(u));
  }, []);

  const logout = React.useCallback(() => {
    setUser(null);
    localStorage.removeItem("ridestore_user");
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return React.useContext(AuthContext);
}
