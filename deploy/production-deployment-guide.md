# Production Deployment Guide
## Project QA Data Management System - PostgreSQL Edition

## Overview
This guide provides step-by-step instructions for deploying the Project QA Data Management System in a production environment using PostgreSQL, Redis, and Docker.

## Prerequisites

### System Requirements
- **CPU**: 4+ cores (8+ recommended)
- **RAM**: 8GB minimum (16GB recommended)
- **Storage**: 50GB+ SSD storage
- **OS**: Linux (Ubuntu 20.04/22.04, CentOS 8+, or similar)
- **Docker**: 20.10+
- **Docker Compose**: 2.0+

### Network Requirements
- Port 80/443 (HTTP/HTTPS)
- Port 5432 (PostgreSQL - internal only)
- Port 6379 (Redis - internal only)
- Port 8000 (Backend API)
- Port 3000 (Frontend)

## Deployment Steps

### 1. Environment Setup

```bash
# Clone the repository
git clone <repository-url>
cd project-qa-data-management

# Create environment file
cp .env.example .env.production

# Edit environment variables
nano .env.production
```

### 2. Configure Environment Variables

Create `.env.production` with the following variables:

```env
# PostgreSQL Configuration
POSTGRES_USER=project_qa_admin
POSTGRES_PASSWORD=strong_password_here
POSTGRES_DB=project_management

# Backend Configuration
SECRET_KEY=your-secret-key-here-change-in-production
DATABASE_URL=postgresql://project_qa_admin:strong_password_here@postgres:5432/project_management
REDIS_URL=redis://redis:6379/0

# Frontend Configuration
REACT_APP_API_URL=http://your-domain.com/api/v1
REACT_APP_ENVIRONMENT=production

# Security
ALLOW_ORIGINS=http://your-domain.com,https://your-domain.com
ALLOWED_HOSTS=your-domain.com,localhost,127.0.0.1

# Performance Tuning
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=30
DB_POOL_RECYCLE=3600
```

### 3. Prepare Data Directories

```bash
# Create data directories
mkdir -p data/postgres data/redis data/logs

# Set proper permissions
chmod 755 data/
chmod 700 data/postgres data/redis
```

### 4. Deploy with Docker Compose

```bash
# Use production docker-compose file
docker-compose -f docker-compose.production.yml --env-file .env.production up -d

# Check status
docker-compose -f docker-compose.production.yml ps

# View logs
docker-compose -f docker-compose.production.yml logs -f
```

### 5. Initialize Database

```bash
# Wait for PostgreSQL to be ready
sleep 30

# Run database initialization
docker-compose -f docker-compose.production.yml exec postgres psql -U project_qa_admin -d project_management -f /docker-entrypoint-initdb.d/init-db.sql

# Create initial admin user
docker-compose -f docker-compose.production.yml exec backend python -c "
from app.database import SessionLocal
from app.models import User
from app.auth import get_password_hash

db = SessionLocal()
try:
    admin = User(
        username='admin',
        email='admin@example.com',
        full_name='System Administrator',
        hashed_password=get_password_hash('Admin@123'),
        is_active=True,
        is_superuser=True
    )
    db.add(admin)
    db.commit()
    print('Admin user created successfully')
except Exception as e:
    print(f'Error: {e}')
finally:
    db.close()
"
```

### 6. Configure SSL/TLS (Optional but Recommended)

```bash
# Create SSL directory
mkdir -p nginx/ssl

# Generate self-signed certificate (for testing)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/nginx.key \
  -out nginx/ssl/nginx.crt \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=your-domain.com"

# Use Let's Encrypt for production
# certbot certonly --nginx -d your-domain.com
```

### 7. Configure Nginx

Edit `nginx/nginx.conf` for your domain:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/nginx.crt;
    ssl_certificate_key /etc/nginx/ssl/nginx.key;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # Frontend
    location / {
        proxy_pass http://frontend:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Health checks
    location /health {
        proxy_pass http://backend:8000/health;
        access_log off;
    }
}
```

### 8. Start All Services

```bash
# Start all services
docker-compose -f docker-compose.production.yml up -d

# Verify all services are running
docker-compose -f docker-compose.production.yml ps

# Check health status
curl http://localhost:8000/health
```

## Monitoring and Maintenance

### 1. Database Backups

Create backup script `scripts/backup-database.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$DATE.sql"

