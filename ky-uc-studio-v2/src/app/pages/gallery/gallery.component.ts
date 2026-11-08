import { Component } from '@angular/core';
import { Router } from '@angular/router';

interface CollectionItem {
  number: string;
  title: string;
  subtitle: string;
  slogan: string;
  description: string;
  image: string;
  conceptTarget: string;
}

@Component({
  selector: 'app-gallery',
  standalone: false,
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.css'
})
export class GalleryComponent {
  collections: CollectionItem[] = [
    {
      number: '01',
      title: 'EM VÀ NẮNG',
      subtitle: 'BST chân dung · 16 concept',
      slogan: 'Thanh xuân rực rỡ nhất dưới nắng.',
      description: 'Lưu giữ vẻ đẹp và cá tính riêng của bạn qua những khung hình chân dung mang dấu ấn cá nhân. Dù dịu dàng, tự nhiên hay mang chút hoài niệm, mỗi bức ảnh đều là một cách để bạn kể câu chuyện của chính mình.',
      image: 'assets/images/gallery-bst-01.png',
      conceptTarget: 'chan-dung'
    },
    {
      number: '02',
      title: 'KÝ ỨC ĐÔI TA',
      subtitle: 'BST cặp đôi · 10 concept',
      slogan: 'Một câu chuyện, hai người cùng viết.',
      description: 'Từ những ánh nhìn dịu dàng đến khoảnh khắc vui đùa tự nhiên, mỗi khung hình đều lưu giữ một phần câu chuyện riêng của hai người. Cùng Ký Ức ghi lại những điều bình dị làm nên tình yêu của bạn.',
      image: 'assets/images/gallery-bst-02.png',
      conceptTarget: 'cap-doi'
    },
    {
      number: '03',
      title: 'NHÀ LÀ NƠI ĐỂ VỀ',
      subtitle: 'BST gia đình và mẹ & bé · 20 concept',
      slogan: 'Nơi yêu thương luôn tìm được đường trở về.',
      description: 'Lưu giữ những cái ôm, nụ cười và khoảnh khắc gần gũi bên những người thân yêu. Bởi theo thời gian, điều quý giá nhất không chỉ là những gì ta đã trải qua, mà còn là những người luôn ở bên cạnh.',
      image: 'assets/images/gallery-bst-03.png',
      conceptTarget: 'gia-dinh'
    },
    {
      number: '04',
      title: 'TÌM LẠI DẤU XƯA',
      subtitle: 'BST áo dài · 10 concept',
      slogan: 'Nét đẹp truyền thống qua góc nhìn hôm nay.',
      description: 'Tôn vinh vẻ đẹp duyên dáng của tà áo dài Việt Nam qua những khung hình thanh lịch, nhẹ nhàng và giàu cảm xúc. Một chút truyền thống, một chút dấu ấn riêng để mỗi bức ảnh trở thành kỷ niệm đáng trân trọng.',
      image: 'assets/images/gallery-bst-04.png',
      conceptTarget: 'ao-dai'
    },
    {
      number: '05',
      title: 'CHÚNG TA CỦA SAU NÀY',
      subtitle: 'BST kỷ yếu · 5 concept',
      slogan: 'Sau này nhìn lại, chúng ta vẫn có nhau trong ảnh.',
      description: 'Thanh xuân sẽ qua đi, nhưng những người từng cùng nhau trưởng thành luôn xứng đáng có một chỗ trong album kỷ niệm. Cùng lưu giữ những ngày tháng vô tư, những nụ cười và tình bạn của một thời tuổi trẻ.',
      image: 'assets/images/gallery-bst-05.png',
      conceptTarget: 'ky-yeu'
    }
  ];

  constructor(private router: Router) {}

  exploreCollection(target: string): void {
    this.router.navigate(['/concept'], { queryParams: { category: target } });
  }
}
