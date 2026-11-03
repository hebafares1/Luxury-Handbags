export type Product = {
  id: number;
  name: string;
  price: number;
  image: string;
  turntableSlug: string;
};

const imageUrl = (file: string) => `${import.meta.env.BASE_URL}${file}`;

export const products: Product[] = [
  { id: 1, name: 'The Sloane', price: 485, image: imageUrl('bag-1.jpg'), turntableSlug: 'the-sloane' },
  { id: 2, name: 'The Solenne', price: 520, image: imageUrl('bag-2.jpg'), turntableSlug: 'the-solenne' },
  { id: 3, name: 'The Marais', price: 445, image: imageUrl('bag-3.jpg'), turntableSlug: 'the-marais' },
  { id: 4, name: 'The No. 8', price: 560, image: imageUrl('bag-4.jpg'), turntableSlug: 'the-no-8' },
  { id: 5, name: 'The Alba', price: 395, image: imageUrl('bag-5.jpg'), turntableSlug: 'the-alba' },
  { id: 6, name: 'The Liora', price: 610, image: imageUrl('bag-6.jpg'), turntableSlug: 'the-liora' },
];

export function getProductFrames(product: Product): string[] {
  return [
    product.image,
    ...Array.from({ length: 23 }, (_, index) =>
      imageUrl(`assets/products/${product.turntableSlug}/${String(index + 2).padStart(2, '0')}.jpg?v=3`),
    ),
  ];
}
