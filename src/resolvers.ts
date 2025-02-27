import { Order } from "./models/Order";
import { ObjectId, BSON, UUID, Binary } from "mongodb";
import { Product } from "./models/Product";
import mongoose from "mongoose";

export const resolvers = {
  // 1️⃣ Get Customer Spending Using Aggregation
  getCustomerSpending: async ({ customerId }: { customerId: string }) => {
    // Convert UUID string to MongoDB Binary format (Subtype 4)
    const binaryCustomerId = new BSON.Binary(
      Buffer.from(customerId.replace(/-/g, ""), "hex"),
      BSON.Binary.SUBTYPE_UUID
    );

    const result = await Order.aggregate([
      {
        $match: {
          customerId: binaryCustomerId,
        },
      },
      {
        $group: {
          _id: "$customerId",
          totalSpent: { $sum: "$totalAmount" },
          averageOrderValue: { $avg: "$totalAmount" },
          lastOrderDate: { $max: { $toDate: "$orderDate" } },
        },
      },
    ]);

    if (!result.length) {
      return {
        customerId,
        totalSpent: 0,
        averageOrderValue: 0,
        lastOrderDate: null,
      };
    }

    const { totalSpent, averageOrderValue, lastOrderDate } = result[0];

    return {
      customerId,
      totalSpent,
      averageOrderValue,
      lastOrderDate: lastOrderDate ? lastOrderDate.toISOString() : null,
    };
  },

  // 2️⃣ Get Top Selling Products Using Aggregation
  getTopSellingProducts: async ({ limit }: { limit: number }) => {
    try {
      const topSelling = await Order.aggregate([
        // Step 1: Filter orders (adjust the status as needed; your sample uses "dev")
        { $match: { status: "completed" } },
        // Step 2: Parse the products string into an array
        {
          $addFields: {
            parsedProducts: {
              $function: {
                body: function (productsStr: any) {
                  if (typeof productsStr === "string") {
                    try {
                      // Replace single quotes with double quotes and parse the JSON
                      return JSON.parse(productsStr.replace(/'/g, '"'));
                    } catch (e) {
                      return [];
                    }
                  }
                  return Array.isArray(productsStr) ? productsStr : [];
                },
                args: ["$products"],
                lang: "js",
              },
            },
          },
        },
        // Step 3: Unwind the parsed products array
        { $unwind: "$parsedProducts" },
        // Step 4: Group by productId (which is a UUID string) and sum the quantities
        {
          $group: {
            _id: "$parsedProducts.productId",
            totalSold: { $sum: "$parsedProducts.quantity" },
          },
        },
        // Step 5: Sort by totalSold in descending order and limit the results
        { $sort: { totalSold: -1 } },
        { $limit: limit },
        // Step 6: Lookup product details from the products collection using a pipeline
        {
          $lookup: {
            from: "products",
            let: { productId: "$_id" },
            pipeline: [
              {
                $addFields: {
                  productBinaryId: {
                    $function: {
                      body:
                        "function(uuidStr) { " +
                        "  var hexStr = uuidStr.replace(/-/g, ''); " +
                        "  var raw = ''; " +
                        "  for (var i = 0; i < hexStr.length; i += 2) { " +
                        "    raw += String.fromCharCode(parseInt(hexStr.substr(i, 2), 16)); " +
                        "  } " +
                        "  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'; " +
                        "  var base64 = ''; " +
                        "  var j = 0; " +
                        "  while (j < raw.length) { " +
                        "    var byte1 = raw.charCodeAt(j++) & 0xff; " +
                        "    var byte2 = j < raw.length ? raw.charCodeAt(j++) & 0xff : NaN; " +
                        "    var byte3 = j < raw.length ? raw.charCodeAt(j++) & 0xff : NaN; " +
                        "    var enc1 = byte1 >> 2; " +
                        "    var enc2 = ((byte1 & 3) << 4) | (byte2 >> 4); " +
                        "    var enc3 = isNaN(byte2) ? 64 : (((byte2 & 15) << 2) | (byte3 >> 6)); " +
                        "    var enc4 = isNaN(byte3) ? 64 : (byte3 & 63); " +
                        "    base64 += chars.charAt(enc1) + chars.charAt(enc2) + " +
                        "              (enc3 !== 64 ? chars.charAt(enc3) : '=') + " +
                        "              (enc4 !== 64 ? chars.charAt(enc4) : '='); " +
                        "  } " +
                        "  return new BinData(4, base64); " +
                        "}",
                      args: ["$$productId"],
                      lang: "js",
                    },
                  },
                },
              },
              {
                $match: {
                  $expr: { $eq: ["$productBinaryId", "$_id"] },
                },
              },
            ],
            as: "productDetails",
          },
        },

        // Step 7: Unwind the productDetails (keeping orders even if no matching product)
        {
          $unwind: {
            path: "$productDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        // Step 8: Project the final output shape
        {
          $project: {
            productId: "$_id",
            totalSold: 1,
            name: { $ifNull: ["$productDetails.name", "Unknown Product"] },
          },
        },
      ]);

      return topSelling;
    } catch (error) {
      console.error("Error fetching top-selling products:", error);
      return [];
    }
  },

  // 3️⃣ Get Sales Analytics Using Aggregation
  getSalesAnalytics: async ({
    startDate,
    endDate,
  }: {
    startDate: string;
    endDate: string;
  }) => {
    const result = await Order.aggregate([
      {
        $addFields: {
          orderDateConverted: { $toDate: "$orderDate" },
        },
      },
      {
        $match: {
          orderDateConverted: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
          status: "completed",
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
          completedOrders: { $sum: 1 },
        },
      },
    ]);

    const categoryBreakdown = await Order.aggregate([
      // Convert orderDate string to a Date if needed, and parse products if stored as a string
      {
        $addFields: {
          orderDateConverted: { $toDate: "$orderDate" },
          parsedProducts: {
            $cond: {
              if: { $isArray: "$products" },
              then: "$products",
              else: {
                $function: {
                  body:
                    "function(productsStr) { " +
                    "try { " +
                    "  return JSON.parse(productsStr.replace(/'/g, '\"')); " +
                    "} catch(e) { " +
                    "  return []; " +
                    "} " +
                    "}",
                  args: ["$products"],
                  lang: "js",
                },
              },
            },
          },
        },
      },
      {
        $match: {
          orderDateConverted: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
          status: "completed",
        },
      },
      { $unwind: "$parsedProducts" },
      {
        $lookup: {
          from: "products",
          let: { productId: "$parsedProducts.productId" },
          pipeline: [
            {
              $addFields: {
                productBinaryId: {
                  $function: {
                    body:
                      "function(uuidStr) { " +
                      "  var hexStr = uuidStr.replace(/-/g, ''); " +
                      "  var raw = ''; " +
                      "  for (var i = 0; i < hexStr.length; i += 2) { " +
                      "    raw += String.fromCharCode(parseInt(hexStr.substr(i, 2), 16)); " +
                      "  } " +
                      "  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'; " +
                      "  var base64 = ''; " +
                      "  var j = 0; " +
                      "  while (j < raw.length) { " +
                      "    var byte1 = raw.charCodeAt(j++) & 0xff; " +
                      "    var byte2 = j < raw.length ? raw.charCodeAt(j++) & 0xff : NaN; " +
                      "    var byte3 = j < raw.length ? raw.charCodeAt(j++) & 0xff : NaN; " +
                      "    var enc1 = byte1 >> 2; " +
                      "    var enc2 = ((byte1 & 3) << 4) | (byte2 >> 4); " +
                      "    var enc3 = isNaN(byte2) ? 64 : (((byte2 & 15) << 2) | (byte3 >> 6)); " +
                      "    var enc4 = isNaN(byte3) ? 64 : (byte3 & 63); " +
                      "    base64 += chars.charAt(enc1) + chars.charAt(enc2) + " +
                      "              (enc3 !== 64 ? chars.charAt(enc3) : '=') + " +
                      "              (enc4 !== 64 ? chars.charAt(enc4) : '='); " +
                      "  } " +
                      "  return new BinData(4, base64); " +
                      "}",
                    args: ["$$productId"],
                    lang: "js",
                  },
                },
              },
            },
            {
              $match: {
                $expr: { $eq: ["$productBinaryId", "$_id"] },
              },
            },
          ],
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      {
        $group: {
          _id: "$productDetails.category",
          revenue: {
            $sum: {
              $multiply: [
                "$parsedProducts.quantity",
                "$parsedProducts.priceAtPurchase",
              ],
            },
          },
        },
      },
      {
        $project: {
          category: "$_id",
          revenue: 1,
        },
      },
    ]);

    if (!result.length) {
      return {
        totalRevenue: 0,
        completedOrders: 0,
        categoryBreakdown: [],
      };
    }

    const { totalRevenue, completedOrders } = result[0];

    return {
      totalRevenue,
      completedOrders,
      categoryBreakdown,
    };
  },

  getCustomerOrders: async ({
    customerId,
    page = 1,
    limit = 10,
  }: {
    customerId: string;
    page?: number;
    limit?: number;
  }) => {
    try {
      // Calculate skip value for pagination
      const skip = (page - 1) * limit;

      // Convert the UUID string to binary format
      const buffer = Buffer.from(customerId.replace(/-/g, ""), "hex");
      const binaryCustomerId = new BSON.Binary(buffer, 0x04);

      // Create aggregation pipeline
      const pipeline: any = [
        // Match by customer ID
        {
          $match: {
            customerId: binaryCustomerId,
          },
        },
        // Sort by order date descending
        {
          $sort: {
            orderDate: -1,
          },
        },
        // Skip for pagination
        {
          $skip: skip,
        },
        // Limit results
        {
          $limit: limit,
        },
        // Lookup customer details
        {
          $lookup: {
            from: "customers", // Replace with your actual customers collection name
            localField: "customerId",
            foreignField: "_id",
            as: "customerDetails",
          },
        },
        // Unwind the customer details array
        {
          $unwind: {
            path: "$customerDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        // Optional: Lookup product details
        {
          $addFields: {
            parsedProducts: {
              $function: {
                body: function (productsString: any) {
                  try {
                    // Convert string representation of products to actual array
                    // Adjust this based on how your products are stored
                    return JSON.parse(productsString.replace(/'/g, '"'));
                  } catch (e) {
                    return [];
                  }
                },
                args: ["$products"],
                lang: "js",
              },
            },
          },
        },
        // Project to shape the final output
        {
          $project: {
            _id: 1,
            orderDate: 1,
            totalAmount: 1,
            status: 1,
            products: "$parsedProducts",
            customer: {
              _id: "$customerDetails._id",
              name: "$customerDetails.name",
              email: "$customerDetails.email",
            },
          },
        },
      ];

      const orders = await Order.aggregate(pipeline);

      return orders;
    } catch (error) {
      console.error("Error in getCustomerOrders aggregation:", error);
      throw error;
    }
  },
};
