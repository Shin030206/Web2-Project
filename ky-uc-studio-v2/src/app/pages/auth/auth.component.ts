import { Component, OnInit, OnDestroy, ElementRef, ViewChildren, QueryList } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-auth',
  standalone: false,
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.css'
})
export class AuthComponent implements OnInit, OnDestroy {
  // Mode: 'login' | 'register'
  mode: 'login' | 'register' = 'login';

  // Login form fields
  loginPhoneOrEmail: string = '';
  loginPassword: string = '';
  rememberMe: boolean = true;
  loginError: string = '';
  loginLoading: boolean = false;
  loginSuccess: string = '';

  // Register form fields
  regFullName: string = '';
  regPhone: string = '';
  regEmail: string = '';
  regPassword: string = '';
  regConfirmPassword: string = '';
  regAgreeTerms: boolean = false;
  regError: string = '';
  regLoading: boolean = false;

  // OTP Modal state (Figma 383:13636)
  showOtpModal: boolean = false;
  otpDigits: string[] = ['', '', '', '', '', ''];
  otpSecondsRemaining: number = 299; // 5 minutes
  otpTimerInterval: any = null;
  otpResendCount: number = 0;
  otpMaxResends: number = 5;
  otpError: string = '';
  otpSuccess: boolean = false;
  maskedPhoneDisplay: string = '03•• ••• 067';

  // Toggle password visibility
  showLoginPassword: boolean = false;
  showRegPassword: boolean = false;

  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef>;

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Check route or query params
    this.route.url.subscribe(segments => {
      const path = segments[0]?.path;
      if (path === 'register') {
        this.mode = 'register';
      } else {
        this.mode = 'login';
      }
    });

