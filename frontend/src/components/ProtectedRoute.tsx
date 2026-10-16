
import { Navigate, Outlet } from "react-router-dom";
import { useApp } from "../context/AppContext";

export default function ProtectedRoute() {
    const { token, loading } = useApp();

    // Show loading spinner while checking authentication
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-dark-900">
                <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // Redirect unauthenticated users
    if (!token) {
        return <Navigate to="/login" replace />;
    }

    // Render protected routes
    return <Outlet />;
}
