import "server-only";

/**
 * Server-Side Storefront Services (Admin SDK Firestore Read Adapter)
 *
 * Enforces strict public boundary:
 * - Admin SDK queries bypass Security Rules, so these queries strictly enforce
 *   visibility filtering (e.g. isActive == true) and public field projection.
 * - Categories: Excludes documents explicitly marked isActive == false while
 *   preserving legacy documents where isActive is undefined.
 * - Services, Blog Posts, Testimonials, Team: Respects existing publication / active
 *   flags if present.
 * - Never returns raw Admin SDK errors, credential errors, or transport diagnostics
 *   to public pages. Logs server-side and returns customer-safe error messages.
 * - Marked "server-only" to guarantee it cannot ever be bundled into client components.
 */

import { adminDb } from "@/lib/firebase/admin";
import type { QueryDocumentSnapshot, DocumentData } from "firebase-admin/firestore";
import fs from "node:fs/promises";
import path from "node:path";
import { Product } from "@/types/auth";
import {
  ProductCategory,
  Service,
  BlogPost,
  Testimonial,
  TeamMember,
} from "@/types";

async function getLocalProducts(): Promise<Product[]> {
  try {
    const filePath = path.join(process.cwd(), "data", "products.json");
    const data = await fs.readFile(filePath, "utf8");
    return JSON.parse(data) as Product[];
  } catch (err) {
    return [];
  }
}

export type StorefrontResult<T> =
  | { success: true; data: T; error?: never }
  | { success: false; error: string; data?: never };

/**
 * Fetch all active products, optionally filtered by category
 */
export async function getServerProducts(
  categorySlug?: string
): Promise<StorefrontResult<Product[]>> {
  try {
    const snapshot = await adminDb
      .collection("products")
      .where("isActive", "==", true)
      .get();
    let products: Product[] = [];

    if (snapshot.docs.length > 0) {
      products = snapshot.docs
        .map((d: QueryDocumentSnapshot<DocumentData>) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || "",
            slug: data.slug || d.id,
            description: data.description || "",
            shortDescription: data.shortDescription || "",
            productType: data.productType || "simple",
            price: Number(data.price) || 0,
            discountPrice: data.discountPrice ? Number(data.discountPrice) : undefined,
            stockQuantity: Number(data.stockQuantity) || 0,
            category: data.category || "General",
            categorySlug: data.categorySlug || data.category?.toLowerCase().replace(/\s+/g, "-"),
            imageUrl: data.imageUrl || "/images/placeholder.webp",
            galleryImages: Array.isArray(data.galleryImages) ? data.galleryImages : [],
            unit: data.unit || "kg",
            sku: data.sku || "",
            isFeatured: Boolean(data.isFeatured),
            isActive: true,
            pricingTierId: data.pricingTierId,
            pricingTierName: data.pricingTierName,
            pricingTiers: data.pricingTiers,
            createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
            updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
          };
        })
        .filter((p) => {
          if (!categorySlug || categorySlug === "all") return true;
          const lower = categorySlug.toLowerCase();
          return (
            p.category?.toLowerCase() === lower ||
            p.categorySlug?.toLowerCase() === lower
          );
        });

      products.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else {
      // Resilient fallback to local catalog when Firestore has no active documents
      const local = await getLocalProducts();
      products = local.filter((p) => {
        if (p.isActive === false) return false;
        if (categorySlug && categorySlug !== "all") {
          return (
            p.category?.toLowerCase() === categorySlug.toLowerCase() ||
            p.categorySlug?.toLowerCase() === categorySlug.toLowerCase()
          );
        }
        return true;
      });
    }

    return { success: true, data: products };
  } catch (error: any) {
    console.error("Storefront getServerProducts error, falling back to local catalogue:", error?.message);
    const local = await getLocalProducts();
    const products = local.filter((p) => {
      if (p.isActive === false) return false;
      if (categorySlug && categorySlug !== "all") {
        return (
          p.category?.toLowerCase() === categorySlug.toLowerCase() ||
          p.categorySlug?.toLowerCase() === categorySlug.toLowerCase()
        );
      }
      return true;
    });
    return { success: true, data: products };
  }
}

/**
 * Fetch a single active product by slug or ID
 */
