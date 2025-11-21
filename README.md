# Multi-Project Data Management System (MPDMS) v3.0

A comprehensive digital inspection management system designed for fabrication projects with advanced user management, multi-project support, and real-time analytics.

## 🌟 Features

### Core Functionality
- **Multi-tenant Architecture**: Complete project isolation with secure data separation
- **Advanced Role-Based Access Control**: Admin, Inspector, and Visitor roles with granular permissions
- **Project Assignment System**: Users can be assigned to multiple projects with role-based visibility
- **Complete Inspection Workflow**: Material → Fit-up → Final → NDT process tracking
- **Real-time Dashboard**: Live project statistics and KPI monitoring
- **Inline Editing**: Direct table editing with validation and auto-population
- **AI Integration**: Qwen AI-powered insights and automated report generation (optional)

### Technical Features
- **Modern Web Stack**: React + TypeScript + Material-UI frontend, FastAPI + PostgreSQL backend
- **RESTful API**: Comprehensive API with JWT authentication
- **Docker Deployment**: Complete containerization with Docker Compose
- **Responsive Design**: Mobile-friendly interface with Material Design components
- **Data Validation**: Real-time validation with automatic material lookup
- **Audit Trail**: Complete tracking of all changes with timestamps
- **Security**: Input sanitization, SQL injection prevention, XSS protection

## 🏗️ System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Frontend │───▶│  FastAPI Backend  │───▶│   PostgreSQL    │
│                 │    │                  │    │                 │
│ - TypeScript    │    │ - Python 3.9+    │    │ - Main Database │
│ - Material-UI   │    │ - SQLAlchemy     │    │ - Audit Logs    │
│ - Axios         │    │ - JWT Auth       │    └─────────────────┘
└─────────────────┘    └──────────────────┘
         │                        │
         │                        │
         ▼                        ▼
┌─────────────────┐    ┌──────────────────┐
│   Nginx Proxy   │    │  Qwen AI Service │
│                 │    │                  │
│ - SSL Termination│   │ - DashScope API  │
│ - Static Files   │   │ - Report Gen     │
└─────────────────┘    └──────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- 4GB+ RAM available
- Ports 80, 443, 3000, 8000, 5432 available

### Installation

1. **Clone or extract the project files**
   ```bash
   # Extract the project files to your desired directory
   cd /path/to/your/projects
   ```

2. **Run the setup script**
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

3. **Configure environment**
   ```bash
   # Edit the .env file with your settings
   nano .env
   ```

4. **Start the system**
   ```bash
   ./start.sh
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

### Default Admin Credentials
- **Email**: admin@mpdms.com
- **Password**: admin123

⚠️ **Important**: Change the default password after first login!

## 📋 User Guide

### User Roles and Permissions

#### Admin
- Create, edit, delete users and projects
- Assign users to projects
- Access all project data across the system
- Manage system configuration
- View comprehensive analytics

#### Inspector
- Create, edit, delete inspection records within assigned projects
- View project data for assigned projects only
- Generate reports and summaries
- Perform material lookups and validations
- Cannot manage users or projects

#### Visitor
- Read-only access to assigned projects
- View project statistics and reports
- No create, edit, or delete permissions

### Project Workflow

1. **Material Register**: Record all materials with piece mark numbers
2. **Fit-up Inspection**: Document joint fit-ups with automatic material lookup
3. **Final Inspection**: Record welding details and quality results
4. **NDT Requests**: Manage non-destructive testing requests and approvals

### Key Features

#### Project Selection
- Users see only projects assigned to them
- Real-time project statistics and progress
- Quick project switching
- Comprehensive project summaries

#### Dashboard
- Live KPI monitoring (total joints, completion rates)
- Material management overview
- NDT request tracking
- Weld quality statistics
- NDT success rates by method

#### Inline Editing
- Direct table editing with validation
- Automatic material lookups based on piece marks
- Real-time data validation
- Role-based editing permissions

#### AI Integration
- Automated project summaries
- Quality analysis and insights
- Performance recommendations
- Customizable AI prompts (requires DASHSCOPE API key)

## 🔧 Configuration

### Environment Variables

#### Backend Configuration
```env
# Database
DB_NAME=project_management
DB_USER=postgres
DB_PASSWORD=your_secure_password
DATABASE_URL=postgresql://postgres:your_secure_password@db:5432/project_management

