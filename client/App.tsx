import "./global.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";
import Index from "./pages/Index";
import ComicDetail from "./pages/ComicDetail";
import AddComic from "./pages/AddComic";
import EditComic from "./pages/EditComic";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Library from "./pages/Library";
import SubmitRequest from "./pages/SubmitRequest";
import MyRequests from "./pages/MyRequests";
import AdminRequests from "./pages/AdminRequests";
import AdminRequestReview from "./pages/AdminRequestReview";
import Series from "./pages/Series";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { AppErrorBoundary } from "./components/app/AppErrorBoundary";
import { ProtectedRoute } from "./components/app/ProtectedRoute";
const queryClient = new QueryClient();
const App = () => (
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Index />} />
              <Route path="/series/:category" element={<Series />} />

              <Route
                path="/comic/:id"
                element={
                  <ProtectedRoute>
                    <ComicDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/library"
                element={
                  <ProtectedRoute>
                    <Library />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/add-comic"
                element={
                  <ProtectedRoute adminOnly>
                    <AddComic />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/edit-comic/:id"
                element={
                  <ProtectedRoute adminOnly>
                    <EditComic />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/submit-request"
                element={
                  <ProtectedRoute>
                    <SubmitRequest />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-requests"
                element={
                  <ProtectedRoute>
                    <MyRequests />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/requests"
                element={
                  <ProtectedRoute adminOnly>
                    <AdminRequests />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/requests/:id"
                element={
                  <ProtectedRoute adminOnly>
                    <AdminRequestReview />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </AppErrorBoundary>
);
createRoot(document.getElementById("root")!).render(<App />);
