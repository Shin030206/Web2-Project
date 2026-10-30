import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ConceptService } from '../../services/concept.service';
import { Concept, CollectionItem } from '../../models/concept.model';

@Component({
  selector: 'app-concept',
  standalone: false,
  templateUrl: './concept.component.html',
  styleUrl: './concept.component.css'
})
export class ConceptComponent implements OnInit {
  concepts: Concept[] = [];
  collections: CollectionItem[] = [];
  
  activeCategory: string = 'all';
  activeCollectionId: string = 'all';
  searchKeyword: string = '';
  loading: boolean = true;

  // Categories list matching Figma
  categories = [
    { id: 'all', name: 'Tất cả nhóm' },
    { id: 'chan-dung', name: 'Chân dung', filter: 'Chân Dung' },
    { id: 'couple', name: 'Couple', filter: 'Couple' },
    { id: 'gia-dinh', name: 'Gia đình', filter: 'Gia Đình' },
    { id: 'me-va-con', name: 'Mẹ và con', filter: 'Mẹ và con' },
    { id: 'ao-dai', name: 'Áo dài', filter: 'Áo dài' },
    { id: 'ky-yeu', name: 'Kỷ yếu', filter: 'Kỷ yếu' }
  ];

  // Quick collections buttons from Figma 162:4642
  collectionPills = [
    { id: 'all', name: '← Tất cả nhóm' },
    { id: 'COL02', name: 'KÝ ỨC ĐÔI TA', cat: 'Couple' },
    { id: 'COL01', name: 'EM VÀ NẮNG', cat: 'Chân Dung' },
    { id: 'COL03', name: 'NHÀ LÀ NƠI ĐỂ VỀ', cat: 'Gia Đình' },
    { id: 'COL04', name: 'CHÚNG TA CỦA SAU NÀY', cat: 'Kỷ yếu' },
    { id: 'COL05', name: 'TÌM LẠI DẤU XƯA', cat: 'Áo dài' }
  ];

  // Quick form model for Frame 46
  quickForm = {
    fullName: '',
    phone: '',
    favoriteConcept: '',
    conceptIdea1: '',
    conceptIdea2: '',
    conceptInterest: '',
    ideaNotes: '',
    service: ''
  };
  quickFormSuccess: boolean = false;

  constructor(
    private conceptService: ConceptService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadConcepts();
    this.loadCollections();

    // Check query params
    this.route.queryParams.subscribe(params => {
      if (params['category']) {
        this.activeCategory = params['category'];
      }
      if (params['collection']) {
        this.activeCollectionId = params['collection'];
      }
    });
  }

  loadConcepts(): void {
    this.loading = true;
    this.conceptService.getConcepts().subscribe({
      next: (data) => {
        this.concepts = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  loadCollections(): void {
    this.conceptService.getCollections().subscribe({
      next: (cols) => {
        this.collections = cols;
      }
    });
  }

  get filteredConcepts(): Concept[] {
    let result = this.concepts;

    // Filter by Collection Pill
    if (this.activeCollectionId !== 'all') {
      const pill = this.collectionPills.find(p => p.id === this.activeCollectionId);
      if (pill && pill.cat) {
        result = result.filter(c => c.category.toLowerCase().includes(pill.cat.toLowerCase()));
      }
    }

    // Filter by Category
    if (this.activeCategory !== 'all') {
      const catObj = this.categories.find(cat => cat.id === this.activeCategory);
      if (catObj && catObj.filter) {
        result = result.filter(c => c.category.toLowerCase().includes(catObj.filter.toLowerCase()));
      }
    }

    // Filter by search keyword
    if (this.searchKeyword.trim()) {
      const q = this.searchKeyword.toLowerCase().trim();
      result = result.filter(c => 
        c.concept_name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        (c.tag && c.tag.toLowerCase().includes(q))
      );
    }

    return result;
  }

  setCategory(catId: string): void {
    this.activeCategory = catId;
    this.activeCollectionId = 'all';
  }

  setCollectionPill(pillId: string): void {
    this.activeCollectionId = pillId;
    if (pillId === 'all') {
      this.activeCategory = 'all';
    } else {
      const pill = this.collectionPills.find(p => p.id === pillId);
      if (pill && pill.cat) {
        const cat = this.categories.find(c => c.filter && c.filter.toLowerCase() === pill.cat.toLowerCase());
        if (cat) this.activeCategory = cat.id;
      }
    }
  }

  viewDetail(concept: Concept): void {
    const slug = concept.concept_code ? concept.concept_code.toLowerCase() : concept.concept_name.toLowerCase().replace(/\s+/g, '-');
    this.router.navigate(['/concept', slug]);
  }

  submitQuickBooking(): void {
    if (!this.quickForm.fullName || !this.quickForm.phone) {
      alert('Vui lòng nhập Họ và tên cùng Số điện thoại của bạn.');
      return;
    }
    // Redirect to booking with query params
    this.router.navigate(['/dat-lich'], {
      queryParams: {
        name: this.quickForm.fullName,
        phone: this.quickForm.phone,
        concept: this.quickForm.conceptInterest
      }
    });
  }
}

