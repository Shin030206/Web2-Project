import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BookingService, PaymentInfo, QuoteResponse } from '../../services/booking.service';
import { PackageService } from '../../services/package.service';
import { ConceptService } from '../../services/concept.service';
import { AuthService } from '../../services/auth.service';
import { Package } from '../../models/package.model';
import { Concept } from '../../models/concept.model';

@Component({
  selector: 'app-booking',
  standalone: false,
  templateUrl: './booking.component.html',
  styleUrl: './booking.component.css'
})
export class BookingComponent implements OnInit, OnDestroy {
  // Packages & Concepts
  packages: Package[] = [];
  selectedPackage: Package | null = null;
  selectedPackageId: number | string = 102; // Default to Nâng Cao 2.5tr

  concepts: Concept[] = [];
  selectedConcept: Concept | null = null;
  selectedConceptCode: string = '';

  // Date & Slot Selection
  bookingDate: string = '';
  minBookingDate: string = '';
  availableSlots: any[] = [];
  selectedSlot: any = null;
  loadingSlots: boolean = false;

  // Hold slot state
  holdId: string = '';
  holdExpiresInSeconds: number = 0;
  holdTimerInterval: any = null;
  holdExpired: boolean = false;

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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private bookingService: BookingService,
    private packageService: PackageService,
    private conceptService: ConceptService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    // Setup default date: tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    this.minBookingDate = tomorrow.toISOString().split('T')[0];
    this.bookingDate = this.minBookingDate;

