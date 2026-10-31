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
  priceFormatted?: string;
  description?: string;
  duration_minutes?: number;
  includes?: string[];
  features?: string[];
  image?: string;
  isPopular?: boolean;
  status?: string;
}
