import { getServices, getServiceBySlug } from "@/lib/server/storefront";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import {
  FaPhoneAlt,
  FaEnvelope,
  FaInstagram,
  FaArrowLeft,
  FaArrowRight,
} from "react-icons/fa";
import companyData from "@/data/company";
import ServiceCategoryCard from "@/components/reusables/cards/ServiceCategoryCard";
import CTASection from "@/components/reusables/sections/cta";
import { Service } from "@/types";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ServiceDetailPageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 3600; // 1-hour ISR for chemical services

export async function generateStaticParams() {
  try {
    const result = await getServices();
    if (!result.success || !result.data) return [];
    return result.data.map((service) => ({ slug: service.slug || service._id }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: ServiceDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getServiceBySlug(slug);

  if (!result.success || !result.data) {
    return {
      title: "Service Not Found | OSVID CHEMICALS LTD.",
      description: "Industrial chemical and surface engineering solutions.",
    };
  }

  const service = result.data;

  return {
    title: `${service.title} | OSVID CHEMICALS LTD. Services`,
    description: service.description
      ? service.description.substring(0, 160).replace(/<[^>]*>?/gm, "") + "..."
      : `Learn more about ${service.title} specialized chemical application services.`,
    openGraph: {
      images: service.image ? [service.image] : [],
    },
  };
}

export default async function ServiceDetailPage({
  params,
}: ServiceDetailPageProps) {
  const { slug } = await params;

  // Fetch all services for sidebar navigation
  const allServicesRes = await getServices();
  const allServices: Service[] = allServicesRes.success ? allServicesRes.data : [];

  // Fetch current service details
  const serviceRes = await getServiceBySlug(slug);

  if (!serviceRes.success || !serviceRes.data) {
    const matched = allServices.find((s) => s.slug === slug);
    if (!matched) return notFound();
  }

  const service = serviceRes.data || allServices.find((s) => s.slug === slug)!;

  // Determine previous and next service for navigation
  const currentIndex = allServices.findIndex((s) => s.slug === slug);
  const prevService = currentIndex > 0 ? allServices[currentIndex - 1] : null;
  const nextService =
    currentIndex >= 0 && currentIndex < allServices.length - 1
      ? allServices[currentIndex + 1]
      : null;

  const otherServices = allServices.filter((s) => s.slug !== slug);
  const relatedServices = otherServices.slice(0, 3);

  const heroImageUrl = service.image || "/images/bgs/default-service-hero.jpg";

  return (
    <main className="min-h-screen bg-slate-50/50">
      <div className="container mx-auto py-8 md:py-12 px-4 md:px-14 flex flex-col md:flex-row gap-12">
        {/* Left Sidebar */}
        <aside className="w-full md:w-80 lg:w-96 p-6 bg-white rounded-3xl border border-slate-200 shadow-sm h-max flex-shrink-0">
          <nav className="mb-8">
            <h2 className="text-xs font-black text-orange-600 uppercase tracking-wider mb-4">
              Our Services
            </h2>
            <ul className="space-y-1.5">
              {allServices.map((sidebarService) => (
                <li key={sidebarService._id}>
                  <Link
                    href={`/services/${sidebarService.slug}`}
                    className={`block px-4 py-3 rounded-2xl font-bold text-sm transition-all duration-200 ${
                      sidebarService.slug === slug
                        ? "bg-orange-600 text-white shadow-md shadow-orange-600/20"
                        : "text-slate-700 hover:bg-orange-50 hover:text-orange-700"
                    }`}
                  >
                    {sidebarService.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact Support Box */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 hidden md:block">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              Request Technical Consultation
            </h3>
            <div className="flex items-center gap-3 mb-2 text-xs">
              <FaPhoneAlt className="text-orange-600" />
              <a
                href={`tel:${companyData.phone}`}
                className="text-slate-700 hover:text-orange-600 transition-colors font-medium"
              >
                {companyData.phone}
              </a>
            </div>
            <div className="flex items-center gap-3 mb-2 text-xs">
              <FaEnvelope className="text-orange-600" />
              <a
                href={`mailto:${companyData.email}`}
                className="text-slate-700 hover:text-orange-600 transition-colors font-medium truncate"
              >
                {companyData.email}
              </a>
            </div>
            <p className="text-slate-500 text-[11px] mt-3">
              Our certified chemical technicians provide on-site inspection and quote evaluations.
            </p>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 overflow-x-hidden space-y-10">
          {/* Hero Banner */}
          <section className="relative h-72 md:h-96 rounded-3xl overflow-hidden flex items-center justify-center shadow-md">
            <Image
              src={heroImageUrl}
              alt={service.title}
              fill
              sizes="(max-width: 768px) 100vw, 70vw"
              priority
              className="object-cover w-full h-full"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/30" />

            <div className="relative z-10 text-center px-4 md:px-12 max-w-2xl">
              <span className="inline-block px-3 py-1 rounded-full bg-orange-600/90 text-white text-xs font-bold uppercase tracking-wider mb-2">
                Technical Service
              </span>
              <h1 className="text-3xl md:text-5xl font-black text-white drop-shadow-md">
                {service.title}
              </h1>
            </div>
          </section>

          {/* Description Section */}
          <section className="bg-white p-6 sm:p-10 rounded-3xl border border-slate-200 shadow-sm space-y-8">
            <article className="prose prose-slate max-w-none leading-relaxed text-slate-700 text-sm sm:text-base">
              <div dangerouslySetInnerHTML={{ __html: service.description }} />
            </article>

            {/* Partnership Callout */}
            <div className="bg-orange-50/80 border border-orange-200/80 p-6 sm:p-8 rounded-2xl space-y-4">
              <h2 className="text-xl font-bold text-orange-950">
                Quality Assurance & Delivery Standards
              </h2>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                Every technical application executed by OSVID CHEMICALS LTD. adheres to strict ASTM chemical formulation guidelines, surface preparation standards, and humidity-controlled curing schedules.
              </p>
              <ul className="list-disc list-inside text-xs sm:text-sm text-slate-700 space-y-1.5 pl-1 font-medium">
                <li>Factory-grade pure epoxy and chemical resins</li>
                <li>Certified technical application engineers</li>
                <li>Durability and adhesion warranty on all completed projects</li>
                <li>Fast turnaround with minimal operational downtime</li>
              </ul>
            </div>

            {/* Navigation Stepper */}
            <div className="flex justify-between items-center pt-6 border-t border-slate-200 text-xs font-bold">
              {prevService ? (
                <Link
                  href={`/services/${prevService.slug}`}
                  className="group flex items-center gap-2 text-orange-600 hover:text-orange-700"
                >
                  <FaArrowLeft className="text-sm group-hover:-translate-x-1 transition-transform" />
                  <span>{prevService.title}</span>
                </Link>
              ) : (
                <div />
              )}

              {nextService && (
                <Link
                  href={`/services/${nextService.slug}`}
                  className="group flex items-center gap-2 text-orange-600 hover:text-orange-700 ml-auto"
                >
                  <span>{nextService.title}</span>
                  <FaArrowRight className="text-sm group-hover:translate-x-1 transition-transform" />
                </Link>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Related Services */}
      {relatedServices.length > 0 && (
        <section className="py-12 container mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mb-8">
            <h2 className="text-2xl font-black text-slate-900">
              Other Industrial Services
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Explore our complementary surface treatments and chemical manufacturing capabilities.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {relatedServices.map((relatedService, index) => (
              <ServiceCategoryCard
                key={relatedService._id}
                index={index + 1}
                service={relatedService}
              />
            ))}
          </div>
        </section>
      )}

      <CTASection
        heading="Ready for Your Chemical Application Project?"
        subheading="Consult with our senior technical chemical engineers today for tailored specifications and quotes."
      />
    </main>
  );
}
