import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  limit,
} from "firebase/firestore";
import { db } from "./client";
import {
  QuoteRequest,
  QuoteRequestStatus,
  NewsletterSubscriber,
  NewsletterSubscriberStatus,
  CrmEmailLog,
  CrmEmailCampaign,
  ContactSubmission,
  ContactSubmissionStatus,
} from "@/types/crm";

// ============================================================================
// FIRESTORE DATA SANITIZER HELPER
// Deeply strips any `undefined` values to satisfy Firestore's strict requirement:
// "Function setDoc() called with invalid data. Unsupported field value: undefined"
// ============================================================================

export function cleanFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  // Deeply strip any undefined values across objects and arrays
  try {
    const json = JSON.stringify(obj, (key, value) => {
      if (value === undefined) {
        return undefined; // Strips keys with undefined values from objects
      }
      return value;
    });
    return JSON.parse(json);
  } catch {
    return obj;
  }
}

// ============================================================================
// 1. QUOTE REQUESTS (RFQs)
// ============================================================================

export async function getQuoteRequestsFromDb(): Promise<QuoteRequest[]> {
  try {
    const q = query(collection(db, "quote_requests"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as QuoteRequest));
  } catch (error) {
    console.error("Error fetching quote requests:", error);
    return [];
  }
}

export async function submitPublicQuoteRequest(
  data: Omit<QuoteRequest, "id" | "quoteNumber" | "status" | "createdAt" | "updatedAt">
): Promise<{ success: boolean; quoteNumber?: string; error?: string }> {
  try {
    const quoteId = `rfq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const dateYear = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const quoteNumber = `RFQ-${dateYear}-${randomSuffix}`;

    const newQuoteRaw: Record<string, any> = {
      ...data,
      id: quoteId,
      quoteNumber,
      status: "new",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const cleanQuote = cleanFirestoreData(newQuoteRaw);

    await setDoc(doc(db, "quote_requests", quoteId), cleanQuote);

    return { success: true, quoteNumber };
  } catch (err: any) {
    console.error("submitPublicQuoteRequest error:", err);
    return { success: false, error: err?.message || "Failed to submit quote request." };
  }
}

export async function updateQuoteStatusInDb(
  quoteId: string,
  updates: Partial<QuoteRequest>
): Promise<{ success: boolean; error?: string }> {
  try {
    const ref = doc(db, "quote_requests", quoteId);
    const cleanUpdates = cleanFirestoreData({
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    await updateDoc(ref, cleanUpdates);
    return { success: true };
  } catch (err: any) {
    console.error("updateQuoteStatusInDb error:", err);
    return { success: false, error: err?.message || "Failed to update quotation." };
  }
}

export async function deleteQuoteRequestInDb(
  quoteId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteDoc(doc(db, "quote_requests", quoteId));
    return { success: true };
  } catch (err: any) {
    console.error("deleteQuoteRequestInDb error:", err);
    return { success: false, error: err?.message || "Failed to delete quotation request." };
  }
}

// ============================================================================
// 2. NEWSLETTER SUBSCRIBERS
// ============================================================================

export async function getNewsletterSubscribersFromDb(): Promise<NewsletterSubscriber[]> {
  try {
    const q = query(collection(db, "newsletter_subscribers"), orderBy("subscribedAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as NewsletterSubscriber));
  } catch (error) {
    console.error("Error fetching newsletter subscribers:", error);
    return [];
  }
}

export async function saveNewsletterSubscriberInDb(
  email: string,
  name?: string,
  source: NewsletterSubscriber["source"] = "footer"
): Promise<{ success: boolean; isNew?: boolean; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { success: false, error: "Invalid email address format." };
  }

  try {
    // Generate deterministic id based on sanitized email
    const docId = `sub_${cleanEmail.replace(/[^a-z0-9]/g, "_")}`;
    const docRef = doc(db, "newsletter_subscribers", docId);

    const subData: Record<string, any> = {
      id: docId,
      email: cleanEmail,
      status: "active",
      source,
      subscribedAt: new Date().toISOString(),
    };
    if (name && name.trim()) {
      subData.name = name.trim();
    }

    // Set with merge: true works for both new subscribers and re-subscriptions
    // without requiring read permissions for public visitors
    await setDoc(docRef, cleanFirestoreData(subData), { merge: true });
    return { success: true, isNew: true };
  } catch (err: any) {
    console.error("saveNewsletterSubscriberInDb error:", err);
    return { success: false, error: err?.message || "Failed to subscribe to newsletter." };
  }
}

export async function toggleSubscriberStatusInDb(
  subscriberId: string,
  newStatus: NewsletterSubscriberStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateDoc(doc(db, "newsletter_subscribers", subscriberId), {
      status: newStatus,
    });
    return { success: true };
  } catch (err: any) {
    console.error("toggleSubscriberStatusInDb error:", err);
    return { success: false, error: err?.message || "Failed to update subscriber status." };
  }
}

export async function deleteSubscriberFromDb(
  subscriberId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteDoc(doc(db, "newsletter_subscribers", subscriberId));
    return { success: true };
  } catch (err: any) {
    console.error("deleteSubscriberFromDb error:", err);
    return { success: false, error: err?.message || "Failed to delete subscriber." };
  }
}

// ============================================================================
// 3. EMAIL LOGS & CAMPAIGNS
// ============================================================================

export async function getCrmEmailLogsFromDb(maxResults: number = 50): Promise<CrmEmailLog[]> {
  try {
    const q = query(
      collection(db, "crm_email_logs"),
      orderBy("sentAt", "desc"),
      limit(maxResults)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CrmEmailLog));
  } catch (error) {
    console.error("Error fetching CRM email logs:", error);
    return [];
  }
}

export async function logCrmEmailInDb(
  log: Omit<CrmEmailLog, "id" | "sentAt">
): Promise<void> {
  try {
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullLog: CrmEmailLog = {
      ...log,
      id: logId,
      sentAt: new Date().toISOString(),
    };
    await setDoc(doc(db, "crm_email_logs", logId), cleanFirestoreData(fullLog));
  } catch (err) {
    console.warn("Could not save email log:", err);
  }
}

export async function getCrmCampaignsFromDb(): Promise<CrmEmailCampaign[]> {
  try {
    const q = query(collection(db, "crm_email_campaigns"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CrmEmailCampaign));
  } catch (error) {
    console.error("Error fetching CRM email campaigns:", error);
    return [];
  }
}

export async function saveCrmCampaignInDb(
  campaign: Omit<CrmEmailCampaign, "id" | "createdAt"> & { id?: string }
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const campId = campaign.id || `camp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const data: CrmEmailCampaign = {
      ...campaign,
      id: campId,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, "crm_email_campaigns", campId), cleanFirestoreData(data), { merge: true });
    return { success: true, id: campId };
  } catch (err: any) {
    console.error("saveCrmCampaignInDb error:", err);
    return { success: false, error: err?.message || "Failed to save email campaign." };
  }
}

