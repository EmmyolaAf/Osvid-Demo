"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  FaPhoneAlt,
  FaEnvelope,
  FaMapMarkerAlt,
  FaInstagram,
  FaWhatsapp,
} from "react-icons/fa";
import companyData from "@/data/company";
import ContactForm from "../forms/ContactForm";

interface CTASectionProps {
  heading?: string;
  subheading?: string;
  formTitle?: string;
  formDescription?: string;
}

const ContactInfoItem = ({
  icon: Icon,
  title,
  content,
  isLink = false,
  href = "",
}: {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  content: string;
  isLink?: boolean;
  href?: string;
}) => (
  <motion.div
    className="flex items-center gap-4"
    whileHover={{ x: 5 }}
    transition={{ type: "spring", stiffness: 300 }}
  >
    <div className="size-12 md:size-14 shrink-0 bg-orange-600 rounded-full grid place-items-center hover:bg-orange-700 transition-colors">
      <Icon size={18} />
    </div>
    <div>
      <p className="text-lg font-semibold">{title}</p>
      {isLink ? (
        <a
          href={href}
          target={href.startsWith("http") ? "_blank" : "_self"}
          rel="noopener noreferrer"
          className="text-gray-200 hover:text-white transition-colors duration-200"
        >
          {content}
        </a>
      ) : (
        <p className="text-gray-200">{content}</p>
      )}
    </div>
  </motion.div>
);

export default function CTASection({
  heading = "Need Expert Advice?",
  subheading = "Choosing the right chemical product can be tricky — but we're here to help!",
  formTitle = "Contact our team",
  formDescription = "We'll provide personalized recommendations based on your project.",
}: CTASectionProps) {
  const contactItems = [
    {
      icon: FaPhoneAlt,
      title: "Call Us",
      content: companyData.phone,
      isLink: true,
      href: `tel:${companyData.phone}`,
    },
    {
      icon: FaMapMarkerAlt,
      title: "Visit Us",
      content: companyData.address,
    },
    {
      icon: FaEnvelope,
      title: "Email Us",
      content: companyData.email,
      isLink: true,
      href: `mailto:${companyData.email}`,
    },
    ...(companyData.socialMedia.instagram
      ? [
          {
            icon: FaInstagram,
            title: "Instagram",
            content: companyData.socialMedia.instagram,
            isLink: true,
            href: `https://instagram.com/${companyData.socialMedia.instagram.replace(
              "@",
              ""
            )}`,
          },
        ]
      : []),
    ...(companyData.whatsapp
      ? [
          {
            icon: FaWhatsapp,
            title: "WhatsApp",
            content: companyData.whatsapp,
            isLink: true,
            href: `https://wa.me/${companyData.whatsapp.replace(/\D/g, "")}`,
          },
        ]
      : []),
  ];

  return (
    <section
      id="contact"
      className="relative bg-[#1B140E] text-white py-20 md:py-28 overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: "url('/images/bgs/map.png')",
      }}
    >
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/30 z-0" />

      <div className="container relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12 px-4 sm:px-6">
        {/* CONTACT INFO */}
        <motion.div
          className="w-full lg:w-[45%] space-y-8"
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-4xl font-bold leading-tight">
            {heading}
          </h2>
          <p className="text-lg text-gray-200 max-w-lg">{subheading}</p>

          <div className="space-y-6">
            {contactItems.map((item, index) => (
              <ContactInfoItem
                key={index}
                icon={item.icon}
                title={item.title}
                content={item.content}
                isLink={item.isLink}
                href={item.href}
              />
            ))}
          </div>
        </motion.div>

        {/* FORM */}
        <motion.div
          className="w-full max-w-2xl bg-white text-gray-800 p-8 md:p-10 rounded-lg shadow-2xl space-y-6"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
        >
          <div className="space-y-2">
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900">
              {formTitle}
            </h3>
            <p className="text-gray-600 text-base md:text-lg">
              {formDescription}
            </p>
          </div>

          <ContactForm />

          <p className="text-sm text-gray-500 mt-4">
            We respect your privacy. Your information will not be shared.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
