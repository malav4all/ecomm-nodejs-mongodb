import { Order } from "./models/Order";
import { BSON } from "mongodb";

export const resolvers = {
  getCustomerSpending: async ({ customerId }: { customerId: string }) => {
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

  getTopSellingProducts: async ({ limit }: { limit: number }) => {
    try {
      const topSelling = await Order.aggregate([
        { $match: { status: "completed" } },
        {
          $addFields: {
            parsedProducts: {
              $function: {
                body: function (productsStr: any) {
                  if (typeof productsStr === "string") {
                    try {
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
        { $unwind: "$parsedProducts" },
        {
          $group: {
            _id: "$parsedProducts.productId",
            totalSold: { $sum: "$parsedProducts.quantity" },
          },
        },
        { $sort: { totalSold: -1 } },
        { $limit: limit },
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
        {
          $unwind: {
            path: "$productDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
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
      const skip = (page - 1) * limit;

      const buffer = Buffer.from(customerId.replace(/-/g, ""), "hex");
      const binaryCustomerId = new BSON.Binary(buffer, 0x04);

      const pipeline: any = [
        {
          $match: {
            customerId: binaryCustomerId,
          },
        },
        {
          $sort: {
            orderDate: -1,
          },
        },
        {
          $skip: skip,
        },
        {
          $limit: limit,
        },
        {
          $lookup: {
            from: "customers",
            localField: "customerId",
            foreignField: "_id",
            as: "customerDetails",
          },
        },
        {
          $unwind: {
            path: "$customerDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            parsedProducts: {
              $function: {
                body: function (productsString: any) {
                  try {
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
