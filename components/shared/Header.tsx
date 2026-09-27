"use client";

import Link from "next/link";
import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Button } from "../ui/button";
import {
  MapPin,
  PhoneCall,
  Menu,
  X,
  LayoutDashboard,
  LogIn,
  ShoppingBag,
  User,
  ChevronRight,
} from "lucide-react";
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
  const closeMenu = () => setIsMenuOpen(false);

  // Scroll detection for sticky header backdrop styling
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Automatically close mobile menu when user navigates
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, [isMenuOpen]);

  // Handle ESC key press to close menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMenuOpen) {
        closeMenu();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMenuOpen]);

  return (
    <>
      {/* Top Bar */}
      <div className="bg-osvid-lime text-gray-100 py-2">
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
              <MapPin size={16} className="text-osvid-blue shrink-0" />
              <span className="text-xs line-clamp-1 text-orange-50 hover:text-orange-200 transition-colors">
                {companyData.address}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <PhoneCall size={16} className="text-osvid-blue shrink-0" />
              <Link
                href={`tel:${companyData.phone}`}
                className="text-xs text-orange-50 hover:text-orange-200 transition-colors"
              >
                {formatUniversalPhoneNumber(companyData.phone)}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header
        className={`sticky top-0 left-0 w-full z-40 transition-all duration-300 ${
          isScrolled ? "bg-white/95 backdrop-blur-md shadow-sm" : "bg-white"
        }`}
      >
        <div className="container px-4 md:px-12 flex items-center justify-between py-3">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <Image
              src="/images/logo.webp"
              alt="Osvid Logo"
              width={150}
              height={50}
              className="h-11 md:h-14 w-auto object-contain"
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
          <div className="flex items-center gap-2 sm:gap-3">
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

            {/* Mobile Menu Hamburger Trigger */}
            <button
              onClick={toggleMenu}
              className="lg:hidden p-2 rounded-xl hover:bg-orange-50 text-slate-700 hover:text-orange-600 transition-colors"
              aria-label="Toggle navigation menu"
              aria-expanded={isMenuOpen}
            >
              <Menu size={26} />
            </button>
          </div>
        </div>
      </header>

      {/* ======================================================== */}
      {/* MOBILE FULL-SCREEN DRAWER (OUTSIDE HEADER TO PREVENT CLIPPING) */}
      {/* ======================================================== */}
      <AnimatePresence>
        {isMenuOpen && (
          <div className="fixed inset-0 z-[999] lg:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={closeMenu}
              aria-hidden="true"
            />

            {/* Drawer Sidebar */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed top-0 left-0 bottom-0 w-[85vw] max-w-sm h-dvh bg-white shadow-2xl flex flex-col z-[1000] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Header */}
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                <Link href="/" onClick={closeMenu} className="flex items-center">
                  <Image
                    src="/images/logo.webp"
                    alt="Osvid Logo"
                    width={130}
                    height={44}
                    className="h-10 w-auto object-contain"
                  />
                </Link>
                <button
                  onClick={closeMenu}
                  className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Drawer Body (Scrollable) */}
              <div className="overflow-y-auto flex-1 overscroll-contain">
                {/* User Profile / Auth Banner */}
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                  {user ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-600 to-amber-500 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                          {userProfile?.displayName?.charAt(0).toUpperCase() || "U"}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {userProfile?.displayName || "Valued Customer"}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                        </div>
                      </div>
                      <Link href="/account" onClick={closeMenu}>
                        <Button size="sm" variant="outline" className="text-xs h-8 rounded-lg">
                          Account
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Link href="/login" onClick={closeMenu} className="flex-1">
                        <Button size="sm" className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl h-9">
                          <LogIn size={14} className="mr-1.5" /> Sign In
                        </Button>
                      </Link>
                      <Link href="/register" onClick={closeMenu} className="flex-1">
                        <Button size="sm" variant="outline" className="w-full text-xs font-semibold rounded-xl h-9">
                          Register
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>

                {/* Staff Dashboard Button if authorized */}
                {isStaff && (
                  <div className="p-4 pb-0">
                    <Link
                      href="/dashboard"
                      onClick={closeMenu}
                      className="px-4 py-3 rounded-xl text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-between shadow-sm transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <LayoutDashboard size={18} className="text-orange-400" />
                        <span>Staff Dashboard</span>
                      </div>
                      <ChevronRight size={16} className="text-slate-400" />
                    </Link>
                  </div>
                )}

                {/* Navigation Links */}
                <nav className="p-4 space-y-1">
                  {menu.map((item) => {
                    const isActive =
                      pathname === "/"
                        ? item.link === "/"
                        : pathname.startsWith(item.link) && item.link !== "/";

                    return (
                      <Link
                        key={item.name}
                        href={item.link}
                        onClick={closeMenu}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                          isActive
                            ? "bg-orange-50 text-orange-600 font-bold"
                            : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <span>{item.name}</span>
                        <ChevronRight
                          size={16}
                          className={isActive ? "text-orange-600" : "text-slate-300"}
                        />
                      </Link>
                    );
                  })}
                </nav>

                {/* Contact & Quote Details */}
                <div className="p-4 border-t border-slate-100 space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-xl">
                      <MapPin size={16} className="text-orange-600 mt-0.5 shrink-0" />
                      <span className="text-xs text-slate-600 leading-relaxed">
                        {companyData.address}
                      </span>
                    </div>

                    <Link
                      href={`tel:${companyData.phone}`}
                      className="flex items-center gap-2.5 p-3 bg-slate-50 hover:bg-orange-50 rounded-xl transition-colors"
                    >
                      <PhoneCall size={16} className="text-orange-600 shrink-0" />
                      <span className="text-xs font-semibold text-slate-700">
                        {formatUniversalPhoneNumber(companyData.phone)}
                      </span>
                    </Link>
                  </div>

                  <Link href="#getQuote" onClick={closeMenu} className="block pt-1">
                    <Button className="w-full h-11 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white font-bold text-sm shadow-md shadow-orange-600/20">
                      Get a Quote
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
