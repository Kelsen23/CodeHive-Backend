<h1 align="center">CodeHive Backend</h1>

<p align="center">
  🚀 Backend service for <b>CodeHive</b> – powering authentication, APIs, caching, and database management.
</p>

<p align="center">
  <img src="assets/CodeHive logo.png" alt="CodeHive Logo" width="800"/>
</p>

---

## 🛠️ Tech Stack

- **Node.js** + **Express**
- **PostgreSQL** – users, authentication, relational data
- **MongoDB** – questions, answers, replies, nested documents
- **Redis**
  - Caching  
  - Sessions  
  - Rate limiting  
  - **Pub/Sub messaging** for real-time events  
- **Socket.IO** – real-time bidirectional communication (websocket layer)
- **BullMQ** – scalable background job processing & task queues
- **GraphQL / REST APIs**

---

## ⚙️ Setup

```bash
# Clone repo
git clone https://github.com/Kelsen23/CodeHive-Backend.git
cd CodeHive-Backend

# Install dependencies
npm install

# Run development server
npm run dev
```

## 🤝 Contributing

Contributions are welcome!

If you’d like to improve **CodeHive-Backend**, feel free to **fork the repository** and submit a pull request.  
This project is licensed under the **MIT License**, so you’re free to use, modify, and share it.

Steps to contribute:

1. Fork the repository
2. Create a new branch (`git checkout -b feature-name`)
3. Make your changes
4. Commit and push (`git commit -m "Add new feature" && git push origin feature-name`)
5. Open a Pull Request
