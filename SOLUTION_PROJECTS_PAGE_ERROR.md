# Solution: Fix for "Cannot GET /projects" Error

## Problem Analysis
When trying to access `http://localhost:3001/projects`, users get an error. Based on investigation, here are the key findings:

### Root Causes Identified:
1. **Port Confusion**: 
   - Frontend React development server runs on port **3001** (node.js)
   - Backend FastAPI server runs on port **8000** (Python)
   - User is accessing frontend port but expecting backend API response

2. **Authentication Requirement**:
   - The `/projects` route in the frontend is **protected** (requires login)
   - Unauthenticated users are redirected to `/login`

3. **API Endpoint Structure**:
   - Backend API endpoints are prefixed with `/api/v1/`
   - Correct backend endpoint: `http://localhost:8000/api/v1/projects`
   - Frontend `.env` file correctly configured: `REACT_APP_API_URL=http://127.0.0.1:8000/api/v1`

4. **CORS Configuration**:
   - Backend CORS is configured to allow `http://localhost:3001`
   - This should work correctly based on the configuration

## Step-by-Step Solution

### Solution 1: Access the Application Correctly
1. **Start both servers** (if not already running):
   ```bash
   # Backend (port 8000)
   cd backend
   python -m uvicorn app.main:app --reload --port 8000

   # Frontend (port 3001) 
   cd frontend
   npm start
   ```

2. **Access the application properly**:
   - Open browser to: `http://localhost:3001`
   - You will be redirected to login page
   - Login with default credentials:
     - Email: `admin@mpdms.com`
     - Password: `admin`
   - After login, navigate to Projects page

### Solution 2: Fix Common Issues

#### Issue A: Frontend Development Server Not Running
**Symptoms**: Blank page or "Cannot connect" error at `http://localhost:3001`

**Fix**:
```bash
cd frontend
npm install  # Ensure dependencies are installed
npm start    # Start development server
```

#### Issue B: Backend API Server Not Running
**Symptoms**: Frontend loads but shows API connection errors in console

**Fix**:
```bash
cd backend
# Activate virtual environment if needed
# venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

python -m uvicorn app.main:app --reload --port 8000
```

#### Issue C: CORS Errors in Browser Console
**Symptoms**: Browser console shows CORS policy errors

**Fix**: Ensure backend CORS configuration includes frontend origin:
```python
# In backend/app/main.py
allow_origins = [
    "http://localhost:3000",
    "http://localhost:3001",  # Make sure this is included
    "http://localhost:3002",
    "http://localhost:3003",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",  # And this
    # ... other origins
]
```

#### Issue D: Database Connection Issues
**Symptoms**: Backend starts but API calls fail with database errors

**Fix**:
```bash
cd backend
python reset_database.py  # Reset and recreate tables
python seed_db.py         # Seed with sample data
```

### Solution 3: Diagnostic Tools

1. **Use the diagnostic HTML page**:
   - Open `test_frontend_issue.html` in browser
   - Run tests to identify specific issues

2. **Check browser developer console**:
   - Press F12 → Console tab
   - Look for errors when accessing `/projects`

3. **Verify server status**:
   ```bash
   # Check if servers are running
   netstat -ano | findstr :3001  # Frontend
   netstat -ano | findstr :8000  # Backend
   ```

## Quick Troubleshooting Checklist

- [ ] **Frontend server running** on port 3001
- [ ] **Backend server running** on port 8000  
- [ ] **User is logged in** (check localStorage for token)
- [ ] **CORS configured** correctly in backend
- [ ] **Database initialized** and seeded
- [ ] **.env files configured** correctly
- [ ] **Browser cache cleared** (Ctrl+F5 for hard refresh)

## Expected Flow After Fix

1. User visits `http://localhost:3001`
2. If not authenticated → Redirected to `/login`
3. User logs in with credentials
4. After successful login → Redirected to `/projects`
5. Projects page loads and displays project list from backend API

## API Endpoints Reference

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | `http://localhost:3001` | React application |
| Frontend Login | `http://localhost:3001/login` | Login page |
| Frontend Projects | `http://localhost:3001/projects` | Projects page (protected) |
| Backend API | `http://localhost:8000/` | API root |
| Backend Projects API | `http://localhost:8000/api/v1/projects` | Projects data (requires auth) |
| Backend Docs | `http://localhost:8000/docs` | API documentation |

## Default Login Credentials

- **Admin**: `admin@mpdms.com` / `admin`
- **Inspector**: `inspector@mpdms.com` / `inspect`
- **Visitor**: `visitor@mpdms.com` / `visit`

## Additional Notes

- The backend has `TEST_LOGIN_BYPASS=true` in `.env` for development
- Database uses SQLite by default (`USE_SQLITE="true"`)
- For production, consider switching to PostgreSQL and updating configuration

If issues persist after trying these solutions, check the backend logs in `backend/debug_log.txt` for detailed error information.