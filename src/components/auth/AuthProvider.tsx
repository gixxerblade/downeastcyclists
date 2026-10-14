'use client';

import {useQueryClient} from '@tanstack/react-query';
import {Effect} from 'effect';
import {onAuthStateChanged, User} from 'firebase/auth';
import {createContext, useContext, useEffect, useRef, useState, ReactNode} from 'react';

import type {AccessRole} from '@/src/lib/access-control';
import {clearSessionCookie, createSessionCookie} from '@/src/lib/effect/client-auth';
import {auth} from '@/src/utils/firebase';

interface AuthContextType {
  user: User | null;
  role: AccessRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({children}: {children: ReactNode}) {
  const queryClient = useQueryClient();
  const accountId = useRef<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AccessRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let generation = 0;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const currentGeneration = ++generation;
      setLoading(true);
      if (accountId.current !== (firebaseUser?.uid ?? null)) {
        queryClient.clear();
        accountId.current = firebaseUser?.uid ?? null;
        setUser(null);
        setRole(null);
      }
      try {
        if (firebaseUser) {
          // Get ID token and create session
          const idToken = await firebaseUser.getIdToken();
          if (currentGeneration !== generation) return;
          await Effect.runPromise(createSessionCookie(idToken));
          if (currentGeneration !== generation) return;
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
          if (currentGeneration !== generation) return;
          setUser(firebaseUser);
          setRole(accessRole);
        } else {
          // Clear session
          await Effect.runPromise(clearSessionCookie());
          if (currentGeneration !== generation) return;
          setUser(null);
          setRole(null);
        }
      } catch {
        if (currentGeneration === generation) {
          setUser(null);
          setRole(null);
          queryClient.clear();
        }
      } finally {
        if (currentGeneration === generation) setLoading(false);
      }
    });

    return () => {
      generation++;
      unsubscribe();
    };
  }, [queryClient]);

  const handleSignOut = async () => {
    setLoading(true);
    setUser(null);
    setRole(null);
    queryClient.clear();
    await auth.signOut();
    await Effect.runPromise(clearSessionCookie());
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
