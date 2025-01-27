import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AdWizard from "./components/AdWizard";
import AppLayout from "./components/layout/AppLayout";

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/ad-wizard/*" element={<AdWizard />} />
        <Route path="*" element={
          <AppLayout>
            <div>Welcome to the application!</div>
          </AppLayout>
        } />
      </Routes>
    </Router>
  );
};

export default App;