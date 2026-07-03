import { useRouteError, Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/common/ui/components/button";
import { Card } from "@/common/ui/components/card";

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
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="text-destructive" size={36} />
        </div>
        <h1 className="text-4xl font-bold mb-2">Oops!</h1>
        <p className="text-xl text-muted-foreground mb-4">
          Looks like an unexpected error occurred
        </p>
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-md mb-6 text-left">
          <p className="font-medium">Error details</p>
          <p className="italic break-words">
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
