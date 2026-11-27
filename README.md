# TovNa (ទៅណា?)

### Smart Travel Planning & Booking Platform

**Discover Cambodia. Plan Your Journey.**

TovNa is a smart travel planning and booking platform designed to make exploring Cambodia easier and more convenient.

Instead of searching across multiple platforms to organize a trip, travelers can use TovNa to discover destinations, explore travel services, receive personalized recommendations, plan journeys and manage bookings in one place.

This project is developed as an individual graduation project, combining web development, mobile application development, backend engineering and AI-powered travel assistance.

---

## ✨ Key Features

- **Explore Destinations** — Discover interesting places and travel destinations across Cambodia.
- **Smart Recommendations** — Get travel suggestions based on personal interests and preferences.
- **AI Travel Assistant** — Get assistance with travel questions and trip ideas.
- **Trip Planning** — Organize travel plans and explore suitable travel options.
- **Service Booking** — Browse and book hotels, tours, activities and transportation.
- **Booking Management** — View booking details, status and booking history.
- **Payment Management** — Submit payment information and review payment records.
- **User Authentication** — Secure account access with role-based authentication.

## 🛠️ Technology Stack

I built TovNa using the following technologies:

| Area               | Technologies            |
| ------------------ | ----------------------- |
| Web Frontend       | React, Vite, JavaScript |
| Mobile Application | React Native, Expo      |
| Backend            | Python, FastAPI         |
| Database           | PostgreSQL              |
| API                | REST API                |
| Authentication     | JWT                     |
| AI Integration     | LLM API                 |
| Version Control    | Git, GitHub             |

## 🏗️ Project Architecture

TovNa is organized into three main applications:

```text
TovNA/
│
├── backend/       # FastAPI backend and REST APIs
│
├── frontend/      # React web application
│
├── mobile/        # React Native mobile application
│
└── README.md
```

**Frontend:** Provides the web interface for interacting with the platform.

**Mobile:** Provides a mobile experience for travelers to explore destinations, plan trips and manage bookings.

**Backend:** Handles business logic, authentication, database operations and API communication.

## 🚀 Getting Started

### Prerequisites

- Node.js and npm
- Python
- PostgreSQL
- Git
- Expo Go or an Android/iOS emulator

### 1. Clone the repository

```bash
git clone https://github.com/H-thaksin/TovNA.git
cd TovNA
```

### 2. Start the Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
```

Install the project's Python dependencies and configure the required database and environment settings.

Start the API:

```bash
uvicorn main:app --reload
```

API documentation:

`http://127.0.0.1:8000/docs`

### 3. Start the Web Application

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local development URL displayed in your terminal.

### 4. Start the Mobile Application

Open another terminal:

```bash
cd mobile
npm install
npx expo start
```

Follow the Expo instructions to run the application on a device or emulator.

**Note:** Configure the frontend and mobile API base URLs to connect to your backend server.

## 👥 User Roles

- **Customer:** Explore destinations, receive recommendations, plan trips, book travel services and manage payments.
- **Admin:** Responsible for managing platform information, services, users and bookings.
- **Agent:** A role reserved for travel-service management workflows.

Protected operations are handled through backend authorization.

## 📱 Screenshots

Screenshots of the web and mobile applications will be added here to demonstrate the user interface and main features.

## 📌 Project Status

TovNa is actively being developed as an individual graduation project.

The customer-facing mobile application includes destination exploration, recommendations, AI assistance, booking management, payments and transportation features.

Further development includes mobile launch preparation, production deployment and administrative management features.

## 👨‍💻 Developer

**HENG THAKSIN**

Software Development Student | Aspiring Web Developer

- GitHub: [H-thaksin](https://github.com/H-thaksin)
- Project: [TovNa Repository](https://github.com/H-thaksin/TovNA)

---

_Thank you for checking out TovNa!_
