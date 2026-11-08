import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Product } from '@/data/products';
import { convertUsdToKwd } from '@/lib/currency';

export type CartItem = { key: number; id: number; name: string; price: number };
type StoredCart = { currency: 'KWD'; items: CartItem[] };

type CartContextValue = {
  items: CartItem[];
  isOpen: boolean;
  announcement: string;
  total: number;
  openCart: () => void;
  closeCart: () => void;
  addToCart: (product: Product) => void;
  removeFromCart: (key: number) => void;
  clearAnnouncement: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function readStorage<T,>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function readCart(): CartItem[] {
  const stored = readStorage<unknown>('aura-cart', []);
  if (Array.isArray(stored)) {
    return (stored as CartItem[]).map((item) => ({
      ...item,
      price: convertUsdToKwd(item.price),
    }));
  }
  if (
    typeof stored === 'object' &&
    stored !== null &&
    'currency' in stored &&
    stored.currency === 'KWD' &&
    'items' in stored &&
    Array.isArray(stored.items)
  ) {
    return stored.items as CartItem[];
  }
  return [];
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(readCart);
  const [isOpen, setIsOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const stored: StoredCart = { currency: 'KWD', items };
    localStorage.setItem('aura-cart', JSON.stringify(stored));
  }, [items]);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const addToCart = useCallback((product: Product) => {
    setItems((current) => [
      ...current,
      { key: Date.now() + Math.random(), id: product.id, name: product.name, price: product.price },
    ]);
    setAnnouncement(`${product.name} added to your bag`);
    setIsOpen(true);
  }, []);
  const removeFromCart = useCallback((key: number) => {
    setItems((current) => current.filter((item) => item.key !== key));
  }, []);
  const clearAnnouncement = useCallback(() => setAnnouncement(''), []);
  const total = items.reduce((sum, item) => sum + item.price, 0);

  const value = useMemo(() => ({
    items,
    isOpen,
    announcement,
    total,
    openCart,
    closeCart,
    addToCart,
    removeFromCart,
    clearAnnouncement,
  }), [items, isOpen, announcement, total, openCart, closeCart, addToCart, removeFromCart, clearAnnouncement]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used inside CartProvider.');
  return value;
}
