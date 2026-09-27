"use client";

import Link from "next/link";
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
  UserPlus,
} from "lucide-react";
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
  const [mounted, setMounted] = useState(false);
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

  // Client-side mount flag for React Portal
  useEffect(() => {
    setMounted(true);
  }, []);

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
        <div className="px-4 container md:px-12 flex items-center justify-between gap-4 mx-auto">
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
        <div className="container px-4 md:px-12 flex items-center justify-between py-3 mx-auto">
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
              type="button"
              className="lg:hidden p-2.5 rounded-xl bg-slate-50 hover:bg-orange-50 text-slate-700 hover:text-orange-600 transition-colors border border-slate-200/80 active:scale-95"
              aria-label="Toggle navigation menu"
              aria-expanded={isMenuOpen}
            >
              <Menu size={24} />
            </button>
          </div>
        </div>
      </header>

      {/* ======================================================== */}
      {/* REBUILT MOBILE PORTAL DRAWER (MOUNTED TO BODY VIA REACT PORTAL) */}
      {/* ======================================================== */}
      {mounted &&
        createPortal(
          <div
            className={`fixed inset-0 z-[99999] lg:hidden transition-all duration-300 ease-in-out ${
              isMenuOpen
                ? "opacity-100 pointer-events-auto visible"
                : "opacity-0 pointer-events-none invisible"
            }`}
            aria-hidden={!isMenuOpen}
          >
            {/* Dark Backdrop Overlay */}
            <div
              className={`fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity duration-300 ${
                isMenuOpen ? "opacity-100" : "opacity-0"
              }`}
              onClick={closeMenu}
              aria-hidden="true"
            />

            {/* Drawer Sidebar Container */}
            <div
              className={`fixed top-0 left-0 bottom-0 w-[85vw] max-w-sm h-[100dvh] bg-white shadow-2xl flex flex-col z-[100000] overflow-hidden transform transition-transform duration-300 ease-out ${
                isMenuOpen ? "translate-x-0" : "-translate-x-full"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Top Header */}
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                <Link href="/" onClick={closeMenu} className="flex items-center">
                  <Image
                    src="/images/logo.webp"
                    alt="Osvid Logo"
                    width={130}
                    height={44}
                    className="h-9 w-auto object-contain"
                  />
                </Link>
                <button
                  onClick={closeMenu}
                  type="button"
                  className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors active:scale-95"
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Drawer Scrollable Content Area */}
              <div className="overflow-y-auto flex-1 overscroll-contain flex flex-col justify-between">
                {/* Navigation Links */}
                <div className="p-4 space-y-1">
                  {isStaff && (
                    <Link
                      href="/dashboard"
                      onClick={closeMenu}
                      className="px-4 py-3 rounded-xl text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-between shadow-sm transition-colors mb-2"
                    >
                      <div className="flex items-center gap-2">
                        <LayoutDashboard size={18} className="text-orange-400" />
                        <span>Staff Dashboard</span>
                      </div>
                      <ChevronRight size={16} className="text-slate-400" />
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
                </div>

                {/* Bottom Section: Sign In / Register directly above Request a Quote */}
                <div className="p-4 border-t border-slate-100 space-y-3 bg-slate-50/50 mt-auto">
                  {/* Account / Auth Actions */}
                  {user ? (
                    <div className="bg-white border border-slate-200 p-3 rounded-2xl flex items-center justify-between shadow-xs">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-orange-600 to-amber-500 text-white font-bold flex items-center justify-center text-xs shadow-xs shrink-0">
                          {userProfile?.displayName?.charAt(0).toUpperCase() || "U"}
                        </div>
                        <div className="overflow-hidden min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {userProfile?.displayName || "Valued Customer"}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                        </div>
                      </div>
                      <Link href="/account" onClick={closeMenu} className="shrink-0">
                        <Button size="sm" variant="outline" className="text-xs h-7 px-2.5 rounded-lg">
                          Account
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Link href="/login" onClick={closeMenu}>
                        <Button
                          size="sm"
                          className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl h-10 shadow-sm"
                        >
                          <LogIn size={14} className="mr-1.5" /> Sign In
                        </Button>
                      </Link>
                      <Link href="/register" onClick={closeMenu}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs font-semibold rounded-xl h-10 border-slate-200 bg-white"
                        >
                          <UserPlus size={14} className="mr-1.5" /> Register
                        </Button>
                      </Link>
                    </div>
                  )}

                  {/* Contact Info Snippets */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center gap-2 px-2 py-1 text-slate-600 text-xs">
                      <MapPin size={14} className="text-orange-600 shrink-0" />
                      <span className="truncate text-[11px]">{companyData.address}</span>
                    </div>
                    <Link
                      href={`tel:${companyData.phone}`}
                      className="flex items-center gap-2 px-2 py-1 text-slate-700 text-xs font-medium hover:text-orange-600 transition-colors"
                    >
                      <PhoneCall size={14} className="text-orange-600 shrink-0" />
                      <span className="text-[11px]">{formatUniversalPhoneNumber(companyData.phone)}</span>
                    </Link>
                  </div>

                  {/* Get a Quote Action */}
                  <Link href="#getQuote" onClick={closeMenu} className="block pt-1">
                    <Button className="w-full h-11 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white font-bold text-sm shadow-md shadow-orange-600/20">
                      Get a Quote
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
