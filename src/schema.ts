import { buildSchema } from "graphql";

export const schema = buildSchema(`
  type CustomerSpending {
    customerId: ID!
    totalSpent: Float!
    averageOrderValue: Float!
    lastOrderDate: String
  }

  type TopProduct {
    productId: ID!
    name: String!
    totalSold: Int!
  }

  type CategoryRevenue {
    category: String!
    revenue: Float!
  }

  type SalesAnalytics {
    totalRevenue: Float!
    completedOrders: Int!
    categoryBreakdown: [CategoryRevenue!]!
  }
type OrderProduct {
  productId: String!
  quantity: Int!
  priceAtPurchase: Float!
}
  type Order {
  _id: ID!
  customerId: String!
  products: [OrderProduct!]!
  totalAmount: Float!
  orderDate: String!
  status: String!
}

  type Query {
    getCustomerSpending(customerId: ID!): CustomerSpending
    getTopSellingProducts(limit: Int!): [TopProduct]
    getSalesAnalytics(startDate: String!, endDate: String!): SalesAnalytics
    getCustomerOrders(customerId: String!, page: Int!, limit: Int!): [Order!]!
  }
`);
