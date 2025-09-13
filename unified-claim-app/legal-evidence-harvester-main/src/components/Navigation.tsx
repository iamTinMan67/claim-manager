
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Users, LogOut, User, RefreshCw, Calendar, CheckSquare, Share2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, refreshUserSession } = useAuth();

  const navItems = [
    { path: "/", label: "Claims", icon: Home },
    { path: "/calendar", label: "Calendar", icon: Calendar },
    { path: "/todos", label: "To-Do List", icon: CheckSquare },
    { path: "/shared", label: "Shared Claims", icon: Share2 },
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  const handleRefreshSession = async () => {
    await refreshUserSession();
  };

  return (
    <nav className="bg-blue-600 text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <h1 className="text-xl font-bold">Claim Manager</h1>
            <div className="flex space-x-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-blue-700 text-white"
                        : "text-blue-100 hover:bg-blue-500 hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
          
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-white hover:bg-blue-500">
                  <User className="w-4 h-4 mr-2" />
                  {user.email}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleRefreshSession}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Session
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </nav>
  );
};