    this.route.queryParams.subscribe(params => {
      if (params['mode'] === 'register') {
        this.mode = 'register';
      } else if (params['mode'] === 'login') {
        this.mode = 'login';
      }
    });
  }

  ngOnDestroy(): void {
    this.clearOtpTimer();
  }

  setMode(targetMode: 'login' | 'register'): void {
    this.mode = targetMode;
    this.loginError = '';
    this.regError = '';
    this.loginSuccess = '';
  }

  // Handle Login Submit
  submitLogin(): void {
    this.loginError = '';
    this.loginSuccess = '';

    if (!this.loginPhoneOrEmail.trim()) {
      this.loginError = 'Vui lòng nhập số điện thoại hoặc email.';
      return;
    }

    if (!this.loginPassword) {
      this.loginError = 'Vui lòng nhập mật khẩu của bạn.';
      return;
    }

    this.loginLoading = true;
    setTimeout(() => {
      this.loginLoading = false;
      this.loginSuccess = 'Đăng nhập thành công! Đang chuyển hướng...';
      setTimeout(() => {
        this.router.navigate(['/']);
      }, 1200);
    }, 800);
  }

  // Handle Register Submit -> Trigger OTP Modal
  submitRegister(): void {
    this.regError = '';

    if (!this.regFullName.trim()) {
      this.regError = 'Vui lòng nhập họ và tên của bạn.';
      return;
    }

    const cleanPhone = this.regPhone.trim();
    if (!cleanPhone || !/^[0-9]{9,11}$/.test(cleanPhone)) {
      this.regError = 'Vui lòng nhập số điện thoại hợp lệ (9 - 11 chữ số).';
      return;
    }

    if (this.regEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.regEmail.trim())) {
      this.regError = 'Định dạng email chưa chính xác.';
      return;
    }

    if (!this.regPassword || this.regPassword.length < 6) {
      this.regError = 'Mật khẩu phải chứa ít nhất 6 ký tự.';
      return;
    }

    if (this.regPassword !== this.regConfirmPassword) {
      this.regError = 'Mật khẩu xác nhận không khớp.';
      return;
    }

    if (!this.regAgreeTerms) {
      this.regError = 'Vui lòng đồng ý với Điều khoản dịch vụ và Chính sách bảo mật.';
      return;
    }

    // Mask phone for OTP modal: e.g. 0396581067 -> 03•• ••• 067
    this.maskedPhoneDisplay = this.formatMaskedPhone(cleanPhone);

    // Open OTP modal
    this.showOtpModal = true;
    this.resetOtpForm();
    this.startOtpTimer();

    // Auto focus first OTP input after render
    setTimeout(() => {
      if (this.otpInputs && this.otpInputs.first) {
        this.otpInputs.first.nativeElement.focus();
      }
    }, 150);
  }

  formatMaskedPhone(phone: string): string {
    if (phone.length >= 10) {
      return phone.substring(0, 2) + '•• ••• ' + phone.substring(phone.length - 3);
    }
    return phone;
  }

  // OTP Timer Management
  startOtpTimer(): void {
    this.clearOtpTimer();
    this.otpSecondsRemaining = 299; // 04:59
    this.otpTimerInterval = setInterval(() => {
      if (this.otpSecondsRemaining > 0) {
        this.otpSecondsRemaining--;
      } else {
        this.clearOtpTimer();
      }
    }, 1000);
  }

  clearOtpTimer(): void {
    if (this.otpTimerInterval) {
      clearInterval(this.otpTimerInterval);
      this.otpTimerInterval = null;
    }
  }

  get formatOtpTimer(): string {
    const mins = Math.floor(this.otpSecondsRemaining / 60);
    const secs = this.otpSecondsRemaining % 60;
    const mStr = mins < 10 ? '0' + mins : mins;
    const sStr = secs < 10 ? '0' + secs : secs;
    return `${mStr}:${sStr}`;
  }

  resetOtpForm(): void {
    this.otpDigits = ['', '', '', '', '', ''];
    this.otpError = '';
    this.otpSuccess = false;
  }

  closeOtpModal(): void {
    this.showOtpModal = false;
    this.clearOtpTimer();
    this.resetOtpForm();
  }

  // Handle OTP 6-digit input interactions
  onOtpInput(index: number, event: any): void {
    const inputVal = event.target.value;
    
    // Only accept numeric
    if (!/^[0-9]$/.test(inputVal)) {
      this.otpDigits[index] = '';
      return;
    }

    this.otpDigits[index] = inputVal;

    // Move to next input box if available
    if (index < 5) {
      const inputsArray = this.otpInputs.toArray();
      if (inputsArray[index + 1]) {
        inputsArray[index + 1].nativeElement.focus();
      }
    } else {
      // All 6 digits filled, auto-verify if desired
      if (this.otpDigits.every(d => d !== '')) {
        this.verifyOtp();
      }
    }
  }

  onOtpKeyDown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace') {
      if (!this.otpDigits[index] && index > 0) {
        const inputsArray = this.otpInputs.toArray();
        if (inputsArray[index - 1]) {
          inputsArray[index - 1].nativeElement.focus();
          this.otpDigits[index - 1] = '';
        }
      } else {
        this.otpDigits[index] = '';
      }
    }
  }

  onOtpPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const clipboardData = event.clipboardData?.getData('text') || '';
    const digitsOnly = clipboardData.replace(/\D/g, '').substring(0, 6);

    if (digitsOnly.length > 0) {
      for (let i = 0; i < 6; i++) {
        this.otpDigits[i] = digitsOnly[i] || '';
      }

      // Focus last filled or 6th input
      const targetIndex = Math.min(digitsOnly.length, 5);
      const inputsArray = this.otpInputs.toArray();
      if (inputsArray[targetIndex]) {
        inputsArray[targetIndex].nativeElement.focus();
      }

      if (digitsOnly.length === 6) {
        this.verifyOtp();
      }
    }
  }

  resendOtp(): void {
    if (this.otpResendCount >= this.otpMaxResends) {
      this.otpError = 'Bạn đã đạt giới hạn 5 lần gửi mã mỗi giờ. Vui lòng thử lại sau.';
      return;
    }

    this.otpResendCount++;
    this.otpError = '';
    this.startOtpTimer();
  }

  verifyOtp(): void {
    this.otpError = '';
    const code = this.otpDigits.join('');

    if (code.length < 6) {
      this.otpError = 'Vui lòng nhập đầy đủ 6 chữ số mã OTP.';
      return;
    }

    // Verify OTP simulation
    this.otpSuccess = true;
    setTimeout(() => {
      this.closeOtpModal();
      this.mode = 'login';
      this.loginSuccess = 'Xác thực tài khoản thành công! Vui lòng đăng nhập để bắt đầu.';
      this.loginPhoneOrEmail = this.regPhone;
    }, 1500);
  }
}

