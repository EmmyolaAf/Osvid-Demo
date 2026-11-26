import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const sa = JSON.parse(fs.readFileSync('./firebase-service-account.json', 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const servicesData = [
  {
    id: "srv_surface_coating",
    title: "Surface Coating, Installation & Finishing",
    description: "Expert application of sealants, stamped concrete design, adhesive installations, concrete polishing, and brick finishing for durable and beautiful surfaces.",
    slug: "surface-coating",
    image: "https://oc0zbmw1i8.ufs.sh/f/zhN3yTMP32cOrARyhwX5YhBq3gjWcTuUDKedVMHr9sRpFiSA",
    priority: 1,
    isActive: true,
    published: true,
    isPublished: true,
  },
  {
    id: "srv_epoxy_flooring",
    title: "Epoxy Flooring & Wall Installation",
    description: "High-performance epoxy floors and wall coatings for warehouses, hospitals, showrooms, and homes, including decorative, self-leveling, and anti-slip finishes.",
    slug: "epoxy-flooring",
    image: "https://oc0zbmw1i8.ufs.sh/f/zhN3yTMP32cOmEGLnQo4lryG5Lx2zcPUbgWQEhSJ0OaeR38X",
    priority: 2,
    isActive: true,
    published: true,
    isPublished: true,
  },
  {
    id: "srv_bulk_supply",
    title: "Bulk Supply & Wholesale Distribution",
    description: "Reliable large-scale supply of construction chemicals for contractors, retailers, and builders across Nigeria, with competitive pricing and prompt delivery.",
    slug: "bulk-supply",
    image: "https://oc0zbmw1i8.ufs.sh/f/zhN3yTMP32cOQO5DfmsoP58UmVxD62qybavgGp9OzRN17sdn",
    priority: 3,
    isActive: true,
    published: true,
    isPublished: true,
  },
  {
    id: "srv_custom_formulation",
    title: "Custom Chemical Formulation",
    description: "Manufacturing of specialized adhesives, sealants, and coatings tailored to meet your exact industrial or commercial needs.",
    slug: "custom-chemical-formulation",
    image: "https://oc0zbmw1i8.ufs.sh/f/zhN3yTMP32cO4RKqBRo29zDEJLNn8fWc20MAoOjeY4mvTK3i",
    priority: 4,
    isActive: true,
    published: true,
    isPublished: true,
  },
  {
    id: "srv_oem_manufacturing",
    title: "OEM (Private Label Manufacturing)",
    description: "Start your adhesive or sealant brand with our confidential OEM services: custom blends, branding, labeling, and full production support.",
    slug: "oem-manufacturing",
    image: "https://oc0zbmw1i8.ufs.sh/f/zhN3yTMP32cOvTIJnrSOIWUTC0ndipjHQJEw3rFD8KS1BMxf",
    priority: 5,
    isActive: true,
    published: true,
    isPublished: true,
  },
  {
    id: "srv_technical_support",
    title: "Technical Consultation & Support",
    description: "Expert guidance on product usage, surface preparation, troubleshooting, and achieving perfect application results before, during, and after your projects.",
    slug: "technical-support",
    image: "https://oc0zbmw1i8.ufs.sh/f/zhN3yTMP32cO7MHjcU5aHJ8vfQEFC4bnsLWtRNGdUci5B1kM",
    priority: 6,
    isActive: true,
    published: true,
    isPublished: true,
  },
];

async function run() {
  console.log("Seeding services into Firestore...");
  const batch = db.batch();
  for (const s of servicesData) {
    const ref = db.collection("services").doc(s.id);
    batch.set(ref, {
      ...s,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }
  await batch.commit();
  console.log("Seeded", servicesData.length, "services successfully!");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
