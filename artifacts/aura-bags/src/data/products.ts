export type Product = {
  id: number;
  name: string;
  price: number;
  image: string;
};

const imageUrl = (file: string) => `${import.meta.env.BASE_URL}${file}`;

export const products: Product[] = [
  { id: 1, name: 'The Sloane', price: 485, image: imageUrl('bag-1.jpg') },
  { id: 2, name: 'The Solenne', price: 520, image: imageUrl('bag-2.jpg') },
  { id: 3, name: 'The Marais', price: 445, image: imageUrl('bag-3.jpg') },
  { id: 4, name: 'The No. 8', price: 560, image: imageUrl('bag-4.jpg') },
  { id: 5, name: 'The Alba', price: 395, image: imageUrl('bag-5.jpg') },
  { id: 6, name: 'The Liora', price: 610, image: imageUrl('bag-6.jpg') },
];
