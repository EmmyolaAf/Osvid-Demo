"use client";

import Image from "next/image";

interface CartItemImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
}

export function CartItemImage({
  src,
  alt,
  width,
  height,
  className,
}: CartItemImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
    />
  );
}
