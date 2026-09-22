import { JSX } from "react";

export interface ServiceCategory {
  id: number;
  title: string;
  description: string;
  slug: string;
  image: string;
}

export const services: ServiceCategory[] = [
  {
    id: 1,
    title: "Surface Coating, Installation & Finishing",
    description:
      "Expert application of sealants, stamped concrete design, adhesive installations, concrete polishing, and brick finishing for durable and beautiful surfaces.",
    slug: "surface-coating",
    image: "https://oc0zbmw1i8.ufs.sh/f/zhN3yTMP32cOrARyhwX5YhBq3gjWcTuUDKedVMHr9sRpFiSA",
  },
  {
    id: 2,
    title: "Epoxy Flooring & Wall Installation",
    description:
      "High-performance epoxy floors and wall coatings for warehouses, hospitals, showrooms, and homes, including decorative, self-leveling, and anti-slip finishes.",
    slug: "epoxy-flooring",
    image: "https://oc0zbmw1i8.ufs.sh/f/zhN3yTMP32cOmEGLnQo4lryG5Lx2zcPUbgWQEhSJ0OaeR38X",
  },
  {
    id: 3,
    title: "Bulk Supply & Wholesale Distribution",
    description:
      "Reliable large-scale supply of construction chemicals for contractors, retailers, and builders across Nigeria, with competitive pricing and prompt delivery.",
    slug: "bulk-supply",
    image: "https://oc0zbmw1i8.ufs.sh/f/zhN3yTMP32cOQO5DfmsoP58UmVxD62qybavgGp9OzRN17sdn",
  },
  {
    id: 4,
    title: "Custom Chemical Formulation",
    description:
      "Manufacturing of specialized adhesives, sealants, and coatings tailored to meet your exact industrial or commercial needs.",
    slug: "custom-chemical-formulation",
    image: "https://oc0zbmw1i8.ufs.sh/f/zhN3yTMP32cO4RKqBRo29zDEJLNn8fWc20MAoOjeY4mvTK3i",
  },
  {
    id: 5,
    title: "OEM (Private Label Manufacturing)",
    description:
      "Start your adhesive or sealant brand with our confidential OEM services — custom blends, branding, labeling, and full production support.",
    slug: "oem-manufacturing",
    image: "https://oc0zbmw1i8.ufs.sh/f/zhN3yTMP32cOvTIJnrSOIWUTC0ndipjHQJEw3rFD8KS1BMxf",
  },
  {
    id: 6,
    title: "Technical Consultation & Support",
    description:
      "Expert guidance on product usage, surface preparation, troubleshooting, and achieving perfect application results — before, during, and after your projects.",
    slug: "technical-support",
    image: "https://oc0zbmw1i8.ufs.sh/f/zhN3yTMP32cO7MHjcU5aHJ8vfQEFC4bnsLWtRNGdUci5B1kM",
  },
];

export default services;
