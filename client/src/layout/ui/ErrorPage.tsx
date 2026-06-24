import { useRouteError, Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "./components/ui/card";

interface RouteError {
  status?: number;
  statusText?: string;
  message?: string;
}

const ErrorPage = () => {
  const error = useRouteError() as RouteError;

  return (
    <div className="min-h-screen flex items-center justify-center max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <Card className="p-8 max-w-md w-full text-center">
        <AlertTriangle className="mx-auto text-red-500 mb-4" size={64} />
        <h1 className="text-4xl font-bold mb-2">Oops!</h1>
        <p className="text-xl mb-4">Looks like an unexpected error occurred</p>
        <div
          className="bg-red-400 border border-red-400 text-red-400 px-4 py-3 rounded mb-4"
          style={{ "--tw-bg-opacity": 0.3 } as React.CSSProperties}
        >
          <p className="font-medium">Error details:</p>
          <p className="italic">
            {error.statusText || error.message || "Unknown error"}
          </p>
        </div>
        <Button asChild className="w-full">
          <Link to="/">Return to Home Page</Link>
        </Button>
      </Card>
    </div>
  );
};

export default ErrorPage;
