/**
 * Storefront Firebase Firestore Client Services
 * Complete unified client service layer replacing legacy @wix-api integrations.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./client";
import { Product } from "@/types/auth";
import {
  ProductCategory,
  Service,
  BlogPost,
  Testimonial,
  TeamMember,
} from "@/types";

// ============================================================================
// RESULT PATTERN TYPE DEFINITION
// ============================================================================

export type StorefrontResult<T> =
  | { success: true; data: T; error?: never }
  | { success: false; error: string; data?: never };

// ============================================================================
// A. PRODUCTS & CATEGORIES (`products`, `product_categories`)
// ============================================================================

/**
 * Fetch all active products, optionally filtered by category
 */
export async function getProducts(
  categorySlug?: string
): Promise<StorefrontResult<Product[]>> {
  try {
    const productsRef = collection(db, "products");
    let q;

    if (categorySlug && categorySlug !== "all") {
      q = query(
        productsRef,
        where("isActive", "==", true),
        where("category", "==", categorySlug),
        orderBy("createdAt", "desc")
      );
    } else {
      q = query(
        productsRef,
        where("isActive", "==", true),
        orderBy("createdAt", "desc")
      );
    }

    const snapshot = await getDocs(q);
    const products: Product[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name || "",
        slug: data.slug || d.id,
        description: data.description || "",
        price: Number(data.price) || 0,
        discountPrice: data.discountPrice ? Number(data.discountPrice) : undefined,
        stockQuantity: Number(data.stockQuantity) || 0,
        category: data.category || "General",
        imageUrl: data.imageUrl || "/images/placeholder.webp",
        galleryImages: data.galleryImages || [],
        unit: data.unit || "kg",
        sku: data.sku || "",
        isFeatured: Boolean(data.isFeatured),
        isActive: data.isActive !== false,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
    });

    return { success: true, data: products };
  } catch (error: any) {
    console.error("Firestore getProducts error:", error);
    return {
      success: false,
      error: error?.message || "Failed to retrieve products from Firestore.",
    };
  }
}

/**
 * Fetch a single product by its unique URL slug or ID fallback
 */
