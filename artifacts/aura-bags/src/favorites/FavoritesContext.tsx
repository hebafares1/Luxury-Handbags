import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/auth/AuthContext';
import { supabaseClient } from '@/lib/supabase';

type FavoritesContextValue = {
  favoriteIds: number[];
  pendingIds: number[];
  loading: boolean;
  error: string | null;
  refreshFavorites: () => Promise<void>;
  toggleFavorite: (productId: number) => Promise<void>;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [pendingIds, setPendingIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeUserId = useRef<string | null>(user?.id ?? null);
  useLayoutEffect(() => {
    activeUserId.current = user?.id ?? null;
  }, [user?.id]);

  const refreshFavorites = useCallback(async () => {
    if (!user) {
      setFavoriteIds([]);
      setError(null);
      setLoading(false);
      return;
    }
    if (!supabaseClient) {
      setError('Favorites are not available because Supabase is not configured.');
      setLoading(false);
      return;
    }

    const requestedUserId = user.id;
    setLoading(true);
    setError(null);
    try {
      const { data, error: requestError } = await supabaseClient
        .from('favorites')
        .select('product_id, created_at')
        .eq('user_id', requestedUserId)
        .order('created_at', { ascending: false });

      if (activeUserId.current !== requestedUserId) return;
      if (requestError) {
        setError(requestError.message);
      } else {
        setFavoriteIds((data ?? []).map((row) => Number(row.product_id)));
      }
    } catch (requestError) {
      if (activeUserId.current === requestedUserId) {
        setError(requestError instanceof Error ? requestError.message : 'Please try again.');
      }
    } finally {
      if (activeUserId.current === requestedUserId) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    setFavoriteIds([]);
    setPendingIds([]);
    setError(null);
    if (!user) {
      activeUserId.current = null;
      setLoading(false);
      return;
    }
    activeUserId.current = user.id;
    void refreshFavorites();
  }, [authLoading, user, refreshFavorites]);

  useEffect(() => {
    if (!user) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshFavorites();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [user, refreshFavorites]);

  const toggleFavorite = useCallback(async (productId: number) => {
    if (!user || !supabaseClient) {
      throw new Error('Sign in to save products to your favorites.');
    }
    if (pendingIds.includes(productId)) return;

    const requestedUserId = user.id;
    setPendingIds((current) => [...current, productId]);
    const isFavorite = favoriteIds.includes(productId);
    try {
      const result = isFavorite
        ? await supabaseClient
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', productId)
        : await supabaseClient
          .from('favorites')
          .upsert(
            { user_id: user.id, product_id: productId },
            { onConflict: 'user_id,product_id', ignoreDuplicates: true },
          );
      if (result.error) throw result.error;
      if (activeUserId.current !== requestedUserId) return;
      setFavoriteIds((current) => isFavorite
        ? current.filter((id) => id !== productId)
        : current.includes(productId) ? current : [productId, ...current]);
      setError(null);
    } finally {
      if (activeUserId.current === requestedUserId) {
        setPendingIds((current) => current.filter((id) => id !== productId));
      }
    }
  }, [favoriteIds, pendingIds, user]);

  const value = useMemo(() => ({
    favoriteIds,
    pendingIds,
    loading,
    error,
    refreshFavorites,
    toggleFavorite,
  }), [favoriteIds, pendingIds, loading, error, refreshFavorites, toggleFavorite]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const value = useContext(FavoritesContext);
  if (!value) throw new Error('useFavorites must be used inside FavoritesProvider.');
  return value;
}
