import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { provideHttpClient } from '@angular/common/http';

import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { HomeComponent } from './pages/home/home.component';
import { PricingComponent } from './pages/pricing/pricing.component';
import { GalleryComponent } from './pages/gallery/gallery.component';
import { BookingComponent } from './pages/booking/booking.component';
import { AuthComponent } from './pages/auth/auth.component';
import { AboutComponent } from './pages/about/about.component';
import { ConceptComponent } from './pages/concept/concept.component';
import { ConceptDetailComponent } from './pages/concept-detail/concept-detail.component';
import { AccountComponent } from './pages/account/account.component';

@NgModule({
  declarations: [
    App,
    HeaderComponent,
    FooterComponent,
    HomeComponent,
    PricingComponent,
    GalleryComponent,
    BookingComponent,
    AuthComponent,
    AboutComponent,
    ConceptComponent,
    ConceptDetailComponent,
    AccountComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule
  ],
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient()
  ],
  bootstrap: [App]
})
export class AppModule { }
