export interface Package {
  _id?: string;
  packageId: string;
  name: string;
  subtitle?: string;
  category: string;
  price: number;
  priceFormatted: string;
  description: string;
  features: string[];
  image: string;
  isPopular?: boolean;
}

