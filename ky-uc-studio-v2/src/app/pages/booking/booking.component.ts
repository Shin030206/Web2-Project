import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BookingService, PaymentInfo, QuoteResponse } from '../../services/booking.service';
import { PackageService } from '../../services/package.service';
import { ConceptService } from '../../services/concept.service';
import { AuthService } from '../../services/auth.service';
import { Package } from '../../models/package.model';
import { Concept } from '../../models/concept.model';

export interface DateChip {
  dateStr: string;      // YYYY-MM-DD
  dayOfWeek: string;    // T2, T3, T4...
  dayMonth: string;     // 11/11, 12/11...
  isWeekend: boolean;
}

@Component({
  selector: 'app-booking',
  standalone: false,
  templateUrl: './booking.component.html',
  styleUrl: './booking.component.css'
})
export class BookingComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private bookingService = inject(BookingService);
  private packageService = inject(PackageService);
  private conceptService = inject(ConceptService);
  public authService = inject(AuthService);

  // Flow Step: 1 = Gói & Concept, 2 = Ngày & Giờ, 3 = Thanh toán cọc
  currentStep: number = 1;

  // Packages & Concepts
  packages: Package[] = [];
  selectedPackage: Package | null = null;
  selectedPackageId: number | string = 102; // Default to Nâng Cao 2.5tr

  concepts: Concept[] = [];
  selectedConcept: Concept | null = null;
  selectedConceptCode: string = 'CD02'; // Default to CD Vườn Hoa
  conceptSearch: string = '';
  showConceptSelector: boolean = false;

  // Date & Slot Selection
  bookingDate: string = '';
  minBookingDate: string = '';
  dateChips: DateChip[] = [];
  availableSlots: any[] = [];
  selectedSlot: any = null;
  loadingSlots: boolean = false;

  // Hold slot state
  holdId: string = '';
  heldPhone: string = '';
  holdExpiresInSeconds: number = 0;
  holdTimerInterval: any = null;
  holdExpired: boolean = false;
  showBookingNoticeModal: boolean = false;

  // Customer Form
  customerName: string = '';
  customerPhone: string = '';
  customerEmail: string = '';
  note: string = '';
  voucherCode: string = '';
  voucherError: string = '';

  // Pricing Quote
  quote: QuoteResponse | null = null;
  loadingQuote: boolean = false;

  // Payment Selection
  selectedPaymentMethod: 'bank' | 'vnpay' = 'bank';

  // Booking Created state
  bookingCreated: boolean = false;
  createdBookingId: string = '';
  createdBookingCode: string = '';
  paymentInfo: PaymentInfo | null = null;
  submittingBooking: boolean = false;
  bookingError: string = '';
  transferConfirmed: boolean = false;
  transferLoading: boolean = false;

  // Consultation Form
  consultForm = {
    fullName: '',
    phone: '',
    favoriteConcept: 'CD Vườn Hoa',
    conceptIdea1: '',
    conceptIdea2: ''
  };

  ngOnInit(): void {
    // Generate dates: tomorrow to next 14 days
    this.generateDateChips();

    // Prefill user data if logged in
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        if (!this.customerName) this.customerName = user.fullName || '';
        if (!this.customerPhone) this.customerPhone = user.phone || '';
        if (!this.customerEmail) this.customerEmail = user.email || '';
        this.cdr.markForCheck();
      }
    });

    // Check query params
    this.route.queryParams.subscribe(params => {
      if (params['step']) {
        const stepNum = parseInt(params['step'], 10);
        if (stepNum >= 1 && stepNum <= 3) this.currentStep = stepNum;
      }
      if (params['package']) {
        this.selectedPackageId = params['package'];
      }
      if (params['concept'] || params['conceptCode']) {
        const cVal = params['conceptCode'] || params['concept'];
        this.selectedConceptCode = cVal;
      }
      if (params['name'] && !this.customerName) {
        this.customerName = params['name'];
      }
      if (params['phone'] && !this.customerPhone) {
        this.customerPhone = params['phone'];
      }
      this.initData();
    });
  }

  ngOnDestroy(): void {
    this.clearHoldTimer();
  }

  generateDateChips(): void {
    const chips: DateChip[] = [];
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    
    // Start from tomorrow
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + 1);
    this.minBookingDate = baseDate.toISOString().split('T')[0];
    if (!this.bookingDate) this.bookingDate = this.minBookingDate;

    for (let i = 0; i < 14; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayOfWeek = dayNames[d.getDay()];
      const dayMonth = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      chips.push({
        dateStr,
        dayOfWeek,
        dayMonth,
        isWeekend: d.getDay() === 0 || d.getDay() === 6
      });
    }
    this.dateChips = chips;
  }

  initData(): void {
    // 1. Load packages
    this.packageService.getPackages().subscribe({
      next: (pkgs) => {
        this.packages = pkgs;
        if (pkgs.length > 0) {
          const matched = pkgs.find(p => String(p.package_id || p.packageId) === String(this.selectedPackageId));
          this.selectedPackage = matched || pkgs.find(p => String(p.package_id) === '102') || pkgs[0];
          this.selectedPackageId = this.selectedPackage.package_id || this.selectedPackage.packageId || 102;
        }
        this.cdr.markForCheck();
        // 2. Load concepts
        this.loadConcepts();
      },
      error: () => {
        this.loadConcepts();
      }
    });
  }

  loadConcepts(): void {
    this.conceptService.getConcepts().subscribe({
      next: (concepts) => {
        this.concepts = concepts;
        if (concepts.length > 0) {
          this.resolveConceptFromParamsOrFallback();
        }
        this.cdr.markForCheck();
        // 3. Load draft if exists
        this.loadDraft();
      },
      error: () => {
        this.cdr.markForCheck();
        this.loadDraft();
      }
    });
  }

  resolveConceptFromParamsOrFallback(): void {
    const qVal = (this.route.snapshot.queryParams['concept'] || 
                  this.route.snapshot.queryParams['conceptCode'] || 
                  this.selectedConceptCode || 'CD02').trim().toLowerCase();

    // Match by code, name, or keywords like "vườn hoa"
    let found = this.concepts.find(c => 
      c.concept_code.toLowerCase() === qVal ||
      c.concept_name.toLowerCase() === qVal ||
      c.concept_name.toLowerCase().includes(qVal) ||
      c.concept_name.toLowerCase().replace(/\s+/g, '') === qVal.replace(/\s+/g, '')
    );

    if (!found && qVal.includes('vườn hoa')) {
      found = this.concepts.find(c => c.concept_name.toLowerCase().includes('vườn hoa') || c.concept_code.toLowerCase() === 'cd02');
    }

    if (!found && qVal.includes('ngay mua')) {
      found = this.concepts.find(c => c.concept_code.toLowerCase() === 'cd01');
    }

    if (found) {
      this.selectedConcept = found;
      this.selectedConceptCode = found.concept_code;
    } else {
      // Default to CD Vườn Hoa if available, or first concept
      const vuonHoa = this.concepts.find(c => c.concept_code === 'CD02' || c.concept_name.toLowerCase().includes('vườn hoa'));
      this.selectedConcept = vuonHoa || this.concepts[0];
      this.selectedConceptCode = this.selectedConcept.concept_code;
    }

    // Auto align package to category if needed
    if (this.selectedConcept && this.packages.length > 0) {
      const cat = (this.selectedConcept.category || '').toLowerCase();
      const currentPkgCat = (this.selectedPackage?.package_name || '').toLowerCase();
      if (cat.includes('couple') || cat.includes('cặp đôi')) {
        if (!currentPkgCat.includes('cặp đôi')) {
          const matchPkg = this.packages.find(p => (p.package_name || '').toLowerCase().includes('cặp đôi'));
          if (matchPkg) {
            this.selectedPackage = matchPkg;
            this.selectedPackageId = matchPkg.package_id || matchPkg.packageId || 202;
          }
        }
      } else if (cat.includes('gia đình')) {
        if (!currentPkgCat.includes('gia đình')) {
          const matchPkg = this.packages.find(p => (p.package_name || '').toLowerCase().includes('gia đình'));
          if (matchPkg) {
            this.selectedPackage = matchPkg;
            this.selectedPackageId = matchPkg.package_id || matchPkg.packageId || 302;
          }
        }
      }
    }
  }

  isPackageSelected(pkg: Package): boolean {
    const pkgId = pkg.package_id !== undefined ? pkg.package_id : pkg.packageId;
    return String(this.selectedPackageId) === String(pkgId);
  }

  loadDraft(): void {
    this.bookingService.getDraft().subscribe({
      next: (res) => {
        if (res && res.draft && res.draft.data) {
          const d = res.draft.data;
          
          // Only overwrite package if not in query params
          if (!this.route.snapshot.queryParams['package'] && d.packageId) {
            this.selectedPackageId = d.packageId;
            const matched = this.packages.find(p => String(p.package_id || p.packageId) === String(d.packageId));
            if (matched) this.selectedPackage = matched;
          }

          // ONLY overwrite concept if queryParams did NOT specify a concept
          const hasQueryConcept = !!(this.route.snapshot.queryParams['concept'] || this.route.snapshot.queryParams['conceptCode']);
          if (!hasQueryConcept && d.conceptCode) {
            const matchedC = this.concepts.find(c => c.concept_code === d.conceptCode);
            if (matchedC) {
              this.selectedConcept = matchedC;
              this.selectedConceptCode = matchedC.concept_code;
            }
          }

          if (d.bookingDate) this.bookingDate = d.bookingDate;
          if (d.customer) {
            if (!this.customerName && d.customer.name) this.customerName = d.customer.name;
            if (!this.customerPhone && d.customer.phone) this.customerPhone = d.customer.phone;
            if (!this.customerEmail && d.customer.email) this.customerEmail = d.customer.email;
            if (!this.note && d.customer.note) this.note = d.customer.note;
          }
          if (d.voucherCode) this.voucherCode = d.voucherCode;

          // Check hold validity
          if (res.hold && res.hold.valid && res.hold.secondsLeft > 0) {
            this.holdId = d.holdId;
            this.heldPhone = d.customer?.phone || this.customerPhone;
            this.selectedSlot = {
              startTime: d.startTime,
              timeSlot: res.hold.timeSlot
            };
            this.startHoldTimer(res.hold.secondsLeft);
          } else if (res.hold && !res.hold.valid) {
            this.holdExpired = true;
          }

          if (res.quote) {
            this.quote = res.quote;
          }
        }

        this.cdr.markForCheck();
        this.fetchSlots();
        this.fetchQuote();
      },
      error: () => {
        this.cdr.markForCheck();
        this.fetchSlots();
        this.fetchQuote();
      }
    });
  }

  // Get packages applicable for the selected concept category
  get displayPackages(): Package[] {
    if (!this.selectedConcept) return this.packages.slice(0, 3);
    const cat = (this.selectedConcept.category || '').toLowerCase();
    let filtered: Package[] = [];
    if (cat.includes('couple') || cat.includes('cặp đôi')) {
      filtered = this.packages.filter(p => (p.package_name || '').toLowerCase().includes('cặp đôi'));
    } else if (cat.includes('gia đình')) {
      filtered = this.packages.filter(p => (p.package_name || '').toLowerCase().includes('gia đình'));
    } else {
      // Chân dung / Áo dài / default
      filtered = this.packages.filter(p => (p.package_name || '').toLowerCase().includes('chân dung'));
    }
    return filtered.length > 0 ? filtered : this.packages.slice(0, 3);
  }

  // Filtered concepts for selection grid in Step 1
  get displayConcepts(): Concept[] {
    if (!this.conceptSearch.trim()) {
      return this.concepts.slice(0, 12);
    }
    const q = this.conceptSearch.trim().toLowerCase();
    return this.concepts.filter(c => 
      c.concept_name.toLowerCase().includes(q) ||
      c.concept_code.toLowerCase().includes(q) ||
      (c.category && c.category.toLowerCase().includes(q))
    );
  }

  onPackageChange(packageId: any): void {
    this.selectedPackageId = packageId;
    this.selectedPackage = this.packages.find(p => String(p.package_id || p.packageId) === String(packageId)) || null;
    this.selectedSlot = null;
    this.holdId = '';
    this.clearHoldTimer();
    this.fetchSlots();
    this.fetchQuote();
    this.saveProgressDraft();
    this.cdr.markForCheck();
  }

  onConceptChange(code: string): void {
    this.selectedConceptCode = code;
    this.selectedConcept = this.concepts.find(c => c.concept_code === code) || null;
    this.showConceptSelector = false;
    this.fetchQuote();
    this.saveProgressDraft();
    this.cdr.markForCheck();
  }

  selectDateChip(dateStr: string): void {
    this.bookingDate = dateStr;
    this.onDateChange();
  }

  onDateChange(): void {
    this.selectedSlot = null;
    this.holdId = '';
    this.clearHoldTimer();
    this.fetchSlots();
    this.saveProgressDraft();
    this.cdr.markForCheck();
  }

  fetchSlots(): void {
    if (!this.bookingDate || !this.selectedPackageId) return;
    this.loadingSlots = true;
    this.bookingService.getAvailableSlots(this.bookingDate, this.selectedPackageId).subscribe({
      next: (res) => {
        this.loadingSlots = false;
        this.availableSlots = res.slots || [];
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingSlots = false;
        this.availableSlots = [];
        this.cdr.markForCheck();
      }
    });
  }

  selectSlot(slot: any): void {
    if (!slot.available && slot.status !== 'AVAILABLE') return;
    
    // Auto-fill phone from logged-in user if empty
    if (!this.customerPhone && this.authService.currentUser?.phone) {
      this.customerPhone = this.authService.currentUser.phone;
    }
    if (!this.customerName && this.authService.currentUser?.fullName) {
      this.customerName = this.authService.currentUser.fullName;
    }

    const phone = (this.customerPhone || '0987654321').trim().replace(/\s/g, '');
    this.bookingError = '';
    this.selectedSlot = slot;
    this.heldPhone = phone;

    this.bookingService.holdSlot({
      packageId: this.selectedPackageId,
      bookingDate: this.bookingDate,
      startTime: slot.startTime,
      customerPhone: phone
    }).subscribe({
      next: (res) => {
        this.holdId = res.holdId;
        this.holdExpired = false;
        this.startHoldTimer(res.expiresInSeconds || 600);
        this.saveProgressDraft();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.bookingError = err.message || 'Khung giờ này vừa có người giữ chỗ, vui lòng chọn khung giờ khác!';
        this.cdr.markForCheck();
      }
    });
  }

  startHoldTimer(seconds: number): void {
    this.clearHoldTimer();
    this.holdExpiresInSeconds = seconds;
    this.holdTimerInterval = setInterval(() => {
      if (this.holdExpiresInSeconds > 0) {
        this.holdExpiresInSeconds--;
        this.cdr.markForCheck();
      } else {
        this.clearHoldTimer();
        this.holdExpired = true;
        this.holdId = '';
        this.selectedSlot = null;
        this.bookingError = 'Thời gian giữ chỗ 10 phút đã hết hạn. Vui lòng chọn lại khung giờ!';
        this.cdr.markForCheck();
      }
    }, 1000);
  }

  clearHoldTimer(): void {
    if (this.holdTimerInterval) {
      clearInterval(this.holdTimerInterval);
      this.holdTimerInterval = null;
    }
  }

  get formatHoldTimer(): string {
    const mins = Math.floor(this.holdExpiresInSeconds / 60);
    const secs = this.holdExpiresInSeconds % 60;
    const mStr = mins < 10 ? '0' + mins : mins;
    const sStr = secs < 10 ? '0' + secs : secs;
    return `${mStr}:${sStr}`;
  }

  fetchQuote(): void {
    if (!this.selectedPackageId) return;
    this.loadingQuote = true;
    this.voucherError = '';

    this.bookingService.getQuote({
      packageId: this.selectedPackageId,
      conceptCode: this.selectedConceptCode || undefined,
      voucherCode: this.voucherCode ? this.voucherCode.trim() : undefined
    }).subscribe({
      next: (q) => {
        this.loadingQuote = false;
        this.quote = q;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadingQuote = false;
        if (this.voucherCode) {
          this.voucherError = err.message || 'Mã ưu đãi không hợp lệ!';
        }
        this.cdr.markForCheck();
      }
    });
  }

  applyVoucher(): void {
    if (!this.voucherCode.trim()) return;
    this.fetchQuote();
  }

  saveProgressDraft(): void {
    this.bookingService.saveDraft({
      step: this.currentStep,
      packageId: this.selectedPackageId,
      conceptCode: this.selectedConceptCode || undefined,
      bookingDate: this.bookingDate || undefined,
      startTime: this.selectedSlot?.startTime || undefined,
      holdId: this.holdId || undefined,
      voucherCode: this.voucherCode ? this.voucherCode.trim() : undefined,
      customer: {
        name: this.customerName || undefined,
        phone: this.customerPhone || undefined,
        email: this.customerEmail || undefined,
        note: this.note || undefined
      }
    }).subscribe({
      error: () => {}
    });
  }

  // Step Navigation
  goToStep(step: number): void {
    this.bookingError = '';
    if (step === 2) {
      if (!this.selectedPackageId) {
        this.bookingError = 'Vui lòng chọn một gói chụp để tiếp tục!';
        return;
      }
      this.currentStep = 2;
      this.fetchSlots();
    } else if (step === 3) {
      if (!this.selectedSlot) {
        this.bookingError = 'Vui lòng chọn một khung giờ chụp trước khi thanh toán cọc!';
        return;
      }
      this.currentStep = 3;
      this.fetchQuote();
      this.saveProgressDraft();
    } else {
      this.currentStep = step;
    }
    this.cdr.markForCheck();
  }

  setPaymentMethod(method: 'bank' | 'vnpay'): void {
    this.selectedPaymentMethod = method;
  }

  // Handle Proceed / Pay from Step 3
  confirmPayment(): void {
    this.bookingError = '';

    // 1. Check customer info
    if (!this.customerName.trim()) {
      this.bookingError = 'Vui lòng nhập Họ và tên người đặt lịch!';
      return;
    }
    const cleanPhone = this.customerPhone.trim().replace(/\s/g, '');
    if (!cleanPhone || !/^[0-9]{9,11}$/.test(cleanPhone)) {
      this.bookingError = 'Vui lòng nhập Số điện thoại hợp lệ (9 - 11 chữ số)!';
      return;
    }

    // 2. Check slot
    if (!this.selectedSlot) {
      this.bookingError = 'Vui lòng chọn một khung giờ chụp còn trống!';
      this.currentStep = 2;
      return;
    }

    // 3. Save draft
    this.saveProgressDraft();

    // 4. AUTH GATE: Check if user is logged in
    if (!this.authService.isLoggedIn) {
      // Save draft and redirect to login
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/dat-lich?step=3' } });
      return;
    }

    // If holdId is missing or held with another phone, re-hold with cleanPhone
    if (!this.holdId || this.holdExpired || this.heldPhone !== cleanPhone) {
      this.bookingService.holdSlot({
        packageId: this.selectedPackageId,
        bookingDate: this.bookingDate,
        startTime: this.selectedSlot.startTime,
        customerPhone: cleanPhone
      }).subscribe({
        next: (hRes) => {
          this.holdId = hRes.holdId;
          this.heldPhone = cleanPhone;
          this.showBookingNoticeModal = true;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.bookingError = err.message || 'Khung giờ này không còn trống, vui lòng chọn giờ khác!';
          this.currentStep = 2;
          this.cdr.markForCheck();
        }
      });
      return;
    }

    // Show notice popup modal first (Figma Screen 5)
    this.showBookingNoticeModal = true;
    this.cdr.markForCheck();
  }

  closeBookingNoticeModal(): void {
    this.showBookingNoticeModal = false;
    this.cdr.markForCheck();
  }

  confirmPaymentAfterNotice(): void {
    this.showBookingNoticeModal = false;
    const cleanPhone = this.customerPhone.trim().replace(/\s/g, '');

    // 5. Create Booking on Server
    this.submittingBooking = true;
    this.cdr.markForCheck();
    this.bookingService.createBooking({
      holdId: this.holdId,
      conceptCode: this.selectedConceptCode || undefined,
      voucherCode: this.voucherCode ? this.voucherCode.trim() : undefined,
      customerName: this.customerName.trim(),
      customerPhone: cleanPhone,
      customerEmail: this.customerEmail.trim() || undefined,
      note: this.note.trim() || undefined
    }).subscribe({
      next: (res) => {
        this.submittingBooking = false;
        this.bookingCreated = true;
        this.createdBookingId = res.bookingId;
        this.createdBookingCode = res.bookingCode;
        this.paymentInfo = res.paymentInfo || null;
        this.cdr.markForCheck();

        // If VNPay: redirect immediately to paymentUrl
        if (this.selectedPaymentMethod === 'vnpay') {
          this.bookingService.createVnpayPayment(res.bookingId).subscribe({
            next: (vnpRes) => {
              if (vnpRes.paymentUrl) {
                window.location.href = vnpRes.paymentUrl;
              }
            },
            error: (vnpErr) => {
              this.bookingError = vnpErr.message || 'Không thể tạo link VNPay lúc này, vui lòng chuyển khoản ngân hàng!';
              this.cdr.markForCheck();
            }
          });
        }
      },
      error: (err) => {
        this.submittingBooking = false;
        this.bookingError = err.error?.error || err.error?.message || err.message || 'Đặt lịch chưa thành công, vui lòng kiểm tra lại thông tin!';
        this.cdr.markForCheck();
      }
    });
  }

  // Khách bấm xác nhận đã chuyển khoản
  notifyBankTransferDone(): void {
    if (!this.createdBookingId) return;
    this.transferLoading = true;
    this.bookingService.confirmBankTransfer({
      bookingId: this.createdBookingId,
      note: `Khách báo đã chuyển khoản cọc đơn ${this.createdBookingCode}`
    }).subscribe({
      next: () => {
        this.transferLoading = false;
        this.transferConfirmed = true;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.transferLoading = false;
        this.bookingError = err.message || 'Lỗi gửi xác nhận, studio sẽ đối soát giao dịch tự động.';
        this.transferConfirmed = true;
        this.cdr.markForCheck();
      }
    });
  }

  submitConsult(): void {
    if (!this.consultForm.fullName || !this.consultForm.phone) {
      alert('Vui lòng nhập Họ tên và Số điện thoại!');
      return;
    }
    alert('Ký Ức Studio đã ghi nhận thông tin! Ekip sẽ liên hệ lại với bạn trong vòng 30 phút.');
    this.consultForm = {
      fullName: '',
      phone: '',
      favoriteConcept: 'CD Vườn Hoa',
      conceptIdea1: '',
      conceptIdea2: ''
    };
  }
}
