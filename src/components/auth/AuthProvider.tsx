'use client';

import {onAuthStateChanged, User} from 'firebase/auth';
import {createContext, useContext, useEffect, useState, ReactNode} from 'react';

import type {AccessRole} from '@/src/lib/access-control';
import {auth} from '@/src/utils/firebase';

interface AuthContextType {
  user: User | null;
  role: AccessRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({children}: {children: ReactNode}) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AccessRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Get ID token and create session
        const idToken = await firebaseUser.getIdToken();
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({idToken}),
        });
        const accessResponse = await fetch('/api/admin/check');
        const accessData: unknown = accessResponse.ok ? await accessResponse.json() : null;
        const accessRole =
          typeof accessData === 'object' &&
          accessData !== null &&
          'role' in accessData &&
          (accessData.role === 'admin' ||
            accessData.role === 'organizer' ||
            accessData.role === 'member')
            ? accessData.role
            : 'member';
        setUser(firebaseUser);
        setRole(accessRole);
      } else {
        // Clear session
        await fetch('/api/auth/session', {method: 'DELETE'});
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await auth.signOut();
    await fetch('/api/auth/session', {method: 'DELETE'});
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{user, role, loading, signOut: handleSignOut}}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
