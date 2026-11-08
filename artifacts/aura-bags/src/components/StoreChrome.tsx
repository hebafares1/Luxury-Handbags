import { Heart, ShoppingBag, X, Check } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/auth/AuthContext';
import { useCart } from '@/cart/CartContext';
import { useFavorites } from '@/favorites/FavoritesContext';
import { supabaseClient } from '@/lib/supabase';
import { formatStorePrice } from '@/lib/currency';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';

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
        {items.length > 0 && <div className="cart-total"><span>Subtotal</span><span>{formatStorePrice(total)}</span></div>}
      </aside>
    </>
  );
}
