import ContactForm from "@/components/reusables/forms/ContactForm";
import PageHeader from "@/components/reusables/PageHeader";
import companyData from "@/data/company";
import React from "react";

export default function ContactPage() {
  return (
    <main>
      {/* Page Header */}
      <PageHeader title="Contact" />

      {/* Contact Section */}
      <section className="container px-4 py-16 md:px-14 grid md:grid-cols-2 gap-12">
        {/* Left Side: Contact Form */}
        <div className="flex flex-col gap-6 max-w-md">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            Send Us a Message
          </h2>

          <ContactForm />
        </div>

        {/* Right Side: Company Info */}
        <div className="flex flex-col gap-8">
          <div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">
              Head Office
            </h3>
            <p className="text-gray-600">{companyData.address}</p>
          </div>

          <div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">
              Contact Info
            </h3>
            <p className="text-gray-600">Phone: {companyData.phone}</p>
            <p className="text-gray-600">Email: {companyData.email}</p>
          </div>

          <div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">
              Business Hours
            </h3>
            <p className="text-gray-600">Mon - Fri: 8:00am - 5:00pm</p>
            <p className="text-gray-600">Saturday: 9:00am - 2:00pm</p>
            <p className="text-gray-600">Sunday: Closed</p>
          </div>
        </div>
      </section>
    </main>
  );
}
