import { UUID } from "mongodb";
import mongoose, { Document } from "mongoose";
// import { v4 as uuidv4 } from "uuid";

export interface IProduct extends Document {
  _id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
}

const ProductSchema = new mongoose.Schema({
  _id: { type: String, default: UUID },
  name: { type: String, required: true },
  category: { type: String, required: true },
  price: { type: Number, required: true },
  stock: { type: Number, required: true },
});

export const Product = mongoose.model<IProduct>("Product", ProductSchema);
