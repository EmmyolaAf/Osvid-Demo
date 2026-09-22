import Image from "next/image";
import { Star, StarHalf } from "lucide-react";

type TestimonialCardProps = {
  name: string;
  role: string;
  imageUrl?: string | null;
  content: string;
  rating?: number;
  className?: string;
};

export default function TestimonialCard({
  name,
  role,
  imageUrl,
  content,
  rating = 5,
  className = "",
}: TestimonialCardProps) {
  const renderStars = (currentRating: number) => {
    const fullStars = Math.floor(currentRating);
    const hasHalfStar = currentRating % 1 !== 0;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
      <div className="flex gap-0.5">
        {[...Array(fullStars)].map((_, i) => (
          <Star
            key={`full-${i}`}
            size={20}
            className="text-yellow-400 fill-current"
          />
        ))}
        {hasHalfStar && (
          <StarHalf size={20} className="text-yellow-400 fill-current" />
        )}
        {[...Array(emptyStars)].map((_, i) => (
          <Star
            key={`empty-${i}`}
            size={20}
            className="text-gray-300 fill-current"
          />
        ))}
      </div>
    );
  };

  return (
    <div
      className={`group relative bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden ${className}`}
    >
      {/* Decorative background element */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-white opacity-70" />

      <div className="relative z-10 flex flex-col h-full">
        {/* Content section */}
        <div className="p-6 flex-1">
          {/* Quote icon */}
          <div className="text-5xl text-orange-400/30 font-serif leading-none mb-4">
            &ldquo;
          </div>

          {/* Testimonial text */}
          <p className="text-gray-700 text-lg leading-relaxed mb-6 line-clamp-4">
            {content}
          </p>
        </div>

        {/* Author section */}
        <div className="border-t border-gray-100 p-6 bg-gradient-to-r from-orange-50/50 to-transparent">
          <div className="flex items-center gap-4">
            {/* Avatar image */}
            <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-white shadow-md">
              <Image
                src={imageUrl ?? "/fallback.jpg"}
                alt={`${name}'s photo`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 80px, 80px"
              />
            </div>

            {/* Author info */}
            <div className="flex-1">
              <h4 className="text-lg font-bold text-gray-900">{name}</h4>
              <p className="text-sm text-gray-600">{role}</p>
              <div className="mt-1">{renderStars(rating)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Hover effect border */}
      <div className="absolute inset-0 border-2 border-transparent group-hover:border-orange-200 rounded-2xl transition-all duration-300 pointer-events-none" />
    </div>
  );
}