# Security
SECRET_KEY=your_very_secure_secret_key_here
DEBUG=true

# API Configuration
API_URL=http://localhost:8000/api/v1
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# AI Services (Optional)
DASHSCOPE_API_KEY=your_dashscope_api_key_here
```

#### Frontend Configuration
```env
REACT_APP_API_URL=http://localhost:8000/api/v1
```

### Database Configuration

The system uses PostgreSQL 13+ with the following key features:
- Proper indexing for query performance
- Foreign key constraints for data integrity
- Cascade delete for related records
- Audit fields (created_at, updated_at)

#### Key Tables
- `users`: User accounts and roles
- `projects`: Project definitions
- `user_projects`: User-project assignments
- `material_register`: Material inventory
- `fitup_inspection`: Fit-up records
- `final_inspection`: Final inspection records
- `ndt_requests`: NDT request management

### API Endpoints

#### Authentication
- `POST /api/v1/login` - User login
- `POST /api/v1/logout` - User logout
- `GET /api/v1/verify-token` - Token verification

#### User Management
- `GET /api/v1/users/me` - Current user profile
- `POST /api/v1/users` - Create user (Admin)
- `PUT /api/v1/users/{id}` - Update user (Admin)
- `DELETE /api/v1/users/{id}` - Delete user (Admin)
- `POST /api/v1/users/{id}/change-password` - Change password

#### Project Management
- `GET /api/v1/projects` - List projects (role-based)
- `GET /api/v1/projects/my-projects` - User's assigned projects
- `POST /api/v1/projects` - Create project (Admin)
- `GET /api/v1/projects/{id}/summary` - Project statistics

#### Inspection Management
- `GET /api/v1/material-register` - Material records
- `POST /api/v1/material-register` - Create material record
- `GET /api/v1/fitup-inspection` - Fit-up inspections
- `POST /api/v1/fitup-inspection` - Create fit-up record
- `GET /api/v1/final-inspection` - Final inspections
- `POST /api/v1/final-inspection` - Create final record
- `GET /api/v1/ndt-requests` - NDT requests

#### AI Services
- `POST /api/v1/ai/summary` - Generate AI summary
- `GET /api/v1/ai/project-summary/{id}` - Project AI summary
- `GET /api/v1/ai/inspection-summary/{id}` - Inspection AI analysis

## 🐳 Docker Deployment

### Development
```bash
# Start development environment
docker-compose up --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production
```bash
# Use production configuration
docker-compose -f docker-compose.yml up --build -d

# With SSL (configure nginx.conf and SSL certificates)
docker-compose -f docker-compose.prod.yml up --build -d
```

### Service Management
```bash
# Check service status
docker-compose ps

# Restart specific service
docker-compose restart backend

# View specific service logs
docker-compose logs backend

# Access database
docker-compose exec db psql -U postgres -d project_management
```

## 🔒 Security Features

### Authentication & Authorization
- JWT-based authentication with 30-minute expiration
- Role-based access control (RBAC)
- Secure password hashing with bcrypt
- Session management with automatic token refresh

### Data Security
- SQL injection prevention via SQLAlchemy ORM
- XSS protection through input sanitization
- CSRF protection with JWT tokens
- Input validation on all endpoints
- Secure headers configuration

### System Security
- Docker container isolation
- Environment variable protection
- Database connection security
- HTTPS/SSL termination (production)
- Rate limiting (recommended for production)

## 📊 Monitoring & Maintenance

### Health Checks
```bash
# Check system health
curl http://localhost:8000/health

# Verify database connection
curl http://localhost:8000/api/v1/verify-token
```

### Logs
- Application logs: `docker-compose logs backend`
- Frontend logs: `docker-compose logs frontend`
- Database logs: `docker-compose logs db`

### Backup Procedures
```bash
# Backup database
docker-compose exec db pg_dump -U postgres project_management > backup.sql

# Restore database
docker-compose exec -T db psql -U postgres project_management < backup.sql
```

## 🧪 Testing

### Backend Testing
```bash
cd backend
pytest tests/ -v
```

### Frontend Testing
```bash
cd frontend
npm test
```

### API Testing
```bash
# Using curl
curl -X POST http://localhost:8000/api/v1/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@mpdms.com","password":"admin123"}'
```

