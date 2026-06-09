-- ============================================================
-- Academy Management System - MySQL Schema
-- Database: academy_management
-- Engine: InnoDB | MySQL 8+
-- ============================================================

CREATE DATABASE IF NOT EXISTS academy_management;
USE academy_management;

-- ============================================================
-- 1. USERS TABLE (Central Authentication for all roles)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id          CHAR(36)      NOT NULL DEFAULT (UUID()),
  email       VARCHAR(255)  NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role        ENUM('center', 'teacher', 'student') NOT NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. CENTERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS centers (
  id          CHAR(36)      NOT NULL DEFAULT (UUID()),
  user_id     CHAR(36)      NOT NULL,
  name        TEXT          NOT NULL,
  owner_name  TEXT,
  phone       TEXT,
  city        TEXT,
  subjects    JSON,
  grades      JSON,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_centers_user_id (user_id),
  CONSTRAINT fk_centers_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. COURSES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS courses (
  id          CHAR(36)      NOT NULL DEFAULT (UUID()),
  center_id   CHAR(36)      NOT NULL,
  name        TEXT          NOT NULL,
  type        VARCHAR(100)  NOT NULL DEFAULT 'subject',
  duration    TEXT,
  monthly_fee INT           NOT NULL DEFAULT 0,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_courses_center_id (center_id),
  CONSTRAINT fk_courses_center FOREIGN KEY (center_id)
    REFERENCES centers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. COURSE MODULES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS course_modules (
  id          CHAR(36)      NOT NULL DEFAULT (UUID()),
  course_id   CHAR(36)      NOT NULL,
  name        TEXT          NOT NULL,
  order_index INT           NOT NULL DEFAULT 0,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_course_modules_course_id (course_id),
  CONSTRAINT fk_course_modules_course FOREIGN KEY (course_id)
    REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. TEACHERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS teachers (
  id              CHAR(36)      NOT NULL DEFAULT (UUID()),
  user_id         CHAR(36)      NOT NULL,
  center_id       CHAR(36)      NOT NULL,
  name            TEXT          NOT NULL,
  role            VARCHAR(100)  NOT NULL DEFAULT 'teacher',
  dob             DATE,
  qualification   TEXT,
  photo_url       TEXT,
  salary          INT,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_teachers_user_id (user_id),
  INDEX idx_teachers_center_id (center_id),
  CONSTRAINT fk_teachers_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_teachers_center FOREIGN KEY (center_id)
    REFERENCES centers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. BATCHES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS batches (
  id          CHAR(36)      NOT NULL DEFAULT (UUID()),
  center_id   CHAR(36)      NOT NULL,
  course_id   CHAR(36)      NOT NULL,
  teacher_id  CHAR(36)      NOT NULL,
  name        TEXT          NOT NULL,
  start_date  DATE,
  end_date    DATE,
  days        JSON,
  timing      VARCHAR(100),
  status      ENUM('active', 'completed') DEFAULT 'active',
  max_seats   INT DEFAULT 0,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_batches_center_id (center_id),
  INDEX idx_batches_course_id (course_id),
  INDEX idx_batches_teacher_id (teacher_id),
  CONSTRAINT fk_batches_center FOREIGN KEY (center_id)
    REFERENCES centers(id) ON DELETE CASCADE,
  CONSTRAINT fk_batches_course FOREIGN KEY (course_id)
    REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_batches_teacher FOREIGN KEY (teacher_id)
    REFERENCES teachers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. STUDENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS students (
  id            CHAR(36)      NOT NULL DEFAULT (UUID()),
  user_id       CHAR(36)      NOT NULL,
  center_id     CHAR(36)      NOT NULL,
  batch_id      CHAR(36),
  name          TEXT          NOT NULL,
  dob           DATE,
  class         TEXT,
  address       TEXT,
  parent_name   TEXT,
  parent_phone  TEXT,
  photo_url     TEXT,
  roll_number   VARCHAR(50),
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_students_user_id (user_id),
  INDEX idx_students_center_id (center_id),
  INDEX idx_students_batch_id (batch_id),
  CONSTRAINT fk_students_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_students_center FOREIGN KEY (center_id)
    REFERENCES centers(id) ON DELETE CASCADE,
  CONSTRAINT fk_students_batch FOREIGN KEY (batch_id)
    REFERENCES batches(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8. BATCH ENROLLMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS batch_enrollments (
  id          CHAR(36)      NOT NULL DEFAULT (UUID()),
  student_id  CHAR(36)      NOT NULL,
  batch_id    CHAR(36)      NOT NULL,
  enrolled_at DATE,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_batch_enrollments_student_id (student_id),
  INDEX idx_batch_enrollments_batch_id (batch_id),
  CONSTRAINT fk_batch_enrollments_student FOREIGN KEY (student_id)
    REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_batch_enrollments_batch FOREIGN KEY (batch_id)
    REFERENCES batches(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 9. ATTENDANCE TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance (
  id              CHAR(36)      NOT NULL DEFAULT (UUID()),
  student_id      CHAR(36)      NOT NULL,
  module_id       CHAR(36)      NOT NULL,
  enrollment_id   CHAR(36)      NOT NULL,
  date            DATE          NOT NULL,
  status          ENUM('present', 'absent', 'holiday') NOT NULL,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_attendance_student_id (student_id),
  INDEX idx_attendance_module_id (module_id),
  INDEX idx_attendance_enrollment_id (enrollment_id),
  INDEX idx_attendance_date (date),
  CONSTRAINT fk_attendance_student FOREIGN KEY (student_id)
    REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_module FOREIGN KEY (module_id)
    REFERENCES course_modules(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_enrollment FOREIGN KEY (enrollment_id)
    REFERENCES batch_enrollments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 10. TESTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS tests (
  id          CHAR(36)      NOT NULL DEFAULT (UUID()),
  batch_id    CHAR(36)      NOT NULL,
  module_id   CHAR(36)      NOT NULL,
  name        TEXT          NOT NULL,
  total_marks INT           NOT NULL,
  test_date   DATE,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_tests_batch_id (batch_id),
  INDEX idx_tests_module_id (module_id),
  CONSTRAINT fk_tests_batch FOREIGN KEY (batch_id)
    REFERENCES batches(id) ON DELETE CASCADE,
  CONSTRAINT fk_tests_module FOREIGN KEY (module_id)
    REFERENCES course_modules(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 11. TEST RESULTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS test_results (
  id              CHAR(36)      NOT NULL DEFAULT (UUID()),
  test_id         CHAR(36)      NOT NULL,
  student_id      CHAR(36)      NOT NULL,
  enrollment_id   CHAR(36)      NOT NULL,
  marks_obtained  INT,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_test_results_test_id (test_id),
  INDEX idx_test_results_student_id (student_id),
  INDEX idx_test_results_enrollment_id (enrollment_id),
  CONSTRAINT fk_test_results_test FOREIGN KEY (test_id)
    REFERENCES tests(id) ON DELETE CASCADE,
  CONSTRAINT fk_test_results_student FOREIGN KEY (student_id)
    REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_test_results_enrollment FOREIGN KEY (enrollment_id)
    REFERENCES batch_enrollments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 12. FEES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS fees (
  id              CHAR(36)      NOT NULL DEFAULT (UUID()),
  enrollment_id   CHAR(36)      NOT NULL,
  month           VARCHAR(7)    NOT NULL, -- Format: YYYY-MM
  amount          INT           NOT NULL,
  due_date        DATE,
  paid            BOOLEAN       NOT NULL DEFAULT FALSE,
  payment_date    TIMESTAMP     NULL,
  payment_method  VARCHAR(50),
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_fees_enrollment_id (enrollment_id),
  CONSTRAINT fk_fees_enrollment FOREIGN KEY (enrollment_id)
    REFERENCES batch_enrollments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 13. PARENT REPORTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS parent_reports (
  id          CHAR(36)      NOT NULL DEFAULT (UUID()),
  student_id  CHAR(36)      NOT NULL,
  batch_id    CHAR(36)      NOT NULL,
  month       TEXT          NOT NULL,
  message     TEXT,
  status      VARCHAR(100)  NOT NULL DEFAULT 'draft',
  sent_at     TIMESTAMP     NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_parent_reports_student_id (student_id),
  INDEX idx_parent_reports_batch_id (batch_id),
  CONSTRAINT fk_parent_reports_student FOREIGN KEY (student_id)
    REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_parent_reports_batch FOREIGN KEY (batch_id)
    REFERENCES batches(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SEED DATA (One dummy Center, Teacher, Course, Batch, Student)
-- NOTE: Passwords below are bcrypt hashes of "password123"
-- Using INSERT IGNORE so re-running setup:db is safe (idempotent)
-- ============================================================

-- Seed Users — passwords follow Option B format: localpart@123
-- center@demo.com  → center@123
-- teacher@demo.com → teacher@123
-- student@demo.com → student@123
INSERT IGNORE INTO users (id, email, password_hash, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'center@demo.com',  '$2b$10$mJqAY8gW3WPgOGpvpnQ0KOd8qpec17TGKLaZDU.Qglhzy7y5HRQiq', 'center'),
  ('12345678-1234-1234-1234-123456789012', 'sunrise@academy.com', '$2b$10$pRWxUiMoajUsm5m3.CVxseiMyaT8jD04CTA8RvLNRUrn5q8IBMzZu', 'center'),
  ('22222222-2222-2222-2222-222222222222', 'teacher@demo.com', '$2b$10$TQpVOqy613MQQgdlk1FaBuvujyXxhx1qmqnHrNjqq9ZXicSKJ3dPa', 'teacher'),
  ('33333333-3333-3333-3333-333333333333', 'student@demo.com', '$2b$10$cgRgHftvbIUcbb0xBWf6aOhS5IJJrt27YLYNU5OpBlADpc0GJJgp6', 'student');

-- Seed Center
INSERT IGNORE INTO centers (id, user_id, name, owner_name, phone, city, subjects, grades) VALUES
  ('aaaa0001-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111',
   'Bright Future Academy',
   'Rahul Sharma',
   '+91-9876543210',
   'Mumbai',
   '["Mathematics", "Science", "English"]',
   '["Grade 8", "Grade 9", "Grade 10"]');

INSERT IGNORE INTO centers (id, user_id, name, owner_name, phone, city, subjects, grades) VALUES
  ('aaaa0002-0000-0000-0000-000000000002',
   '12345678-1234-1234-1234-123456789012',
   'Sunrise Academy',
   'Sunil Verma',
   '+91-9888888888',
   'Delhi',
   '["Physics", "Chemistry"]',
   '["Class 11", "Class 12"]');

-- Seed Course
INSERT IGNORE INTO courses (id, center_id, name, type, duration, monthly_fee) VALUES
  ('bbbb0002-0000-0000-0000-000000000002',
   'aaaa0001-0000-0000-0000-000000000001',
   'Mathematics Grade 10',
   'subject',
   '6 months',
   1500);

-- Seed Course Module
INSERT IGNORE INTO course_modules (id, course_id, name, order_index) VALUES
  ('cccc0003-0000-0000-0000-000000000003',
   'bbbb0002-0000-0000-0000-000000000002',
   'Algebra Fundamentals',
   1);

-- Seed Teacher
INSERT IGNORE INTO teachers (id, user_id, center_id, name, role, dob, qualification, salary) VALUES
  ('dddd0004-0000-0000-0000-000000000004',
   '22222222-2222-2222-2222-222222222222',
   'aaaa0001-0000-0000-0000-000000000001',
   'Priya Mehta',
   'teacher',
   '1990-06-15',
   'M.Sc Mathematics',
   35000);

-- Seed Batch
INSERT IGNORE INTO batches (id, center_id, course_id, teacher_id, name) VALUES
  ('eeee0005-0000-0000-0000-000000000005',
   'aaaa0001-0000-0000-0000-000000000001',
   'bbbb0002-0000-0000-0000-000000000002',
   'dddd0004-0000-0000-0000-000000000004',
   'Morning Batch A');

-- Seed Student
INSERT IGNORE INTO students (id, user_id, center_id, batch_id, name, dob, class, parent_name, parent_phone) VALUES
  ('ffff0006-0000-0000-0000-000000000006',
   '33333333-3333-3333-3333-333333333333',
   'aaaa0001-0000-0000-0000-000000000001',
   'eeee0005-0000-0000-0000-000000000005',
   'Amit Patel',
   '2009-03-22',
   'Grade 10',
   'Suresh Patel',
   '+91-9876500001');

-- Seed Batch Enrollment
INSERT IGNORE INTO batch_enrollments (id, student_id, batch_id, enrolled_at) VALUES
  ('gggg0007-0000-0000-0000-000000000007',
   'ffff0006-0000-0000-0000-000000000006',
   'eeee0005-0000-0000-0000-000000000005',
   '2024-06-01');

-- Seed Fee Record
INSERT IGNORE INTO fees (id, enrollment_id, month, amount, due_date, paid) VALUES
  ('hhhh0008-0000-0000-0000-000000000008',
   'gggg0007-0000-0000-0000-000000000007',
   '2024-06',
   1500,
   '2024-06-10',
   FALSE);
