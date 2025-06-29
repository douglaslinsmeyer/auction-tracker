# Development Guide

## Hot-Reloading Setup

The backend now supports hot-reloading for rapid development. Changes to the code will automatically restart the server.

### Quick Start

```bash
# Start with hot-reloading (development mode)
docker-compose up

# Or explicitly
docker-compose up --build
```

### How It Works

1. **Default Development Mode**: When you run `docker-compose up`, it automatically uses:
   - `docker-compose.yml` (base configuration)
   - `docker-compose.override.yml` (development overrides)

2. **What Gets Reloaded**:
   - `/src` - All backend API code
   - `/public` - All UI files (HTML, CSS, JS)
   - Configuration files

3. **Nodemon Configuration** (`nodemon.json`):
   - Watches: `src/` and `public/` directories
   - File types: `.js`, `.html`, `.css`, `.json`
   - Delay: 1 second (prevents multiple restarts)
   - Ignores: test files and logs

### Production Mode

To run without hot-reloading:

```bash
# Use production configuration
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up

# Or build for production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build
```

### Viewing Logs

```bash
# Follow logs
docker-compose logs -f

# Just backend logs
docker-compose logs -f nellis-backend
```

### Rebuilding

```bash
# Force rebuild after package.json changes
docker-compose build --no-cache

# Or just restart
docker-compose restart
```

### Tips

1. **File Changes**: Save any file in `/src` or `/public` to trigger reload
2. **Package Changes**: Run `docker-compose build` after modifying package.json
3. **Clean Start**: `docker-compose down -v` removes volumes for fresh start
4. **Check Health**: `docker-compose ps` shows container health status

### Troubleshooting

- **Not Reloading?** Check `docker-compose logs` for nodemon output
- **Port Conflict?** Ensure port 3000 is free
- **Slow Reloads?** Increase delay in `nodemon.json`