# Sales & Revenue Analytics API

## Overview
This project is a GraphQL API built using Node.js, MongoDB, and GraphQL. It provides sales and revenue analytics for an e-commerce platform, enabling insights into customer spending, top-selling products, and overall sales performance.

## Features
- Get total spending, last purchase date, and average order value for a customer.
- Retrieve top-selling products based on total quantity sold.
- Analyze revenue trends, including total revenue, completed orders, and category-wise revenue breakdown.
- Fetch paginated orders for a specific customer.

## Technologies Used
- **Node.js**
- **Express.js**
- **MongoDB** (with Aggregation Pipelines)
- **GraphQL** (Apollo Server)

## Setup Instructions

### Prerequisites
Ensure you have the following installed:
- **Node.js** (v14+ recommended)
- **MongoDB** (local or Atlas)
- **Yarn** or **npm**

### Installation
1. Clone the repository:
   ```sh
   git clone https://github.com/malav4all/ecomm-nodejs-mongodb.git
   cd ecomm-nodejs-mongodb
   ```
2. Install dependencies:
   ```sh
   yarn install  # or npm install
   ```
3. Create a `.env` file in the root directory and add your MongoDB connection string:
   ```sh
   MONGO_URI=mongodb://localhost:27017/ecommerce
   PORT=4000
   ```
4. Import the provided dataset into MongoDB:
   - Download the seed data: [Seed Data](https://drive.google.com/file/d/1g47E54fmcYFrjJVJSeok5O2VmLxiJCXk/view?usp=sharing)
   - Use MongoDB Compass or CLI to import the data.

5. Start the server:
   ```sh
   yarn start  # or npm start
   ```
6. Open **GraphQL Playground** at:
   ```
   http://localhost:4000/graphql
   ```

## GraphQL Queries

### 1️⃣ Get Customer Spending
```graphql
query {
  getCustomerSpending(customerId: "63f8b3d5a7b1d7f3b0a2c5e1") {
    customerId
    totalSpent
    averageOrderValue
    lastOrderDate
  }
}
```

### 2️⃣ Get Top-Selling Products
```graphql
query {
  getTopSellingProducts(limit: 5) {
    productId
    name
    totalSold
  }
}
```

### 3️⃣ Get Sales Analytics
```graphql
query {
  getSalesAnalytics(startDate: "2024-02-01", endDate: "2024-02-20") {
    totalRevenue
    completedOrders
    categoryBreakdown {
      category
      revenue
    }
  }
}
```

### 4️⃣ Get Customer Orders (Pagination)
```graphql
query {
  getCustomerOrders(customerId: "63f8b3d5a7b1d7f3b0a2c5e1", page: 1, limit: 5) {
    _id
    totalAmount
    orderDate
    status
    products {
      productId
      quantity
      priceAtPurchase
    }
  }
}
```


## Author
**Malav**

