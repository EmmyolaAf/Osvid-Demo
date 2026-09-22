import { TeamMember } from "@/types";
import { getWixStaticImageUrl } from "@/utils/wixImageUtils";
import Image from "next/image";
import { motion } from "framer-motion";

export default function TeamMemberCard({ name, role, imageUrl }: TeamMember) {
  // Fallback for imageUrl if it's not provided
  const finalImageUrl =
    getWixStaticImageUrl(imageUrl) || "/images/team-placeholder.jpg"; // Use a professional placeholder

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      whileHover={{ y: -5 }}
      transition={{ duration: 0.3 }}
      className="group relative w-full overflow-hidden rounded-xl shadow-lg
                 bg-white hover:shadow-xl transition-all duration-300 ease-in-out
                 focus-within:ring-2 focus-within:ring-osvid-blue focus-within:ring-offset-2"
    >
      {/* Image Container */}
      <div className="relative w-full aspect-square">
        {" "}
        {/* Square aspect ratio for consistency */}
        <Image
          src={finalImageUrl}
          alt={`Portrait of ${name}, ${role} at OSVID`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
          quality={90} // Higher quality for team photos
          priority={false}
        />
      </div>

      {/* Text Content */}
      <div className="p-6 text-center">
        <h3
          className="text-xl font-bold text-gray-900 mb-1 line-clamp-1"
          title={name}
        >
          {name}
        </h3>
        <p className="text-gray-600 font-medium line-clamp-2" title={role}>
          {role}
        </p>

        {/* Optional: Bio excerpt */}
        {/* <p className="mt-3 text-sm text-gray-500 line-clamp-3">
          {bio}
        </p> */}
      </div>
    </motion.div>
  );
}