    // Prefill user data if logged in
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        if (!this.customerName) this.customerName = user.fullName || '';
        if (!this.customerPhone) this.customerPhone = user.phone || '';
        if (!this.customerEmail) this.customerEmail = user.email || '';
      }
    });

    // Check query params & draft
    this.route.queryParams.subscribe(params => {
      if (params['package']) {
        this.selectedPackageId = params['package'];
      }
      if (params['concept']) {
        this.selectedConceptCode = params['concept'];
      }
      this.initData();
    });
  }

  ngOnDestroy(): void {
    this.clearHoldTimer();
  }

  initData(): void {
    // 1. Load packages
    this.packageService.getPackages().subscribe({
      next: (pkgs) => {
        this.packages = pkgs;
        if (pkgs.length > 0) {
          const matched = pkgs.find(p => String(p.package_id || p.packageId) === String(this.selectedPackageId));
          this.selectedPackage = matched || pkgs[0];
          this.selectedPackageId = this.selectedPackage.package_id || this.selectedPackage.packageId || 102;
        }
        // 2. Load draft if exists
        this.loadDraft();
      },
      error: () => {
        // Fallback default
        this.loadDraft();
      }
    });

    // 3. Load concepts
    this.conceptService.getConcepts().subscribe({
      next: (concepts) => {
        this.concepts = concepts;
        if (concepts.length > 0) {
          if (this.selectedConceptCode) {
            this.selectedConcept = concepts.find(c => c.concept_code === this.selectedConceptCode) || concepts[0];
          } else {
            this.selectedConcept = concepts[0];
            this.selectedConceptCode = this.selectedConcept.concept_code;
          }
        }
      }
    });
  }

  loadDraft(): void {
    this.bookingService.getDraft().subscribe({
      next: (res) => {
        if (res && res.draft && res.draft.data) {
          const d = res.draft.data;
          if (d.packageId) {
            this.selectedPackageId = d.packageId;
            const matched = this.packages.find(p => String(p.package_id || p.packageId) === String(d.packageId));
            if (matched) this.selectedPackage = matched;
          }
          if (d.conceptCode) {
            this.selectedConceptCode = d.conceptCode;
            const matchedC = this.concepts.find(c => c.concept_code === d.conceptCode);
            if (matchedC) this.selectedConcept = matchedC;
          }
          if (d.bookingDate) this.bookingDate = d.bookingDate;
          if (d.customer) {
            if (d.customer.name) this.customerName = d.customer.name;
            if (d.customer.phone) this.customerPhone = d.customer.phone;
            if (d.customer.email) this.customerEmail = d.customer.email;
            if (d.customer.note) this.note = d.customer.note;
          }
          if (d.voucherCode) this.voucherCode = d.voucherCode;

          // Check hold validity
          if (res.hold && res.hold.valid && res.hold.secondsLeft > 0) {
            this.holdId = d.holdId;
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
        // Load slots and quote
        this.fetchSlots();
        this.fetchQuote();
      },
      error: () => {
        this.fetchSlots();
        this.fetchQuote();
      }
    });
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
  }

  onConceptChange(code: string): void {
    this.selectedConceptCode = code;
    this.selectedConcept = this.concepts.find(c => c.concept_code === code) || null;
    this.fetchQuote();
    this.saveProgressDraft();
  }

  onDateChange(): void {
    this.selectedSlot = null;
    this.holdId = '';
    this.clearHoldTimer();
    this.fetchSlots();
    this.saveProgressDraft();
  }

  fetchSlots(): void {
    if (!this.bookingDate || !this.selectedPackageId) return;
    this.loadingSlots = true;
    this.bookingService.getAvailableSlots(this.bookingDate, this.selectedPackageId).subscribe({
      next: (res) => {
        this.loadingSlots = false;
        this.availableSlots = res.slots || [];
      },
      error: () => {
        this.loadingSlots = false;
        this.availableSlots = [];
      }
    });
  }

  selectSlot(slot: any): void {
    if (!slot.available && slot.status !== 'AVAILABLE') return;
    
    // Server requires customerPhone to hold slot
    const phone = (this.customerPhone || this.authService.currentUser?.phone || '').trim();
    if (!phone || !/^[0-9]{9,11}$/.test(phone)) {
      this.bookingError = 'Vui lòng nhập Số điện thoại của bạn ở bên dưới để hệ thống giữ khung giờ này trong 10 phút!';
      // Focus phone field
      const phoneInput = document.getElementById('bookingPhoneInput');
      if (phoneInput) phoneInput.focus();
      return;
    }

    this.bookingError = '';
    this.selectedSlot = slot;
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
      },
      error: (err) => {
        this.bookingError = err.message || 'Khung giờ này vừa có người giữ chỗ, vui lòng chọn khung giờ khác!';
      }
    });
  }

  startHoldTimer(seconds: number): void {
    this.clearHoldTimer();
    this.holdExpiresInSeconds = seconds;
    this.holdTimerInterval = setInterval(() => {
      if (this.holdExpiresInSeconds > 0) {
        this.holdExpiresInSeconds--;
      } else {
        this.clearHoldTimer();
        this.holdExpired = true;
        this.holdId = '';
        this.selectedSlot = null;
        this.bookingError = 'Thời gian giữ chỗ 10 phút đã hết hạn. Vui lòng chọn lại khung giờ!';
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
      },
      error: (err) => {
        this.loadingQuote = false;
        if (this.voucherCode) {
          this.voucherError = err.message || 'Mã ưu đãi không hợp lệ!';
        }
      }
    });
  }

  applyVoucher(): void {
    if (!this.voucherCode.trim()) return;
    this.fetchQuote();
  }

  saveProgressDraft(): void {
    this.bookingService.saveDraft({
      step: 1,
      data: {
        packageId: this.selectedPackageId,
        conceptCode: this.selectedConceptCode,
        bookingDate: this.bookingDate,
        startTime: this.selectedSlot?.startTime,
        holdId: this.holdId || undefined,
        voucherCode: this.voucherCode ? this.voucherCode.trim() : undefined,
        customer: {
          name: this.customerName,
          phone: this.customerPhone,
          email: this.customerEmail,
          note: this.note
        }
      }
    }).subscribe({
      error: () => {}
    });
  }

  setPaymentMethod(method: 'bank' | 'vnpay'): void {
    this.selectedPaymentMethod = method;
  }

  // Handle Proceed / Pay
  confirmPayment(): void {
    this.bookingError = '';

    // 1. Check customer info
    if (!this.customerName.trim()) {
      this.bookingError = 'Vui lòng nhập Họ và tên khách hàng!';
      return;
    }
    const cleanPhone = this.customerPhone.trim().replace(/\s/g, '');
    if (!cleanPhone || !/^[0-9]{9,11}$/.test(cleanPhone)) {
      this.bookingError = 'Vui lòng nhập Số điện thoại hợp lệ!';
      return;
    }

    // 2. Check slot
    if (!this.selectedSlot || !this.holdId || this.holdExpired) {
      this.bookingError = 'Vui lòng chọn một khung giờ chụp còn trống để giữ chỗ!';
      return;
    }

    // 3. Save draft first
    this.saveProgressDraft();

    // 4. AUTH GATE: Check if user is logged in
    if (!this.authService.isLoggedIn) {
      // Save draft and redirect to login
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/dat-lich' } });
      return;
    }

    // 5. Create Booking on Server
    this.submittingBooking = true;
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
            }
          });
        }
      },
      error: (err) => {
        this.submittingBooking = false;
        this.bookingError = err.message || 'Đặt lịch chưa thành công, vui lòng kiểm tra lại thông tin!';
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
      },
      error: (err) => {
        this.transferLoading = false;
        this.bookingError = err.message || 'Lỗi gửi xác nhận, studio sẽ đối soát giao dịch tự động.';
        this.transferConfirmed = true;
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
