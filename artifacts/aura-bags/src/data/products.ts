import type { StoreProduct } from '@workspace/api-client-react';

export type Product = StoreProduct;

const imageUrl = (file: string) =>
  `${import.meta.env.BASE_URL}${file.replace(/^\/+/, '')}`;

const productsWithRotationFrames = new Set([
  'the-sloane',
  'the-solenne',
  'the-marais',
  'the-no-8',
  'the-alba',
  'the-liora',
]);

export function mapStoreProduct(product: StoreProduct): Product {
  return {
    ...product,
    image: imageUrl(product.image),
    price: Number(product.price),
  };
}

export function getProductFrames(product: Product): string[] {
  if (!productsWithRotationFrames.has(product.turntableSlug)) {
    return [product.image];
  }
  return [
    product.image,
    ...Array.from({ length: 23 }, (_, index) =>
      imageUrl(`assets/products/${product.turntableSlug}/${String(index + 2).padStart(2, '0')}.jpg?v=3`),
    ),
  ];
}
