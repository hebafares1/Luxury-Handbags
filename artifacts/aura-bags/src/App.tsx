import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUpRight, Plus } from 'lucide-react';
import { getProducts } from '@workspace/api-client-react';
import { Route, Switch } from 'wouter';
import { AuthProvider } from '@/auth/AuthContext';
import { CartProvider, useCart } from '@/cart/CartContext';
import { FavoritesProvider, useFavorites } from '@/favorites/FavoritesContext';
import { LoginPage, SignUpPage } from '@/pages/auth';
import FavoritesPage from '@/pages/favorites';
import NotFound from '@/pages/not-found';
import { CartDrawer, StoreFooter, StoreHeader } from '@/components/StoreChrome';
import { ProductCard } from '@/components/ProductCard';
import { Toaster } from '@/components/ui/toaster';
import { mapStoreProduct, type Product } from '@/data/products';
import { ProductImageViewer } from '@/components/ProductImageViewer';
import { HeroBackdrop } from '@/components/HeroBackdrop';
import { formatStorePrice } from '@/lib/currency';
import { useToast } from '@/hooks/use-toast';
import { supabaseClient } from '@/lib/supabase';

const money = formatStorePrice;

function Storefront() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All pieces');
  const { favoriteIds, pendingIds, toggleFavorite } = useFavorites();
  const { addToCart, clearCart } = useCart();
  const { toast } = useToast();

  useEffect(() => {
    const returnUrl = new URL(window.location.href);
    const checkoutResult = returnUrl.searchParams.get('checkout');
    if (!checkoutResult) return;

    const sessionId = returnUrl.searchParams.get('session_id');
    returnUrl.searchParams.delete('checkout');
    returnUrl.searchParams.delete('session_id');
    window.history.replaceState(
      window.history.state,
      '',
      `${returnUrl.pathname}${returnUrl.search}${returnUrl.hash}`,
    );

    if (checkoutResult === 'cancelled') {
      toast({ title: 'Checkout canceled', description: 'Your bag is still saved.' });
      return;
    }

    if (checkoutResult !== 'success' || !sessionId || !supabaseClient) {
      toast({
        title: 'Payment could not be verified',
        description: 'Your bag is still saved. Please contact us if you completed payment.',
        variant: 'destructive',
      });
      return;
    }

    void supabaseClient.functions.invoke('create-checkout-session', {
      body: { action: 'verify', sessionId },
    }).then(({ data, error }) => {
      if (error || data?.paid !== true) {
        toast({
          title: 'Payment is not confirmed yet',
          description: 'Your bag is still saved. Please check your payment status.',
          variant: 'destructive',
        });
        return;
      }
      clearCart();
      toast({ title: 'Thank you', description: 'Your ROSE payment was received.' });
    }).catch(() => {
      toast({
        title: 'Payment could not be verified',
        description: 'Your bag is still saved. Please contact us if you completed payment.',
        variant: 'destructive',
      });
    });
  }, [clearCart, toast]);

  const categories = ['All pieces', ...new Set(products.map((product) => product.category).filter(Boolean))];
  const visibleProducts = activeCategory === 'All pieces'
    ? products
    : products.filter((product) => product.category === activeCategory);
  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    setProductsError(false);
    try {
      const items = (await getProducts()).map(mapStoreProduct);
      setProducts(items);
      setSelected((current) => items.find((item) => item.id === current?.id) ?? items[0] ?? null);
    } catch {
      setProductsError(true);
    } finally {
      setProductsLoading(false);
    }
  }, []);
  useEffect(() => { void loadProducts(); }, [loadProducts]);
  useEffect(() => {
    const items = document.querySelectorAll<HTMLElement>('.reveal');
    if (!('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .12 });
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [products.length, activeCategory, productsLoading, productsError]);
  const handleToggleFavorite = async (id: number) => {
    try {
      await toggleFavorite(id);
    } catch (error) {
      toast({
        title: 'Sign in to save favorites',
        description: error instanceof Error ? error.message : 'Please log in to save a piece.',
        variant: 'destructive',
      });
    }
  };
  const scrollToSection = (selector: string) => {
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    document.querySelector(selector)?.scrollIntoView({ behavior });
  };
  const chooseProduct = (product: Product) => {
    setSelected(product);
    scrollToSection('#viewer');
  };

  return (
    <>
      <StoreHeader />

      <main>
        <section className="hero" id="home">
          <HeroBackdrop />
          <div className="hero-content">
            <h1>Carry<br /><em>Your Story</em></h1>
            <a className="hero-cta" href="#collection" data-testid="link-shop-collection"><span className="hero-cta-label">Shop now</span><ArrowUpRight size={18} strokeWidth={1.6} /></a>
          </div>
        </section>

        <section className="collection-section" id="collection">
          <div className="section-wrap">
            <div className="section-heading reveal">
              <div><div className="eyebrow">Made to move with you</div><h2 className="serif">The collection<span className="heading-period">.</span></h2></div>
              <p className="collection-intro">Good things, carried daily.<br />Find the one that feels like yours.</p>
            </div>
            {!productsLoading && !productsError && products.length > 0 && (
              <div className="collection-toolbar" aria-label="Filter collection">
                <div className="category-list" role="group" aria-label="Product categories">
                  {categories.map((category) => (
                    <button type="button" key={category} className={`category-chip ${activeCategory === category ? 'is-active' : ''}`} onClick={() => setActiveCategory(category)} aria-pressed={activeCategory === category} data-testid={`filter-category-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
                      {category}
                    </button>
                  ))}
                </div>
                <span className="result-count" data-testid="text-result-count">{String(visibleProducts.length).padStart(2, '0')} pieces</span>
              </div>
            )}
            <div className="product-grid">
              {productsLoading ? (
                <div className="collection-status" role="status">Loading the collection…</div>
              ) : productsError ? (
                <div className="collection-status" role="alert">
                  <span>We couldn’t load the collection.</span>
                  <button type="button" onClick={() => void loadProducts()}>Try again</button>
                </div>
              ) : products.length === 0 ? (
                <div className="collection-status" role="status">The collection is currently empty.</div>
              ) : visibleProducts.length === 0 ? (
                <div className="collection-status" role="status">No pieces in this edit yet.</div>
              ) : visibleProducts.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  favorite={favoriteIds.includes(product.id)}
                  favoritePending={pendingIds.includes(product.id)}
                  index={index}
                  onToggleFavorite={(id) => void handleToggleFavorite(id)}
                  onChoose={chooseProduct}
                  onAddToCart={addToCart}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="story-section" id="story">
          <div className="story-rail" aria-hidden="true">ROSE · A STUDY IN EVERYDAY</div>
          <div className="story-content reveal">
            <div className="eyebrow">A point of view, carried</div>
            <h2>Not another<br /><em>everyday bag.</em></h2>
            <p>ROSE is for the pieces you reach for without thinking—and still feel something when you do. Distinctive by design, made to find its place in your own everyday.</p>
            <a href="#collection" className="story-link" data-testid="link-story-discover">Find your ROSE <ArrowDown size={15} /></a>
          </div>
          <div className="story-note"><span>Style is personal.<br />Carry it that way.</span></div>
        </section>

        <section className="viewer-section" id="viewer">
          <div className="section-wrap">
            <div className="viewer-heading reveal">
              <div><div className="eyebrow">A closer look</div><h2 className="serif">See It From<br />Every Angle</h2></div>
            </div>
            <div className="viewer-panel reveal">
              {selected ? (
                <>
                  <ProductImageViewer key={selected.id} product={selected} />
                  <aside className="viewer-details">
                    <h3>{selected.name}</h3>
                    <span className="price">{money(selected.price)}</span>
                    <button className="viewer-add" onClick={() => addToCart(selected)} data-testid="button-add-selected">Add to Bag <Plus size={15} /></button>
                  </aside>
                </>
              ) : (
                <div className="viewer-status" role={productsError ? 'alert' : 'status'}>
                  {productsLoading ? 'Loading the collection…' : productsError ? 'Product details are unavailable.' : 'No products to display.'}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <StoreFooter />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <FavoritesProvider>
          <Switch>
            <Route path="/login" component={LoginPage} />
            <Route path="/signup" component={SignUpPage} />
            <Route path="/favorites" component={FavoritesPage} />
            <Route path="/" component={Storefront} />
            <Route component={NotFound} />
          </Switch>
          <CartDrawer />
          <Toaster />
        </FavoritesProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
