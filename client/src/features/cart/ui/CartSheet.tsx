import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, Plus, Minus, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/common/ui/components/sheet";
import { Button } from "@/common/ui/components/button";
import { useCart, discountedPrice } from "@/features/cart/data/CartContext";
import { ikUrl } from "@/common/utils/utils";

export default function CartSheet() {
  const { items, count, subtotal, setQuantity, removeItem } = useCart();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const goCheckout = () => {
    setOpen(false);
    navigate("/checkout");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Open cart">
          <ShoppingCart className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground">
              {count}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Your Cart</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <p className="mt-8 text-center text-muted-foreground">
            Your cart is empty.
          </p>
        ) : (
          <div className="-mx-6 flex-1 divide-y overflow-y-auto px-6">
            {items.map((item) => (
              <div key={item.productId} className="flex gap-3 py-4">
                <img
                  src={ikUrl(item.imageUrl, "w-160,q-80,f-auto")}
                  alt={item.name}
                  className="h-16 w-16 rounded object-cover"
                />
                <div className="flex flex-1 flex-col">
                  <span className="line-clamp-2 text-sm font-medium">
                    {item.name}
                  </span>
                  <span className="text-sm font-semibold">
                    ${discountedPrice(item.price, item.discountPercentage).toFixed(2)}
                  </span>
                  <div className="mt-auto flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setQuantity(item.productId, item.quantity - 1)}
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setQuantity(item.productId, item.quantity + 1)}
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-auto h-7 w-7 text-destructive"
                      onClick={() => removeItem(item.productId)}
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <SheetFooter className="mt-auto flex-col gap-3 border-t pt-4 sm:flex-col sm:space-x-0">
            <div className="flex w-full justify-between text-sm">
              <span>Subtotal</span>
              <span className="font-semibold">${subtotal.toFixed(2)}</span>
            </div>
            <Button className="w-full" onClick={goCheckout}>
              Checkout
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
