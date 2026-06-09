# Tuition Tracker Backend API

This repository contains the backend REST API for the **Tuition Tracker** system. It is built using Node.js, Express, and TypeScript, with MySQL serving as the relational database.

## Tech Stack
- **Runtime:** Node.js (v18+)
- **Framework:** Express.js (TypeScript)
- **Database:** MySQL (v8.0+)
- **Database Driver:** `mysql2` (using connection pooling & promise wrapper)
- **Authentication:** JSON Web Tokens (JWT) using `jsonwebtoken`
- **Security:** Password hashing using `bcryptjs`
- **Development Tooling:** `nodemon`, `ts-node`, `typescript`

---

## Getting Started

### Prerequisites
Make sure you have the following installed on your machine:
- **Node.js** (v18 or higher)
- **npm** (comes with Node.js)
- **MySQL Server** running locally or accessible remotely

### Installation

1. Navigate to the backend directory:
   ```bash
   cd BE-tuition-tracker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create your local environment file:
   ```bash
   cp .env.example .env
   ```

4. Configure `.env` with your database credentials and a strong random JWT secret:
   ```env
   PORT=3001
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=academy_management
   JWT_SECRET=your_super_secret_jwt_key
   ```

---

## Database Setup & Migrations

The project includes an automated database initialization and seeding script.

1. Ensure your MySQL server is running.
2. Run the database setup script to create the database, define tables, and seed initial test data:
   ```bash
   npm run setup:db
   ```
   
   *This command runs the [database/setup.ts](file:///Users/user/Documents/NP/testProject/tuition-tracker/BE-tuition-tracker/database/setup.ts) script, which reads [database/schema.sql](file:///Users/user/Documents/NP/testProject/tuition-tracker/BE-tuition-tracker/database/schema.sql) and prepares the database structure.*

---

## Running the Application

### Development Mode
Start the development server with live reloading enabled:
```bash
npm run dev
```
The server will boot up and listen on the port defined in `.env` (default is `3001`). You should see:
```text
Successfully connected to the MySQL Database.
Server is running on port 3001
```

---

## API Endpoints

A complete mapping of endpoints is exposed at the API root URL (`GET /`). 

### Core Endpoints Overview

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/auth/login` | Authenticate center, teacher, or student | No |
| **GET** | `/api/health` | API Health Check status | No |
| **GET** | `/api/admin/centers` | List centers | Yes (Center) |
| **POST** | `/api/students` | Register a new student | Yes (Center) |
| **GET** | `/api/students` | List/filter students | Yes (Center/Teacher) |
| **POST** | `/api/courses` | Create a course | Yes (Center) |
| **GET** | `/api/courses` | List courses | Yes |
| **POST** | `/api/batches` | Create a batch | Yes (Center) |
| **POST** | `/api/fees` | Record fee invoice | Yes (Center) |
| **PUT** | `/api/fees/:id/pay` | Pay student fee | Yes (Center) |
| **POST** | `/api/attendance` | Record daily attendance | Yes (Center/Teacher) |

*Auth tokens must be passed in the headers as: `Authorization: Bearer <your_jwt_token>`*

---

## Database Schema Structure

The database consists of the following relational tables:
- **`users`**: Central credentials repository for auth (`role` is `center`, `teacher`, or `student`).
- **`centers`**: Registration details for tuition center branches.
- **`courses`**: Course packages, monthly fees, and structures.
- **`course_modules`**: Chapters/Modules within a course.
- **`teachers`**: Teacher profiles, qualifications, and salaries.
- **`batches`**: Groupings of students assigned to a teacher and course.
- **`students`**: Student records, classes, and parent contact details.
- **`batch_enrollments`**: Many-to-many relationship tracking student batch placements.
- **`attendance`**: Daily attendance tracker (`present`, `absent`, `holiday`).
- **`tests` & `test_results`**: Academic evaluations and scores.
- **`fees`**: Tracking monthly fee invoices and payment status.
- **`parent_reports`**: Progress summaries generated for parent review.

---

## Development & Contribution Guidelines

- **TypeScript Type Safety**: Always define proper Request/Response types in controllers and router files.
- **Code Separation**: Maintain a clean structure of routes, controllers, and database helpers.
- **Database Safety**: Write parameterised queries using the MySQL pool driver to prevent SQL Injection.
- **Environment Variables**: Add any new environment configurations to `.env.example`.
