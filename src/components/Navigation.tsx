import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Home, CreditCard, PlusCircle } from "lucide-react";
import { CreditDisplay } from "./CreditDisplay";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState("");
  
  const isActive = (path: string) => {
    if (path === "/") {
      return currentPath === "/" || currentPath === "/projects";
    }
    if (path === "/ad-wizard") {
      return currentPath.includes('/ad-wizard');
    }
    return currentPath === path;
  };

  const handleStartClick = () => {
    navigate("/ad-wizard/new");
  };

  const handleNavigationAttempt = (path: string) => {
    // Only show confirmation if we're in step 4 of the wizard
    if (currentPath.includes('/ad-wizard') && !currentPath.includes('/new')) {
      setShowLeaveDialog(true);
      setPendingNavigation(path);
    } else {
      navigate(path);
    }
  };

  const handleConfirmNavigation = () => {
    setShowLeaveDialog(false);
    navigate(pendingNavigation);
  };
  
  return (
    <>
      <nav className="fixed top-0 left-0 right-0 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="container h-full">
          <div className="flex h-full items-center justify-between">
            <Link to="/" className="font-semibold">
              Viable
            </Link>
            <div className="flex items-center gap-4">
              <CreditDisplay />
              <Button
                variant="default"
                size="sm"
                onClick={handleStartClick}
                className="gap-2"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Start</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleNavigationAttempt("/")}
                className={cn(
                  "gap-2",
                  isActive("/") && "bg-accent"
                )}
              >
                <Home className="h-4 w-4" />
                <span>Home</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className={cn(
                  "gap-2",
                  isActive("/pricing") && "bg-accent"
                )}
              >
                <Link to="/pricing">
                  <CreditCard className="h-4 w-4" />
                  <span>Pricing</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Ad Wizard?</AlertDialogTitle>
            <AlertDialogDescription>
              Your progress in the current step will be lost. Are you sure you want to leave?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmNavigation}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Navigation;