# OSVID CHEMICALS LTD. Marketing Website

![Next.js](https://img.shields.io/badge/Next.js-14-blue)
![Wix Studio](https://img.shields.io/badge/Wix-Headless_Studio-yellowgreen)
![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-✓-3178C6)
![Deployed on Vercel](https://img.shields.io/badge/Deployed-Vercel-black)

![Osvid Limited Website Screenshot](https://osvidcompany.vercel.app/_next/image?url=%2Fimages%2Fbgs%2Fhero-chemical.jpg&w=1920&q=75)
> 📸 _Replace with an actual screenshot of the live site or homepage for best visual impact._

---

## Table of Contents

1. [Project Overview](#1-project-overview)  
2. [Live Demo](#2-live-demo)  
3. [Key Features](#3-key-features)  
4. [Technology Stack](#4-technology-stack)  
5. [Getting Started](#5-getting-started)  
   - 5.1 [Prerequisites](#51-prerequisites)  
   - 5.2 [Installation](#52-installation)  
   - 5.3 [Environment Variables](#53-environment-variables-envlocal)  
6. [Project Structure](#6-project-structure)  
7. [Wix Headless CMS Integration](#7-wix-headless-cms-integration)  
8. [Deployment](#8-deployment)  
9. [Future Development / Roadmap](#9-future-development--roadmap)  
10. [Support & Contact](#10-support--contact)  
11. [License](#11-license)

---

## 1. Project Overview

This repository contains the frontend codebase for the **OSVID CHEMICALS LTD.** marketing and e-commerce website.

The website was designed to:

- Promote Osvid's chemical products and industrial services
- Enable e-commerce functionality with payment integration
- Showcase dynamic service and product content via a connected Headless CMS
- Provide a clean, responsive, and SEO-optimized user experience

---

## 2. Live Demo

- 🌐 **Production:** [https://osvidcompany.com](https://osvidcompany.com)  
- 🌐 **Staging:** [https://osvidcompany.vercel.app](https://osvidcompany.vercel.app)

---

## 3. Key Features

- 🧠 **Wix Headless CMS Integration** – Services, products, categories, and blog content managed via Wix Studio  
- 🛍️ **Dynamic Product Pages** – Fully integrated with Wix Stores  
- ✍️ **Blog System** – Posts pulled from Wix with social sharing and related post logic  
- 📱 **Responsive Layouts** – Two-column and mobile-first grids  
- 🛒 **WhatsApp + Paystack Checkout** – Multi-channel order support  
- 🧩 **Modular Components** – Built with reusability and scalability in mind  
- 🚀 **SEO & Metadata** – Automatic title, description, and OG meta rendering per page  
- ⚙️ **Contact Forms** – Powered by Wix Forms and Resend for notifications  
- 🖼️ **Optimized Images** – Using `next/image` with custom Wix CDN resolver

---

## 4. Technology Stack

| Stack        | Description                                |
|--------------|--------------------------------------------|
| **Framework** | Next.js 14 with App Router (TypeScript)    |
| **Styling**   | Tailwind CSS                               |
| **Animations**| Framer Motion                              |
| **CMS**       | Wix Studio (Data, Blog, Stores)            |
| **API**       | Wix Client SDK                             |
| **Email**     | Resend API                                 |
| **Payments**  | Paystack Integration via Wix Stores        |
| **Deployment**| Vercel (CI/CD linked to GitHub)            |

---

## 5. Getting Started

### 5.1 Prerequisites

- Node.js v18+
- npm or yarn
- A Wix Studio project with the following:
  - Data Collections: `services`, `products`, `product_categories`
  - Wix Blog enabled
  - Wix Stores set up with products
- Paystack account for live payments

### 5.2 Installation

```bash
git clone https://github.com/your-org/osvid-website.git
cd osvid-website
npm install
# or
yarn install
