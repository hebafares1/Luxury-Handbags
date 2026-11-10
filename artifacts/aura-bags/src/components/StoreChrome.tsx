import { ArrowUpRight, Heart, ShoppingBag, X, Check } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/auth/AuthContext';
import { useCart } from '@/cart/CartContext';
import { useFavorites } from '@/favorites/FavoritesContext';
import { supabaseClient } from '@/lib/supabase';
import { formatStorePrice } from '@/lib/currency';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';

export function StoreHeader() {
  const { user, loading: authLoading } = useAuth();
  const { favoriteIds, loading: favoritesLoading } = useFavorites();
  const { items, openCart } = useCart();
  const { toast } = useToast();
  const [location] = useLocation();
  const isFavoritesPage = location === '/favorites';

  const signOut = async () => {
    if (!supabaseClient) {
      toast({ title: 'Unable to sign out', description: 'Authentication is not configured.', variant: 'destructive' });
      return;
    }
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      toast({ title: 'Unable to sign out', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Signed out', description: 'You have been signed out of ROSE.' });
  };

  return (
    <header className="nav-shell">
      <div className="nav-inner">
        <a href={isFavoritesPage ? '/' : '#home'} className="brand-mark" aria-label="ROSE home" data-testid="link-home">ROSE</a>
        <nav className="nav-links" aria-label="Main navigation">
          <a href={isFavoritesPage ? '/' : '#home'} data-testid="link-nav-home">Home</a>
          <a href={isFavoritesPage ? '/#collection' : '#collection'} data-testid="link-nav-collection">Collection</a>
          <a href={isFavoritesPage ? '/#contact' : '#contact'} data-testid="link-nav-contact">Contact</a>
        </nav>
        <div className="nav-actions">
          {authLoading ? (
            <span className="nav-auth-placeholder" aria-hidden="true" />
          ) : user?.email ? (
            <div className="nav-user-controls">
              <span className="nav-user-email" title={user.email} data-testid="text-user-email">{user.email}</span>
              <button className="nav-auth-link nav-logout" type="button" onClick={() => void signOut()} data-testid="button-auth-logout">Log out</button>
            </div>
          ) : (
            <div className="nav-auth-links">
              <Link href="/login" className="nav-auth-link" data-testid="link-login">Log in</Link>
              <Link href="/signup" className="nav-auth-link" data-testid="link-signup">Sign up</Link>
            </div>
          )}
          <Link
            href="/favorites"
            className={`nav-favorites${isFavoritesPage ? ' is-active' : ''}`}
            aria-label={`My Favorites, ${favoritesLoading ? 'loading' : `${favoriteIds.length} saved products`}`}
            aria-current={isFavoritesPage ? 'page' : undefined}
            data-testid="link-nav-favorites"
          >
            <Heart size={18} strokeWidth={1.5} />
            <span className="favorites-count" data-testid="text-favorites-count">{favoritesLoading ? '…' : favoriteIds.length}</span>
          </Link>
          <button className="nav-cart" onClick={openCart} aria-label={`Open cart, ${items.length} items`} data-testid="button-open-cart">
            <ShoppingBag size={18} strokeWidth={1.5} /><span>Bag</span><span className="cart-count">{items.length}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export function StoreFooter() {
  return (
    <footer className="contact-footer" id="contact">
      <a className="footer-brand" href="/" data-testid="link-footer-home">ROSE</a>
      <span className="footer-note">Carry what feels like you.</span>
      <a href="mailto:rose-bags@gmail.com" data-testid="link-contact">Contact Us</a>
      <a className="email" href="mailto:rose-bags@gmail.com">rose-bags@gmail.com</a>
    </footer>
  );
}

export function CartDrawer() {
  const {
    items,
    isOpen,
    announcement,
    total,
    closeCart,
    removeFromCart,
    clearAnnouncement,
  } = useCart();
  const { toast } = useToast();
  const [checkoutPending, setCheckoutPending] = useState(false);

  const startCheckout = async () => {
    if (!supabaseClient || items.length === 0 || checkoutPending) {
      if (!supabaseClient) {
        toast({
          title: 'Checkout is unavailable',
          description: 'The store payment service is not configured.',
          variant: 'destructive',
        });
      }
      return;
    }

    const checkoutWindow = window.open('about:blank', '_blank');
    if (!checkoutWindow) {
      toast({
        title: 'Checkout could not open',
        description: 'Allow pop-ups for this preview, then try again.',
        variant: 'destructive',
      });
      return;
    }
    checkoutWindow.opener = null;
    setCheckoutPending(true);
    try {
      const quantities = new Map<number, number>();
      for (const item of items) {
        quantities.set(item.id, (quantities.get(item.id) ?? 0) + 1);
      }

      const { data, error } = await supabaseClient.functions.invoke('create-checkout-session', {
        body: {
          action: 'create',
          items: [...quantities].map(([id, quantity]) => ({ id, quantity })),
        },
        timeout: 20_000,
      });
      if (error) throw error;

      const checkoutUrl = typeof data?.url === 'string' ? new URL(data.url) : null;
      if (
        !checkoutUrl ||
        checkoutUrl.protocol !== 'https:' ||
        checkoutUrl.hostname !== 'checkout.stripe.com'
      ) {
        throw new Error('Stripe did not return a valid checkout link.');
      }

      if (checkoutWindow.closed) {
        throw new Error('The checkout tab was closed before it opened.');
      }
      checkoutWindow.location.replace(checkoutUrl.toString());
    } catch (error) {
      if (!checkoutWindow.closed) checkoutWindow.close();
      let description = 'Please try again. Your bag is still saved.';
      const context = (error as { context?: unknown } | null)?.context;
      if (context instanceof Response) {
        try {
          const payload: unknown = await context.clone().json();
          if (
            typeof payload === 'object' &&
            payload !== null &&
            typeof (payload as Record<string, unknown>).error === 'string'
          ) {
            description = (payload as Record<string, string>).error;
          }
        } catch {
          // Keep the safe generic checkout message if no JSON error is available.
        }
      }
      toast({
        title: 'Checkout could not be started',
        description,
        variant: 'destructive',
      });
    } finally {
      setCheckoutPending(false);
    }
  };

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeCart();
    };
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  }, [closeCart]);

  return (
    <>
      <div className={`cart-backdrop ${isOpen ? 'open' : ''}`} onClick={closeCart} aria-hidden="true" />
      <aside className={`cart-drawer ${isOpen ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label="Your bag" aria-hidden={!isOpen}>
        <div className="drawer-head">
          <h2>Your Bag <span style={{ color: '#9b825d' }}>({items.length})</span></h2>
          <button className="drawer-close" onClick={closeCart} aria-label="Close cart"><X size={20} /></button>
        </div>
        {announcement && (
          <div className="cart-confirmation" role="status" aria-live="polite" data-testid="status-cart-added">
            <Check size={16} /><span>{announcement}</span>
            <button type="button" onClick={clearAnnouncement} aria-label="Dismiss added to bag message"><X size={14} /></button>
          </div>
        )}
        <div className="drawer-items">
          {items.length === 0 ? <div className="empty-cart">Your bag is waiting.</div> : items.map((item) => (
            <div className="cart-row" key={item.key}>
              <span className="cart-row-name">{item.name}</span>
              <span className="cart-row-price">{formatStorePrice(item.price)}</span>
              <button className="remove-item" onClick={() => removeFromCart(item.key)} aria-label={`Remove ${item.name}`} data-testid={`button-remove-cart-${item.key}`}><X size={16} /></button>
            </div>
          ))}
        </div>
        {items.length > 0 && (
          <>
            <div className="cart-total"><span>Subtotal</span><span>{formatStorePrice(total)}</span></div>
            <button
              className="viewer-add cart-checkout"
              type="button"
              onClick={() => void startCheckout()}
              disabled={checkoutPending}
              data-testid="button-cart-checkout"
            >
              <span>{checkoutPending ? 'Opening secure checkout…' : 'Checkout securely'}</span>
              <ArrowUpRight size={16} strokeWidth={1.6} />
            </button>
          </>
        )}
      </aside>
    </>
  );
}