export async function getServerProductBySlug(
  slug: string
): Promise<StorefrontResult<Product | null>> {
  try {
    if (!slug) {
      return { success: false, error: "Product slug is required." };
    }

    const snapshot = await adminDb
      .collection("products")
      .where("slug", "==", slug)
      .where("isActive", "==", true)
      .limit(1)
      .get();

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
        galleryImages: Array.isArray(data.galleryImages) ? data.galleryImages : [],
        unit: data.unit || "kg",
        sku: data.sku || "",
        isFeatured: Boolean(data.isFeatured),
        isActive: true,
        createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
        updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
      };
      return { success: true, data: product };
    }

    // Direct ID fallback lookup
    const directDoc = await adminDb.collection("products").doc(slug).get();
    if (directDoc.exists) {
      const data = directDoc.data() || {};
      if (data.isActive === true) {
        const product: Product = {
          id: directDoc.id,
          name: data.name || "",
          slug: data.slug || directDoc.id,
          description: data.description || "",
          price: Number(data.price) || 0,
          discountPrice: data.discountPrice ? Number(data.discountPrice) : undefined,
          stockQuantity: Number(data.stockQuantity) || 0,
          category: data.category || "General",
          imageUrl: data.imageUrl || "/images/placeholder.webp",
          galleryImages: Array.isArray(data.galleryImages) ? data.galleryImages : [],
          unit: data.unit || "kg",
          sku: data.sku || "",
          isFeatured: Boolean(data.isFeatured),
          isActive: true,
          createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
          updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
        };
        return { success: true, data: product };
      }
    }

    // Local catalog fallback
    const local = await getLocalProducts();
    const found = local.find(
      (p) =>
        (p.slug === slug || p.id === slug) &&
        p.isActive !== false
    );
    if (found) {
      return { success: true, data: found };
    }

    return { success: true, data: null };
  } catch (error: any) {
    console.error(`Storefront getServerProductBySlug (${slug}) error, checking local fallback:`, error?.message);
    const local = await getLocalProducts();
    const found = local.find(
      (p) => (p.slug === slug || p.id === slug) && p.isActive !== false
    );
    if (found) {
      return { success: true, data: found };
    }
    return {
      success: false,
      error: "Unable to load product details right now.",
    };
  }
}

/**
 * Fetch featured products for homepage showcase
 */
export async function getServerFeaturedProducts(
  limitCount: number = 6
): Promise<StorefrontResult<Product[]>> {
  try {
    const snapshot = await adminDb
      .collection("products")
      .where("isActive", "==", true)
      .where("isFeatured", "==", true)
      .limit(limitCount)
      .get();

    let products: Product[] = [];
    if (snapshot.docs.length > 0) {
      products = snapshot.docs.map((d: QueryDocumentSnapshot<DocumentData>) => {
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
          galleryImages: Array.isArray(data.galleryImages) ? data.galleryImages : [],
          unit: data.unit || "kg",
          sku: data.sku || "",
          isFeatured: true,
          isActive: true,
          createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
          updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
        };
      });
    } else {
      const local = await getLocalProducts();
      const featured = local.filter((p) => p.isActive !== false && p.isFeatured);
      products = (featured.length > 0 ? featured : local.filter((p) => p.isActive !== false)).slice(0, limitCount);
    }

    return { success: true, data: products };
  } catch (error: any) {
    console.error("Storefront getServerFeaturedProducts error, checking local fallback:", error?.message);
    const local = await getLocalProducts();
    const featured = local.filter((p) => p.isActive !== false && p.isFeatured);
    const products = (featured.length > 0 ? featured : local.filter((p) => p.isActive !== false)).slice(0, limitCount);
    return { success: true, data: products };
  }
}

/**
 * Fetch all product categories
 *
 * Strict public visibility:
 * - Excludes categories where isActive === false.
 * - Preserves compatibility with legacy category documents where isActive is omitted.
 */
export async function getServerProductCategories(): Promise<
  StorefrontResult<ProductCategory[]>
