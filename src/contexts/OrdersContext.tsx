import { createContext, useContext, useState, ReactNode } from "react";

export type Order = {
  id: string;
  order_number: string;
  client_name: string;
  vendor_name: string;
  status: "pending" | "processing" | "delivered" | "cancelled";
  total_amount: number;
  order_date: string;
  items_count: number;
};

const INITIAL_ORDERS: Order[] = [
  {
    id: "ord_001",
    order_number: "ORD-001",
    client_name: "Tech Solutions Inc",
    vendor_name: "Global Supplies",
    status: "delivered",
    total_amount: 15000,
    order_date: "2024-01-10",
    items_count: 5,
  },
  {
    id: "ord_002",
    order_number: "ORD-002",
    client_name: "Marketing Pro Agency",
    vendor_name: "Equipment Rentals",
    status: "processing",
    total_amount: 8500,
    order_date: "2024-01-15",
    items_count: 3,
  },
  {
    id: "ord_003",
    order_number: "ORD-003",
    client_name: "Finance Corp",
    vendor_name: "Tech Solutions Ltd",
    status: "pending",
    total_amount: 22000,
    order_date: "2024-01-20",
    items_count: 8,
  },
  {
    id: "ord_004",
    order_number: "ORD-004",
    client_name: "Global Trading Ltd",
    vendor_name: "Global Supplies",
    status: "cancelled",
    total_amount: 5500,
    order_date: "2024-01-25",
    items_count: 2,
  },
];

interface OrdersContextType {
  orders: Order[];
  addOrder: (order: Omit<Order, "id">) => string;
  deleteOrder: (id: string) => void;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);

  const addOrder = (order: Omit<Order, "id">): string => {
    const id = `ord_${Date.now()}`;
    setOrders((prev) => [{ ...order, id }, ...prev]);
    return id;
  };

  const deleteOrder = (id: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== id));
  };

  return (
    <OrdersContext.Provider value={{ orders, addOrder, deleteOrder }}>
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used within an OrdersProvider");
  return ctx;
}
