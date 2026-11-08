import { Component, OnInit, OnDestroy, ElementRef, ViewChildren, QueryList, ChangeDetectorRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth',
  standalone: false,
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.css'
})
export class AuthComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);

  // Mode: 'login' | 'register' | 'forgot'
  mode: 'login' | 'register' | 'forgot' = 'login';
  returnUrl: string = '/';

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
  regSuccess: string = '';

  // Forgot Password fields
  forgotAccount: string = '';
  forgotNewPassword: string = '';
  forgotConfirmPassword: string = '';
  forgotStep: 'request' | 'verify' = 'request';
  forgotLoading: boolean = false;
  forgotError: string = '';
  forgotSuccess: string = '';

  // OTP Modal state (Figma 383:13636 & Password Reset)
  showOtpModal: boolean = false;
  showRegisterSuccessModal: boolean = false;
  otpDigits: string[] = ['', '', '', '', '', ''];
  otpSecondsRemaining: number = 300; // 5 minutes
  otpTimerInterval: any = null;
  otpError: string = '';
  otpSuccess: boolean = false;
  maskedPhoneDisplay: string = '03•• ••• 067';

  // Toggle password visibility
  showLoginPassword: boolean = false;
  showRegPassword: boolean = false;
  showForgotNewPassword: boolean = false;

  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Check returnUrl
    this.route.queryParams.subscribe(params => {
      if (params['returnUrl']) {
        this.returnUrl = params['returnUrl'];
      }
      if (params['mode'] === 'register') {
        this.mode = 'register';
      } else if (params['mode'] === 'forgot') {
        this.mode = 'forgot';
      } else if (params['mode'] === 'login') {
        this.mode = 'login';
      }
    });

    this.route.url.subscribe(segments => {
      const path = segments[0]?.path;
      if (path === 'register') {
        this.mode = 'register';
      } else if (path === 'login') {
        this.mode = 'login';
      } else if (path === 'forgot-password') {
        this.mode = 'forgot';
      }
    });
  }

  ngOnDestroy(): void {
    this.clearOtpTimer();
  }

  setMode(targetMode: 'login' | 'register' | 'forgot'): void {
    this.mode = targetMode;
    this.loginError = '';
    this.regError = '';
    this.loginSuccess = '';
    this.regSuccess = '';
    this.forgotError = '';
    this.forgotSuccess = '';
    this.cdr.markForCheck();
  }

  // Validate strong password matching server rules exactly
  validatePasswordStrength(password: string): string | null {
    const value = String(password || '');
    const missing: string[] = [];
    if (value.length < 8 || value.length > 32) missing.push('dài 8–32 ký tự');
    if (!/[A-Z]/.test(value)) missing.push('ít nhất 1 chữ hoa');
    if (!/[a-z]/.test(value)) missing.push('ít nhất 1 chữ thường');
    if (!/[0-9]/.test(value)) missing.push('ít nhất 1 chữ số');
    if (!/[^A-Za-z0-9]/.test(value)) missing.push('ít nhất 1 ký tự đặc biệt (@, #, $, !, %, ...)');
    if (!/^[\x21-\x7E]*$/.test(value)) missing.push('không chứa chữ có dấu hoặc khoảng trắng');
    
    if (missing.length > 0) {
      return `Mật khẩu cần: ${missing.join(', ')}.`;
    }
    return null;
  }

  // 1. Submit Login to Server
  submitLogin(): void {
    this.loginError = '';
    this.loginSuccess = '';

    const account = this.loginPhoneOrEmail.trim();
    if (!account) {
      this.loginError = 'Vui lòng nhập số điện thoại hoặc email.';
      this.cdr.markForCheck();
      return;
    }

    if (!this.loginPassword) {
      this.loginError = 'Vui lòng nhập mật khẩu của bạn.';
      this.cdr.markForCheck();
      return;
    }

    this.loginLoading = true;
    this.cdr.markForCheck();
    this.authService.login({
      account: account,
      password: this.loginPassword,
      rememberMe: this.rememberMe
    }).subscribe({
      next: (res) => {
        this.loginLoading = false;
        this.loginSuccess = res.message || 'Đăng nhập thành công! Đang chuyển hướng...';
        this.cdr.markForCheck();
        setTimeout(() => {
          if (res.user?.role === 'admin') {
            this.router.navigateByUrl(this.returnUrl !== '/' ? this.returnUrl : '/admin');
          } else {
            this.router.navigateByUrl(this.returnUrl);
          }
        }, 800);
      },
      error: (err) => {
        this.loginLoading = false;
        this.loginError = err.error?.error || err.error?.message || err.message || 'Sai số điện thoại hoặc mật khẩu!';
        this.cdr.markForCheck();
      }
    });
  }

  // 2. Submit Register to Server
  submitRegister(): void {
    this.regError = '';
    this.regSuccess = '';

    const fullName = this.regFullName.trim();
    if (!fullName) {
      this.regError = 'Vui lòng nhập họ và tên của bạn.';
      this.cdr.markForCheck();
      return;
    }

    const cleanPhone = this.regPhone.trim().replace(/\s/g, '');
    if (!cleanPhone || !/^[0-9]{9,11}$/.test(cleanPhone)) {
      this.regError = 'Vui lòng nhập số điện thoại hợp lệ (9 - 11 chữ số).';
      this.cdr.markForCheck();
      return;
    }

    const email = this.regEmail.trim();
    if (!email) {
      this.regError = 'Vui lòng nhập địa chỉ email để nhận thông tin bộ ảnh và tài khoản.';
      this.cdr.markForCheck();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.regError = 'Định dạng email chưa chính xác.';
      this.cdr.markForCheck();
      return;
    }

    const passError = this.validatePasswordStrength(this.regPassword);
    if (passError) {
      this.regError = passError;
      this.cdr.markForCheck();
      return;
    }

    if (this.regPassword !== this.regConfirmPassword) {
      this.regError = 'Mật khẩu xác nhận không khớp.';
      this.cdr.markForCheck();
      return;
    }

    if (!this.regAgreeTerms) {
      this.regError = 'Vui lòng đồng ý với Điều khoản dịch vụ và Chính sách bảo mật.';
      this.cdr.markForCheck();
      return;
    }

    this.regLoading = true;
    this.cdr.markForCheck();
    this.authService.register({
      fullName: fullName,
      email: email,
      phone: cleanPhone,
      password: this.regPassword
    }).subscribe({
      next: (res) => {
        this.regLoading = false;
        this.showRegisterSuccessModal = true;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.regLoading = false;
        this.regError = err.error?.error || err.error?.message || err.message || 'Đăng ký thất bại, vui lòng kiểm tra lại thông tin!';
        this.cdr.markForCheck();
      }
    });
  }

  closeRegisterSuccessModal(): void {
    this.showRegisterSuccessModal = false;
    this.cdr.markForCheck();
  }

  onRegisterSuccessLogin(): void {
    this.showRegisterSuccessModal = false;
    this.router.navigateByUrl(this.returnUrl || '/');
  }

  onRegisterSuccessContinue(): void {
    this.showRegisterSuccessModal = false;
    if (this.returnUrl && this.returnUrl.includes('dat-lich')) {
      this.router.navigateByUrl('/dat-lich');
    } else {
      this.router.navigateByUrl('/');
    }
  }

  // 3. Forgot Password Flow
  submitForgotPasswordRequest(): void {
    this.forgotError = '';
    this.forgotSuccess = '';

    const target = this.forgotAccount.trim();
    if (!target) {
      this.forgotError = 'Vui lòng nhập số điện thoại hoặc email đã đăng ký.';
      this.cdr.markForCheck();
      return;
    }

    this.forgotLoading = true;
    this.cdr.markForCheck();
    this.authService.forgotPassword({ account: target }).subscribe({
      next: (res) => {
        this.forgotLoading = false;
        this.maskedPhoneDisplay = res.sentTo || target;
        this.forgotStep = 'verify';
        this.showOtpModal = true;
        this.resetOtpForm();
        this.startOtpTimer();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.forgotLoading = false;
        this.forgotError = err.error?.error || err.error?.message || err.message || 'Không thể gửi mã xác nhận lúc này!';
        this.cdr.markForCheck();
      }
    });
  }

  submitResetPassword(): void {
    this.forgotError = '';
    const otp = this.otpDigits.join('');
    if (otp.length !== 6) {
      this.otpError = 'Vui lòng nhập đầy đủ 6 chữ số OTP.';
      this.cdr.markForCheck();
      return;
    }

    const passError = this.validatePasswordStrength(this.forgotNewPassword);
    if (passError) {
      this.otpError = passError;
      this.cdr.markForCheck();
      return;
    }

    if (this.forgotNewPassword !== this.forgotConfirmPassword) {
      this.otpError = 'Mật khẩu xác nhận không khớp.';
      this.cdr.markForCheck();
      return;
    }

    this.forgotLoading = true;
    this.cdr.markForCheck();
    this.authService.resetPassword({
      account: this.forgotAccount.trim(),
      otp: otp,
      newPassword: this.forgotNewPassword
    }).subscribe({
      next: (res) => {
        this.forgotLoading = false;
        this.otpSuccess = true;
        this.cdr.markForCheck();
        setTimeout(() => {
          this.closeOtpModal();
          this.setMode('login');
          this.loginSuccess = 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập với mật khẩu mới.';
          this.cdr.markForCheck();
        }, 1200);
      },
      error: (err) => {
        this.forgotLoading = false;
        this.otpError = err.error?.error || err.error?.message || err.message || 'Mã OTP không đúng hoặc đã hết hạn!';
        this.cdr.markForCheck();
      }
    });
  }

  // OTP Modal Controls
  closeOtpModal(): void {
    this.showOtpModal = false;
    this.clearOtpTimer();
    this.cdr.markForCheck();
  }

  resetOtpForm(): void {
    this.otpDigits = ['', '', '', '', '', ''];
    this.otpError = '';
    this.otpSuccess = false;
    this.cdr.markForCheck();
  }

  startOtpTimer(): void {
    this.clearOtpTimer();
    this.otpSecondsRemaining = 300;
    this.otpTimerInterval = setInterval(() => {
      if (this.otpSecondsRemaining > 0) {
        this.otpSecondsRemaining--;
        this.cdr.markForCheck();
      } else {
        this.clearOtpTimer();
        this.cdr.markForCheck();
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

  onOtpInput(index: number, event: any): void {
    const value = event.target.value;
    if (value && value.length > 0) {
      this.otpDigits[index] = value.slice(-1);
      // Auto advance
      if (index < 5 && this.otpInputs) {
        const nextInput = this.otpInputs.toArray()[index + 1];
        if (nextInput) nextInput.nativeElement.focus();
      }
    } else {
      this.otpDigits[index] = '';
    }
  }

  onOtpKeyDown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.otpDigits[index] && index > 0 && this.otpInputs) {
      const prevInput = this.otpInputs.toArray()[index - 1];
      if (prevInput) {
        prevInput.nativeElement.focus();
      }
    }
  }

  onOtpPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasteData = event.clipboardData?.getData('text') || '';
    const digits = pasteData.replace(/\D/g, '').slice(0, 6).split('');
    digits.forEach((d, i) => {
      if (i < 6) this.otpDigits[i] = d;
    });
  }

  resendOtp(): void {
    if (this.forgotAccount.trim()) {
      this.submitForgotPasswordRequest();
    }
  }

  verifyOtp(): void {
    this.submitResetPassword();
  }
}
