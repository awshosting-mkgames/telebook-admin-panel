# Telebook Admin Panel Server Configuration

This document explains the production server setup for the Telebook admin panel and the current nginx configuration plan.

## 1. Current deployment structure

- Frontend app: Telebook admin panel
- Frontend domain: https://admin.telebookservices.com
- Backend API: https://api.telebookservices.com
- Frontend build path: /var/www/telebook-admin-panel/dist
- Nginx config path: /etc/nginx/sites-available/admin.telebookservices.com

## 2. Important production fact

This project is a React + Vite app. It does not run directly from the source folder in production.
The app must be built first:

```bash
cd /var/www/telebook-admin-panel
npm install
npm run build
```

After build, the static output is generated in:

```bash
/var/www/telebook-admin-panel/dist
```

Nginx should serve from this directory, not from the project source root.

## 3. Production nginx config

Use this server block in nginx:

```nginx
server {
    listen 80;
    server_name admin.telebookservices.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name admin.telebookservices.com;

    root /var/www/telebook-admin-panel/dist;
    index index.html;

    ssl_certificate /etc/letsencrypt/live/admin.telebookservices.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.telebookservices.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass https://api.telebookservices.com;
        proxy_http_version 1.1;
        proxy_set_header Host api.telebookservices.com;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Connection "";
    }

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
    gzip_min_length 256;

    client_max_body_size 20M;
}
```

## 4. Install steps on EC2

```bash
sudo cp /var/www/telebook-admin-panel/nginx-admin.conf /etc/nginx/sites-available/admin.telebookservices.com
sudo ln -sf /etc/nginx/sites-available/admin.telebookservices.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 5. Backend on separate server

If the backend is on a different server, keep the frontend config as:

```nginx
proxy_pass https://api.telebookservices.com;
```

This is correct for the current architecture where backend is separate from admin frontend.

## 6. Need to change current nginx config?

Yes, the current nginx config should be updated for production if it currently points to the wrong root or a missing cert path.

The production config should be the one above, because:

- frontend is static build served from /dist
- HTTPS is enabled with Let’s Encrypt
- admin domain points to frontend
- backend API lives on another server

## 7. Frontend API base configuration

The frontend reads the backend URL from the environment variable:

```env
VITE_API_BASE_URL=https://api.telebookservices.com
```

This value is baked into the build. If it changes, rebuild the app:

```bash
cd /var/www/telebook-admin-panel
npm run build
```

## 8. Browser note

If users previously had a wrong server URL stored in browser storage, clear:

- Local Storage: tb_admin_base
- Session Storage: tb_admin_token

Then refresh the page.

## 9. Final checklist

- Domain resolves to EC2 public IP
- Security group allows 80 and 443
- SSL certificate exists
- Frontend built successfully
- Nginx root points to /var/www/telebook-admin-panel/dist
- API proxy points to backend domain
- Browser cache cleared

## 10. Current production recommendation

Use the config in this document for the live environment. Do not rely on ad-hoc temporary nginx files once the site is production.

Keep this file in the project repo for deployment history and future changes.
