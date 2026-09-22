// components/Analytics.js
import Script from "next/script";

const Analytics = () => {
  if (process.env.NODE_ENV === "production") {
    return (
      <Script
        id="gtm"
        src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS}`}
        strategy="afterInteractive"
      >
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS}');
        `}
      </Script>
    );
  }
  return null;
};

export default Analytics;