## 🔧 Development

### Local Development Setup

#### Backend Development
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend Development
```bash
cd frontend
npm install
npm start
```

### Code Structure

#### Backend Structure
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application
│   ├── database.py          # Database configuration
│   ├── auth.py              # Authentication & authorization
│   ├── models.py            # SQLAlchemy models
│   ├── schemas.py           # Pydantic schemas
│   └── routes/
│       ├── __init__.py
│       ├── auth.py          # Authentication routes
│       ├── users.py         # User management
│       ├── projects.py      # Project management
│       ├── inspections.py   # Inspection modules
│       └── ai.py            # AI services
├── requirements.txt
└── Dockerfile
```

#### Frontend Structure
```
frontend/
├── src/
│   ├── App.tsx              # Main application
│   ├── index.tsx            # Application entry point
│   ├── types/
│   │   └── index.ts         # TypeScript definitions
│   ├── services/
│   │   └── api.ts           # API service layer
│   ├── contexts/
│   │   └── AuthContext.tsx  # Authentication context
│   └── components/
│       ├── Auth/
│       │   └── Login.tsx
│       ├── Layout/
│       │   └── Layout.tsx
│       ├── Dashboard/
│       │   └── Dashboard.tsx
│       ├── ProjectSelection/
│       │   └── ProjectSelection.tsx
│       ├── Inspection/
│       │   ├── MaterialRegister.tsx
│       │   ├── FitUpInspection.tsx
│       │   ├── FinalInspection.tsx
│       │   └── NDTRequests.tsx
│       ├── Management/
│       │   ├── UserManagement.tsx
│       │   └── ProjectManagement.tsx
│       └── Common/
│           ├── EditableTable.tsx
│           └── LoadingScreen.tsx
├── package.json
└── Dockerfile
```

## 🚀 Production Deployment

### Recommended Production Setup

1. **SSL Certificate Configuration**
   - Obtain SSL certificates for your domain
   - Update nginx configuration
   - Configure HTTPS redirect

2. **Environment Security**
   - Generate secure secret keys
   - Use strong database passwords
   - Enable DEBUG=false
   - Configure proper CORS origins

3. **Database Optimization**
   - PostgreSQL configuration tuning
   - Database backup automation
   - Connection pooling
   - Query optimization

4. **Monitoring & Alerting**
   - Application performance monitoring
   - Error tracking and alerting
   - Log aggregation
   - Health check endpoints

5. **Scaling Considerations**
   - Load balancer configuration
   - Horizontal scaling with multiple backend instances
   - Database replication
   - CDN for static assets

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

### Code Standards
- Backend: Follow PEP 8 with Black formatting
- Frontend: Follow TypeScript and ESLint rules
- Documentation: Update README for significant changes
- Testing: Maintain test coverage above 80%

## 📞 Support

### Common Issues

#### Database Connection Issues
```bash
# Check database service
docker-compose ps db

# Verify database connectivity
docker-compose exec db pg_isready -U postgres
```

#### API Connection Issues
```bash
# Check backend service
docker-compose ps backend

# View backend logs
docker-compose logs backend
```

#### Frontend Issues
```bash
# Check frontend service
docker-compose ps frontend

# Clear browser cache and restart
docker-compose restart frontend
```

### Performance Tuning

#### Database Optimization
- Ensure proper indexing on frequently queried columns
- Configure PostgreSQL settings for your workload
- Monitor slow query logs

#### API Optimization
- Implement response caching where appropriate
- Use database connection pooling
- Optimize SQL queries with proper joins

#### Frontend Optimization
- Enable gzip compression
- Implement code splitting
- Optimize bundle size
- Use React.memo for expensive components

## 📝 License

This project is licensed under the MIT License. See the LICENSE file for details.

## 🆕 Changelog

### Version 3.0.0 (Current)
- Complete multi-project architecture
- Advanced role-based access control
- Inline editing with validation
- AI integration with Qwen
- Real-time dashboard with analytics
- Docker deployment configuration
- Comprehensive API documentation
- Enhanced security features

### Version 2.0.0
- Basic project management
- Simple user authentication
- Core inspection modules

### Version 1.0.0
- Initial release
- Basic functionality

---

**Built with ❤️ by MiniMax Agent**

For technical support or feature requests, please create an issue in the project repository.