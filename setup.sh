#!/bin/bash

# Multi-Project Data Management System (MPDMS) Setup Script
# This script helps you set up the complete system quickly

set -e

echo "=== Multi-Project Data Management System (MPDMS) v3.0 Setup ==="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    print_status "Checking Docker installation..."
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        echo "Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_success "Docker and Docker Compose are installed"
}

# Setup environment file
setup_environment() {
    print_status "Setting up environment configuration..."
    
    if [ ! -f .env ]; then
        cp .env.example .env
        print_success "Created .env file from template"
        print_warning "Please update the .env file with your specific configuration"
        echo "  - Set a secure SECRET_KEY"
        echo "  - Configure database credentials"
        echo "  - Add your DASHSCOPE_API_KEY for AI features (optional)"
        echo ""
    else
        print_warning ".env file already exists, skipping creation"
    fi
}

# Setup backend
setup_backend() {
    print_status "Setting up backend application..."
    
    cd backend
    
    # Install Python dependencies
    if [ -f requirements.txt ]; then
        pip install -r requirements.txt
        print_success "Python dependencies installed"
    else
        print_warning "No requirements.txt found in backend directory"
    fi
    
    cd ..
    print_success "Backend setup completed"
}

# Setup frontend
setup_frontend() {
    print_status "Setting up frontend application..."
    
    cd frontend
    
    # Install Node.js dependencies
    if [ -f package.json ]; then
        npm install
        print_success "Node.js dependencies installed"
    else
        print_warning "No package.json found in frontend directory"
    fi
    
    cd ..
    print_success "Frontend setup completed"
}

# Create initial database and admin user
setup_database() {
    print_status "Setting up database..."
    
    # Generate a random password for postgres
    POSTGRES_PASSWORD=$(openssl rand -base64 12)
    
    # Update .env file with generated password
    if command -v sed &> /dev/null; then
        sed -i.bak "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$POSTGRES_PASSWORD/" .env
        print_success "Generated secure database password"
    fi
}

# Create startup script
create_startup_script() {
    print_status "Creating startup scripts..."
    
    cat > start.sh << 'EOF'
#!/bin/bash
echo "Starting Multi-Project Data Management System..."
docker-compose up --build -d
echo "System started successfully!"
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:8000"
echo "API Documentation: http://localhost:8000/docs"
echo ""
echo "Default admin credentials:"
echo "Email: admin@mpdms.com"
echo "Password: admin123"
echo ""
echo "Please change the default password after first login!"
EOF

    cat > stop.sh << 'EOF'
#!/bin/bash
echo "Stopping Multi-Project Data Management System..."
docker-compose down
echo "System stopped successfully!"
EOF

    cat > logs.sh << 'EOF'
#!/bin/bash
echo "Showing application logs..."
docker-compose logs -f
EOF

    chmod +x start.sh stop.sh logs.sh
    print_success "Created startup scripts (start.sh, stop.sh, logs.sh)"
}

# Display final instructions
display_instructions() {
    echo ""
    echo "=== Setup Complete! ==="
    echo ""
    echo "Quick Start:"
    echo "1. Update the .env file with your configuration"
    echo "2. Run: ./start.sh"
    echo "3. Open your browser to: http://localhost:3000"
    echo ""
    echo "System Information:"
    echo "- Frontend: React + TypeScript + Material-UI"
    echo "- Backend: FastAPI + SQLAlchemy + PostgreSQL"
    echo "- Authentication: JWT with role-based access control"
    echo "- Multi-project support with data isolation"
    echo ""
    echo "User Roles:"
    echo "- Admin: Full system access, user/project management"
    echo "- Inspector: Create/edit inspection records"
    echo "- Visitor: Read-only access to assigned projects"
    echo ""
    echo "Next Steps:"
    echo "1. Login with admin credentials"
    echo "2. Create your first project"
    echo "3. Add users and assign them to projects"
    echo "4. Start managing inspection data"
    echo ""
    echo "Useful Commands:"
    echo "- ./start.sh    - Start the system"
    echo "- ./stop.sh     - Stop the system"
    echo "- ./logs.sh     - View application logs"
    echo "- docker-compose ps    - Check service status"
    echo "- docker-compose logs [service] - View specific service logs"
    echo ""
}

# Main execution
main() {
    echo "Starting MPDMS setup process..."
    echo ""
    
    # Check prerequisites
    check_docker
    
    # Setup components
    setup_environment
    setup_backend
    setup_frontend
    setup_database
    create_startup_script
    
    # Display final instructions
    display_instructions
    
    print_success "MPDMS setup completed successfully!"
}

# Run main function
main "$@"