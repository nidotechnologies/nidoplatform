import { ShoppingCart } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';

export default function FloatingCartButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const { items } = useCart();
  const cartPath = location.pathname.startsWith("/portal/")
    ? "/portal/shop/cart"
    : "/shop/cart";

  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <button
      onClick={() => navigate(cartPath)}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#1a2340] hover:bg-[#222d4a] text-white px-5 py-3.5 rounded-2xl shadow-2xl shadow-black/30 transition-colors"
      title="View Cart"
    >
      {/* Cart icon with count badge */}
      <div className="relative">
        <ShoppingCart size={22} strokeWidth={1.8} />
        <span className="absolute -top-2.5 -right-2.5 bg-blue-500 text-white text-[9px] font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none border-2 border-[#1a2340]">
          {totalQty > 99 ? '99+' : totalQty}
        </span>
      </div>

      {/* Text block */}
      <div className="flex flex-col items-start leading-none">
        <span className="text-[13px] font-semibold tracking-wide">Cart</span>
      </div>
    </button>
  );
}
