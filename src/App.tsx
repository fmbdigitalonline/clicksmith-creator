import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AdWizard from "./components/AdWizard";
import AppLayout from "./components/layout/AppLayout";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      retry: 1,
    },
  },
});

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/ad-wizard/*" element={
            <AppLayout>
              <AdWizard />
            </AppLayout>
          } />
          <Route path="*" element={
            <AppLayout>
              <div>Welcome to the application!</div>
            </AppLayout>
          } />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
};

export default App;