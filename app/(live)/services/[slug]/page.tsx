// app/services/[slug]/page.tsx.
import { getServices } from "@/wix-api/services";
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
// You might need to import 'clsx' or 'cva' for conditional class names if not already globally available
// import clsx from 'clsx'; // If you use it for active link styling

// Type definition for service (ensure it matches your actual Service type)
interface Service {
  _id: string;
  title: string;
  slug: string;
  description: string;
  image?: string;
  createdAt?: string;
}

// Generate dynamic metadata for each service page
export async function generateMetadata({
  params,
}: ServiceDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const services: Service[] = await getServices();
  const service = services.find((s) => s.slug === slug);

  if (!service) {
    return {
      title: "Service Not Found",
      description: "The requested service could not be found.",
    };
  }

  return {
    title: `${service.title} | OSVID CHEMICALS LTD.`,
    description: service.description
      ? service.description.substring(0, 160).replace(/<[^>]*>?/gm, "") + "..."
      : `Learn more about ${service.title} services provided by OSVID CHEMICALS LTD.`,
    openGraph: {
      images: service.image ? [service.image] : [],
    },
  };
}

type ServiceDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ServiceDetailPage({
  params,
}: ServiceDetailPageProps) {
  const { slug } = await params;

  // Fetch all services for the sidebar and the current service
  const allServices: Service[] = await getServices();
  const service = allServices.find((s) => s.slug === slug);

  if (!service) return notFound();

  // Determine previous and next service for navigation
  const currentIndex = allServices.findIndex((s) => s.slug === slug);
  const prevService = currentIndex > 0 ? allServices[currentIndex - 1] : null;
  const nextService =
    currentIndex < allServices.length - 1
      ? allServices[currentIndex + 1]
      : null;

  // Filter out the current service for "More Services" section
  const otherServices = allServices.filter((s) => s.slug !== slug);
  const relatedServices = otherServices.slice(0, 3); // Display up to 3 other services

  // Fallback image if service.image is not provided
  const heroImageUrl = service.image || "/images/bgs/default-service-hero.jpg"; // Path to a default hero image

  return (
    <main className="min-h-screen">
      <div className="container py-8 md:py-12 px-4 md:px-14 flex flex-col md:flex-row gap-12">
        {/* Left Sidebar */}
        <aside className="w-full md:w-80 lg:w-96 p-6 bg-gray-50 border-b h-max md:border-b-0 md:border-r border-gray-200 flex-shrink-0">
          <nav className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Our Services
            </h2>
            <ul className="space-y-2">
              {allServices.map((sidebarService) => (
                <li key={sidebarService._id}>
                  <Link
                    href={`/services/${sidebarService.slug}`}
                    // Add conditional styling for the active link if you use a client component for navigation
                    className={`block p-3 rounded-lg font-medium transition-colors duration-200
                              ${
                                sidebarService.slug === slug
                                  ? "bg-osvid-orange text-white"
                                  : "text-gray-700 hover:bg-osvid-orange hover:text-white"
                              }`}
                  >
                    {sidebarService.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact Section */}
          <div className="bg-white p-6 rounded-lg shadow-md hidden md:block ">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Contact Us</h3>
            <div className="flex items-center gap-3 mb-2">
              <FaPhoneAlt className="text-osvid-orange text-lg" />
              <a
                href={`tel:${companyData.phone}`}
                className="text-gray-700 hover:text-osvid-orange transition-colors duration-200"
              >
                {companyData.phone}
              </a>
            </div>
            <div className="flex items-center gap-3 mb-2">
              <FaEnvelope className="text-osvid-orange text-lg" />
              <a
                href={`mailto:${companyData.email}`}
                className="text-gray-700 hover:text-osvid-orange transition-colors duration-200"
              >
                {companyData.email}
              </a>
            </div>
            {companyData.socialMedia?.instagram && (
              <div className="flex items-center gap-3">
                <FaInstagram className="text-osvid-orange text-lg" />
                <a
                  href={`https://instagram.com/${companyData.socialMedia.instagram.replace(
                    "@",
                    ""
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-700 hover:text-osvid-orange transition-colors duration-200"
                >
                  {companyData.socialMedia.instagram}
                </a>
              </div>
            )}
            <p className="text-gray-600 text-sm mt-4">
              Get in touch for expert advice and solutions.
            </p>
          </div>
        </aside>
        {/* Main Content Area - This will contain all your existing service page content */}
        <div className="flex-1 overflow-x-hidden">
          {/* Hero Section - Image with Overlay and Title */}
          <section className="relative h-96 md:h-[60vh] flex items-center justify-center overflow-hidden">
            <Image
              src={heroImageUrl}
              alt={service.title || "Service background image"}
              fill
              sizes="100vw"
              priority
              className="object-cover w-full h-full"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent via-black/40" />

            <div className="relative z-10 text-center px-4 md:px-12 max-w-4xl">
              <h1 className="text-4xl md:text-6xl font-extrabold text-white leading-tight drop-shadow-lg">
                {service.title}
              </h1>
            </div>
          </section>

          {/* Main Content Section */}
          <section className="container max-w-5xl mx-auto px-4 md:px-12 py-16 space-y-12">
            {/* Service Description Article */}
            <article className="prose prose-lg mx-auto max-w-none text-gray-700">
              <div dangerouslySetInnerHTML={{ __html: service.description }} />
            </article>

            {/* Expertise / Partnership Callout Section */}
            <section className="bg-orange-50 p-8 md:p-12 rounded-xl shadow-lg space-y-6">
              <h2 className="text-2xl md:text-3xl font-bold text-osvid-orange">
                Partner with OSVID CHEMICALS LTD. Today!
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Whether you need expert surface finishing, reliable bulk
                chemical supply, or technical guidance — OSVID CHEMICALS LTD. is
                ready to serve you with quality, commitment, and innovation.
              </p>
              <ul className="list-disc list-inside text-gray-800 space-y-2 pl-2 text-lg">
                <li>Quality Without Compromise</li>
                <li>Commitment to Excellence</li>
                <li>Innovation-Driven Solutions</li>
                <li>Expert Technical Consultation and Support</li>
                <li>Professional Workmanship & Top-Tier Finishing</li>
              </ul>

              <div className="flex flex-wrap gap-6 pt-4">
                <div className="flex items-center gap-3">
                  <FaPhoneAlt className="text-osvid-orange text-xl" />
                  <a
                    href={`tel:${companyData.phone}`}
                    className="text-gray-700 hover:text-osvid-orange transition-colors duration-200"
                  >
                    {companyData.phone}
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <FaEnvelope className="text-osvid-orange text-xl" />
                  <a
                    href={`mailto:${companyData.email}`}
                    className="text-gray-700 hover:text-osvid-orange transition-colors duration-200"
                  >
                    {companyData.email}
                  </a>
                </div>
                {companyData.socialMedia?.instagram && (
                  <div className="flex items-center gap-3">
                    <FaInstagram className="text-osvid-orange text-xl" />
                    <a
                      href={`https://instagram.com/${companyData.socialMedia.instagram.replace(
                        "@",
                        ""
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-700 hover:text-osvid-orange transition-colors duration-200"
                    >
                      {companyData.socialMedia.instagram}
                    </a>
                  </div>
                )}
              </div>
            </section>

            {/* Next/Previous Service Navigation */}
            <section className="flex justify-between items-center py-8 border-t border-b border-gray-200">
              {prevService ? (
                <Link
                  href={`/services/${prevService.slug}`}
                  className="group flex items-center gap-2 text-osvid-orange hover:text-orange-700 transition-colors duration-200 font-semibold"
                >
                  <FaArrowLeft className="text-lg group-hover:-translate-x-1 transition-transform" />
                  {prevService.title}
                </Link>
              ) : (
                <div className="opacity-50 text-gray-500 flex items-center gap-2">
                  <FaArrowLeft className="text-lg" />
                  No Previous Service
                </div>
              )}

              {nextService ? (
                <Link
                  href={`/services/${nextService.slug}`}
                  className="group flex items-center gap-2 text-osvid-orange hover:text-orange-700 transition-colors duration-200 font-semibold ml-auto"
                >
                  {/* ml-auto pushes to right */}
                  {nextService.title}
                  <FaArrowRight className="text-lg group-hover:translate-x-1 transition-transform" />
                </Link>
              ) : (
                <div className="opacity-50 text-gray-500 flex items-center gap-2 ml-auto">
                  No Next Service
                  <FaArrowRight className="text-lg" />
                </div>
              )}
            </section>
          </section>
        </div>
      </div>

      {/* More Services Section */}
      {relatedServices.length > 0 && (
        <section className="py-12 container">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-800 mb-10">
            Explore More Services
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {relatedServices.map((relatedService, index) => (
              <ServiceCategoryCard
                key={relatedService._id}
                index={index + 1} // Use a more stable ID if possible, but for related it's fine
                service={relatedService}
              />
            ))}
          </div>
          {/* Optional: Button to view all services if not all are displayed */}
          {otherServices.length > relatedServices.length && (
            <div className="text-center mt-12">
              <Link
                href="/services"
                className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium rounded-full text-white bg-osvid-orange hover:bg-orange-700 transition-colors shadow-lg"
              >
                View All Services &rarr;
              </Link>
            </div>
          )}
        </section>
      )}
      {/* Reusable CTA Section */}
      <CTASection
        heading="Ready for Your Next Project?"
        subheading="Need a reliable surface expert or chemical supplier? Trust OSVID CHEMICALS LTD. — where quality meets craftsmanship."
      />
    </main>
  );
}