export async function getProductBySlug(
  slug: string
): Promise<StorefrontResult<Product | null>> {
  try {
    if (!slug) {
      return { success: false, error: "Product slug is required." };
    }

    const productsRef = collection(db, "products");
    const q = query(
      productsRef,
      where("slug", "==", slug),
      where("isActive", "==", true),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      const data = docSnap.data();
      const product: Product = {
        id: docSnap.id,
        name: data.name || "",
        slug: data.slug || docSnap.id,
        description: data.description || "",
        price: Number(data.price) || 0,
        discountPrice: data.discountPrice ? Number(data.discountPrice) : undefined,
        stockQuantity: Number(data.stockQuantity) || 0,
        category: data.category || "General",
        imageUrl: data.imageUrl || "/images/placeholder.webp",
        galleryImages: data.galleryImages || [],
        unit: data.unit || "kg",
        sku: data.sku || "",
        isFeatured: Boolean(data.isFeatured),
        isActive: data.isActive !== false,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
      return { success: true, data: product };
    }

    // Direct ID fallback lookup
    const directDocRef = doc(db, "products", slug);
    const directSnap = await getDoc(directDocRef);

    if (directSnap.exists() && directSnap.data().isActive !== false) {
      const data = directSnap.data();
      const product: Product = {
        id: directSnap.id,
        name: data.name || "",
        slug: data.slug || directSnap.id,
        description: data.description || "",
        price: Number(data.price) || 0,
        discountPrice: data.discountPrice ? Number(data.discountPrice) : undefined,
        stockQuantity: Number(data.stockQuantity) || 0,
        category: data.category || "General",
        imageUrl: data.imageUrl || "/images/placeholder.webp",
        galleryImages: data.galleryImages || [],
        unit: data.unit || "kg",
        sku: data.sku || "",
        isFeatured: Boolean(data.isFeatured),
        isActive: data.isActive !== false,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
      return { success: true, data: product };
    }

    return { success: true, data: null };
  } catch (error: any) {
    console.error(`Firestore getProductBySlug (${slug}) error:`, error);
    return {
      success: false,
      error: error?.message || `Failed to fetch product "${slug}".`,
    };
  }
}

/**
 * Fetch featured products for homepage and showcase banners
 */
export async function getFeaturedProducts(
  limitCount: number = 6
): Promise<StorefrontResult<Product[]>> {
  try {
    const productsRef = collection(db, "products");
    const q = query(
      productsRef,
      where("isActive", "==", true),
      where("isFeatured", "==", true),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    const products: Product[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name || "",
        slug: data.slug || d.id,
        description: data.description || "",
        price: Number(data.price) || 0,
        discountPrice: data.discountPrice ? Number(data.discountPrice) : undefined,
        stockQuantity: Number(data.stockQuantity) || 0,
        category: data.category || "General",
        imageUrl: data.imageUrl || "/images/placeholder.webp",
        galleryImages: data.galleryImages || [],
        unit: data.unit || "kg",
        sku: data.sku || "",
        isFeatured: true,
        isActive: true,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
    });

    return { success: true, data: products };
  } catch (error: any) {
    console.error("Firestore getFeaturedProducts error:", error);
    return {
      success: false,
      error: error?.message || "Failed to fetch featured products.",
    };
  }
}

/**
 * Fetch all product categories ordered by priority
 */
export async function getProductCategories(): Promise<
  StorefrontResult<ProductCategory[]>
> {
  try {
    const categoriesRef = collection(db, "product_categories");
    const q = query(categoriesRef, orderBy("priority", "asc"));
    const snapshot = await getDocs(q);

    const categories: ProductCategory[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        _id: d.id,
        _owner: data._owner || "admin",
        _createdDate: data.createdAt || data._createdDate || new Date().toISOString(),
        _updatedDate: data.updatedAt || data._updatedDate || new Date().toISOString(),
        priority: Number(data.priority) || 0,
        slug: data.slug || d.id,
        title: data.title || "",
        imageUrl: data.imageUrl || "/images/placeholder.webp",
        description: data.description || "",
        products: Array.isArray(data.products) ? data.products : [],
      };
    });

    return { success: true, data: categories };
  } catch (error: any) {
    console.error("Firestore getProductCategories error:", error);
    return {
      success: false,
      error: error?.message || "Failed to fetch product categories.",
    };
  }
}

// ============================================================================
// B. SERVICES (`services`)
// ============================================================================

/**
 * Fetch all industrial and chemical application services ordered by priority
 */
export async function getServices(): Promise<StorefrontResult<Service[]>> {
  try {
    const servicesRef = collection(db, "services");
    const q = query(servicesRef, orderBy("priority", "asc"));
    const snapshot = await getDocs(q);

    const services: Service[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        _id: d.id,
        title: data.title || "",
        slug: data.slug || d.id,
        description: data.description || "",
        image: data.image || data.imageUrl || "/images/placeholder.webp",
        createdAt: data.createdAt || new Date().toISOString(),
      };
    });

    return { success: true, data: services };
  } catch (error: any) {
    console.error("Firestore getServices error:", error);
    return {
      success: false,
      error: error?.message || "Failed to fetch chemical services.",
    };
  }
}

/**
 * Fetch a single chemical service by its slug
 */
