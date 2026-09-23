export interface HeroContent {
  badge: string;
  titlePrimary: string;
  titleSecondary: string;
  description: string;
  primaryButtonText: string;
  primaryButtonLink: string;
  secondaryButtonText: string;
  secondaryButtonLink: string;
  consultationButtonText: string;
}

export interface AnnouncementContent {
  enabled: boolean;
  text: string;
  linkText?: string;
  linkUrl?: string;
}

export interface AboutSummaryContent {
  heading: string;
  subheading: string;
  description: string;
  yearsOfExperience: string;
  productsDelivered: string;
  satisfactionRate: string;
}

export interface ContactInfoContent {
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  businessHours: string;
}

export interface SiteContent {
  hero: HeroContent;
  announcement: AnnouncementContent;
  aboutSummary: AboutSummaryContent;
  contactInfo: ContactInfoContent;
  lastUpdated: string;
  updatedBy?: string;
}

export const DEFAULT_SITE_CONTENT: SiteContent = {
  hero: {
    badge: "Industrial & Domestic Chemical Solutions",
    titlePrimary: "Engineered for Performance.",
    titleSecondary: "Trusted for Surface Excellence.",
    description: "OSVID Chemicals delivers high-grade specialty chemicals, car care solutions, and industrial formulations manufactured to the highest global safety and quality standards.",
    primaryButtonText: "Explore Chemical Catalog",
    primaryButtonLink: "/shop",
    secondaryButtonText: "Speak with Chemical Specialist",
    secondaryButtonLink: "/contact",
    consultationButtonText: "Book Technical Consultation",
  },
  announcement: {
    enabled: true,
    text: "🚀 Free delivery on bulk chemical orders across Lagos & nationwide dispatch available!",
    linkText: "Order Now",
    linkUrl: "/shop",
  },
  aboutSummary: {
    heading: "Leading the Chemical Formulation Industry",
    subheading: "Innovative Formulations for Industrial & Commercial Growth",
    description: "With years of research and production excellence, OSVID delivers reliable raw materials, surface cleaning agents, and precision specialty chemicals.",
    yearsOfExperience: "10+",
    productsDelivered: "50,000+",
    satisfactionRate: "99.8%",
  },
  contactInfo: {
    phone: "+234 803 123 4567",
    whatsapp: "+234 803 123 4567",
    email: "info@osvidchemicals.com",
    address: "Km 24 Lekki-Epe Expressway, Lagos, Nigeria",
    businessHours: "Mon - Sat: 8:00 AM - 6:00 PM",
  },
  lastUpdated: new Date().toISOString(),
};
