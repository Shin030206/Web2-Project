import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ConceptService } from '../../services/concept.service';
import { Concept } from '../../models/concept.model';

@Component({
  selector: 'app-concept-detail',
  standalone: false,
  templateUrl: './concept-detail.component.html',
  styleUrl: './concept-detail.component.css'
})
export class ConceptDetailComponent implements OnInit {
  concept: Concept | null = null;
  relatedConcepts: Concept[] = [];
  loading: boolean = true;

  // Extended poetic essay from Figma for key concepts
  conceptEssays: { [key: string]: string } = {
    'CD01': 'Có những ngày phố xá sũng ướt, lòng người chỉ muốn nép lại một góc tĩnh lặng. CD Ngày Mưa là như thế. Một chiếc cardigan len dệt kim mỏng, tóc xõa lơi tự nhiên bên ô cửa kính đọng nước. Tông màu phim trầm ấm, độ tương phản dịu nhẹ đủ để ánh nhìn sâu đăm chiêu và viền vai gầy hiện lên thật mộc. Bố cục gồm một khung cận mặt đong đầy cảm xúc kết hợp các góc trung cảnh bên bàn gỗ, tách trà ấm và trang sách mở dở. Phù hợp cho những ai đang tìm kiếm một khoảng không riêng tư, muốn lưu giữ một nốt trầm dịu dàng hay đơn giản là muốn trò chuyện với chính mình. Không cần tạo dáng cầu kỳ, không đòi hỏi biểu cảm gượng gạo. Bộ ảnh này là nơi bạn thả lỏng tâm trí và tự do chìm đọng trong cảm xúc thật nhất.',
    'AD01': 'Nét thanh thuần dịu dàng của tà áo dài lụa trắng, kết hợp không gian mái ngói thềm rêu hoài cổ của đất kinh kỳ. Từng nếp áo buông lơi theo từng nhịp bước, mang cả bầu trời hoài niệm về một thời thanh xuân trong ngần. Ánh sáng tự nhiên dịu mát tôn vinh vẻ đẹp kín đáo, thanh tao và cốt cách kiêu sa của người phụ nữ Việt.',
    'CP01': 'Chạy trốn khỏi nhịp sống phố thị ồn ả, nắm tay nhau bước qua những bậc thềm xưa cũ. Thước phim tình yêu mang màu sắc điện ảnh hoài niệm, ghi lại những rung động mộc mạc nhất qua từng ánh mắt và cái chạm tay nhẹ nhàng.'
  };

  // Quick form model for Frame 46
  quickForm = {
    fullName: '',
    phone: '',
    favoriteConcept: '',
    conceptIdea1: '',
    conceptIdea2: '',
    conceptInterest: '',
    ideaNotes: ''
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private conceptService: ConceptService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const codeOrSlug = params.get('code') || '';
      this.loadConceptDetail(codeOrSlug);
    });
  }

  loadConceptDetail(codeOrSlug: string): void {
    this.loading = true;
    this.conceptService.getConcepts().subscribe({
      next: (concepts) => {
        const clean = codeOrSlug.toLowerCase().trim();
        const found = concepts.find(c => 
          c.concept_code.toLowerCase() === clean ||
          c.concept_name.toLowerCase().replace(/\s+/g, '-') === clean ||
          c.concept_name.toLowerCase().includes(clean)
        );

        if (found) {
          this.concept = found;
          this.quickForm.conceptInterest = found.concept_name;
          // Related concepts in same category
          this.relatedConcepts = concepts
            .filter(c => c.category === found.category && c.concept_code !== found.concept_code)
            .slice(0, 4);
        } else {
          // Default to first concept if not found
          this.concept = concepts[0];
          this.relatedConcepts = concepts.slice(1, 5);
        }
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  get conceptStory(): string {
    if (this.concept && this.conceptEssays[this.concept.concept_code]) {
      return this.conceptEssays[this.concept.concept_code];
    }
    return this.concept ? this.concept.description : '';
  }

  goToBooking(): void {
    if (this.concept) {
      this.router.navigate(['/dat-lich'], {
        queryParams: {
          concept: this.concept.concept_name,
          category: this.concept.category
        }
      });
    }
  }

  submitQuickBooking(): void {
    if (!this.quickForm.fullName || !this.quickForm.phone) {
      alert('Vui lòng nhập Họ và tên cùng Số điện thoại của bạn.');
      return;
    }
    this.router.navigate(['/dat-lich'], {
      queryParams: {
        name: this.quickForm.fullName,
        phone: this.quickForm.phone,
        concept: this.concept?.concept_name || this.quickForm.conceptInterest
      }
    });
  }
}

