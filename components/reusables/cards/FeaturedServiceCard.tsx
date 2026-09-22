import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React from "react";

export default function FeaturedServiceCard() {
  return (
    <div className="h-[28rem] relative w-full max-w-sm">
      <Link href={"/"} className="h-full">
        <Image
          src={"/images/services/service-1.jpg"}
          alt=""
          height={480}
          width={520}
          quality={75}
          className="h-full"
        />
      </Link>

      <div className="absolute bottom-0 left-0 w-full px-2">
        <div className="p-3 px-6 w-max text-stroke-orange bg-black font-semibold text-5xl rounded-tr-xl text-stroke">
          1
        </div>
        <div className="flex h-max justify-end items-end">
          <div className="bg-orange-400 px-6 text-xl font-semibold text-white w-full py-5 h-full">
            Wall Painting
          </div>
          <div className="h-15 w-20 bg-white grid place-items-center border">
            <ArrowUpRight size={32} className="text-gray-700" />
          </div>
        </div>
      </div>
    </div>
  );
}
