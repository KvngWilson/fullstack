# Admin System - Visual Control Flow Diagrams

## Legend

- Rectangle: process/action
- Diamond: decision
- Rounded node: state/result
- Dashed path: error/failure branch

---

## Complete Employee Journey: Invitation -> Logout

```mermaid
flowchart TD
  subgraph P1[Phase 1: Invitation]
    A1[Admin User Logged In] --> A2[POST /api/v1/employees/invite]
    A2 --> A3[protect auth middleware]
    A3 --> A4{JWT valid}
    A4 -->|Yes| A5[permission employee:invite]
    A4 -.->|No| AX1[401 Unauthorized]
    A5 --> A6{Has permission}
    A6 -->|Yes| A7[inviteEmployee controller validation]
    A6 -.->|No| AX2[403 Forbidden]
    A7 --> A8[InvitationService.createInvitation]
    A8 --> A9[Insert employee_invitations + queue email]
    A9 --> A10((Invitation email sent))
  end

  subgraph P2[Phase 2: Acceptance]
    B1[Employee clicks invitation link] --> B2[Frontend accept-invitation form]
    B2 --> B3[POST /api/v1/employees/accept-invitation]
    B3 --> B4[acceptInvitation controller]
    B4 --> B5{Invitation valid and not expired}
    B5 -->|Yes| B6[Create user + employee + password history + audit log]
    B5 -.->|No| BX1[400 Invalid or expired invitation]
    B6 --> B7((Employee account ready))
  end

  subgraph P3[Phase 3: Admin Authentication]
    C1[Employee opens admin.localhost admin auth login] --> C2[POST /admin/auth/login]
    C2 --> C3[rateAuth middleware]
    C3 --> C4{Attempts < limit}
    C4 -->|Yes| C5[Validate credentials]
    C4 -.->|No| CX1[429 Too Many Requests]
    C5 --> C6{Role in admin or employee}
    C6 -->|Yes| C7[Set auth cookie + store session + audit admin_login]
    C6 -.->|No| CX2[403 Access denied for non-admin roles]
    C7 --> C8((Logged in))
  end

  subgraph P4[Phase 4: Admin Panel Access]
    D1[GET /dashboard on admin subdomain] --> D2[protect middleware]
    D2 --> D3{Token valid}
    D3 -->|Yes| D4[permission dashboard:view]
    D3 -.->|No| DX1[401 Unauthorized]
    D4 --> D5{Permission present}
    D5 -->|Yes| D6[renderDashboard controller]
    D5 -.->|No| DX2[403 Missing permission]
    D6 --> D7((Dashboard rendered))
  end

  subgraph P5[Phase 5: Logout]
    E1[POST /admin/auth/logout] --> E2[Clear cookie + delete session + audit admin_logout]
    E2 --> E3((Logged out and redirected to login))
  end

  A10 --> B1
  B7 --> C1
  C8 --> D1
  D7 --> E1
```

---

## Security Gate Details

```mermaid
flowchart TD
  G1[Gate 1 Rate Limiting] --> G1D{Attempts <= 5 in window}
  G1D -->|Yes| G2[Gate 2 Credential Validation]
  G1D -.->|No| G1X[429 Too Many Requests]

  G2 --> G2D{argon2 verify password}
  G2D -->|Yes| G3[Gate 3 Role Validation]
  G2D -.->|No| G2X[401 Unauthorized]

  G3 --> G3D{Role in admin or employee}
  G3D -->|Yes| G4[Gate 4 JWT Session Establishment]
  G3D -.->|No| G3X[403 Forbidden + non_admin_login_attempt log]

  G4 --> G4D{JWT signature and expiry valid}
  G4D -->|Yes| G5[Gate 5 Permission Check]
  G4D -.->|No| G4X[401 Unauthorized]

  G5 --> G5D{Required permission in role matrix}
  G5D -->|Yes| GOK((Access Granted))
  G5D -.->|No| G5X[403 Forbidden + permission_denied log]
```

---

## SSR vs API Flow Comparison

### SSR Flow (Browser)

```mermaid
sequenceDiagram
  participant U as User Browser
  participant A as Admin Sub-App
  participant C as Admin Auth Controller

  U->>A: POST /admin/auth/login (form)
  A->>C: validate credentials + role
  C-->>U: redirect /dashboard or re-render login

  U->>A: GET /dashboard (cookie)
  A->>C: auth + permission checks
  C-->>U: render dashboard.ejs or redirect login

  U->>A: POST /admin/auth/logout
  A->>C: clear cookie + session
  C-->>U: redirect /admin/auth/login
```

### API Flow (JSON)

```mermaid
sequenceDiagram
  participant C as Client App
  participant R as /api/v1/admin/*
  participant S as Services

  C->>R: POST /api/v1/admin/auth/login (JSON)
  R->>S: authenticate + validateAdminRole
  S-->>R: user/session result
  R-->>C: JSON success or error

  C->>R: GET /api/v1/admin/dashboard/stats
  R->>S: auth + authorization
  S-->>R: dashboard data
  R-->>C: JSON data or unauthorized

  C->>R: POST /api/v1/admin/auth/logout
  R->>S: clear session
  R-->>C: JSON logout result
```

---

## Access Denied Scenarios

```mermaid
flowchart TD
  S1[Customer attempts /api/v1/admin/auth/login] --> S1D{Credentials valid}
  S1D -->|Yes| S1R{Role allowed}
  S1R -.->|No| S1X[403 Access denied + non_admin_login_attempt]

  S2[Employee requests protected route] --> S2A[auth passes]
  S2A --> S2D{Has required permission}
  S2D -.->|No| S2X[403 Missing permission + audit log]

  S3[Expired JWT requests admin route] --> S3D{Token expired}
  S3D -->|Yes| S3X[SSR redirect login or API 401]
```

---

## Troubleshooting Flowchart

```mermaid
flowchart TD
  T0[Issue detected] --> T1{Employee cannot login}
  T1 -->|Yes| T2[Check invitation status accepted]
  T2 --> T3{Accepted and linked user exists}
  T3 -->|No| T3A[Resend invitation or fix user role]
  T3 -->|Yes| T4[Validate credentials]
  T4 --> T5{validateAdminRole passing}
  T5 -->|No| T5A[Inspect role and non-admin login logs]
  T5 -->|Yes| T6[Investigate session/cookie path]

  T1 -->|No| T7{Rate limit 429}
  T7 -->|Yes| T8[Wait window or clear rate-limit key]

  T7 -->|No| T9{Admin subdomain not routing}
  T9 -->|Yes| T10[Verify vhost registration and hosts entry]
  T10 --> T11[Use admin.localhost URL not localhost/admin]
```

---

## Architecture Summary Diagram

```mermaid
flowchart LR
  U[Admin / Employee] --> V[vhost admin.localhost]
  V --> APP[adminApp Express instance]

  APP --> AUTH[Auth stack rateAuth + protect + permission]
  AUTH --> CTRL[Admin controllers SSR and API]
  CTRL --> SRV[Domain services]
  SRV --> DB[(PostgreSQL)]
  AUTH --> REDIS[(Redis sessions and rate limits)]

  CTRL --> AUDIT[security_audit_log]
  CTRL --> VIEW[EJS views for SSR]

  style AUTH stroke:#1f6feb,stroke-width:2px
  style REDIS stroke:#1f6feb,stroke-width:2px
  style AUDIT stroke:#1f6feb,stroke-width:2px
```

---

End of visual control flow documentation.
