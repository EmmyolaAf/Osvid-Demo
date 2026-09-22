"use client";

import { useKeenSlider } from "keen-slider/react";
import { useState } from "react";
import TestimonialCard from "./cards/TestimonialCard";
import { Testimonial } from "@/types";

export default function TestimonialsCarousel({
  testimonials,
}: {
  testimonials: Testimonial[];
}) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [sliderRef, instanceRef] = useKeenSlider<HTMLDivElement>({
    loop: true,
    initial: 0,
    slides: { perView: 1, spacing: 20 },
    breakpoints: {
      "(min-width: 768px)": {
        slides: { perView: 2, spacing: 24 },
      },
    },
    slideChanged(slider) {
      setCurrentSlide(slider.track.details.rel);
    },
  });

  return (
    <>
      <div ref={sliderRef} className="keen-slider">
        {testimonials.map((item, i) => (
          <div className="keen-slider__slide" key={i}>
            <TestimonialCard {...item} />
          </div>
        ))}
      </div>

      {/* Dots */}
      <div className="flex justify-center mt-6 md:mt-12 gap-2">
        {testimonials.map((_, i) => (
          <button
            key={i}
            onClick={() => instanceRef.current?.moveToIdx(i)}
            className={`h-3 w-3 rounded-full transition ${
              currentSlide === i
                ? "bg-orange-600 scale-110"
                : "bg-gray-300 hover:bg-orange-400"
            }`}
          ></button>
        ))}
      </div>
    </>
  );
}
