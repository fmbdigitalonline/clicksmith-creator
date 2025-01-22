import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { WizardStateProvider } from "@/components/wizard/WizardStateProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import "./App.css";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WizardStateProvider>
        <BrowserRouter>
          <AppLayout />
          <Toaster />
        </BrowserRouter>
      </WizardStateProvider>
    </QueryClientProvider>
  );
}

export default App;