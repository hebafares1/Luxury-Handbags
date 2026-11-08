import { Heart, Plus } from 'lucide-react';
import type { Product } from '@/data/products';
import { formatStorePrice } from '@/lib/currency';

type ProductCardProps = {
  product: Product;
  favorite: boolean;
  favoritePending?: boolean;
  index?: number;
  reveal?: boolean;
  onToggleFavorite: (productId: number) => void;
  onChoose: (product: Product) => void;
  onAddToCart: (product: Product) => void;
};

export function ProductCard({
  product,
  favorite,
  favoritePending = false,
  index = 0,
  reveal = true,
  onToggleFavorite,
  onChoose,
  onAddToCart,
}: ProductCardProps) {
  return (
    <article
      className={`product-card${reveal ? ' reveal' : ''}`}
      onClick={() => onChoose(product)}
      style={{ transitionDelay: `${(index % 3) * 80}ms` }}
      data-testid={`card-product-${product.id}`}
    >
      <div className="product-image-wrap">
        <button
          type="button"
          className="product-preview"
          aria-label={`View ${product.name}`}
          onClick={(event) => { event.stopPropagation(); onChoose(product); }}
          data-testid={`button-view-product-${product.id}`}
        >
          <img className="product-image" src={product.image} alt={product.name} />
        </button>
        <button
          type="button"
          className={`favorite ${favorite ? 'is-loved' : ''}`}
          disabled={favoritePending}
          onClick={(event) => { event.stopPropagation(); onToggleFavorite(product.id); }}
          aria-label={favorite ? `Remove ${product.name} from favorites` : `Add ${product.name} to favorites`}
          aria-pressed={favorite}
          data-testid={`button-favorite-${product.id}`}
        >
          <Heart size={17} fill={favorite ? 'currentColor' : 'none'} strokeWidth={1.5} />
        </button>
      </div>
      <div className="product-meta">
        <span className="product-name" data-testid={`text-product-name-${product.id}`}>{product.name}</span>
        <span className="product-price" data-testid={`text-product-price-${product.id}`}>{formatStorePrice(product.price)}</span>
      </div>
      <p className="product-description">{product.description}</p>
      <button
        className="add-button"
        onClick={(event) => { event.stopPropagation(); onAddToCart(product); }}
        data-testid={`button-add-product-${product.id}`}
      >
        Add to Bag <Plus size={14} strokeWidth={1.4} />
      </button>
    </article>
  );
}
