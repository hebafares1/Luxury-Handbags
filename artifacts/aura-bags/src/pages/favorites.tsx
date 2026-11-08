import { useCallback, useEffect, useMemo, useState } from 'react';
import { Heart } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { getProducts } from '@workspace/api-client-react';
import { useAuth } from '@/auth/AuthContext';
import { ProductCard } from '@/components/ProductCard';
import { StoreFooter, StoreHeader } from '@/components/StoreChrome';
import { useCart } from '@/cart/CartContext';
import { useFavorites } from '@/favorites/FavoritesContext';
import { mapStoreProduct, type Product } from '@/data/products';
import { useToast } from '@/hooks/use-toast';

export default function FavoritesPage() {
  const { user, loading: authLoading } = useAuth();
  const { favoriteIds, pendingIds, loading: favoritesLoading, error: favoritesError, refreshFavorites, toggleFavorite } = useFavorites();
  const { addToCart } = useCart();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(false);

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    setProductsError(false);
    try {
      setProducts((await getProducts()).map(mapStoreProduct));
    } catch {
      setProductsError(true);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void loadProducts();
  }, [user, loadProducts]);

  const favoriteProducts = useMemo(() => {
    const byId = new Map(products.map((product) => [product.id, product]));
    return favoriteIds.map((id) => byId.get(id)).filter((product): product is Product => Boolean(product));
  }, [products, favoriteIds]);

  const handleToggleFavorite = async (productId: number) => {
    try {
      await toggleFavorite(productId);
    } catch (error) {
      toast({
        title: 'Could not update favorites',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleChooseProduct = () => setLocation('/#collection');

  const content = () => {
    if (authLoading) return <div className="collection-status" role="status">Checking your account…</div>;
    if (!user) {
      return (
        <div className="favorites-empty" data-testid="favorites-signin-prompt">
          <span className="favorites-empty-icon"><Heart size={22} strokeWidth={1.3} /></span>
          <h2>Your saved pieces, all in one place.</h2>
          <p>Log in to save favorites and return to them whenever you like.</p>
          <div className="favorites-empty-actions">
            <Link href="/login" className="hero-cta" data-testid="link-favorites-login">Log in</Link>
            <Link href="/signup" className="favorites-signup-link" data-testid="link-favorites-signup">Create an account</Link>
          </div>
        </div>
      );
    }
    if (favoritesLoading || productsLoading) {
      return <div className="collection-status" role="status">Gathering your favorites…</div>;
    }
    if (favoritesError) {
      return (
        <div className="collection-status" role="alert">
          <span>We couldn’t load your favorites.</span>
          <button type="button" onClick={() => void refreshFavorites()}>Try again</button>
        </div>
      );
    }
    if (productsError) {
      return (
        <div className="collection-status" role="alert">
          <span>We couldn’t load the product details.</span>
          <button type="button" onClick={() => void loadProducts()}>Try again</button>
        </div>
      );
    }
    if (favoriteProducts.length === 0) {
      return (
        <div className="favorites-empty" data-testid="favorites-empty-state">
          <span className="favorites-empty-icon"><Heart size={22} strokeWidth={1.3} /></span>
          <h2>A little room for something lovely.</h2>
          <p>Tap the heart on any piece in the collection to save it here.</p>
          <a href="/#collection" className="hero-cta" data-testid="link-favorites-collection">Explore the collection</a>
        </div>
      );
    }
    return (
      <div className="product-grid">
        {favoriteProducts.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            favorite
            favoritePending={pendingIds.includes(product.id)}
            index={index}
            reveal={false}
            onToggleFavorite={(id) => void handleToggleFavorite(id)}
            onChoose={handleChooseProduct}
            onAddToCart={addToCart}
          />
        ))}
      </div>
    );
  };

  return (
    <>
      <StoreHeader />
      <main className="favorites-page">
        <section className="favorites-section">
          <div className="section-wrap">
            <div className="section-heading favorites-heading">
              <div>
                <div className="eyebrow">Pieces to keep close</div>
                <h1 className="serif">My Favorites<span className="heading-period">.</span></h1>
              </div>
              {user && !authLoading && !favoritesLoading && !favoritesError && (
                <p className="collection-intro" data-testid="text-favorites-summary">
                  {favoriteProducts.length} {favoriteProducts.length === 1 ? 'piece' : 'pieces'} saved
                </p>
              )}
            </div>
            {content()}
          </div>
        </section>
      </main>
      <StoreFooter />
    </>
  );
}
