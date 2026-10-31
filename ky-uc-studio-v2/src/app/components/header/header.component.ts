import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService, User } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  standalone: false,
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent implements OnInit {
  hotline = '0396581067';
  mobileMenuOpen: boolean = false;
  currentUser: User | null = null;

  navLinks = [
    { title: 'Trang chủ', path: '/' },
    { title: 'Bảng giá', path: '/bang-gia' },
    { title: 'Bộ sưu tập', path: '/bo-suu-tap' },
    { title: 'Concept', path: '/concept' },
    { title: 'Về chúng tôi', path: '/ve-chung-toi' }
  ];

  constructor(
    public authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Listen to user auth changes
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });

    // Close mobile menu on route change
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.closeMobileMenu();
    });
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
    if (this.mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
    document.body.style.overflow = '';
  }

  logout(): void {
    this.authService.logout().subscribe(() => {
      this.closeMobileMenu();
      this.router.navigate(['/']);
    });
  }
}
