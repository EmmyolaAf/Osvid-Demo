"use client";

import { useState, useRef, useEffect } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, EffectFade } from "swiper/modules";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Phone } from "lucide-react";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/effect-fade";
import Link from "next/link";
import { formatUniversalPhoneNumber } from "@/helpers/formatPhoneNumber";
import companyData from "@/data/company";

export default function HeroSection() {
  const [, setActiveIndex] = useState(0);
  const [currentRealIndex, setCurrentRealIndex] = useState(0);
  const [contentIsVisible, setContentIsVisible] = useState(true);
  const isAnimatingRef = useRef(false);

  const slides = [
    {
      image: "/images/bgs/new-hero-2.webp",
      heading: "Premium Surface Solutions for Modern Projects",
      tagline: "Expert Chemical & Surface Applications",
      caption:
        "Transform your spaces with industry-leading materials and professional installation that stands the test of time.",
      ctaText: "Get a Free Consultation",
      ctaLink: "/contact",
    },
    {
      image: "/images/bgs/new-hero.webp",
      heading: "Engineered for Durability, Designed for Beauty",
      tagline: "Commercial & Residential Excellence",
      caption:
        "From polished concrete to decorative Increte floors, our solutions combine aesthetics with unmatched performance.",
      ctaText: "See Our Portfolio",
      ctaLink: "/portfolio",
    },
    {
      image: "/images/ceramic-flooring.jpg",
      heading: "Innovation in Every Surface We Touch",
      tagline: "25+ Years of Industry Leadership",
      caption:
        "Join the thousands of satisfied clients who trust OSVID for their most demanding surface application projects.",
      ctaText: "Discover Our Process",
      ctaLink: "/about",
    },
  ];

  // Animation timing constants
  const SWIPER_FADE_SPEED = 1200;
  const CONTENT_EXIT_DURATION = 400;
  const CONTENT_ENTRANCE_DELAY = 300;
  const CONTENT_ANIMATION_DURATION = 800;
  const AUTOPLAY_DELAY = 8000;

  // Animation variants
  const textVariants = {
    initial: { opacity: 0, y: 40 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: CONTENT_ANIMATION_DURATION / 1000,
        ease: [0.16, 0.77, 0.47, 0.97] as const, // Custom easing for a more dynamic feel
      },
    },
    exit: {
      opacity: 0,
      y: -20,
      transition: {
        duration: CONTENT_EXIT_DURATION / 1000,
        ease: "easeOut" as const,
      },
    },
  };

  const overlayVariants = {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: { duration: SWIPER_FADE_SPEED / 1000, ease: "easeOut" as const },
    },
    exit: {
      opacity: 0,
      transition: { duration: SWIPER_FADE_SPEED / 1000, ease: "easeIn" as const },
    },
  };

  const handleSlideChange = (swiper: { realIndex: number }) => {
    setActiveIndex(swiper.realIndex);
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;

    setContentIsVisible(false);

    setTimeout(() => {
      setCurrentRealIndex(swiper.realIndex);
      setContentIsVisible(true);

      setTimeout(() => {
        isAnimatingRef.current = false;
      }, Math.max(SWIPER_FADE_SPEED, CONTENT_ANIMATION_DURATION));
    }, CONTENT_EXIT_DURATION);
  };

  const [showPhoneNumber, setShowPhoneNumber] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShowPhoneNumber(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="relative w-full h-screen md:h-[90vh] overflow-hidden">
      {/* Floating Phone Button */}
      {showPhoneNumber && (
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="hidden lg:flex fixed left-0 top-1/2 z-30 -translate-y-1/2"
        >
          <div className="flex items-center group">
            <Link
              href={`tel:${formatUniversalPhoneNumber(companyData.phone)}`}
              className="flex items-center justify-center w-14 h-14 bg-orange-600 rounded-r-lg shadow-lg hover:bg-orange-700 transition-colors"
              aria-label="Call us"
            >
              <Phone className="h-6 w-6 text-white" />
            </Link>
            <div className="px-3 py-2 bg-white/90 backdrop-blur-sm rounded-r-lg shadow-sm transform -rotate-90 origin-left whitespace-nowrap text-sm font-medium text-gray-800 opacity-0 group-hover:opacity-100 transition-opacity">
              {formatUniversalPhoneNumber(companyData.phone)}
            </div>
          </div>
        </motion.div>
      )}

      <Swiper
        modules={[Autoplay, Pagination, EffectFade]}
        autoplay={{ delay: AUTOPLAY_DELAY, disableOnInteraction: false }}
        effect="fade"
        fadeEffect={{ crossFade: true }}
        speed={SWIPER_FADE_SPEED}
        loop
        pagination={{
          clickable: true,
          el: ".hero-pagination",
          bulletClass: "hero-bullet",
          bulletActiveClass: "hero-bullet-active",
        }}
        onSlideChange={handleSlideChange}
        className="h-full w-full"
      >
        {slides.map((slide, index) => (
          <SwiperSlide key={index}>
            <div className="relative h-full w-full">
              {/* Background Image */}
              <div className="absolute inset-0 overflow-hidden">
                <img
                  src={slide.image}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="eager"
                />
                <div className="absolute inset-0 bg-black/30" />
              </div>

              {/* Content Overlay */}
              <AnimatePresence mode="wait">
                {currentRealIndex === index && contentIsVisible && (
                  <motion.div
                    key={`slide-content-${currentRealIndex}`}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    variants={overlayVariants}
                    className="absolute inset-0 z-20 flex items-center"
                  >
                    <div className="container px-6 md:px-8 lg:px-12 xl:px-16 mx-auto">
                      <motion.div
                        key={`text-content-${currentRealIndex}`}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        variants={{
                          animate: {
                            transition: {
                              staggerChildren: 0.1,
                              delayChildren: CONTENT_ENTRANCE_DELAY / 1000,
                            },
                          },
                        }}
                        className="max-w-2xl lg:max-w-3xl xl:max-w-4xl space-y-6"
                      >
                        {/* Tagline */}
                        <motion.div variants={textVariants}>
                          <span className="inline-block px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-orange-300 font-medium text-sm tracking-wider border border-orange-300/30">
                            {slides[currentRealIndex].tagline}
                          </span>
                        </motion.div>

                        {/* Main Heading */}
                        <motion.h1
                          variants={textVariants}
                          className="text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-tight"
                        >
                          <span className="text-orange-400">
                            {slides[currentRealIndex].heading
                              .split(" ")
                              .slice(0, 2)
                              .join(" ")}
                          </span>{" "}
                          {slides[currentRealIndex].heading
                            .split(" ")
                            .slice(2)
                            .join(" ")}
                        </motion.h1>

                        {/* Caption */}
                        <motion.p
                          variants={textVariants}
                          className="text-lg md:text-xl text-white/90 leading-relaxed"
                        >
                          {slides[currentRealIndex].caption}
                        </motion.p>

                        {/* CTA Buttons */}
                        <motion.div
                          variants={textVariants}
                          className="flex flex-wrap gap-4 pt-4"
                        >
                          <Button
                            asChild
                            className="h-14 px-8 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg text-lg hover:shadow-lg transition-all"
                          >
                            <Link href={slides[currentRealIndex].ctaLink}>
                              {slides[currentRealIndex].ctaText}
                              <ArrowRight className="ml-2 h-5 w-5" />
                            </Link>
                          </Button>
                          <Button
                            variant="outline"
                            asChild
                            className="lg:hidden h-14 px-6 border-white text-white bg-white/10 hover:bg-white/20 hover:text-white rounded-lg text-lg"
                          >
                            <Link href={`tel:${companyData.phone}`}>
                              <Phone className="mr-2 h-5 w-5" />
                              Call Now
                            </Link>
                          </Button>
                        </motion.div>
                      </motion.div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Custom Pagination */}
      <div className="hero-pagination absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex justify-center gap-2 w-full" />

      {/* Gradient Overlay */}
      <div className="absolute bottom-0 left-0 w-full h-1/3 bg-gradient-to-t from-black/70 to-transparent -z-10" />
    </section>
  );
}
