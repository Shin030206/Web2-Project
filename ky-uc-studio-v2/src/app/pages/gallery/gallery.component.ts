import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ConceptService } from '../../services/concept.service';
import { Concept, CollectionItem as ApiCollection } from '../../models/concept.model';

interface CollectionCard {
  number: string;
  title: string;
  subtitle: string;
  slogan: string;
  description: string;
  image: string;
  conceptTarget: string;
}

// Bộ sưu tập -> nhóm concept tương ứng (để đếm số concept và mở trang /concept đúng bộ lọc)
const COLLECTION_FILTERS: { [id: string]: { categories: string[]; target: string } } = {
  COL01: { categories: ['chân dung'], target: 'chan-dung' },
  COL02: { categories: ['couple', 'cặp đôi'], target: 'couple' },
  COL03: { categories: ['gia đình', 'mẹ và bé', 'mẹ và con'], target: 'gia-dinh' },
  COL04: { categories: ['kỷ yếu'], target: 'ky-yeu' },
  COL05: { categories: ['áo dài'], target: 'ao-dai' }
};

@Component({
  selector: 'app-gallery',
  standalone: false,
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.css'
})
export class GalleryComponent implements OnInit {
  private conceptService = inject(ConceptService);
  private cdr = inject(ChangeDetectorRef);

  // Lấy từ MongoDB (/api/collections), số concept đếm từ /api/concepts
  collections: CollectionCard[] = [];
  private rawCollections: ApiCollection[] = [];
  private concepts: Concept[] = [];

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.conceptService.getCollections().subscribe({
      next: (cols) => {
        this.rawCollections = cols || [];
        this.buildCards();
      },
      error: () => this.cdr.markForCheck()
    });
    this.conceptService.getConcepts().subscribe({
      next: (concepts) => {
        this.concepts = concepts || [];
        this.buildCards();
      },
      error: () => this.cdr.markForCheck()
    });
  }

  private buildCards(): void {
    this.collections = [...this.rawCollections]
      .sort((a, b) => (a.display_order ?? 99) - (b.display_order ?? 99))
      .map((col, idx) => {
        const filter = COLLECTION_FILTERS[col.collection_id];
        const count = filter
          ? this.concepts.filter(c => filter.categories.includes((c.category || '').toLowerCase())).length
          : 0;
        const label = col.category ? `BST ${col.category}` : 'Bộ sưu tập';
        return {
          number: String(idx + 1).padStart(2, '0'),
          title: col.collection_name,
          subtitle: count > 0 ? `${label} · ${count} concept` : `${label} · Sắp ra mắt`,
          slogan: col.slogan || '',
          description: col.introduction || '',
          image: col.cover_url || 'assets/images/gallery-hero-clean.png',
          conceptTarget: filter?.target || ''
        };
      });
    this.cdr.markForCheck();
  }

  exploreCollection(target: string): void {
    this.router.navigate(['/concept'], { queryParams: target ? { category: target } : {} });
  }
}
