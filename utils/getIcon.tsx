import { FaFlask, FaHammer, FaPaintRoller } from "react-icons/fa";

const getIcon = (serviceName: string) => {
  if (
    serviceName.toLowerCase().includes("coating") ||
    serviceName.toLowerCase().includes("sealant")
  )
    return <FaPaintRoller size={24} className="text-osvid-orange" />;
  if (
    serviceName.toLowerCase().includes("installation") ||
    serviceName.toLowerCase().includes("concrete")
  )
    return <FaHammer size={24} className="text-osvid-orange" />;
  if (
    serviceName.toLowerCase().includes("chemical") ||
    serviceName.toLowerCase().includes("adhesive")
  )
    return <FaFlask size={24} className="text-osvid-orange" />;
  return <FaFlask size={24} className="text-osvid-orange" />; // Default icon
};

export default getIcon;
