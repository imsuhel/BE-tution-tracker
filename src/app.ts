import express, { Application, Request, Response } from 'express';
import cors from 'cors';

// Routes
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import studentRoutes from './routes/student.routes';
import courseRoutes from './routes/course.routes';
import teacherRoutes from './routes/teacher.routes';
import batchRoutes from './routes/batch.routes';
import feeRoutes from './routes/fee.routes';
import attendanceRoutes from './routes/attendance.routes';
import centerRoutes from './routes/center.routes';

const app: Application = express();

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Root Route ────────────────────────────────────────────────
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Academy Management System API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: 'GET  /api/health',
      login:  'POST /api/auth/login',
      admin: {
        createCenter: 'POST /api/admin/centers',
        listCenters:  'GET  /api/admin/centers',
        getCenter:    'GET  /api/admin/centers/:id',
      },
      students: {
        create:  'POST /api/students             [Bearer token]',
        list:    'GET  /api/students             [Bearer token] ?page&limit&search&class&fee_status&sort',
        getById: 'GET  /api/students/:id         [Bearer token]',
      },
      courses: {
        create:      'POST   /api/courses                        [Bearer token]',
        list:        'GET    /api/courses                        [Bearer token] ?page&limit&search&type&sort',
        getById:     'GET    /api/courses/:id                    [Bearer token]',
        update:      'PUT    /api/courses/:id                    [Bearer token]',
        addModule:   'POST   /api/courses/:id/modules            [Bearer token]',
        updateModule:'PUT    /api/courses/:id/modules/:moduleId  [Bearer token]',
        deleteModule:'DELETE /api/courses/:id/modules/:moduleId  [Bearer token]',
      },
      teachers: {
        create:  'POST   /api/teachers       [Bearer token]',
        list:    'GET    /api/teachers       [Bearer token] ?page&limit&search&role&sort',
        getById: 'GET    /api/teachers/:id  [Bearer token]',
        update:  'PUT    /api/teachers/:id  [Bearer token]',
        delete:  'DELETE /api/teachers/:id  [Bearer token]',
      },
      batches: {
        create:      'POST   /api/batches              [Bearer token]',
        list:        'GET    /api/batches              [Bearer token] ?page&limit&search&course_id&teacher_id&status',
        enroll:      'POST   /api/batches/:id/enroll   [Bearer token] {student_id}',
        getStudents: 'GET    /api/batches/:id/students [Bearer token]',
      },
      fees: {
        create: 'POST   /api/fees         [Bearer token]',
        list:   'GET    /api/fees         [Bearer token] ?page&limit&student_id&batch_id&status',
        pay:    'PUT    /api/fees/:id/pay [Bearer token] {payment_method}',
      },
      attendance: {
        mark: 'POST /api/attendance [Bearer token] {student_id, enrollment_id, module_id, date, status}',
        get:  'GET  /api/attendance [Bearer token] ?student_id&batch_id&module_id&start_date&end_date',
      },
    },
  });
});

// ── Health Check ──────────────────────────────────────────────
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Academy Management System API is running' });
});

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/center', centerRoutes);

// ── 404 Handler ───────────────────────────────────────────────
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
});

export default app;
