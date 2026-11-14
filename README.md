# ArclivoLabs Employee Portal

Internal employee portal for ArclivoLabs. The portal provides MongoDB-backed credentials authentication, role-protected dashboards, employee management, one-time account setup, employee profiles, project/task workflows, recorded work activity, attendance, leave, internal payment records, announcements, and in-app notifications. There is no public signup or demo account.

## Requirements

- Node.js 20.19 or newer (or 22.12+)
- MongoDB (local or hosted)
- HTTPS and a reverse proxy for production deployments

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Set `MONGODB_URI` to your MongoDB connection string and replace `NEXTAUTH_SECRET` with a unique random value. For example, generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
4. Set the one-time `BOOTSTRAP_ADMIN_*` values in `.env.local`. Use a unique password and keep this file private.
5. Create the initial Super Admin: `npm run bootstrap:admin`. The script refuses to overwrite an existing account with that email.
6. Start the app: `npm run dev`, then open <http://localhost:3000/login>.

The bootstrap command inserts only the initial Super Admin record and refuses to replace an existing account. Do not retain bootstrap credentials in a shared environment.

## Authentication and route checks

- Sign in with the bootstrapped admin to reach `/admin/dashboard`.
- In **Employee Management**, create a Developer or Designer. Copy the one-time setup link shown after creation and share it with that person. The employee chooses their own password; the setup link is hashed in MongoDB, expires according to the employee settings, and can only be used once.
- On the setup page, an employee sets a password of at least 12 characters. Their account becomes active immediately by default; change this behavior under **Settings** if an administrator should activate accounts manually.
- Active employees sign in at `/login` and land at `/employee/dashboard`. They can edit their own name, phone, and profile-picture URL, and change their password at `/employee/profile`.
- Each dashboard layout checks the session and role on the server. API/server-operation code should call the helpers in `src/lib/auth/authorization.ts`; hiding a link is not an authorization check.
- Super Admins can create projects, assign active Developers and Designers, and manage project tasks from `/admin/projects` and `/admin/tasks`. Project progress is calculated from completed (admin-approved) tasks.
- Employees see only projects they are assigned to and tasks assigned to their own account. They can start work, report blockers, comment, and submit a GitHub/preview/Figma link or a meaningful note for admin review. Admins can approve a submission or request changes.
- Task/project APIs validate permissions server-side. Attachments are intentionally unavailable until private file storage is configured; the interface does not claim that uploads work.
- Employees can record work sessions, breaks, activity check-ins, and one daily report per session from `/employee/activity`. The timer is persisted in MongoDB and calculated from server timestamps; recorded open sessions do not verify continuous activity. The portal does not capture screenshots, keystrokes, webcam footage, or claim that check-in popups appear at an exact time.
- Super Admins can review sessions, breaks, check-ins, and reports at `/admin/activity`, and can end an accidentally open session using a reasoned, audited correction. Activity check-in interval and report requirements are configured under **Settings**. Day totals and admin date filters use UTC; timestamps on the activity pages use the browser's local timezone.
- Attendance at `/admin/attendance` and `/employee/attendance` is derived from recorded work sessions; recorded breaks are excluded from work duration. Missing sessions are labeled **No Work Recorded**, not as confirmed absence. Attendance corrections are separate, auditable records and never rewrite original sessions.
- Leave durations use inclusive UTC calendar days. Pending and approved requests reserve each requested day to prevent overlaps; leave is never automatically approved. Approved leave appears in attendance.
- Compensation records are effective-dated agreed amounts. Monthly payment periods use UTC calendar months, and the compensation in force on the first day of a period applies. Amounts are stored as integer paise. Approved incentives are allocated to a single monthly payment record; documented adjustments require an explicit reason.
- Payment records follow Draft → Approved → Paid. **Mark as Paid** records an externally completed payment only; the portal does not transfer money, calculate statutory payroll, or determine legally required wages. Paid records remain immutable; corrections use a separately audited reversal.
- Employees can view only their own approved payment records, compensation, and incentives. Admin payment details and employee earnings are restricted by server-side role and ownership checks.
- Credentials use bcrypt hashing. Passwords require at least 12 characters and are limited to 72 UTF-8 bytes. Sessions are signed JWTs and last up to eight hours. Protected requests recheck the account status, role, and auth version in MongoDB; deactivation and password changes invalidate existing sessions. Password hashes and invitation tokens are excluded from ordinary employee queries and API responses.
- Login and setup attempts are rate limited using MongoDB records. Configure MongoDB with a TTL-capable deployment for automatic cleanup of expired rate-limit and invitation records. Expiration is also checked in queries, so TTL cleanup timing does not extend an invitation's validity.
- Employee IDs use the configured prefix and a sequence. The allocator skips IDs already used, including the bootstrap administrator ID.
- Admin APIs are restricted to Super Admin. Profile APIs only access the authenticated employee's own record. Employee records are deactivated, never deleted, from this interface.

The invitation URL is a secret: share it only with its intended recipient. It is returned only to an authorized administrator when creating or regenerating an invitation and is never stored in plaintext.

## Validation

Run `npm run typecheck`, `npm run lint`, and `npm run build`.
There is no automated unit or end-to-end test runner configured yet. Run database-backed admin and employee workflows in an isolated staging environment before production use.

## Implemented scope

Employee management, live workforce statistics, employee and workspace settings, personal profile/password management, project/task workflows, recorded work activity, attendance, leave management, agreed compensation, incentives, payment records, announcements, and recipient-scoped notifications are implemented.

## Production deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Linux VPS setup, environment configuration, the initial admin bootstrap, process management, Nginx/HTTPS, updates, monitoring, and MongoDB backup/restore guidance. Production is intended to run separately from the public ArclivoLabs website at `workspace.arclivolabs.com`.

The portal does not currently provide employee file uploads; configure private object storage before enabling any upload feature. No real financial transfers are initiated by payment records.
