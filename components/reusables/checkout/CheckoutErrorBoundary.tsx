// components/reusables/checkout/CheckoutErrorBoundary.tsx
"use client";

import { Component, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class CheckoutErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  handleReset = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center text-center py-20 text-red-500">
          <AlertTriangle className="w-10 h-10 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Something went wrong.</h2>
          <p className="mb-4">
            Please try refreshing the page or check your inputs.
          </p>
          <Button onClick={this.handleReset}>Reload Page</Button>
        </div>
      );
    }

    return this.props.children;
  }
}
