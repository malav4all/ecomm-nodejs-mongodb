import { UUID } from "mongodb";
import mongoose, { Document } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export interface IOrderProduct {
  productId: string;
  quantity: number;
  priceAtPurchase: number;
}

export interface IOrder extends Document {
  _id: string;
  customerId: string;
  products: IOrderProduct[];
  totalAmount: number;
  orderDate: Date;
  status: "pending" | "completed";
}

const OrderSchema = new mongoose.Schema({
  _id: { type: String, default: UUID },
  customerId: { type: String, ref: "Customer", required: true },
  products: [
    {
      productId: { type: String, ref: "Product", required: true },
      quantity: { type: Number, required: true },
      priceAtPurchase: { type: Number, required: true },
    },
  ],
  totalAmount: { type: Number, required: true },
  orderDate: { type: Date, default: Date.now },
  status: { type: String, enum: ["pending", "completed"], required: true },
});

export const Order = mongoose.model<IOrder>("Order", OrderSchema);
