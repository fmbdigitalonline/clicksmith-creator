import { useLocation } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useAdWizardState } from "@/hooks/useAdWizardState";

const BreadcrumbNav = () => {
  const location = useLocation();
  const { currentStep } = useAdWizardState();
  const pathSegments = location.pathname.split("/").filter(Boolean);

  console.log("Current path segments:", pathSegments, "Current step:", currentStep);

  const getDisplayName = (segment: string) => {
    // If we're in the wizard and on step 4, show the correct step
    if (segment === "new" && currentStep === 4) {
      return "Ad Gallery";
    }
    
    switch (segment) {
      case "ad-wizard":
        return "Ad Wizard";
      case "saved-ads":
        return "Saved Ads";
      case "new":
        return "New Ad";
      default:
        return segment.charAt(0).toUpperCase() + segment.slice(1);
    }
  };

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Home</BreadcrumbLink>
        </BreadcrumbItem>
        {pathSegments.map((segment, index) => {
          const path = `/${pathSegments.slice(0, index + 1).join("/")}`;
          return (
            <BreadcrumbItem key={path}>
              <BreadcrumbSeparator />
              <BreadcrumbLink href={path}>
                {getDisplayName(segment)}
              </BreadcrumbLink>
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

export default BreadcrumbNav;