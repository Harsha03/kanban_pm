# Deployment Guide

This guide covers production deployment of Kanban PM.

## Prerequisites

- Docker and Docker Compose
- Domain name with DNS configured
- SSL/TLS certificate (Let's Encrypt recommended)

## Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Required for AI features
OPENROUTER_API_KEY=your_actual_api_key_here

# Optional: Custom database location
PM_DB_PATH=/data/pm.db
```

**Security Note:** Never commit `.env` to version control.

## Docker Production Build

### Build the Image

```bash
docker build -t kanban-pm:latest .
```

### Run the Container

```bash
docker run -d \
  --name kanban-pm \
  --restart unless-stopped \
  -p 8000:8000 \
  --env-file .env \
  -v $(pwd)/data:/app/backend/data \
  kanban-pm:latest
```

**Volume Mount:** The `-v` flag persists the SQLite database outside the container.

## Docker Compose (Recommended)

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  kanban-pm:
    build: .
    container_name: kanban-pm
    restart: unless-stopped
    ports:
      - "8000:8000"
    env_file:
      - .env
    volumes:
      - ./data:/app/backend/data
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health', timeout=2).read()"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s
```

Start services:

```bash
docker-compose up -d
```

## Reverse Proxy Setup (Nginx)

Create `/etc/nginx/sites-available/kanban-pm`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/kanban-pm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Database Backup

### Manual Backup

```bash
docker exec kanban-pm cp /app/backend/data/pm.db /app/backend/data/pm-backup-$(date +%Y%m%d).db
docker cp kanban-pm:/app/backend/data/pm-backup-$(date +%Y%m%d).db ./backups/
```

### Automated Backup (Cron)

Add to crontab:

```bash
0 2 * * * /path/to/backup-script.sh
```

`backup-script.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/path/to/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="pm-backup-${TIMESTAMP}.db"

docker exec kanban-pm sqlite3 /app/backend/data/pm.db ".backup /app/backend/data/${BACKUP_FILE}"
docker cp kanban-pm:/app/backend/data/${BACKUP_FILE} ${BACKUP_DIR}/

# Keep only last 30 days of backups
find ${BACKUP_DIR} -name "pm-backup-*.db" -mtime +30 -delete
```

## Database Restore

```bash
docker exec kanban-pm sqlite3 /app/backend/data/pm.db ".restore /app/backend/data/pm-backup-20260408.db"
docker restart kanban-pm
```

## Health Monitoring

### Health Check Endpoint

```bash
curl http://localhost:8000/api/health
# Expected: {"status": "ok"}
```

### Container Health Status

```bash
docker ps
# Look for "healthy" in STATUS column
```

### Logs

```bash
# View logs
docker logs kanban-pm

# Follow logs
docker logs -f kanban-pm

# Last 100 lines
docker logs --tail 100 kanban-pm
```

## Scaling Considerations

### Current Limitations (MVP)

- Single SQLite database (not suitable for multi-instance deployment)
- No session management (auth state in localStorage only)
- One board per user constraint

### Future Scaling Path

1. Migrate to PostgreSQL for multi-instance support
2. Add Redis for session management
3. Implement load balancing with sticky sessions
4. Separate static file serving (CDN)
5. Database connection pooling

## Security Hardening

### Environment Variables

- Store secrets in Docker secrets or external secret manager
- Rotate API keys regularly
- Use separate keys for dev/staging/production

### Network Security

- Run container in private network
- Only expose via reverse proxy
- Enable firewall rules (only ports 80/443 open)

### Application Security

- Keep dependencies updated
- Monitor for CVEs in Docker base images
- Implement rate limiting (see CORS/Rate Limiting section)

## Performance Tuning

### Uvicorn Workers

For production, increase worker count:

```dockerfile
CMD ["/app/.venv/bin/uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

### Database Optimization

```sql
-- Run periodically to optimize database
VACUUM;
ANALYZE;
```

### Static File Caching

Nginx can cache static assets:

```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs kanban-pm

# Verify env file
docker exec kanban-pm env | grep OPENROUTER

# Check file permissions
ls -la data/
```

### Database Locked

```bash
# Check for zombie connections
docker exec kanban-pm lsof /app/backend/data/pm.db

# Restart container
docker restart kanban-pm
```

### High Memory Usage

```bash
# Check container stats
docker stats kanban-pm

# Inspect database size
docker exec kanban-pm ls -lh /app/backend/data/pm.db
```

## Monitoring & Alerting

### Uptime Monitoring

Use services like UptimeRobot, Pingdom, or StatusCake to monitor `/api/health`.

### Log Aggregation

Ship logs to centralized logging:

```yaml
# docker-compose.yml
services:
  kanban-pm:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Metrics (Future)

Consider adding:
- Prometheus metrics endpoint
- Grafana dashboards
- APM (Application Performance Monitoring)

## Rollback Procedure

1. Stop current container:
   ```bash
   docker stop kanban-pm
   ```

2. Restore database backup:
   ```bash
   docker exec kanban-pm sqlite3 /app/backend/data/pm.db ".restore /app/backend/data/pm-backup-20260407.db"
   ```

3. Deploy previous image version:
   ```bash
   docker run -d --name kanban-pm ... kanban-pm:previous-tag
   ```

## Support

For issues:
- Check logs: `docker logs kanban-pm`
- Verify health: `curl http://localhost:8000/api/health`
- Review documentation in `docs/`
