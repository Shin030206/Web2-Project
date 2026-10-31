import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { PricingComponent } from './pages/pricing/pricing.component';
import { GalleryComponent } from './pages/gallery/gallery.component';
import { BookingComponent } from './pages/booking/booking.component';
import { AuthComponent } from './pages/auth/auth.component';
import { AboutComponent } from './pages/about/about.component';
import { ConceptComponent } from './pages/concept/concept.component';
import { ConceptDetailComponent } from './pages/concept-detail/concept-detail.component';
import { AccountComponent } from './pages/account/account.component';
import { PaymentResultComponent } from './pages/payment-result/payment-result.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'bang-gia', component: PricingComponent },
  { path: 'bo-suu-tap', component: GalleryComponent },
  { path: 'concept', component: ConceptComponent },
  { path: 'concept/:code', component: ConceptDetailComponent },
  { path: 'account', component: AccountComponent },
  { path: 'account/bookings', component: AccountComponent },
  { path: 'account/profile', component: AccountComponent },
  { path: 'dat-lich', component: BookingComponent },
  { path: 've-chung-toi', component: AboutComponent },
  { path: 'login', component: AuthComponent },
  { path: 'register', component: AuthComponent },
  { path: 'thanh-toan/ket-qua', component: PaymentResultComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled' })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
