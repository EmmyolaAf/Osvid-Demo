export type QuoteRequestStatus =
  | "new"
  | "in_review"
  | "quoted"
  | "accepted"
  | "declined";

export interface QuoteRequestItem {
  productName: string;
  quantity: number;
  unit: string;
  targetPrice?: number;
  quotedUnitPrice?: number;
  quotedLineTotal?: number;
}

export interface QuoteRequest {
  id: string;
  quoteNumber: string;
  customerName: string;
  companyName?: string;
  email: string;
  phone: string;
  deliveryLocation?: string;
  deliveryAddress?: string;
  state?: string;
  urgency?: "standard" | "urgent" | "immediate" | "normal";
  items: QuoteRequestItem[];
  additionalNotes?: string;
  status: QuoteRequestStatus;
  subtotal?: number;
  freightFee?: number;
  grandTotal?: number;
  paymentTerms?: string;
  validUntil?: string;
  validityDays?: number;
  adminNotes?: string;
  quotedAt?: string;
  quotedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export type NewsletterSubscriberStatus = "active" | "unsubscribed";

export interface NewsletterSubscriber {
  id: string;
  email: string;
  name?: string;
  status: NewsletterSubscriberStatus;
  source: "footer" | "checkout" | "contact" | "manual" | "quote_request" | "admin";
  subscribedAt: string;
  lastEmailedAt?: string;
}

export type CrmEmailAudience =
  | "all_subscribers"
  | "all_customers"
  | "quote_leads"
  | "custom";

export interface CrmEmailCampaign {
  id: string;
  title?: string;
  subject: string;
  previewText?: string;
  targetAudience?: CrmEmailAudience;
  content?: string;
  contentHtml?: string;
  status: "draft" | "sent";
  recipientsCount?: number;
  recipientCount?: number;
  sentAt?: string;
  createdAt?: string;
  sentBy?: string;
}

export type CrmEmailCategory = "quote" | "newsletter" | "broadcast" | "direct";

export interface CrmEmailLog {
  id: string;
  to?: string;
  recipientEmail?: string;
  recipientName?: string;
  subject: string;
  snippet?: string;
  type?: string;
  category?: CrmEmailCategory;
  referenceId?: string;
  quoteNumber?: string;
  status: "sent" | "failed" | "delivered";
  sentBy?: string;
  sentAt: string;
  error?: string;
}

export interface CrmEmailTemplate {
  id: string;
  name: string;
  description: string;
  category: CrmEmailCategory;
  defaultSubject: string;
  defaultContent: string;
}
