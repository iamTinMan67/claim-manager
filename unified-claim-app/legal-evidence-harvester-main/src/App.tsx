
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Calendar from "./pages/Calendar";
import Todos from "./pages/Todos";
import Shared from "./pages/Shared";
import Auth from "./pages/Auth";
import { DonationSuccess } from "./pages/DonationSuccess";
import { DonationPayment } from "./pages/DonationPayment";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<Index />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/todos" element={<Todos />} />
            <Route path="/shared" element={<Shared />} />
            <Route path="/donation-success" element={<DonationSuccess />} />
            <Route path="/donation-payment" element={<DonationPayment />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
