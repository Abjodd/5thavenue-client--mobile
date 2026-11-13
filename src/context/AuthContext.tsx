import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
} from "react";

import {
  portalLogin,
  type PortalUser,
} from "../lib/api";

// ---------------------------------------------
// AUTH CONTEXT TYPE
// ---------------------------------------------

type AuthContextType = {
  user: PortalUser | null;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  updateUser: (updated: Partial<PortalUser>) => void;
};

// ---------------------------------------------
// CREATE AUTH CONTEXT
// ---------------------------------------------

const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

// ---------------------------------------------
// AUTH PROVIDER
// ---------------------------------------------

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<PortalUser | null>(null);

  // LOGIN
  const signIn = async (email: string, password: string) => {
    const loggedInUser = await portalLogin(email, password);
    setUser(loggedInUser);
  };

  // LOGOUT
  const signOut = () => {
    setUser(null);
  };

  // UPDATE USER DETAILS
  // Used after successfully saving profile information.
  const updateUser = (updated: Partial<PortalUser>) => {
    setUser((current) =>
      current ? { ...current, ...updated } : current
    );
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        signIn,
        signOut,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------
// CUSTOM AUTH HOOK
// ---------------------------------------------

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}