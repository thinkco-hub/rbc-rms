import type { PosProduct } from "../types/domain";

// POS product catalog (static seed for the POS grid; cart state lives in usePos)
export const initialPosProducts: PosProduct[] = [
  {
    id: "p1",
    name: "Butter Croissant",
    price: 120,
    category: "Pastries",
    color: "bg-amber-400",
  },
  {
    id: "p2",
    name: "Almond Croissant",
    price: 150,
    category: "Pastries",
    color: "bg-amber-500",
  },
  {
    id: "p3",
    name: "Pain au Chocolat",
    price: 140,
    category: "Pastries",
    color: "bg-orange-400",
  },
  {
    id: "p4",
    name: "Sourdough Loaf",
    price: 200,
    category: "Bread",
    color: "bg-stone-400",
  },
  {
    id: "p5",
    name: "Baguette",
    price: 110,
    category: "Bread",
    color: "bg-stone-300",
  },
  {
    id: "p6",
    name: "Blueberry Muffin",
    price: 95,
    category: "Pastries",
    color: "bg-purple-400",
  },
  {
    id: "p7",
    name: "Choco Chip Cookie",
    price: 75,
    category: "Pastries",
    color: "bg-yellow-600",
  },
  {
    id: "p8",
    name: "Chocolate Cake",
    price: 180,
    category: "Cakes",
    color: "bg-[#562D07]",
  },
  {
    id: "p9",
    name: "Strawberry Tart",
    price: 160,
    category: "Cakes",
    color: "bg-red-400",
  },
  {
    id: "p10",
    name: "Americano",
    price: 110,
    category: "Drinks",
    color: "bg-gray-800",
  },
  {
    id: "p11",
    name: "Cafe Latte",
    price: 140,
    category: "Drinks",
    color: "bg-orange-800",
  },
  {
    id: "p12",
    name: "Orange Juice",
    price: 90,
    category: "Drinks",
    color: "bg-orange-500",
  },
];