> {
  try {
    const snapshot = await adminDb
      .collection("product_categories")
      .orderBy("priority", "asc")
      .get();

    const categories: ProductCategory[] = snapshot.docs
      .filter((d: QueryDocumentSnapshot<DocumentData>) => d.data().isActive !== false)
      .map((d: QueryDocumentSnapshot<DocumentData>) => {
        const data = d.data();
        return {
          _id: d.id,
          _owner: "admin",
          _createdDate: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
          _updatedDate: typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
          priority: Number(data.priority) || 0,
          slug: data.slug || d.id,
          title: data.title || data.name || "",
          imageUrl: data.imageUrl || "/images/placeholder.webp",
          description: data.description || "",
          products: Array.isArray(data.products) ? data.products : [],
        };
      });

    return { success: true, data: categories };
  } catch (error: any) {
    console.error("Server Firestore getProductCategories error, using default categories:", error?.message);
    const defaults: ProductCategory[] = [
      {
        _id: "cat_waterproofing",
        _owner: "admin",
        _createdDate: new Date().toISOString(),
        _updatedDate: new Date().toISOString(),
        priority: 1,
        slug: "waterproofing-sealants",
        title: "Waterproofing & Sealants",
        imageUrl: "/images/products/aquablock.webp",
        description: "Advanced elastomeric waterproofing membranes and sealants",
        products: [],
      },
      {
        _id: "cat_epoxy",
        _owner: "admin",
        _createdDate: new Date().toISOString(),
        _updatedDate: new Date().toISOString(),
        priority: 2,
        slug: "epoxy-resins",
        title: "Epoxy & Resins",
        imageUrl: "/images/products/epoxshield.webp",
        description: "Heavy-duty 3D epoxy flooring and industrial resins",
        products: [],
      },
      {
        _id: "cat_adhesives",
        _owner: "admin",
        _createdDate: new Date().toISOString(),
        _updatedDate: new Date().toISOString(),
        priority: 3,
        slug: "industrial-adhesives",
        title: "Industrial Adhesives",
        imageUrl: "/images/products/osvid-bond-glue.webp",
        description: "High-strength structural and industrial adhesives",
        products: [],
      },
      {
        _id: "cat_grout",
        _owner: "admin",
        _createdDate: new Date().toISOString(),
        _updatedDate: new Date().toISOString(),
        priority: 4,
        slug: "grout-tile-care",
        title: "Grout & Tile Care",
        imageUrl: "/images/products/tile-master.webp",
        description: "Anti-fungal waterproof tile grouts and tile adhesives",
        products: [],
      },
      {
        _id: "cat_concrete",
        _owner: "admin",
        _createdDate: new Date().toISOString(),
        _updatedDate: new Date().toISOString(),
        priority: 5,
        slug: "concrete-admixtures",
        title: "Concrete & Admixtures",
        imageUrl: "/images/products/plastcrete.webp",
        description: "Superplasticizers, accelerators, and concrete admixtures",
        products: [],
      },
      {
        _id: "cat_chemicals",
        _owner: "admin",
        _createdDate: new Date().toISOString(),
        _updatedDate: new Date().toISOString(),
        priority: 6,
        slug: "industrial-chemicals",
        title: "Industrial Chemicals",
        imageUrl: "/images/placeholder.webp",
        description: "Specialized chemical formulations and raw ingredients",
        products: [],
      },
    ];
    return { success: true, data: defaults };
  }
}

/**
 * Fetch all chemical services
 *
 * Visibility: Excludes services explicitly marked inactive or unpublished.
 */
export async function getServerServices(): Promise<StorefrontResult<Service[]>> {
  try {
    const snapshot = await adminDb
      .collection("services")
      .orderBy("priority", "asc")
      .get();

    const services: Service[] = snapshot.docs
      .filter((d: QueryDocumentSnapshot<DocumentData>) => {
        const data = d.data();
        return data.isActive !== false && data.published !== false && data.isPublished !== false;
      })
      .map((d: QueryDocumentSnapshot<DocumentData>) => {
        const data = d.data();
        return {
          _id: d.id,
          title: data.title || "",
          slug: data.slug || d.id,
          description: data.description || "",
          image: data.image || data.imageUrl || "/images/placeholder.webp",
          createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
        };
      });

    return { success: true, data: services };
  } catch (error: any) {
    console.error("Server Firestore getServices error:", error);
    return {
      success: false,
      error: "Unable to load chemical services right now.",
    };
  }
}

/**
 * Fetch a single chemical service by slug
 */
export async function getServerServiceBySlug(
  slug: string
): Promise<StorefrontResult<Service | null>> {
  try {
    if (!slug) {
      return { success: false, error: "Service slug is required." };
    }

    const snapshot = await adminDb
      .collection("services")
      .where("slug", "==", slug)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      const data = docSnap.data();
      if (data.isActive !== false && data.published !== false && data.isPublished !== false) {
        return {
          success: true,
          data: {
            _id: docSnap.id,
            title: data.title || "",
            slug: data.slug || docSnap.id,
            description: data.description || "",
            image: data.image || data.imageUrl || "/images/placeholder.webp",
            createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
          },
        };
      }
    }

    const directDoc = await adminDb.collection("services").doc(slug).get();
    if (directDoc.exists) {
      const data = directDoc.data() || {};
      if (data.isActive !== false && data.published !== false && data.isPublished !== false) {
        return {
          success: true,
          data: {
            _id: directDoc.id,
            title: data.title || "",
            slug: data.slug || directDoc.id,
            description: data.description || "",
            image: data.image || data.imageUrl || "/images/placeholder.webp",
            createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
          },
        };
      }
    }

    return { success: true, data: null };
  } catch (error: any) {
    console.error(`Server Firestore getServiceBySlug (${slug}) error:`, error);
    return {
      success: false,
      error: "Unable to load chemical service details right now.",
    };
  }
}

