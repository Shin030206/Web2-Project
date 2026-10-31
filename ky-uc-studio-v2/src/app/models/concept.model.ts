export interface Concept {
  _id?: string;
  concept_code: string;
  concept_name: string;
  category: string;
  tag: string;
  starting_price: number;
  starting_price_formatted?: string;
  description: string;
  thumbnail_url: string;
}

export interface CollectionItem {
  _id?: string;
  collection_id: string;
  collection_name: string;
  category: string;
  slogan: string;
  introduction: string;
  concepts: {
    concept_code: string;
    concept_name: string;
    category: string;
    starting_price: number;
    starting_price_formatted?: string;
    description: string;
    image?: string;
  }[];
}