// ============================================================================
// 4. CONTACT INQUIRIES & SUBMISSIONS
// ============================================================================

export async function getContactSubmissionsFromDb(): Promise<ContactSubmission[]> {
  try {
    const q = query(
      collection(db, "contact_submissions"),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name || "Anonymous",
        email: data.email || "",
        phone: data.phone || "",
        subject: data.subject || "Contact Inquiry",
        message: data.message || "",
        status: (data.status as ContactSubmissionStatus) || "unread",
        adminNotes: data.adminNotes || "",
        resolvedAt: data.resolvedAt || undefined,
        resolvedBy: data.resolvedBy || undefined,
        createdAt: data.createdAt || (data.timestamp ? new Date(data.timestamp.toMillis ? data.timestamp.toMillis() : Date.now()).toISOString() : new Date().toISOString()),
        updatedAt: data.updatedAt || undefined,
      };
    });
  } catch (error) {
    console.error("Error fetching contact submissions:", error);
    return [];
  }
}

export async function updateContactSubmissionInDb(
  submissionId: string,
  updates: Partial<ContactSubmission>
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(db, "contact_submissions", submissionId);
    await updateDoc(docRef, cleanFirestoreData({
      ...updates,
      updatedAt: new Date().toISOString(),
    }));
    return { success: true };
  } catch (err: any) {
    console.error("updateContactSubmissionInDb error:", err);
    return { success: false, error: err?.message || "Failed to update contact inquiry." };
  }
}

export async function deleteContactSubmissionInDb(
  submissionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(db, "contact_submissions", submissionId);
    await deleteDoc(docRef);
    return { success: true };
  } catch (err: any) {
    console.error("deleteContactSubmissionInDb error:", err);
    return { success: false, error: err?.message || "Failed to delete contact inquiry." };
  }
}


