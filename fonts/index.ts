import localFont from "next/font/local";

const clashDisplay = localFont({
  src: [
    {
      path: "./clash-display/200.woff2",
      weight: "100",
      style: "normal",
    },
    {
      path: "./clash-display/300.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "./clash-display/400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./clash-display/500.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "./clash-display/600.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "./clash-display/700.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-clash-display",
});

const raleway = localFont({
  src: [
    {
      path: "./raleway/100.woff2",
      weight: "100",
      style: "normal",
    },
    {
      path: "./raleway/200.woff2",
      weight: "200",
      style: "normal",
    },
    {
      path: "./raleway/300.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "./raleway/400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./raleway/600.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "./raleway/700.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "./raleway/800.woff2",
      weight: "800",
      style: "normal",
    },
    {
      path: "./raleway/900.woff2",
      weight: "900",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-raleway",
});

export { clashDisplay, raleway };
