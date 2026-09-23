"use client";

import Link from "next/link";
import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Button } from "../ui/button";
import { MapPin, PhoneCall, Menu, X, User, LayoutDashboard, LogIn, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import companyData from "@/data/company";
import { formatUniversalPhoneNumber } from "@/helpers/formatPhoneNumber";
import {
  getSocialMediaLink,
  SocialIconMap,
} from "@/helpers/getSocialMediaLink";
import { CartTrigger } from "../reusables/cart";
import { useAuth } from "@/contexts/AuthContext";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const { user, userProfile, isStaff } = useAuth();

  const menu = [
    { name: "Home", link: "/" },
    { name: "About", link: "/about" },
    { name: "Products", link: "/products" },
    { name: "Services", link: "/services" },
    { name: "Blog", link: "/blog", target: "" },
    { name: "Shop", link: "/shop" },
    { name: "Contact", link: "/contact" },
  ];

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {/* Top Bar */}
      <motion.div
        className="bg-osvid-lime text-gray-100 py-2"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="px-4 container md:px-12 flex items-center justify-between gap-4">
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
          </div>

          <div className="hidden text-sm lg:flex items-center gap-6">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-osvid-blue" />
              <span className="text-xs line-clamp-1 text-orange-50 hover:text-orange-200 transition-colors">
                {companyData.address}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <PhoneCall size={16} className="text-osvid-blue" />
              <Link
                href={`tel:${companyData.phone}`}
                className="text-xs text-orange-50 hover:text-orange-200 transition-colors"
              >
                {formatUniversalPhoneNumber(companyData.phone)}
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Header */}
      <motion.header
        className={`sticky top-0 left-0 w-full z-50 transition-all duration-300 ${
          isScrolled ? "bg-white/95 backdrop-blur-md shadow-sm" : "bg-white"
        }`}
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="container px-4 md:px-12 flex items-center justify-between py-3">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <Image
              src="/images/logo.webp"
              alt="Osvid Logo"
              width={150}
              height={50}
              className="h-12 w-auto object-contain md:h-14"
              priority
            />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {menu.map((item) => {
              const isActive =
                pathname === "/"
                  ? item.link === "/"
                  : pathname.startsWith(item.link) && item.link !== "/";

              return (
                <Link
                  key={item.name}
                  href={item.link}
                  target={item?.target}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "text-orange-600 bg-orange-50"
                      : "text-gray-700 hover:text-orange-600 hover:bg-orange-50/50"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                {isStaff ? (
                  <Link href="/dashboard" className="hidden sm:block">
                    <Button
                      size="sm"
                      className="h-9 px-3.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 shadow-sm"
                    >
                      <LayoutDashboard size={14} />
                      <span>Staff Dashboard</span>
                    </Button>
                  </Link>
                ) : (
                  <Link href="/account/orders" className="hidden sm:block">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 px-3 rounded-lg text-xs font-semibold text-slate-700 hover:text-orange-600 flex items-center gap-1.5"
                    >
                      <ShoppingBag size={14} />
                      <span>Orders</span>
                    </Button>
                  </Link>
                )}

                <Link
                  href="/account"
                  className="w-9 h-9 rounded-full bg-gradient-to-tr from-orange-600 to-amber-500 text-white font-bold flex items-center justify-center text-xs shadow-sm hover:scale-105 transition-transform"
                  title="My Account"
                >
                  {userProfile?.displayName?.charAt(0).toUpperCase() || "U"}
                </Link>
              </div>
            ) : (
              <Link href="/login" className="hidden sm:block">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3.5 rounded-lg text-xs font-semibold border-slate-200 text-slate-700 hover:text-orange-600 hover:border-orange-500 flex items-center gap-1.5"
                >
                  <LogIn size={14} />
                  <span>Sign In</span>
                </Button>
              </Link>
            )}

            <Link href="#getQuote" className="hidden md:block">
              <Button className="h-10 px-5 rounded-lg font-medium bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white shadow-sm">
                Get a Quote
              </Button>
            </Link>

            <CartTrigger />

            <button
              onClick={toggleMenu}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
              aria-label="Menu"
            >
              <Menu size={24} className="text-gray-700" />
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 top-0 left-0 bg-black/60 z-[100] lg:hidden"
              onClick={toggleMenu}
            >
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 25 }}
                className="bg-white w-80 h-full flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b flex justify-between items-center">
                  <Link href="/" onClick={toggleMenu}>
                    <Image
                      src="/images/logo.webp"
                      alt="Osvid Logo"
                      width={120}
                      height={40}
                      className="h-10 w-auto object-contain"
                    />
                  </Link>
                  <button
                    onClick={toggleMenu}
                    className="p-2 rounded-full hover:bg-gray-100"
                    aria-label="Close menu"
                  >
                    <X size={24} className="text-gray-600" />
                  </button>
                </div>

                <div className="overflow-y-auto flex-1">
                  {/* Mobile User Profile Section */}
                  <div className="p-4 border-b bg-slate-50">
                    {user ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-orange-600 text-white font-bold flex items-center justify-center text-sm">
                            {userProfile?.displayName?.charAt(0).toUpperCase() || "U"}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{userProfile?.displayName || "User"}</p>
                            <p className="text-[11px] text-slate-500">{user.email}</p>
                          </div>
                        </div>
                        <Link href="/account" onClick={toggleMenu}>
                          <Button size="sm" variant="outline" className="text-xs h-8">
                            Account
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Link href="/login" onClick={toggleMenu} className="flex-1">
                          <Button size="sm" className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xs">
                            Sign In
                          </Button>
                        </Link>
                        <Link href="/register" onClick={toggleMenu} className="flex-1">
                          <Button size="sm" variant="outline" className="w-full text-xs">
                            Register
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>

                  <nav className="flex flex-col p-4 gap-1">
                    {isStaff && (
                      <Link
                        href="/dashboard"
                        onClick={toggleMenu}
                        className="px-4 py-3 rounded-lg text-base font-bold bg-slate-900 text-white mb-2 flex items-center gap-2"
                      >
                        <LayoutDashboard size={18} />
                        <span>Staff Dashboard</span>
                      </Link>
                    )}

                    {menu.map((item) => {
                      const isActive =
                        pathname === "/"
                          ? item.link === "/"
                          : pathname.startsWith(item.link) && item.link !== "/";

                      return (
                        <Link
                          key={item.name}
                          href={item.link}
                          onClick={toggleMenu}
                          className={`px-4 py-3 rounded-lg text-base font-medium ${
                            isActive
                              ? "bg-orange-50 text-orange-600"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {item.name}
                        </Link>
                      );
                    })}
                  </nav>

                  <div className="p-4 border-t">
                    <div className="flex flex-col gap-3 mb-6">
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <MapPin size={18} className="text-orange-500" />
                        <span className="text-sm text-gray-700">
                          {companyData.address}
                        </span>
                      </div>
                      <Link
                        href={`tel:${companyData.phone}`}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                      >
                        <PhoneCall size={18} className="text-orange-500" />
                        <span className="text-sm text-gray-700">
                          {formatUniversalPhoneNumber(companyData.phone)}
                        </span>
                      </Link>
                    </div>

                    <Link href="#getQuote" onClick={toggleMenu}>
                      <Button className="w-full h-12 rounded-lg bg-gradient-to-r from-orange-600 to-orange-500 text-white font-medium">
                        Get a Quote
                      </Button>
                    </Link>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>
    </>
  );
}
