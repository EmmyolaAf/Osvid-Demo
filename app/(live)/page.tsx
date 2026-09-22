import dynamic from "next/dynamic";

import HeroSection from "@/components/reusables/sections/hero-section";

const FoundationSection = dynamic(
  () => import("@/components/reusables/sections/foundation-section")
);
const FeaturedProducts = dynamic(
  () => import("@/components/reusables/sections/featured-products")
);
const ServicesOneSection = dynamic(
  () => import("@/components/reusables/sections/featured-services")
);

import { Suspense } from "react";
import { Loader } from "@/components/reusables/loader";
import WhyChooseOsvid from "@/components/reusables/sections/why-choose-us";
import { getServices } from "@/wix-api/services";
import { getTestimonials } from "@/wix-api/testimonials";
import CTASection from "@/components/reusables/sections/cta";
import TestimonialsSection from "@/components/reusables/sections/TestimonialsSection";
import BlogSection from "@/components/reusables/sections/BlogSection.server";

export default async function Home() {
  const services = await getServices();
  const testimonials = await getTestimonials();

  return (
    <main>
      {/* Hero Section */}
      <HeroSection />
      <FoundationSection />
      <WhyChooseOsvid />
      <Suspense fallback={<Loader />}>
        <FeaturedProducts />
      </Suspense>
      {/* Services */}
      <section
        style={{ backgroundImage: "url('/images/bbb.jpg')" }}
        className="min-h-[calc(100vh-6rem)] text-white bg-gray-950 bg-blend-overlay bg-fixed"
      >
        <div className="container py-12 md:py-20 mx-auto flex flex-col justify-center items-center gap-6 md:gap-12">
          <div className="text-center flex flex-col gap-8  max-w-5xl">
            <h2 className="text-lg text-orange-500 font-semibold uppercase mx-auto w-max border-y py-2 border-orange-600">
              OUR SERVICES
            </h2>
            <h2 className="text-4xl font-bold md:text-6xl">
              We don&apos;t just sell it — we make it happen.
            </h2>
          </div>

          <Suspense fallback={<Loader />}>
            <ServicesOneSection services={services} />
          </Suspense>
        </div>
      </section>

      <TestimonialsSection testimonials={testimonials} />

      <CTASection />

      <BlogSection />
    </main>
  );
}
