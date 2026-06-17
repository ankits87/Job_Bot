import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

const navItems = [
  { to: "/profile", label: "Profile" },
  { to: "/jobs", label: "Jobs" },
  { to: "/applications", label: "Applications" },
];

export default function Layout() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => { logout(); navigate("/"); };

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-8">
        <span className="text-blue-400 font-bold text-lg tracking-tight">JobBot</span>
        <div className="flex gap-6 flex-1">
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `text-sm font-medium transition-colors ${isActive ? "text-blue-400" : "text-gray-400 hover:text-gray-100"}`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
        <div className="flex items-center gap-4">
          {user && <span className="text-xs text-gray-500">{user.name}</span>}
          <button onClick={handleLogout} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
            Sign out
          </button>
        </div>
      </nav>
      <main className="flex-1 p-8 max-w-5xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
