export interface Product {
  _id: string;
  cartItemId: string;
  name: string;
  slug: string;
  description?: string;
  quantity: number;
  priceData?: {
    currency: string;
    price: number | string;
    discountedPrice?: number | string;
    formatted?: {
      price: string;
      discountedPrice?: string;
    };
  };
  price?: number | string;
  discountPrice?: number | string;
  media?: {
    mainMedia?: {
      image?: {
        url: string;
        width?: number;
        height?: number;
      };
    };
  };
}

export interface mProduct {
  _id: string;
  name: string;
  description?: string;
  price: number;
  discountPrice?: number;
  image: string;
  slug: string;
  // Add any other product fields you need
}

export interface CartItem {
  _id: string;
  cartItemId: string;
  name: string;
  slug: string;
  description?: string;
  quantity: number;
  priceData?: {
    currency: string;
    price: number | string;
    discountedPrice?: number | string;
    formatted?: {
      price: string;
      discountedPrice?: string;
    };
  };
  price?: number | string;
  discountPrice?: number | string;
  media?: {
    mainMedia?: {
      image?: {
        url: string;
        width?: number;
        height?: number;
      };
    };
  };
  // Add any other fields you need from the product data
}

// The full Cart structure
export type CartType = {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
};

// Logged-in member details
export type MemberType = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  roles?: string[];
};

// Product Collection (e.g., categories, groupings)
export type Collection = {
  id: string;
  title: string;
  slug: string;
  description?: string;
  image?: string;
};

// All collections
export type CollectionsType = Collection[];

// types/Cart.type.ts
import { currentCart } from "@wix/ecom";

interface AugmentedCartProperties {
  subtotal?: {
    amount?: number;
    formattedAmount?: string;
    formattedConvertedAmount?: string;
  };
  total?: {
    amount?: number;
    formattedAmount?: string;
    formattedConvertedAmount?: string;
  };
  // Add other properties you expect from the fetched cart data
  // e.g., discounts, tax, etc.
}

export interface AugmentedCart
  extends currentCart.Cart,
    AugmentedCartProperties {}

// Optional: If line items also need augmentation beyond the base type
// interface AugmentedCartLineItem extends currentCart.LineItem {
//    // Add properties here if needed
// }
// Update AugmentedCart to use AugmentedCartLineItem if needed
// export interface AugmentedCart extends currentCart.Cart, AugmentedCartProperties {
//     lineItems?: AugmentedCartLineItem[];
// }

export interface Service {
  _id: string;
  title: string;
  slug: string;
  description: string;
  image?: string;
  createdAt?: string;
  // ...add other fields as needed
}

export interface TeamMember {
  name: string;
  role: string;
  imageUrl: string;
}

export interface Testimonial {
  name: string;
  role: string;
  content: string;
  imageUrl?: string | null;
  rating: number;
}

export interface CoreValue {
  id: string;
  label: string;
  description: string;
  icon?: string; // optional if you want to display custom icons later
}
// types.ts
export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string | { richText?: any[]; nodes?: any[]; documentStyle?: any };
  featuredImage?: string;
  publishDate?: string | Date;
  author?: {
    name: string;
    avatar?: string;
  };
  category?: string;
  tags?: string[];
  comments?: number;
}

export interface ProductCategory {
  _id: string;
  _owner: string;
  _createdDate: string; // ISO 8601 string
  _updatedDate: string; // ISO 8601 string
  priority: number; // Used for sorting, lower number = higher priority
  slug: string; // Unique slug for the category
  title: string;
  imageUrl?: string; // URL to the category image
  description: string;
  products?: string[]; // Array of product IDs, if linked
  content?: {
    nodes?: any[];
    documentStyle?: Record<string, any>; // More specific than just `any` if possible
    metadata?: Record<string, any>;
  };
  // Add other fields from your Wix collection if they are relevant for the category display
  // e.g., imageUrl?: string; if you store image URLs directly
}

// Main ContentViewer component
interface ContentNode {
  type: string;
  id?: string;
  nodes?: ContentNode[];
  textData?: {
    text: string;
    decorations: any[];
  };
  headingData?: {
    level: number;
    text: string;
    decorations?: any[]; // Headings can also have inline decorations
  };
  imageData?: {
    src: string;
    alt?: string;
    width?: number;
    height?: number;
  };
  listData?: {
    items: Array<{
      textData: {
        text: string;
        decorations: any[];
      };
    }>;
  };
  quoteData?: {
    text: string;
    decorations: any[];
  };
  codeData?: {
    text: string;
  };
}
