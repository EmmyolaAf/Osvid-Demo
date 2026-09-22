"use client";

import React from "react";
import companyData from "@/data/company";
import Link from "next/link";
import { FaLocationArrow, FaPhone, FaEnvelope } from "react-icons/fa";
import NewsletterSection from "../reusables/sections/NewsletterForm";
import { usePathname } from "next/navigation";
import {
  getSocialMediaLink,
  SocialIconMap,
} from "@/helpers/getSocialMediaLink";

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const pathname = usePathname();

  // Skip footer on certain pages if needed
  if (pathname?.startsWith("/admin")) return null;

  const footerLinks = [
    { name: "About Us", href: "/about" },
    { name: "Our Products", href: "/products" },
    { name: "Latest News", href: "/blog" },
    { name: "Contact Us", href: "/contact" },
    { name: "Privacy Policy", href: "/privacy" },
    { name: "Terms of Service", href: "/terms" },
  ];

  return (
    <footer
      className="bg-osvid-soft-yellow w-full"
      style={{
        backgroundImage: "url('/images/bgs/footer-bg.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
      aria-label="Website footer"
    >
      <div className="bg-black/10 backdrop-blur-sm">
        {/* Top Footer */}
        <div className="container grid py-12 md:py-16 gap-8 md:grid-cols-4 lg:grid-cols-4">
          {/* About Us */}
          <div className="text-white">
            <h2 className="text-xl md:text-2xl font-bold mb-4 text-osvid-cream">
              Osvid Chemicals Ltd.
            </h2>
            <p className="text-sm md:text-base leading-relaxed">
              {companyData.description ||
                "Leading innovation in chemical solutions across industries. Quality, safety, and sustainability at our core."}
            </p>
          </div>

          {/* Quick Links */}
          <div className="text-white">
            <h2 className="text-xl md:text-2xl font-bold mb-4 text-osvid-cream">
              Quick Links
            </h2>
            <ul className="text-sm md:text-base grid grid-cols-1 gap-2">
              {footerLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="hover:text-osvid-orange transition-colors duration-200 block py-1"
                    aria-label={link.name}
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div className="text-white">
            <h2 className="text-xl md:text-2xl font-bold mb-4 text-osvid-cream">
              Contact Us
            </h2>
            <address className="not-italic flex flex-col gap-3">
              <div className="flex items-start">
                <FaLocationArrow
                  className="mt-1 mr-2 flex-shrink-0"
                  aria-hidden="true"
                />
                <span>{companyData.address}</span>
              </div>
              <div className="flex items-center">
                <FaEnvelope className="mr-2" aria-hidden="true" />
                <Link
                  href={`mailto:${companyData.email}`}
                  className="hover:text-osvid-orange transition-colors"
                  aria-label="Email us"
                >
                  {companyData.email}
                </Link>
              </div>
              <div className="flex items-center">
                <FaPhone className="mr-2" aria-hidden="true" />
                <Link
                  href={`tel:${companyData.phone.replace(/\D/g, "")}`}
                  className="hover:text-osvid-orange transition-colors"
                  aria-label="Call us"
                >
                  {companyData.phone}
                </Link>
              </div>
            </address>
          </div>

          {/* Newsletter */}
          <NewsletterSection />
        </div>

        {/* Bottom Footer */}
        <div className="py-4 bg-[#574e4299] text-white">
          <div className="container flex flex-col md:flex-row text-center md:text-left justify-between items-center gap-4">
            <div className="flex flex-col md:flex-row gap-2 md:gap-6">
              <p className="text-orange-100 font-medium text-sm">
                &copy; {currentYear} {companyData.name}. All rights reserved.
              </p>
              <Link
                href="/sitemap"
                className="text-orange-100 hover:text-white text-sm font-medium transition-colors"
                aria-label="Sitemap"
              >
                Sitemap
              </Link>
            </div>
            <div className="flex items-center gap-3">
              {Object.entries(companyData.socialMedia).map(
                ([platform, username]) => {
                  const socialLink = getSocialMediaLink(platform, username);
                  const IconComponent = SocialIconMap[platform.toLowerCase()];

                  if (!socialLink || !IconComponent) return null;

                  return (
                    <Link
                      key={platform}
                      href={socialLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${platform} page`}
                      className="p-1.5 rounded-full hover:bg-orange-700/30 transition-colors"
                    >
                      <IconComponent size={16} className="text-orange-300" />
                    </Link>
                  );
                }
              )}
            </div>{" "}
          </div>
        </div>
      </div>
    </footer>
  );
}