export async function getServiceBySlug(
  slug: string
): Promise<StorefrontResult<Service | null>> {
  try {
    if (!slug) {
      return { success: false, error: "Service slug is required." };
    }

    const servicesRef = collection(db, "services");
    const q = query(servicesRef, where("slug", "==", slug), limit(1));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      const data = docSnap.data();
      const service: Service = {
        _id: docSnap.id,
        title: data.title || "",
        slug: data.slug || docSnap.id,
        description: data.description || "",
        image: data.image || data.imageUrl || "/images/placeholder.webp",
        createdAt: data.createdAt || new Date().toISOString(),
      };
      return { success: true, data: service };
    }

    // Direct ID fallback lookup
    const directDocRef = doc(db, "services", slug);
    const directSnap = await getDoc(directDocRef);

    if (directSnap.exists()) {
      const data = directSnap.data();
      const service: Service = {
        _id: directSnap.id,
        title: data.title || "",
        slug: data.slug || directSnap.id,
        description: data.description || "",
        image: data.image || data.imageUrl || "/images/placeholder.webp",
        createdAt: data.createdAt || new Date().toISOString(),
      };
      return { success: true, data: service };
    }

    return { success: true, data: null };
  } catch (error: any) {
    console.error(`Firestore getServiceBySlug (${slug}) error:`, error);
    return {
      success: false,
      error: error?.message || `Failed to fetch service "${slug}".`,
    };
  }
}

// ============================================================================
// C. BLOG & CONTENT (`blog_posts`, `testimonials`)
// ============================================================================

/**
 * Fetch all published blog articles ordered by publication date descending
 */
export async function getBlogPosts(): Promise<StorefrontResult<BlogPost[]>> {
  try {
    const blogRef = collection(db, "blog_posts");
    const q = query(blogRef, orderBy("publishDate", "desc"));
    const snapshot = await getDocs(q);

    const posts: BlogPost[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title || "",
        slug: data.slug || d.id,
        excerpt: data.excerpt || "",
        content: data.content || "",
        featuredImage: data.featuredImage || "/images/placeholder.webp",
        publishDate: data.publishDate || data.createdAt || new Date().toISOString(),
        author: {
          name: data.author?.name || "OSVID Technical Team",
          avatar: data.author?.avatar || undefined,
        },
        category: data.category || "Chemical Applications",
        tags: Array.isArray(data.tags) ? data.tags : [],
        comments: Number(data.comments) || 0,
      };
    });

    return { success: true, data: posts };
  } catch (error: any) {
    console.error("Firestore getBlogPosts error:", error);
    return {
      success: false,
      error: error?.message || "Failed to fetch blog posts.",
    };
  }
}

/**
 * Fetch a single blog post by its unique URL slug
 */
export async function getBlogPostBySlug(
  slug: string
): Promise<StorefrontResult<BlogPost | null>> {
  try {
    if (!slug) {
      return { success: false, error: "Blog slug is required." };
    }

    const blogRef = collection(db, "blog_posts");
    const q = query(blogRef, where("slug", "==", slug), limit(1));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      const data = docSnap.data();
      const post: BlogPost = {
        id: docSnap.id,
        title: data.title || "",
        slug: data.slug || docSnap.id,
        excerpt: data.excerpt || "",
        content: data.content || "",
        featuredImage: data.featuredImage || "/images/placeholder.webp",
        publishDate: data.publishDate || data.createdAt || new Date().toISOString(),
        author: {
          name: data.author?.name || "OSVID Technical Team",
          avatar: data.author?.avatar || undefined,
        },
        category: data.category || "Chemical Applications",
        tags: Array.isArray(data.tags) ? data.tags : [],
        comments: Number(data.comments) || 0,
      };
      return { success: true, data: post };
    }

    return { success: true, data: null };
  } catch (error: any) {
    console.error(`Firestore getBlogPostBySlug (${slug}) error:`, error);
    return {
      success: false,
      error: error?.message || `Failed to fetch blog post "${slug}".`,
    };
  }
}

/**
 * Fetch client testimonials and satisfaction ratings
 */
