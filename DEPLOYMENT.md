# Linux VPS deployment

This guide deploys the internal portal separately from the public ArclivoLabs website, using `workspace.arclivolabs.com` as the suggested host. Do not copy the public site over this application.

## Requirements

- Ubuntu 22.04/24.04 or another supported Linux distribution
- Node.js `^20.19.0 || >=22.12.0` and npm
- MongoDB with authentication and TLS enabled for remote connections
- A DNS `A`/`AAAA` record for `workspace.arclivolabs.com`
- Nginx and Certbot

## Install and configure

1. Create a dedicated, non-root service account and an application directory (for example, `/srv/arclivolabs-employee`). Install a currently supported Node.js version satisfying the package engine range.
2. Check out or copy the application into that directory. From the project root, install locked dependencies and prepare the production environment:

   ```sh
   npm ci
   cp .env.example .env.local
   chmod 600 .env.local
   ```

3. Edit `.env.local` and set:
   - `MONGODB_URI` to the production database, using an application-specific MongoDB user with only the permissions it needs. Keep the database private and require TLS for remote connections.
   - `NEXTAUTH_URL=https://workspace.arclivolabs.com`
   - `NEXTAUTH_SECRET` to a new secret, for example generated with `openssl rand -base64 48`.
   - Unique, temporary bootstrap values for `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, and `BOOTSTRAP_ADMIN_EMPLOYEE_ID`. Use a strong password meeting the documented 12-character and 72-byte constraints.

   Never commit `.env.local`, put secrets in `NEXT_PUBLIC_*` variables, or share them in logs. Restrict the file to the service account.

4. Create the initial Super Admin exactly once:

   ```sh
   npm run bootstrap:admin
   ```

   After confirming the account was created, remove all `BOOTSTRAP_ADMIN_*` values from `.env.local`. Keep a secure record of the admin recovery process; do not retain the bootstrap password in the deployment environment.

5. Build and start the application:

   ```sh
   npm run build
   npm run start -- --hostname 127.0.0.1 --port 3000
   ```

   Keep the process under a process manager rather than an interactive terminal. For example, a systemd unit at `/etc/systemd/system/arclivolabs-employee.service` can use:

   ```ini
   [Unit]
   Description=ArclivoLabs Employee Portal
   After=network.target

   [Service]
   Type=simple
   User=arclivo-portal
   Group=arclivo-portal
   WorkingDirectory=/srv/arclivolabs-employee
   Environment=NODE_ENV=production
   ExecStart=/usr/bin/npm run start -- --hostname 127.0.0.1 --port 3000
   Restart=on-failure
   RestartSec=5
   NoNewPrivileges=true
   PrivateTmp=true

   [Install]
   WantedBy=multi-user.target
   ```

   Adjust `User`, `Group`, `WorkingDirectory`, and the `npm` path to the host. Ensure the service account can read `.env.local` and the app files. Then run `sudo systemctl daemon-reload`, `sudo systemctl enable --now arclivolabs-employee`, and check `sudo systemctl status arclivolabs-employee`. Next.js loads `.env.local` from the application directory.

## Nginx and HTTPS

Configure Nginx to proxy only the portal hostname to the loopback-bound application. A minimal HTTP server block, before requesting a certificate, is:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name workspace.arclivolabs.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Test and reload Nginx, then obtain and install the certificate:

```sh
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d workspace.arclivolabs.com
```

Verify the HTTPS site and Certbot renewal timer. Keep port 3000 inaccessible from the public network; only Nginx should reach it. The production `NEXTAUTH_URL` and HTTPS deployment enable secure session cookies.

## Updates and operations

For an update, fetch the intended release, run `npm ci`, run the project checks (`npm run typecheck`, `npm run lint`), build with `npm run build`, and restart with `sudo systemctl restart arclivolabs-employee`. Keep a known-good release available for rollback and verify the service status and login page after each update.

Review service output with `sudo journalctl -u arclivolabs-employee`. Monitor disk space, memory, service restarts, Nginx errors, MongoDB availability, and certificate expiry. Do not log request credentials, session tokens, environment contents, or password hashes.

## MongoDB backup and restore

Use an authenticated MongoDB database-tools account over TLS and store backups outside the application host with restricted access. For example:

```sh
mongodump --uri="mongodb+srv://cluster.example.mongodb.net/arclivolabs_employee_portal?tls=true" --username="$MONGODB_BACKUP_USER" --authenticationDatabase=admin --archive=/secure-backups/arclivolabs-employee-$(date -u +%Y%m%dT%H%M%SZ).archive.gz --gzip
mongorestore --uri="mongodb+srv://cluster.example.mongodb.net/arclivolabs_employee_portal?tls=true" --username="$MONGODB_BACKUP_USER" --authenticationDatabase=admin --archive=/secure-backups/backup.archive.gz --gzip
```

With the password option omitted, MongoDB Database Tools prompt for the password rather than putting it in the command line. Replace the sample cluster host and set `MONGODB_BACKUP_USER` in a protected shell environment. Protect and encrypt backup files, define retention, and regularly test restoring into a separate database before relying on backups. Backups contain employee and compensation data and must be treated as confidential.

## File storage

Employee attachment uploads are not implemented. Do not enable public upload directories or add an upload endpoint without private storage, type/size validation, access controls, and a separate review.
