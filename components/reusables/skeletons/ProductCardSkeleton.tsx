// --- Skeleton Loader Component ---
const ProductCardSkeleton = () => (
  <div className="group relative block bg-gray-100 rounded-xl shadow-md animate-pulse overflow-hidden">
    {/* Image placeholder */}
    <div className="relative w-full h-60 sm:h-68 md:h-72 bg-gray-200 rounded-t-xl">
      {/* Optional: Add a subtle loading text or icon */}
    </div>

    {/* Content placeholder */}
    <div className="relative px-5 py-4 sm:px-6 sm:py-5 text-center">
      {/* Price placeholder */}
      <div className="h-6 w-3/4 bg-gray-200 rounded mb-2 mx-auto"></div>
      {/* Name placeholder */}
      <div className="h-5 w-4/5 bg-gray-200 rounded mb-2 mx-auto"></div>
      {/* Stars placeholder */}
      <div className="h-4 w-1/3 bg-gray-200 rounded mx-auto"></div>
      {/* Button placeholder */}
      <div className="h-10 w-full bg-gray-200 rounded-md mt-4"></div>
    </div>
  </div>
);

export default ProductCardSkeleton;
