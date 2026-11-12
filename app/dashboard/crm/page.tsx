"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase/client";
import {
  QuoteRequest,
  QuoteRequestStatus,
  NewsletterSubscriber,
  NewsletterSubscriberStatus,
  CrmEmailLog,
  CrmEmailCampaign,
} from "@/types/crm";
import {
  getQuoteRequestsFromDb,
  updateQuoteStatusInDb,
  deleteQuoteRequestInDb,
  getNewsletterSubscribersFromDb,
  saveNewsletterSubscriberInDb,
  toggleSubscriberStatusInDb,
  deleteSubscriberFromDb,
  getCrmEmailLogsFromDb,
  logCrmEmailInDb,
  getCrmCampaignsFromDb,
  saveCrmCampaignInDb,
} from "@/lib/firebase/crm";
import {
  Mail,
  Send,
  FileSpreadsheet,
  Users,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Download,
  Building2,
  Phone,
  Calendar,
  DollarSign,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Eye,
  FileText,
  BadgePercent,
  Check,
  X,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function AdminCrmPage() {
  const { user, role, isAdmin, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<"quotes" | "newsletter" | "emails">("quotes");

  // State: Quotes
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(true);
  const [quoteSearch, setQuoteSearch] = useState("");
  const [quoteStatusFilter, setQuoteStatusFilter] = useState<string>("all");
  const [selectedQuoteForPricing, setSelectedQuoteForPricing] = useState<QuoteRequest | null>(null);

  // State: Subscribers & Campaigns
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(true);
  const [subscriberSearch, setSubscriberSearch] = useState("");
  const [subscriberStatusFilter, setSubscriberStatusFilter] = useState<string>("all");
  const [isAddSubModalOpen, setIsAddSubModalOpen] = useState(false);
  const [newSubEmail, setNewSubEmail] = useState("");
  const [newSubName, setNewSubName] = useState("");

  const [campaigns, setCampaigns] = useState<CrmEmailCampaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

  // State: Broadcast Composer
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastContent, setBroadcastContent] = useState("");
  const [broadcastCtaText, setBroadcastCtaText] = useState("Shop Industrial Chemicals");
  const [broadcastCtaUrl, setBroadcastCtaUrl] = useState("https://osvid.com.ng/shop");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // State: Direct Email
  const [directRecipientEmail, setDirectRecipientEmail] = useState("");
  const [directRecipientName, setDirectRecipientName] = useState("");
  const [directSubject, setDirectSubject] = useState("");
  const [directMessage, setDirectMessage] = useState("");
  const [sendingDirect, setSendingDirect] = useState(false);

  // State: Email Logs
  const [emailLogs, setEmailLogs] = useState<CrmEmailLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Pricing Modal Form State
  const [pricingItems, setPricingItems] = useState<Array<{ productName: string; quantity: number; unit: string; unitPrice: number; total: number }>>([]);
  const [pricingFreightFee, setPricingFreightFee] = useState<number>(0);
  const [pricingPaymentTerms, setPricingPaymentTerms] = useState<string>("100% advance payment prior to dispatch");
  const [pricingValidityDays, setPricingValidityDays] = useState<number>(7);
  const [pricingAdminNotes, setPricingAdminNotes] = useState<string>("");
  const [sendingQuotationEmail, setSendingQuotationEmail] = useState(false);

  // Load all initial CRM data
  const refreshAllData = async () => {
    setLoadingQuotes(true);
    setLoadingSubscribers(true);
    setLoadingCampaigns(true);
    setLoadingLogs(true);

    try {
      const [qData, subData, campData, logsData] = await Promise.all([
        getQuoteRequestsFromDb(),
        getNewsletterSubscribersFromDb(),
        getCrmCampaignsFromDb(),
        getCrmEmailLogsFromDb(60),
      ]);
      setQuotes(qData);
      setSubscribers(subData);
      setCampaigns(campData);
      setEmailLogs(logsData);
    } catch (err) {
      console.error("Error refreshing CRM data:", err);
      toast.error("Failed to load some CRM records.");
    } finally {
      setLoadingQuotes(false);
      setLoadingSubscribers(false);
      setLoadingCampaigns(false);
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    refreshAllData();
  }, []);

  // Filtered Quotes
  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => {
      const matchesSearch =
        !quoteSearch.trim() ||
        q.quoteNumber?.toLowerCase().includes(quoteSearch.toLowerCase()) ||
        q.customerName?.toLowerCase().includes(quoteSearch.toLowerCase()) ||
        q.companyName?.toLowerCase().includes(quoteSearch.toLowerCase()) ||
        q.email?.toLowerCase().includes(quoteSearch.toLowerCase()) ||
        q.items?.some((i) => i.productName.toLowerCase().includes(quoteSearch.toLowerCase()));

      const matchesStatus =
        quoteStatusFilter === "all" || q.status === quoteStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [quotes, quoteSearch, quoteStatusFilter]);

  // Filtered Subscribers
  const filteredSubscribers = useMemo(() => {
    return subscribers.filter((s) => {
      const matchesSearch =
        !subscriberSearch.trim() ||
        s.email.toLowerCase().includes(subscriberSearch.toLowerCase()) ||
        s.name?.toLowerCase().includes(subscriberSearch.toLowerCase());

      const matchesStatus =
        subscriberStatusFilter === "all" || s.status === subscriberStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [subscribers, subscriberSearch, subscriberStatusFilter]);

  // Active Subscribers Count
  const activeSubscribersCount = useMemo(() => {
    return subscribers.filter((s) => s.status === "active").length;
  }, [subscribers]);

  // Handle Quote Status Change
  const handleUpdateQuoteStatus = async (quoteId: string, newStatus: QuoteRequestStatus) => {
    try {
      const res = await updateQuoteStatusInDb(quoteId, { status: newStatus });
      if (res.success) {
        setQuotes((prev) =>
          prev.map((q) => (q.id === quoteId ? { ...q, status: newStatus } : q))
        );
        toast.success(`Quote status updated to "${newStatus}".`);
      } else {
        toast.error(res.error || "Failed to update status.");
      }
    } catch (e: any) {
      toast.error("Failed to update status.");
    }
  };

  // Handle Delete Quote Request
  const handleDeleteQuote = async (quoteId: string) => {
    if (!confirm("Are you sure you want to delete this quotation request?")) return;
    try {
      const res = await deleteQuoteRequestInDb(quoteId);
      if (res.success) {
        setQuotes((prev) => prev.filter((q) => q.id !== quoteId));
        toast.success("Quotation request removed.");
      } else {
        toast.error(res.error || "Failed to delete.");
      }
    } catch (e: any) {
      toast.error("Failed to delete quotation.");
    }
  };

  // Open Pricing Modal for a Quote
  const handleOpenPricingModal = (quote: QuoteRequest) => {
    setSelectedQuoteForPricing(quote);
    const initialItems = (quote.items || []).map((it) => ({
      productName: it.productName,
      quantity: it.quantity,
      unit: it.unit,
      unitPrice: it.targetPrice || 0,
      total: (it.quantity || 1) * (it.targetPrice || 0),
    }));
    setPricingItems(initialItems);
    setPricingFreightFee(quote.freightFee || 0);
    setPricingPaymentTerms(quote.paymentTerms || "100% advance payment prior to dispatch");
    setPricingValidityDays(quote.validityDays || 7);
    setPricingAdminNotes(quote.adminNotes || "");
  };

  const handlePriceItemChange = (index: number, unitPrice: number) => {
    setPricingItems((prev) => {
      const copy = [...prev];
      const item = copy[index];
      const price = Math.max(0, unitPrice);
      copy[index] = {
        ...item,
        unitPrice: price,
        total: item.quantity * price,
      };
      return copy;
    });
  };

  const quoteSubtotal = useMemo(() => {
    return pricingItems.reduce((acc, curr) => acc + (curr.total || 0), 0);
  }, [pricingItems]);

  const quoteGrandTotal = useMemo(() => {
    return quoteSubtotal + (Number(pricingFreightFee) || 0);
  }, [quoteSubtotal, pricingFreightFee]);

  // Dispatch Official Quotation Email to Client
  const handleSendOfficialQuotation = async () => {
    if (!selectedQuoteForPricing) return;

    if (pricingItems.some((i) => i.unitPrice <= 0)) {
      if (!confirm("Some items have a unit price of ₦0. Do you want to proceed?")) {
        return;
      }
    }

    setSendingQuotationEmail(true);

    try {
      const token = await auth.currentUser?.getIdToken();

      const quotationPayload = {
        quoteNumber: selectedQuoteForPricing.quoteNumber,
        customerName: selectedQuoteForPricing.customerName,
        companyName: selectedQuoteForPricing.companyName,
        recipientEmail: selectedQuoteForPricing.email,
        items: pricingItems.map((i) => ({
          name: `${i.productName} (${i.unit})`,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          total: i.total,
        })),
        freightFee: pricingFreightFee,
        grandTotal: quoteGrandTotal,
        paymentTerms: pricingPaymentTerms,
        validityDays: pricingValidityDays,
        adminNotes: pricingAdminNotes,
      };

      // 1. Try sending email through the backend API route with auth token
      let emailSuccess = false;
      try {
        const resp = await fetch("/api/admin/crm/send-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            action: "send_quote",
            ...quotationPayload,
          }),
        });

        if (resp.ok) {
          emailSuccess = true;
        } else {
          console.warn("Backend email dispatch returned non-200. Logging directly.");
        }
      } catch (networkErr) {
        console.warn("Network error reaching /api/admin/crm/send-email:", networkErr);
      }

      // 2. Update quote in Firestore with quotation details & 'quoted' status
      const validUntilDate = new Date();
      validUntilDate.setDate(validUntilDate.getDate() + pricingValidityDays);

      await updateQuoteStatusInDb(selectedQuoteForPricing.id, {
        status: "quoted",
        quotedAt: new Date().toISOString(),
        quotedBy: user?.email || "Admin",
        subtotal: quoteSubtotal,
        freightFee: pricingFreightFee,
        grandTotal: quoteGrandTotal,
        validUntil: validUntilDate.toISOString(),
        validityDays: pricingValidityDays,
        paymentTerms: pricingPaymentTerms,
        adminNotes: pricingAdminNotes,
        items: pricingItems.map((i) => ({
          productName: i.productName,
          quantity: i.quantity,
          unit: i.unit,
          quotedUnitPrice: i.unitPrice,
          quotedLineTotal: i.total,
        })),
      });

      // 3. Log in CRM Email Logs
      await logCrmEmailInDb({
        recipientEmail: selectedQuoteForPricing.email,
        recipientName: selectedQuoteForPricing.customerName,
        subject: `Official Quotation ${selectedQuoteForPricing.quoteNumber} - OSVID Chemicals`,
        type: "quote",
        status: "sent",
        sentBy: user?.email || "Admin",
        quoteNumber: selectedQuoteForPricing.quoteNumber,
      });

      toast.success(
        `Quotation ${selectedQuoteForPricing.quoteNumber} saved and dispatched to ${selectedQuoteForPricing.email}!`
      );

      // Refresh list
      setQuotes((prev) =>
        prev.map((q) =>
          q.id === selectedQuoteForPricing.id
            ? {
                ...q,
                status: "quoted",
                subtotal: quoteSubtotal,
                freightFee: pricingFreightFee,
                grandTotal: quoteGrandTotal,
              }
            : q
        )
      );

      setSelectedQuoteForPricing(null);
      refreshAllData();
    } catch (err: any) {
      console.error("Quotation generation error:", err);
      toast.error(err?.message || "Failed to finalize and send quotation.");
    } finally {
      setSendingQuotationEmail(false);
    }
  };

  // Add Subscriber Manually
  const handleAddSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubEmail || !newSubEmail.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    try {
      const res = await saveNewsletterSubscriberInDb(newSubEmail, newSubName, "admin");
      if (res.success) {
        toast.success(`Subscriber ${newSubEmail} added successfully.`);
        setNewSubEmail("");
        setNewSubName("");
        setIsAddSubModalOpen(false);
        const fresh = await getNewsletterSubscribersFromDb();
        setSubscribers(fresh);
      } else {
        toast.error(res.error || "Failed to add subscriber.");
      }
    } catch (e: any) {
      toast.error("Failed to add subscriber.");
    }
  };

  // Toggle Subscriber Active / Unsubscribed
  const handleToggleSubStatus = async (subscriber: NewsletterSubscriber) => {
    const nextStatus: NewsletterSubscriberStatus =
      subscriber.status === "active" ? "unsubscribed" : "active";
    try {
      const res = await toggleSubscriberStatusInDb(subscriber.id, nextStatus);
      if (res.success) {
        setSubscribers((prev) =>
          prev.map((s) => (s.id === subscriber.id ? { ...s, status: nextStatus } : s))
        );
        toast.success(`Subscriber set to ${nextStatus}.`);
      } else {
        toast.error(res.error || "Failed to toggle status.");
      }
    } catch (e: any) {
      toast.error("Failed to update subscriber.");
    }
  };

  // Delete Subscriber
  const handleDeleteSubscriber = async (subscriberId: string) => {
    if (!confirm("Are you sure you want to remove this subscriber?")) return;
    try {
      const res = await deleteSubscriberFromDb(subscriberId);
      if (res.success) {
        setSubscribers((prev) => prev.filter((s) => s.id !== subscriberId));
        toast.success("Subscriber removed.");
      } else {
        toast.error(res.error || "Failed to delete.");
      }
    } catch (e: any) {
      toast.error("Failed to delete subscriber.");
    }
  };

  // Export Subscribers to CSV
  const handleExportCsv = () => {
    if (subscribers.length === 0) {
      toast.error("No subscribers to export.");
      return;
    }

    const headers = ["Email", "Name", "Status", "Source", "SubscribedAt"];
    const rows = subscribers.map((s) => [
      `"${s.email}"`,
      `"${s.name || ""}"`,
      `"${s.status}"`,
      `"${s.source || "footer"}"`,
      `"${s.subscribedAt || ""}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `osvid_subscribers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${subscribers.length} subscribers.`);
  };

  // Broadcast Template Quick Selector
  const applyBroadcastTemplate = (type: "restock" | "discount" | "notice") => {
    if (type === "restock") {
      setBroadcastSubject("Restocked: Industrial Resins, Pigments & Emulsifiers Now Available");
      setBroadcastContent(
        `<p>Dear Valued Client,</p>
<p>We are pleased to announce the arrival of fresh high-purity industrial chemical shipments at our Lagos and regional distribution warehouses.</p>
<p>Key restocked product lines available in drums (200L) and bulk IBC totes:</p>
<ul>
  <li>Industrial Grade Resins & Binder Polymers</li>
  <li>Surfactants & Emulsifier Concentrates</li>
  <li>Specialty Coating Additives & Thickening Agents</li>
</ul>
<p>Contact our commercial sales desk today to lock in your volume allocation before allocations fill up.</p>`
      );
      setBroadcastCtaText("View Available Inventory");
      setBroadcastCtaUrl("https://osvid.com.ng/shop");
    } else if (type === "discount") {
      setBroadcastSubject("Wholesale Bulletin: Exclusive Volume Discounts on Bulk Chemical Orders");
      setBroadcastContent(
        `<p>Dear Partner,</p>
<p>For this month only, OSVID Chemical Company is introducing tier-based wholesale rebates across all industrial solvent and formulation supplies.</p>
<p>Enjoy up to <strong>15% volume discounts</strong> on multi-drum orders, with negotiated express freight available to industrial estates across Nigeria.</p>
<p>Submit an RFQ or contact your designated account representative for a custom quotation.</p>`
      );
      setBroadcastCtaText("Request Wholesale RFQ");
      setBroadcastCtaUrl("https://osvid.com.ng/contact");
    } else if (type === "notice") {
      setBroadcastSubject("Operational Notice: Warehouse Delivery Schedule & Holiday Support");
      setBroadcastContent(
        `<p>Dear Manufacturing & Procurement Partners,</p>
<p>Please take note of our updated commercial logistics schedule for the upcoming period. Factory pickups and freight dispatches will operate normally Monday through Saturday.</p>
<p>To avoid supply interruptions, we advise placing restock orders at least 72 hours prior to scheduled production runs.</p>
<p>Thank you for choosing OSVID as your formulation partner.</p>`
      );
      setBroadcastCtaText("Contact Support Desk");
      setBroadcastCtaUrl("https://osvid.com.ng/contact");
    }
  };

  // Send Broadcast Newsletter
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastSubject.trim() || !broadcastContent.trim()) {
      toast.error("Subject and content are required.");
      return;
    }

    const activeSubs = subscribers.filter((s) => s.status === "active");
    if (activeSubs.length === 0) {
      toast.error("No active subscribers found in database.");
      return;
    }

    if (!confirm(`Are you sure you want to broadcast this newsletter to ${activeSubs.length} active subscribers?`)) {
      return;
    }

    setSendingBroadcast(true);

    try {
      const token = await auth.currentUser?.getIdToken();

      // Dispatch via backend API
      try {
        await fetch("/api/admin/crm/send-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            action: "send_broadcast",
            subject: broadcastSubject,
            contentHtml: broadcastContent,
            ctaText: broadcastCtaText,
            ctaUrl: broadcastCtaUrl,
            recipientEmails: activeSubs.map((s) => s.email),
          }),
        });
      } catch (err) {
        console.warn("Backend API dispatch warning:", err);
      }

      // Record campaign in Firestore
      const campaignId = `camp_${Date.now()}`;
      await saveCrmCampaignInDb({
        id: campaignId,
        subject: broadcastSubject,
        content: broadcastContent,
        sentAt: new Date().toISOString(),
        recipientsCount: activeSubs.length,
        status: "sent",
        sentBy: user?.email || "Admin",
      });

      // Log in email audit logs
      await logCrmEmailInDb({
        recipientEmail: `[Broadcast] ${activeSubs.length} Subscribers`,
        subject: broadcastSubject,
        type: "newsletter",
        status: "sent",
        sentBy: user?.email || "Admin",
      });

      toast.success(`Newsletter broadcast dispatched to ${activeSubs.length} subscribers!`);
      setBroadcastSubject("");
      setBroadcastContent("");
      refreshAllData();
    } catch (err: any) {
      console.error("Broadcast error:", err);
      toast.error("Failed to dispatch newsletter broadcast.");
    } finally {
      setSendingBroadcast(false);
    }
  };

  // Send Direct Email to a Customer
  const handleSendDirectEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directRecipientEmail || !directRecipientEmail.includes("@")) {
      toast.error("A valid recipient email is required.");
      return;
    }
    if (!directSubject.trim() || !directMessage.trim()) {
      toast.error("Subject and message are required.");
      return;
    }

    setSendingDirect(true);
    try {
      const token = await auth.currentUser?.getIdToken();

      try {
        await fetch("/api/admin/crm/send-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            action: "send_direct",
            recipientEmail: directRecipientEmail.trim().toLowerCase(),
            recipientName: directRecipientName.trim() || undefined,
            subject: directSubject.trim(),
            contentHtml: `<p>${directMessage.replace(/\n/g, "<br/>")}</p>`,
          }),
        });
      } catch (err) {
        console.warn("API route warning:", err);
      }

      // Record email log in Firestore
      await logCrmEmailInDb({
        recipientEmail: directRecipientEmail.trim().toLowerCase(),
        recipientName: directRecipientName.trim() || undefined,
        subject: directSubject.trim(),
        type: "direct",
        status: "sent",
        sentBy: user?.email || "Admin",
      });

      toast.success(`Email dispatched to ${directRecipientEmail}!`);
      setDirectRecipientEmail("");
      setDirectRecipientName("");
      setDirectSubject("");
      setDirectMessage("");
      refreshAllData();
    } catch (err: any) {
      console.error("Direct email error:", err);
      toast.error("Failed to send message.");
    } finally {
      setSendingDirect(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Banner / CRM Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-700/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-orange-400 font-semibold text-xs tracking-wider uppercase mb-1">
              <Mail className="w-4 h-4" /> Commercial CRM & Inquiries Desk
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Customer Relations & Quotations Hub
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Process wholesale quotation requests (RFQs), publish newsletters to subscribers, and dispatch official communications directly to clients.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAllData}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh Data
            </Button>
          </div>
        </div>

        {/* KPI Ribbon */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-700/60">
          <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/50">
            <span className="text-xs text-slate-400 block font-medium">Pending RFQs</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-orange-400">
                {quotes.filter((q) => q.status === "new" || q.status === "in_review").length}
              </span>
              <span className="text-xs text-slate-400">of {quotes.length} total</span>
            </div>
          </div>

          <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/50">
            <span className="text-xs text-slate-400 block font-medium">Active Subscribers</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-emerald-400">{activeSubscribersCount}</span>
              <span className="text-xs text-slate-400">of {subscribers.length} total</span>
            </div>
          </div>

          <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/50">
            <span className="text-xs text-slate-400 block font-medium">Newsletter Campaigns</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-blue-400">{campaigns.length}</span>
              <span className="text-xs text-slate-400">broadcasts</span>
            </div>
          </div>

          <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/50">
            <span className="text-xs text-slate-400 block font-medium">Communications Logged</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-purple-400">{emailLogs.length}</span>
              <span className="text-xs text-slate-400">records</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("quotes")}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === "quotes"
              ? "border-orange-500 text-orange-600 bg-orange-50/50 rounded-t-lg"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Quote Requests (RFQs)</span>
          <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {quotes.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("newsletter")}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === "newsletter"
              ? "border-orange-500 text-orange-600 bg-orange-50/50 rounded-t-lg"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Newsletter & Broadcasts</span>
          <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {subscribers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("emails")}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === "emails"
              ? "border-orange-500 text-orange-600 bg-orange-50/50 rounded-t-lg"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Direct Email & Audit Logs</span>
          <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {emailLogs.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: QUOTE REQUESTS (RFQS) */}
      {/* ========================================================================= */}
      {activeTab === "quotes" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={quoteSearch}
                  onChange={(e) => setQuoteSearch(e.target.value)}
                  placeholder="Search by quote #, client, company, or product..."
                  className="pl-9 rounded-xl border-slate-200 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <span className="text-xs font-semibold text-slate-500">Status:</span>
              {(["all", "new", "in_review", "quoted", "accepted", "declined"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setQuoteStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer shrink-0 ${
                    quoteStatusFilter === st
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {st.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Quotations List */}
          {loadingQuotes ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              <p className="text-sm">Loading quotation requests...</p>
            </div>
          ) : filteredQuotes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
              <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-800">No quotation requests found</h3>
              <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
                {quoteSearch || quoteStatusFilter !== "all"
                  ? "Try clearing filters to see other inquiries."
                  : "Wholesale quotation requests submitted by customers through the website will appear here for pricing and dispatch."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredQuotes.map((quote) => {
                const statusColors: Record<QuoteRequestStatus, string> = {
                  new: "bg-orange-100 text-orange-700 border-orange-200",
                  in_review: "bg-blue-100 text-blue-700 border-blue-200",
                  quoted: "bg-purple-100 text-purple-700 border-purple-200",
                  accepted: "bg-emerald-100 text-emerald-700 border-emerald-200",
                  declined: "bg-rose-100 text-rose-700 border-rose-200",
                };

                return (
                  <div
                    key={quote.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-slate-300 transition-all space-y-4"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-md text-sm border border-orange-200">
                          {quote.quoteNumber}
                        </span>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                            statusColors[quote.status]
                          }`}
                        >
                          {quote.status.replace("_", " ")}
                        </span>
                        {quote.urgency === "urgent" && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">
                            Urgent (48h)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{new Date(quote.createdAt).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Customer & Company Details */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-3.5 rounded-xl text-xs">
                      <div>
                        <span className="text-slate-400 block font-semibold mb-0.5">Contact Person</span>
                        <span className="font-bold text-slate-800 text-sm">{quote.customerName}</span>
                        {quote.companyName && (
                          <span className="block text-slate-600 mt-0.5">
                            <Building2 className="w-3 h-3 inline mr-1 text-slate-400" />
                            {quote.companyName}
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="text-slate-400 block font-semibold mb-0.5">Contact Coordinates</span>
                        <a
                          href={`mailto:${quote.email}`}
                          className="text-blue-600 hover:underline block font-medium"
                        >
                          {quote.email}
                        </a>
                        {quote.phone && (
                          <a
                            href={`tel:${quote.phone}`}
                            className="text-slate-700 hover:underline block mt-0.5"
                          >
                            <Phone className="w-3 h-3 inline mr-1 text-slate-400" />
                            {quote.phone}
                          </a>
                        )}
                      </div>

                      <div>
                        <span className="text-slate-400 block font-semibold mb-0.5">Delivery Destination</span>
                        <span className="text-slate-700 font-medium">
                          {quote.deliveryLocation || "Not specified / Ex-Works pickup"}
                        </span>
                        {quote.grandTotal ? (
                          <span className="block text-emerald-700 font-bold text-sm mt-1">
                            Quoted: ₦{quote.grandTotal.toLocaleString()}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Requested Items Table */}
                    <div>
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                        Requested Products & Volumes
                      </span>
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600">
                            <tr>
                              <th className="py-2 px-3 font-semibold">Product Description</th>
                              <th className="py-2 px-3 font-semibold">Requested Qty</th>
                              <th className="py-2 px-3 font-semibold">Packaging Unit</th>
                              <th className="py-2 px-3 font-semibold">Quoted Unit Price</th>
                              <th className="py-2 px-3 font-semibold text-right">Line Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {quote.items.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="py-2 px-3 font-medium text-slate-800">{item.productName}</td>
                                <td className="py-2 px-3 text-slate-700 font-semibold">{item.quantity}</td>
                                <td className="py-2 px-3 text-slate-600">{item.unit}</td>
                                <td className="py-2 px-3 text-slate-700">
                                  {item.quotedUnitPrice
                                    ? `₦${item.quotedUnitPrice.toLocaleString()}`
                                    : item.targetPrice
                                    ? `Target: ₦${item.targetPrice.toLocaleString()}`
                                    : "Pending pricing"}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-slate-800">
                                  {item.quotedLineTotal
                                    ? `₦${item.quotedLineTotal.toLocaleString()}`
                                    : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Additional Notes */}
                    {quote.additionalNotes && (
                      <div className="text-xs bg-amber-50/80 border border-amber-200/60 p-3 rounded-xl text-amber-900">
                        <span className="font-bold">Customer Notes: </span>
                        {quote.additionalNotes}
                      </div>
                    )}

                    {/* Actions Row */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-semibold">Set Status:</span>
                        <select
                          value={quote.status}
                          onChange={(e) =>
                            handleUpdateQuoteStatus(quote.id, e.target.value as QuoteRequestStatus)
                          }
                          className="h-8 text-xs rounded-lg border border-slate-200 bg-white px-2 font-medium text-slate-700 focus:outline-none"
                        >
                          <option value="new">New</option>
                          <option value="in_review">In Review</option>
                          <option value="quoted">Quoted</option>
                          <option value="accepted">Accepted</option>
                          <option value="declined">Declined</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        {quote.phone && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const cleanPhone = quote.phone?.replace(/[^0-9]/g, "");
                              window.open(
                                `https://wa.me/${cleanPhone}?text=Hello%20${encodeURIComponent(
                                  quote.customerName
                                )},%20regarding%20your%20OSVID%20quotation%20request%20${quote.quoteNumber}...`,
                                "_blank"
                              );
                            }}
                            className="h-8 text-xs border-emerald-600 text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5 mr-1" /> WhatsApp
                          </Button>
                        )}

                        <Button
                          size="sm"
                          onClick={() => handleOpenPricingModal(quote)}
                          className="h-8 text-xs bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg gap-1.5 cursor-pointer shadow-sm"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          {quote.status === "quoted" ? "Revise Quotation" : "Prepare & Send Quotation"}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteQuote(quote.id)}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: NEWSLETTER ORGANISATION */}
      {/* ========================================================================= */}
      {activeTab === "newsletter" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Audience & Subscribers List */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Newsletter Audience</h3>
                  <p className="text-xs text-slate-500">
                    Subscribers collected from website footer, checkout opt-ins, and RFQ forms.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCsv}
                    className="h-8 text-xs border-slate-200 text-slate-700 rounded-lg cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setIsAddSubModalOpen(true)}
                    className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white rounded-lg cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Subscriber
                  </Button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={subscriberSearch}
                    onChange={(e) => setSubscriberSearch(e.target.value)}
                    placeholder="Search by subscriber email..."
                    className="pl-9 h-9 text-xs rounded-lg"
                  />
                </div>
                <div className="flex items-center gap-1 w-full sm:w-auto">
                  {(["all", "active", "unsubscribed"] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setSubscriberStatusFilter(st)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                        subscriberStatusFilter === st
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subscribers Table */}
              {loadingSubscribers ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                  <span className="text-xs">Loading subscriber records...</span>
                </div>
              ) : filteredSubscribers.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No subscribers matching your filters.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[480px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">Subscriber Email</th>
                        <th className="py-2.5 px-3 font-semibold">Source</th>
                        <th className="py-2.5 px-3 font-semibold">Status</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSubscribers.map((sub) => (
                        <tr key={sub.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-800 block">{sub.email}</span>
                            {sub.name && <span className="text-slate-400 text-[11px]">{sub.name}</span>}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 capitalize">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 border border-slate-200">
                              {sub.source || "footer"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                sub.status === "active"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-slate-200 text-slate-600"
                              }`}
                            >
                              {sub.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleSubStatus(sub)}
                                className="h-7 text-[11px] px-2 text-slate-600 hover:text-slate-900 cursor-pointer"
                              >
                                {sub.status === "active" ? "Unsubscribe" : "Activate"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteSubscriber(sub.id)}
                                className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Broadcast Composer & History */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <div className="flex items-center gap-1.5 text-orange-600 font-bold text-xs uppercase tracking-wider mb-1">
                  <Send className="w-3.5 h-3.5" /> Newsletter Broadcast Composer
                </div>
                <h3 className="font-bold text-slate-900 text-base">Send Email to Audience</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Target: <strong className="text-emerald-600 font-bold">{activeSubscribersCount} active subscribers</strong>.
                </p>
              </div>

              {/* Pre-made Templates */}
              <div>
                <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                  Quick Fill Templates:
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyBroadcastTemplate("restock")}
                    className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md font-medium cursor-pointer"
                  >
                    📦 Restock & Arrivals
                  </button>
                  <button
                    type="button"
                    onClick={() => applyBroadcastTemplate("discount")}
                    className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md font-medium cursor-pointer"
                  >
                    🏷️ Wholesale Rebate
                  </button>
                  <button
                    type="button"
                    onClick={() => applyBroadcastTemplate("notice")}
                    className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md font-medium cursor-pointer"
                  >
                    🔔 Logistics Notice
                  </button>
                </div>
              </div>

              <form onSubmit={handleSendBroadcast} className="space-y-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Broadcast Subject Line *
                  </Label>
                  <Input
                    required
                    value={broadcastSubject}
                    onChange={(e) => setBroadcastSubject(e.target.value)}
                    placeholder="e.g. Fresh Industrial Resin Shipments Available"
                    className="text-xs rounded-xl"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                    HTML / Message Content *
                  </Label>
                  <Textarea
                    required
                    value={broadcastContent}
                    onChange={(e) => setBroadcastContent(e.target.value)}
                    placeholder="Compose announcement body (supports paragraphs <p>, bullet lists <ul><li>)..."
                    className="text-xs rounded-xl min-h-[140px] font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                      CTA Button Text
                    </Label>
                    <Input
                      value={broadcastCtaText}
                      onChange={(e) => setBroadcastCtaText(e.target.value)}
                      placeholder="e.g. Shop Now"
                      className="text-xs rounded-lg"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                      CTA Destination URL
                    </Label>
                    <Input
                      value={broadcastCtaUrl}
                      onChange={(e) => setBroadcastCtaUrl(e.target.value)}
                      placeholder="https://..."
                      className="text-xs rounded-lg"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={sendingBroadcast || activeSubscribersCount === 0}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs h-10 rounded-xl cursor-pointer shadow-md mt-2"
                >
                  {sendingBroadcast ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" /> Dispatching Broadcast...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 mr-2" /> Dispatch to {activeSubscribersCount} Subscribers
                    </>
                  )}
                </Button>
              </form>
            </div>

            {/* Campaign History */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                Recent Broadcasts
              </h4>
              {campaigns.length === 0 ? (
                <p className="text-xs text-slate-400">No campaigns dispatched yet.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {campaigns.map((camp) => (
                    <div
                      key={camp.id}
                      className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 text-xs flex items-center justify-between"
                    >
                      <div className="overflow-hidden pr-2">
                        <span className="font-semibold text-slate-800 truncate block">
                          {camp.subject}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {camp.sentAt ? new Date(camp.sentAt).toLocaleDateString() : "Draft"} · {camp.recipientsCount ?? camp.recipientCount ?? 0} recipients
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase shrink-0">
                        {camp.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DIRECT EMAIL & AUDIT LOGS */}
      {/* ========================================================================= */}
      {activeTab === "emails" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Direct Email Sender Form */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <div className="flex items-center gap-1.5 text-blue-600 font-bold text-xs uppercase tracking-wider mb-1">
                  <Mail className="w-3.5 h-3.5" /> Direct Communications
                </div>
                <h3 className="font-bold text-slate-900 text-base">Send Direct Client Email</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sends an official OSVID-branded email directly to a client, distributor, or procurement lead.
                </p>
              </div>

              <form onSubmit={handleSendDirectEmail} className="space-y-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Recipient Email Address *
                  </Label>
                  <Input
                    type="email"
                    required
                    value={directRecipientEmail}
                    onChange={(e) => setDirectRecipientEmail(e.target.value)}
                    placeholder="client@company.com"
                    className="text-xs rounded-xl"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Recipient Name (Optional)
                  </Label>
                  <Input
                    value={directRecipientName}
                    onChange={(e) => setDirectRecipientName(e.target.value)}
                    placeholder="Engr. Adebayo"
                    className="text-xs rounded-xl"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Subject Line *
                  </Label>
                  <Input
                    required
                    value={directSubject}
                    onChange={(e) => setDirectSubject(e.target.value)}
                    placeholder="Update regarding your chemical procurement inquiry"
                    className="text-xs rounded-xl"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Message Body *
                  </Label>
                  <Textarea
                    required
                    value={directMessage}
                    onChange={(e) => setDirectMessage(e.target.value)}
                    placeholder="Type your official message here..."
                    className="text-xs rounded-xl min-h-[140px]"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={sendingDirect}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs h-10 rounded-xl cursor-pointer shadow-md mt-2"
                >
                  {sendingDirect ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" /> Sending Message...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 mr-2" /> Send Message
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Communication Audit Trail</h3>
                  <p className="text-xs text-slate-500">
                    Real-time history of all dispatched quotations, newsletters, and direct emails.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refreshAllData}
                  className="h-8 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
                </Button>
              </div>

              {loadingLogs ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                  <span className="text-xs">Loading audit logs...</span>
                </div>
              ) : emailLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No communications recorded yet.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[500px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">Recipient</th>
                        <th className="py-2.5 px-3 font-semibold">Subject & Type</th>
                        <th className="py-2.5 px-3 font-semibold">Timestamp</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {emailLogs.map((log) => {
                        const typeBadges: Record<string, string> = {
                          quote: "bg-purple-100 text-purple-700",
                          newsletter: "bg-orange-100 text-orange-700",
                          direct: "bg-blue-100 text-blue-700",
                        };

                        return (
                          <tr key={log.id} className="hover:bg-slate-50/60">
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-slate-800 block truncate max-w-[160px]">
                                {log.recipientEmail}
                              </span>
                              {log.recipientName && (
                                <span className="text-[11px] text-slate-400">{log.recipientName}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                    (log.type && typeBadges[log.type]) || "bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  {log.type || "email"}
                                </span>
                                <span className="text-slate-700 font-medium truncate max-w-[200px]">
                                  {log.subject}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                              {new Date(log.sentAt).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  log.status === "sent" || log.status === "delivered"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-red-100 text-red-700"
                                }`}
                              >
                                {log.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: PREPARE & SEND FORMAL QUOTATION */}
      {/* ========================================================================= */}
      {selectedQuoteForPricing && (
        <Dialog open={true} onOpenChange={(open) => !open && setSelectedQuoteForPricing(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl p-6 border border-slate-200 shadow-2xl">
            <DialogHeader className="mb-4">
              <div className="flex items-center gap-2 text-orange-600 font-bold text-xs uppercase tracking-wider">
                <FileSpreadsheet className="w-4 h-4" /> B2B Quotation Generator
              </div>
              <DialogTitle className="text-xl font-bold text-slate-900">
                Official Quotation: {selectedQuoteForPricing.quoteNumber}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Client: <strong className="text-slate-800">{selectedQuoteForPricing.customerName}</strong>
                {selectedQuoteForPricing.companyName ? ` (${selectedQuoteForPricing.companyName})` : ""} · {selectedQuoteForPricing.email}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Product Pricing Matrix */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">
                  Itemized Product Pricing
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="py-2 px-3">Product</th>
                      <th className="py-2 px-3">Unit</th>
                      <th className="py-2 px-3">Quantity</th>
                      <th className="py-2 px-3">Unit Price (₦)</th>
                      <th className="py-2 px-3 text-right">Line Total (₦)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pricingItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{item.productName}</td>
                        <td className="py-2.5 px-3 text-slate-600">{item.unit}</td>
                        <td className="py-2.5 px-3 text-slate-700 font-bold">{item.quantity}</td>
                        <td className="py-2.5 px-3">
                          <Input
                            type="number"
                            min="0"
                            value={item.unitPrice || ""}
                            onChange={(e) => handlePriceItemChange(idx, Number(e.target.value) || 0)}
                            placeholder="Unit Price"
                            className="h-8 w-28 text-xs font-mono font-bold"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          ₦{item.total.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Freight, Logistics & Payment Terms */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Freight & Haulage Fee (₦)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    value={pricingFreightFee || ""}
                    onChange={(e) => setPricingFreightFee(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="h-9 text-xs font-mono"
                  />
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    Destination: {selectedQuoteForPricing.deliveryLocation || "Ex-Works / Local"}
                  </span>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Quotation Validity
                  </Label>
                  <select
                    value={pricingValidityDays}
                    onChange={(e) => setPricingValidityDays(Number(e.target.value) || 7)}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700"
                  >
                    <option value={3}>3 Days (Fast expiring)</option>
                    <option value={7}>7 Days (Standard)</option>
                    <option value={14}>14 Days (Two weeks)</option>
                    <option value={30}>30 Days (One month)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Payment Terms
                  </Label>
                  <Input
                    value={pricingPaymentTerms}
                    onChange={(e) => setPricingPaymentTerms(e.target.value)}
                    placeholder="e.g. 100% advance payment or 70% advance, 30% on dispatch"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Technical Specifications or Commercial Notes
                  </Label>
                  <Textarea
                    value={pricingAdminNotes}
                    onChange={(e) => setPricingAdminNotes(e.target.value)}
                    placeholder="Any specific batch, purity, packaging drums, or delivery details..."
                    className="text-xs rounded-xl min-h-[60px]"
                  />
                </div>
              </div>

              {/* Total Summary Breakdown */}
              <div className="bg-slate-900 text-white p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block">Subtotal: ₦{quoteSubtotal.toLocaleString()}</span>
                  <span className="text-xs text-slate-400 block">Freight: ₦{pricingFreightFee.toLocaleString()}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs uppercase text-orange-400 tracking-wider font-semibold block">
                    Total Quotation Value
                  </span>
                  <span className="text-2xl font-mono font-bold text-white">
                    ₦{quoteGrandTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedQuoteForPricing(null)}
                  disabled={sendingQuotationEmail}
                  className="rounded-xl text-xs h-10 px-5 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSendOfficialQuotation}
                  disabled={sendingQuotationEmail}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl text-xs h-10 px-6 gap-2 cursor-pointer shadow-md"
                >
                  {sendingQuotationEmail ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Dispatching Quotation...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" /> Dispatch Quotation to Client
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADD SUBSCRIBER MANUALLY */}
      {/* ========================================================================= */}
      {isAddSubModalOpen && (
        <Dialog open={true} onOpenChange={(open) => !open && setIsAddSubModalOpen(false)}>
          <DialogContent className="max-w-md bg-white rounded-2xl p-6 border border-slate-200 shadow-xl">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-lg font-bold text-slate-900">
                Add Newsletter Subscriber
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Manually register a customer or partner email into the newsletter audience.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleAddSubscriber} className="space-y-4">
              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Email Address *
                </Label>
                <Input
                  type="email"
                  required
                  value={newSubEmail}
                  onChange={(e) => setNewSubEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="text-xs rounded-xl"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Contact / Company Name (Optional)
                </Label>
                <Input
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  placeholder="e.g. Dangote Paints Ltd"
                  className="text-xs rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddSubModalOpen(false)}
                  className="text-xs rounded-xl h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs rounded-xl h-9 px-4 font-semibold"
                >
                  Add Subscriber
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
