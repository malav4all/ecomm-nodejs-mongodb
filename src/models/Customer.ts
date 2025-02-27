import mongoose, { Document } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export interface ICustomer extends Document {
  _id: string;
  name: string;
  email: string;
  age: number;
  location: string;
  gender: string;
}

const CustomerSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  age: { type: Number, required: true },
  location: { type: String, required: true },
  gender: { type: String, enum: ["Male", "Female"], required: true },
});

export const Customer = mongoose.model<ICustomer>("Customer", CustomerSchema);
