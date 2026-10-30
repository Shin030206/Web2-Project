import { Component } from '@angular/core';

@Component({
  selector: 'app-header',
  standalone: false,
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent {
  hotline = '0396581067';
  navLinks = [
    { title: 'Trang chủ', path: '/' },
    { title: 'Bảng giá', path: '/bang-gia' },
    { title: 'Bộ sưu tập', path: '/bo-suu-tap' },
    { title: 'Concept', path: '/concept' },
    { title: 'Về chúng tôi', path: '/ve-chung-toi' }
  ];
}

