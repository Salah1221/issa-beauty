import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { User, Package, ShoppingCart, Moon, Sun, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/common/ui/components/avatar";
import { Badge } from "@/common/ui/components/badge";
import { Button } from "@/common/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/common/ui/components/dropdown-menu";
import { useCart } from "@/features/cart/data/CartContext";

// Single navbar hub: cart, orders, theme, and (placeholder) auth live behind
// one avatar so the mobile navbar stays uncluttered. Becomes the real account
// menu once customer accounts exist.
export default function AccountMenu() {
  const { count, setOpen: setCartOpen } = useCart();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    if (saved) {
      setTheme(saved);
      document.body.classList.toggle("dark", saved === "dark");
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.body.classList.toggle("dark", next === "dark");
    localStorage.setItem("theme", next);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="Account menu">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-muted">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          {count > 0 && (
            <Badge className="absolute -right-1 -top-1 h-4 min-w-4 justify-center rounded-full border-transparent px-1 text-[10px] font-bold leading-none">
              {count}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Guest</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* Defer opening to the next frame so the menu closes first (avoids the
            dropdown/sheet focus-trap race). */}
        <DropdownMenuItem onSelect={() => requestAnimationFrame(() => setCartOpen(true))}>
          <ShoppingCart className="mr-2 h-4 w-4" />
          Cart
          {count > 0 && (
            <Badge className="ml-auto h-5 min-w-5 justify-center rounded-full border-transparent px-1.5">
              {count}
            </Badge>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/orders">
            <Package className="mr-2 h-4 w-4" />
            My Orders
          </Link>
        </DropdownMenuItem>
        {mounted && (
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); toggleTheme(); }}>
            {theme === "light" ? <Moon className="mr-2 h-4 w-4" /> : <Sun className="mr-2 h-4 w-4" />}
            {theme === "light" ? "Dark mode" : "Light mode"}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => toast("Accounts are coming soon.")}>
          <LogIn className="mr-2 h-4 w-4" />
          Log in / Sign up
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
