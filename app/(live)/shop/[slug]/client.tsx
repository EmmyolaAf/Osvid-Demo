"use client";

import Badge from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { checkInStock, findVariant } from "@/lib/utils";
import { products } from "@wix/stores";
import { ShoppingCart } from "lucide-react";
import { useState } from "react";
import ProductOptions from "./ProductOptions";
import ProductPrice from "./ProductPrice";
import companyData from "@/data/company";
import formatCurrency from "@/helpers/formatCurrency";
import { useCart } from "@/providers/CartProvider";
import { toast } from "sonner";
import { BulkDiscount } from "@/components/reusables/CompactBulkOrder";

interface ProductDetailsProps {
  product: products.Product;
}

export default function ProductDetails({ product }: ProductDetailsProps) {
  const { addToCart, openCart } = useCart();
  // const { toast } = useToast();
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(
    product.media?.mainMedia?.image?.url || ""
  );
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string>
  >(
    product.productOptions
      ?.map((option) => ({
        [option.name || ""]: option.choices?.[0].description || "",
      }))
      ?.reduce((acc, curr) => ({ ...acc, ...curr }), {}) || {}
  );

  const selectedVariant = findVariant(product, selectedOptions);
  const inStock = checkInStock(product, selectedOptions);

  const availableQuantity =
    selectedVariant?.stock?.quantity ?? product.stock?.quantity;

  const availableQuantityExceeded =
    !!availableQuantity && quantity > availableQuantity;

  const handleQuantityChange = (delta: number) => {
    setQuantity((prevQuantity) => {
      const newQuantity = prevQuantity + delta;
      if (newQuantity < 1) return 1;
      if (availableQuantity && newQuantity > availableQuantity) {
        return availableQuantity;
      }
      return newQuantity;
    });
  };

  const handleAddToCart = () => {
    if (!inStock) {
      toast.warning("Out of Stock");
      return;
    }

    setIsAddingToCart(true);

    try {
      // Prepare cart item data
      const cartItem = {
        id: product._id!,
        name: product.name!,
        imageUrl: product.media?.mainMedia?.image?.url || "",
        variant: selectedVariant
          ? Object.values(selectedOptions).join(", ")
          : undefined,
        priceData: {
          price: product.priceData?.price || 0,
          currency: product.priceData?.currency || "NGN",
          formatted: {
            price: formatCurrency(
              product.priceData?.currency || "NGN",
              product.priceData?.price || 0
            ),
          },
        },
      };

      addToCart(cartItem, quantity);
      openCart(); // Optional: Open cart drawer after adding

      toast.success("Added to Cart");
    } catch (error) {
      console.error(error);

      toast.error("Failed to add item to cart");
    } finally {
      setIsAddingToCart(false);
    }
  };

  // WhatsApp Message Generation
  const productOwnerWhatsAppNumber = companyData.whatsapp.replace(/\D/g, "");
  const productOwnerWhatsAppNumberWithCountryCode = `234${productOwnerWhatsAppNumber}`;
  const whatsappMessage = `Hello, I'm interested in your product: ${
    product.name
  }.
Price: ${formatCurrency("NGN", product.priceData?.price ?? 0)}.
Quantity: ${quantity}.
${
  selectedVariant
    ? `Selected Variant: ${Object.values(selectedOptions).join(", ")}.`
    : ""
}
Product Link: ${process.env.NEXT_PUBLIC_SITE_URL}/shop/${product.slug}`;

  const encodedMessage = encodeURIComponent(whatsappMessage);
  const whatsappLink = `https://wa.me/${productOwnerWhatsAppNumberWithCountryCode}?text=${encodedMessage}`;

  return (
    <div className="flex flex-col gap-10 md:flex-row lg:gap-20 container py-8">
      {/* Product Images - Left Column */}
      <div className="md:w-6/12 w-full flex flex-col-reverse md:flex-row gap-4">
        {/* Thumbnail Gallery */}
        {product.media?.items && product.media.items.length > 1 && (
          <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto pb-2 md:pb-0 scrollbar-hide flex-shrink-0">
            {product.media.items.map((mediaItem, index) => {
              const imageUrl = mediaItem.image?.url;
              if (!imageUrl) return null;

              return (
                <img
                  key={mediaItem._id || index}
                  src={imageUrl}
                  alt={`${product.name} thumbnail ${index + 1}`}
                  className={`w-20 h-20 object-cover rounded-md cursor-pointer border-2 transition-all duration-200 ${
                    activeImage === imageUrl
                      ? "border-osvid-blue"
                      : "border-transparent hover:border-gray-300"
                  }`}
                  onClick={() => setActiveImage(imageUrl)}
                />
              );
            })}
          </div>
        )}

        {/* Main Product Image */}
        <div className="flex-1 h-96 md:h-[36rem] relative overflow-hidden rounded-lg shadow-lg">
          {activeImage ? (
            <img
              src={activeImage}
              alt={product.name ?? "Product Image"}
              className="w-full h-full object-contain"
            />
          ) : product.media?.mainMedia?.image?.url ? (
            <img
              src={product.media.mainMedia.image.url}
              alt={product.name ?? "Product Image"}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400">
              No Image Available
            </div>
          )}
        </div>
      </div>

      {/* Product Details - Right Column */}
      <div className="basis-3/5 space-y-6">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold lg:text-4xl text-gray-900">
            {product.name}
          </h1>
          {product.brand && (
            <p className="text-muted-foreground text-lg font-medium">
              Brand: {product.brand}
            </p>
          )}
          {product.ribbon && (
            <Badge className="inline-block px-3 py-1 bg-osvid-orange text-white rounded-full text-sm">
              {product.ribbon}
            </Badge>
          )}
        </div>

        {product.description && (
          <div
            dangerouslySetInnerHTML={{ __html: product.description }}
            className="prose dark:prose-invert text-gray-700 leading-relaxed max-w-none"
          />
        )}

        <ProductPrice product={product} selectedVariant={selectedVariant} />

        <ProductOptions
          product={product}
          selectedOptions={selectedOptions}
          setSelectedOptions={setSelectedOptions}
        />

        {/* Quantity Selector */}
        <div className="space-y-1.5">
          <Label htmlFor="quantity" className="text-lg font-semibold">
            Quantity
          </Label>
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleQuantityChange(-1)}
              disabled={quantity <= 1}
            >
              -
            </Button>
            <Input
              name="quantity"
              type="number"
              value={quantity}
              onChange={(e) => {
                const value = Math.max(1, Number(e.target.value));
                setQuantity(
                  availableQuantity ? Math.min(value, availableQuantity) : value
                );
              }}
              className="w-24 text-center text-lg font-semibold"
              disabled={!inStock}
              min={1}
              max={availableQuantity || undefined}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleQuantityChange(1)}
              disabled={!!availableQuantity && quantity >= availableQuantity}
            >
              +
            </Button>
            {!!availableQuantity &&
              (availableQuantityExceeded || availableQuantity < 10) && (
                <span
                  className={`text-sm font-medium ${
                    availableQuantityExceeded
                      ? "text-red-600"
                      : "text-orange-600"
                  }`}
                >
                  Only {availableQuantity} left in stock!
                </span>
              )}
            {!inStock && (
              <span className="text-destructive font-semibold">
                Out of Stock
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 pt-2">
          <Button
            size="lg"
            className="flex-1 py-6 text-lg"
            onClick={handleAddToCart}
            disabled={!inStock || isAddingToCart}
          >
            {isAddingToCart ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Adding...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                {inStock ? "Add to Cart" : "Out of Stock"}
              </span>
            )}
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="flex-1 py-6 text-lg"
            asChild
          >
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
              Contact via WhatsApp
            </a>
          </Button>
        </div>

        {/* Additional Product Information */}
        {/* {!!product.additionalInfoSections?.length && (
          <div className="space-y-4 mt-8">
            <span className="flex items-center gap-2 text-base text-gray-700 font-semibold">
              <InfoIcon className="size-5 text-osvid-blue" />
              <span>Additional Product Information</span>
            </span>
            <Accordion type="multiple" className="w-full">
              {product.additionalInfoSections.map((section, index) => (
                <AccordionItem
                  value={section.title || `section-${index}`}
                  key={section.title || `section-${index}`}
                  className="border-b border-gray-200"
                >
                  <AccordionTrigger className="text-lg font-medium text-gray-800 hover:no-underline py-4">
                    {section.title}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div
                      dangerouslySetInnerHTML={{
                        __html: section.description || "",
                      }}
                      className="prose text-base text-gray-700 dark:prose-invert max-w-none pt-2 pb-4"
                    />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )} */}

        <BulkDiscount percentage={10} minItems={5} />
      </div>
    </div>
  );
}
