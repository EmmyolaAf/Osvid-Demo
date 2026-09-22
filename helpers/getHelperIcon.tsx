// Helper function to get a specific icon for each core value

import companyData from "@/data/company";

// You might want to get these from your `companyData` if they are defined there.
const getCoreValueIcon = (index: number) => {
  const icons = ["✨", "🤝", "Innovation", "🛡️", "🌍", "🏆"]; // Example emojis for illustration
  // Map specific values to icons if companyData.coreValues has unique IDs/labels
  switch (companyData.coreValues[index]?.label) {
    case "Integrity":
      return "🤝";
    case "Innovation":
      return "💡";
    case "Customer Centricity":
      return "🌟"; // Or another suitable emoji
    case "Quality Excellence":
      return "🏆";
    case "Sustainability":
      return "🌱";
    default:
      return icons[index % icons.length]; // Fallback for other values
  }
};

export default getCoreValueIcon;
