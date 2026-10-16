
import axios, { type AxiosInstance } from "axios";
import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react";

interface User {
    id: string;
    name: string;
    email: string;
    plan?: string;
    analysisCount?: number;
}

interface AppContextType {
    user: User | null;
    token: string | null;
    loading: boolean;
    api: AxiosInstance;

    login: (
        email: string,
        password: string
    ) => Promise<{ success: boolean; message?: string }>;

    register: (
        name: string,
        email: string,
        password: string
    ) => Promise<{ success: boolean; message?: string }>;

    logout: () => void;
}

const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(
        () => localStorage.getItem("token")
    );
    const [loading, setLoading] = useState(true);

    // Axios instance
    const api = axios.create({
        baseURL: BACKEND_URL,
    });

    // Attach the latest JWT to API requests
    api.interceptors.request.use((config) => {
        const storedToken = localStorage.getItem("token");

        if (storedToken) {
            config.headers.Authorization = `Bearer ${storedToken}`;
        }

        return config;
    });

    // Load authenticated user on app startup
    useEffect(() => {
        const loadUser = async () => {
            const storedToken = localStorage.getItem("token");

            if (!storedToken) {
                setLoading(false);
                return;
            }

            try {
                const { data } = await api.get("/api/auth/user");

                if (data.success) {
                    setUser(data.user);
                } else {
                    localStorage.removeItem("token");
                    setToken(null);
                }
            } catch {
                localStorage.removeItem("token");
                setToken(null);
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        loadUser();
    }, []);

    // Login
    const login = async (email: string, password: string) => {
        try {
            const { data } = await api.post("/api/auth/login", {
                email,
                password,
            });

            if (data.success) {
                localStorage.setItem("token", data.token);
                setToken(data.token);
                setUser(data.user);

                return { success: true };
            }

            return {
                success: false,
                message: data.message || "Login failed",
            };
        } catch (error: unknown) {
            const message = axios.isAxiosError(error)
                ? error.response?.data?.message || "Login failed"
                : "An unexpected error occurred";

            return { success: false, message };
        }
    };

    // Register
    const register = async (
        name: string,
        email: string,
        password: string
    ) => {
        try {
            const { data } = await api.post("/api/auth/register", {
                name,
                email,
                password,
            });

            if (data.success) {
                localStorage.setItem("token", data.token);
                setToken(data.token);
                setUser(data.user);

                return { success: true };
            }

            return {
                success: false,
                message: data.message || "Registration failed",
            };
        } catch (error: unknown) {
            const message = axios.isAxiosError(error)
                ? error.response?.data?.message || "Registration failed"
                : "An unexpected error occurred";

            return { success: false, message };
        }
    };

    // Logout
    const logout = () => {
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
    };

    const value: AppContextType = {
        user,
        token,
        loading,
        api,
        login,
        register,
        logout,
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const context = useContext(AppContext);

    if (!context) {
        throw new Error("useApp must be used within AppProvider");
    }

    return context;
}
