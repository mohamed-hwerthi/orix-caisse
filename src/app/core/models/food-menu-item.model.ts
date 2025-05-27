import { CategoryDTO } from './categoryDTO.model';
import { CurrencyDTO } from './currency.model';
import { Media } from './media.model';
import { Tax } from './tax.model';

export interface MenuItem {
  id: number;
  title: string;
  description: string;
  price: number;
  imageUrl: URL;
  salesCount: number;
  categories: CategoryDTO[];
  currency: CurrencyDTO;
  tax: Tax;
  reviewCount: number;
  averageRating: number;
  medias: Media[];
  quantity : number ; 
  
}

export interface PaginatedResponseDTO<T> {
  items: T[];
  totalCount: number;
}
