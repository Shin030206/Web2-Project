export interface Package {
  _id?: string;
  packageId?: string | number;
  package_id?: string | number;
  name?: string;
  package_name?: string;
  subtitle?: string;
  category?: string;
  level?: string;
  price?: number;
  original_price?: number;
  priceFormatted?: string;
  description?: string;
  duration_minutes?: number;
  includes?: string[];
  features?: string[];
  image?: string;
  image_url?: string;
  isPopular?: boolean;
  status?: string;
}

export interface Addon {
  _id?: string;
  addon_id: number;
  addon_name: string;
  price: number;
  unit?: string;
  description?: string;
  status?: string;
}
