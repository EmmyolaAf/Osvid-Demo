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

export interface ElementStyleOverride {
  text?: string;
  textColor?: string;
  backgroundColor?: string;
  borderRadius?: string;
  fontSize?: string;
  fontWeight?: string;
  padding?: string;
}

export interface ContentChangeLog {
  id: string;
  timestamp: string;
  expiresAt: string; // 7 days from timestamp
  author: string;
  page: string;
  summary: string;
  changes: Record<string, ElementStyleOverride>;
  previousSnapshot?: Record<string, ElementStyleOverride>;
}

export interface SiteContent {
  hero: HeroContent;
  announcement: AnnouncementContent;
  aboutSummary: AboutSummaryContent;
  contactInfo: ContactInfoContent;
  elements?: Record<string, ElementStyleOverride>;
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
    phone: "+234 814 395 9711",
    whatsapp: "+234 912 109 0303",
    email: "info@osvidcompany.com",
    address: "41 Lagos/Badagry Expressway, Ile-Epo Bus-stop, Lagos, Nigeria",
    businessHours: "Mon - Sat: 8:00 AM - 6:00 PM",
  },
  elements: {
    "hero-badge": {
      text: "Industrial & Domestic Chemical Solutions",
      textColor: "#fdba74",
      backgroundColor: "rgba(255, 255, 255, 0.1)",
      borderRadius: "9999px",
    },
    "hero-title-primary": {
      text: "Engineered for Performance.",
      textColor: "#fb923c",
    },
    "hero-title-secondary": {
      text: "Trusted for Surface Excellence.",
      textColor: "#ffffff",
    },
    "hero-description": {
      text: "OSVID Chemicals delivers high-grade specialty chemicals, car care solutions, and industrial formulations manufactured to the highest global safety and quality standards.",
      textColor: "rgba(255, 255, 255, 0.9)",
    },
    "hero-primary-btn": {
      text: "Explore Chemical Catalog",
      textColor: "#ffffff",
      backgroundColor: "#ea580c",
      borderRadius: "8px",
    },
    "hero-secondary-btn": {
      text: "Speak with Chemical Specialist",
      textColor: "#ffffff",
      backgroundColor: "rgba(255, 255, 255, 0.1)",
      borderRadius: "8px",
    },
  },
  lastUpdated: new Date().toISOString(),
};
