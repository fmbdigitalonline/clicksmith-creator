import Navigation from "../Navigation";
import AppSidebar from "../AppSidebar";
import BreadcrumbNav from "../Breadcrumb";

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex flex-col w-full min-h-screen">
      <Navigation />
      <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] mt-16">
        <AppSidebar />
        <main className="flex-1 p-3 md:p-6 overflow-auto">
          <div className="glass p-3 md:p-6 min-h-[calc(100vh-8rem)]" role="main" aria-label="Main content">
            <BreadcrumbNav />
            <div className="mt-4 md:mt-6">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;