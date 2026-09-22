"use client";

import companyData from "@/data/company";
import { motion } from "framer-motion";
import { FaWhatsapp } from "react-icons/fa";

// Animation Variants for the Button
const buttonVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      delay: 0.5,
      duration: 0.5,
      type: "spring",
      stiffness: 120,
    },
  },
  hover: {
    scale: 1.1,
    // Subtle shadow on hover
    boxShadow: "0px 6px 20px rgba(37, 211, 102, 0.4)", // Shadow with WhatsApp green tint
    transition: { duration: 0.3 },
  },
  tap: {
    scale: 0.95,
    transition: { duration: 0.2 },
  },
} as const;

export default function WhatsAppButton() {
  // Define WhatsApp brand colors
  const whatsappGreen = "#5b8004";

  return (
    <motion.a
      href={companyData.chatLink} // Replace with your actual wa.link or wa.me link
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 text-white rounded-full py-4 px-6 flex items-center gap-2 shadow-lg z-50"
      // Apply inline styles for WhatsApp green background
      style={{ backgroundColor: whatsappGreen }}
      variants={buttonVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      whileTap="tap"
      aria-label="Chat with us on WhatsApp"
    >
      {/* Use Lucide's Whatsapp component */}
      <FaWhatsapp
        size={24} // Set the size (equivalent to text-2xl)
        style={{ color: "white" }} // Set the color
      />
      <span className="hidden md:inline text-sm font-semibold">
        Chat with Us
      </span>
    </motion.a>
  );
}