export async function getTestimonials(): Promise<StorefrontResult<Testimonial[]>> {
  try {
    const testimonialsRef = collection(db, "testimonials");
    const q = query(testimonialsRef, orderBy("rating", "desc"));
    const snapshot = await getDocs(q);

    const testimonials: Testimonial[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        name: data.name || "Anonymous Client",
        role: data.role || "Verified Buyer",
        content: data.content || "",
        imageUrl: data.imageUrl || null,
        rating: Number(data.rating) || 5,
      };
    });

    return { success: true, data: testimonials };
  } catch (error: any) {
    console.error("Firestore getTestimonials error:", error);
    return {
      success: false,
      error: error?.message || "Failed to fetch testimonials.",
    };
  }
}

/**
 * Fetch company team members from Firestore teams collection or fallback
 */
export async function getTeamMembers(): Promise<StorefrontResult<TeamMember[]>> {
  try {
    const teamsRef = collection(db, "teams");
    const q = query(teamsRef, orderBy("createdAt", "asc"), limit(12));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const members: TeamMember[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          name: data.name || "Team Member",
          role: data.role || "Specialist",
          imageUrl: data.imageUrl || "/images/team-placeholder.jpg",
        };
      });
      return { success: true, data: members };
    }

    // Default static team members if collection is not yet populated
    const defaultMembers: TeamMember[] = [
      {
        name: "Engr. Osvid Alabi",
        role: "Managing Director & Chief Chemist",
        imageUrl: "/images/team-1.webp",
      },
      {
        name: "Sarah Adebayo",
        role: "Head of Quality Assurance & R&D",
        imageUrl: "/images/team-placeholder.jpg",
      },
      {
        name: "Michael Okonkwo",
        role: "Lead Field Applications Engineer",
        imageUrl: "/images/team-placeholder.jpg",
      },
      {
        name: "Grace Ekwueme",
        role: "Client Technical Support Manager",
        imageUrl: "/images/team-placeholder.jpg",
      },
    ];

    return { success: true, data: defaultMembers };
  } catch (error: any) {
    console.error("Firestore getTeamMembers error:", error);
    return {
      success: false,
      error: error?.message || "Failed to fetch team members.",
    };
  }
}

// ============================================================================
// D. BACK-IN-STOCK & LEAD FORMS (`back_in_stock_requests`, `contact_submissions`)
// ============================================================================

export interface BackInStockInput {
  productId: string;
  productName: string;
  email: string;
  itemUrl?: string;
}

/**
 * Record a customer back-in-stock alert notification request
 */
export async function requestBackInStock(
  data: BackInStockInput
): Promise<StorefrontResult<{ requestId: string }>> {
  try {
    if (!data.email || !data.productId) {
      return {
        success: false,
        error: "Product ID and customer email are required.",
      };
    }

    const payload = {
      productId: data.productId,
      productName: data.productName || "Product",
      email: data.email.trim().toLowerCase(),
      itemUrl: data.itemUrl || "",
      status: "pending",
      createdAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
    };

    const docRef = await addDoc(
      collection(db, "back_in_stock_requests"),
      payload
    );

    return { success: true, data: { requestId: docRef.id } };
  } catch (error: any) {
    console.error("Firestore requestBackInStock error:", error);
    return {
      success: false,
      error: error?.message || "Failed to register back-in-stock notification.",
    };
  }
}

export interface ContactSubmissionInput {
  name: string;
  email: string;
  message: string;
  phone?: string;
  subject?: string;
}

/**
 * Record an incoming customer contact form or technical inquiry
 */
export async function submitContactForm(
  data: ContactSubmissionInput
): Promise<StorefrontResult<{ submissionId: string }>> {
  try {
    if (!data.name || !data.email || !data.message) {
      return {
        success: false,
        error: "Name, email, and message are required fields.",
      };
    }

    const payload = {
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone?.trim() || "",
      subject: data.subject?.trim() || "Storefront Contact Inquiry",
      message: data.message.trim(),
      status: "unread",
      createdAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "contact_submissions"), payload);

    return { success: true, data: { submissionId: docRef.id } };
  } catch (error: any) {
    console.error("Firestore submitContactForm error:", error);
    return {
      success: false,
      error: error?.message || "Failed to submit contact message.",
    };
  }
}
