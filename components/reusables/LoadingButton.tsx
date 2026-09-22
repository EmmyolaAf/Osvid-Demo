import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { Button, ButtonProps } from "../ui/button";

interface LoadingButtonProps extends ButtonProps {
  loading: boolean;
}

export default function LoadingButton({
  loading,
  disabled,
  className,
  ...props
}: LoadingButtonProps) {
  return (
    <Button
      disabled={loading || disabled}
      className={cn(
        "flex items-center gap-2 py-6 bg-osvid-blue text-osvid-soft-yellow font-medium text-base",
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="size-5 animate-spin" />}
      {props.children}
    </Button>
  );
}
