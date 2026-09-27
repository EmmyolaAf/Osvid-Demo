"use client";

import React, { useEffect, useState } from "react";
import { getSubscriptionStatus, SubscriptionStatusInfo } from "@/lib/firebase/subscription";
import SuspensionBarrier from "./SuspensionBarrier";
import { useAuth } from "@/contexts/AuthContext";

export default function GlobalSubscriptionGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const [subscription, setSubscription] = useState<SubscriptionStatusInfo | null>(null);
  const { isSuperAdmin } = useAuth();

  useEffect(() => {
    let isMounted = true;
    async function checkStatus() {
      const res = await getSubscriptionStatus();
      if (isMounted && res.success && res.data) {
        setSubscription(res.data);
      }
    }
    checkStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  // If global app is suspended and user is not Super Admin, lock down
  if (subscription?.isSuspended && !isSuperAdmin) {
    return <SuspensionBarrier subscription={subscription as any} />;
  }

  return <>{children}</>;
}