/**
 * Fetch published blog articles
 *
 * Visibility: Excludes articles explicitly marked inactive or unpublished.
 */
export async function getServerBlogPosts(): Promise<StorefrontResult<BlogPost[]>> {
  try {
    const snapshot = await adminDb
      .collection("blog_posts")
      .orderBy("publishDate", "desc")
      .get();

    const posts: BlogPost[] = snapshot.docs
      .filter((d: QueryDocumentSnapshot<DocumentData>) => {
        const data = d.data();
        return data.isActive !== false && data.published !== false && data.isPublished !== false;
      })
      .map((d: QueryDocumentSnapshot<DocumentData>) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title || "",
          slug: data.slug || d.id,
          excerpt: data.excerpt || "",
          content: data.content || "",
          featuredImage: data.featuredImage || "/images/placeholder.webp",
          publishDate: typeof data.publishDate === "string" ? data.publishDate : new Date().toISOString(),
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
    console.error("Server Firestore getBlogPosts error:", error);
    return {
      success: false,
      error: "Unable to load blog posts right now.",
    };
  }
}

/**
 * Fetch a single blog post by slug
 */
export async function getServerBlogPostBySlug(
  slug: string
): Promise<StorefrontResult<BlogPost | null>> {
  try {
    if (!slug) {
      return { success: false, error: "Blog slug is required." };
    }

    const snapshot = await adminDb
      .collection("blog_posts")
      .where("slug", "==", slug)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      const data = docSnap.data();
      if (data.isActive !== false && data.published !== false && data.isPublished !== false) {
        return {
          success: true,
          data: {
            id: docSnap.id,
            title: data.title || "",
            slug: data.slug || docSnap.id,
            excerpt: data.excerpt || "",
            content: data.content || "",
            featuredImage: data.featuredImage || "/images/placeholder.webp",
            publishDate: typeof data.publishDate === "string" ? data.publishDate : new Date().toISOString(),
            author: {
              name: data.author?.name || "OSVID Technical Team",
              avatar: data.author?.avatar || undefined,
            },
            category: data.category || "Chemical Applications",
            tags: Array.isArray(data.tags) ? data.tags : [],
            comments: Number(data.comments) || 0,
          },
        };
      }
    }

    return { success: true, data: null };
  } catch (error: any) {
    console.error(`Server Firestore getBlogPostBySlug (${slug}) error:`, error);
    return {
      success: false,
      error: "Unable to load blog post right now.",
    };
  }
}

/**
 * Fetch customer testimonials
 */
export async function getServerTestimonials(): Promise<StorefrontResult<Testimonial[]>> {
  try {
    const snapshot = await adminDb
      .collection("testimonials")
      .orderBy("rating", "desc")
      .get();

    const testimonials: Testimonial[] = snapshot.docs
      .filter((d: QueryDocumentSnapshot<DocumentData>) => {
        const data = d.data();
        return data.isActive !== false && data.published !== false;
      })
      .map((d: QueryDocumentSnapshot<DocumentData>) => {
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
    console.error("Server Firestore getTestimonials error:", error);
    return {
      success: false,
      error: "Unable to load testimonials right now.",
    };
  }
}

/**
 * Fetch team members
 */
export async function getServerTeamMembers(): Promise<StorefrontResult<TeamMember[]>> {
  try {
    const snapshot = await adminDb
      .collection("teams")
      .orderBy("createdAt", "asc")
      .limit(12)
      .get();

    if (!snapshot.empty) {
      const members: TeamMember[] = snapshot.docs
        .filter((d: QueryDocumentSnapshot<DocumentData>) => d.data().isActive !== false)
        .map((d: QueryDocumentSnapshot<DocumentData>) => {
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
    console.error("Server Firestore getTeamMembers error:", error);
    return {
      success: false,
      error: "Unable to load team members right now.",
    };
  }
}

// Aliases matching storefront function signatures for Server Components
export {
  getServerProducts as getProducts,
  getServerProductBySlug as getProductBySlug,
  getServerFeaturedProducts as getFeaturedProducts,
  getServerProductCategories as getProductCategories,
  getServerServices as getServices,
  getServerServiceBySlug as getServiceBySlug,
  getServerBlogPosts as getBlogPosts,
  getServerBlogPostBySlug as getBlogPostBySlug,
  getServerTestimonials as getTestimonials,
  getServerTeamMembers as getTeamMembers,
};