docker-compose -f docker-compose.production.yml exec postgres \
  pg_dump -U project_qa_admin project_management > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete
```

### 2. Log Rotation

Configure log rotation in `/etc/logrotate.d/project-qa`:

```bash
/var/lib/docker/containers/*/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    copytruncate
}
```

### 3. Performance Monitoring

Access monitoring tools:
- **Grafana**: http://your-domain.com:3001 (admin/admin)
- **Prometheus**: http://your-domain.com:9090
- **pgAdmin**: http://your-domain.com:5050

### 4. Regular Maintenance Tasks

```bash
# Weekly database maintenance
docker-compose -f docker-compose.production.yml exec postgres \
  psql -U project_qa_admin -d project_management -c "VACUUM ANALYZE;"

# Refresh materialized views
docker-compose -f docker-compose.production.yml exec postgres \
  psql -U project_qa_admin -d project_management -c "SELECT refresh_dashboard_statistics();"

# Check database health
docker-compose -f docker-compose.production.yml exec backend \
  python -c "from app.database import check_database_health; print('Database healthy:', check_database_health())"
```

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   ```bash
   # Check PostgreSQL logs
   docker-compose -f docker-compose.production.yml logs postgres
   
   # Test database connection
   docker-compose -f docker-compose.production.yml exec postgres \
     pg_isready -U project_qa_admin
   ```

2. **Application Not Starting**
   ```bash
   # Check backend logs
   docker-compose -f docker-compose.production.yml logs backend
   
   # Check health endpoint
   curl http://localhost:8000/health
   ```

3. **High Memory Usage**
   ```bash
   # Check container resource usage
   docker stats
   
   # Check PostgreSQL memory settings
   docker-compose -f docker-compose.production.yml exec postgres \
     psql -U project_qa_admin -d project_management -c "SHOW shared_buffers;"
   ```

### Performance Tuning

1. **PostgreSQL Configuration**
   - Adjust `shared_buffers` based on available RAM (25% of total RAM)
   - Set `effective_cache_size` to 50% of total RAM
   - Monitor `pg_stat_statements` for slow queries

2. **Application Configuration**
   - Adjust `DB_POOL_SIZE` based on expected concurrent users
   - Enable Redis caching for frequently accessed data
   - Use connection pooling in application

## Security Considerations

### 1. Network Security
- Use firewall to restrict access to necessary ports only
- Configure SSL/TLS for all external connections
- Use VPN for administrative access

### 2. Database Security
- Change default PostgreSQL passwords
- Use separate users for application and administration
- Enable SSL for database connections
- Regular security updates

### 3. Application Security
- Use strong secret keys
- Implement rate limiting
- Regular dependency updates
- Security headers in Nginx

## Scaling Considerations

### Vertical Scaling
- Increase CPU/RAM for PostgreSQL container
- Add more workers to backend (`--workers` parameter)
- Increase Redis memory limit

### Horizontal Scaling
1. **Database**: Set up PostgreSQL replication
2. **Backend**: Add more backend instances behind load balancer
3. **Redis**: Configure Redis cluster
4. **Frontend**: Use CDN for static assets

## Backup and Recovery

### Backup Strategy
- **Daily**: Full database backup
- **Hourly**: WAL (Write-Ahead Log) backups
- **Real-time**: Database replication to standby server

### Recovery Procedure
1. Stop application services
2. Restore latest backup
3. Apply WAL logs if available
4. Verify data integrity
5. Restart services

## Support and Maintenance

### Regular Tasks
- [ ] Daily: Check system health and logs
- [ ] Weekly: Database maintenance (VACUUM ANALYZE)
- [ ] Monthly: Security updates and patches
- [ ] Quarterly: Performance review and tuning

### Monitoring Alerts
Configure alerts for:
- Database connection failures
- High CPU/memory usage
- Disk space below 20%
- Application errors > 5% of requests

## Conclusion

This production deployment provides a robust, scalable, and maintainable environment for the Project QA Data Management System. Regular monitoring, maintenance, and security updates are essential for optimal performance and reliability.

For additional support, refer to:
- PostgreSQL Documentation: https://www.postgresql.org/docs/
- Docker Documentation: https://docs.docker.com/
- FastAPI Documentation: https://fastapi.tiangolo.com/
