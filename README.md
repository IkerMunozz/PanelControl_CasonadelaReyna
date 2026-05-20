# Panel de control Casona — WhatsApp AI Hotel Agent

Dashboard full-stack para supervisar conversaciones de WhatsApp gestionadas por un agente de reservas, con Redis como única fuente de estado y n8n Cloud como canal de envío/entrada mediante webhooks.

## Requisitos

- Node.js 20+
- Redis accesible desde el backend
- Workflow de n8n Cloud con WhatsApp Trigger

## Configuración

Backend:

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

URLs por defecto:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
- Webhook entrante para n8n: `http://TU_HOST:3001/api/webhook/incoming`

## Variables de entorno

Crea `backend/.env`:

```env
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
N8N_WEBHOOK_URL=https://app.n8n.cloud/webhook/...
N8N_SEND_WEBHOOK_URL=https://app.n8n.cloud/webhook/send-message
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

En producción, `CORS_ORIGIN` debe apuntar al dominio real del dashboard.

## Integración con n8n

1. Abre el workflow de n8n Cloud.
2. Después del nodo **WhatsApp Trigger**, añade en paralelo un nodo **HTTP Request**.
3. Configura el nodo:
   - Method: `POST`
   - URL: `https://TU_BACKEND/api/webhook/incoming`
   - Body: JSON
   - Campos mínimos:

```json
{
  "phone": "={{ $json.from }}",
  "message": "={{ $json.text.body }}",
  "timestamp": "={{ new Date().toISOString() }}"
}
```

Esto alimenta el backend con cada mensaje entrante para registrar estadísticas en Redis, clasificar intents por palabras clave y notificar el dashboard por WebSocket en tiempo real.

Si el agente de n8n escala una conversación, envía también `reason` con uno de estos valores: `complaint`, `cancellation`, `special_price`, `incident`, `request_human`.

## Claves Redis

El backend solo escribe en:

- `hotel-escalation:{phone}`
- `messages:{phone}`
- `stats:*`

El backend solo lee, sin modificar, la memoria de n8n:

- `lc:memory_buffer:{phone}`

## Datos de prueba

Para ver el módulo de estadísticas con datos realistas:

```bash
cd backend
npm run seed:stats
```

El seed genera actividad de los últimos 30 días, motivos de escalación, intents y conversaciones recientes.

## Desplegar backend para n8n Cloud

Como n8n Cloud no puede llamar a `localhost`, el backend necesita una URL pública HTTPS. Una opción sencilla es Render para el servicio Node y Upstash para Redis.

### 1. Crear Redis público

1. Crea una base Redis en Upstash.
2. Copia la conexión Redis compatible con TCP, con formato:

```env
REDIS_URL=rediss://default:PASSWORD@HOST.upstash.io:6379
```

Upstash usa TLS, por eso el prefijo debe ser `rediss://`.

### 2. Subir este proyecto a GitHub

Render despliega desde un repositorio. Sube la carpeta completa del proyecto a GitHub.

### 3. Crear Web Service en Render

En Render:

- New → Web Service
- Repository: el repo de este proyecto
- Root Directory: `backend`
- Build Command: `npm ci && npm run build`
- Start Command: `npm start`
- Health Check Path: `/api/health`

Variables de entorno:

```env
REDIS_URL=rediss://default:PASSWORD@HOST.upstash.io:6379
REDIS_PASSWORD=
N8N_SEND_WEBHOOK_URL=https://TU_N8N/webhook/send-message
N8N_WEBHOOK_URL=https://TU_N8N/webhook/...
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

Cuando Render termine, tendrás una URL como:

```text
https://casona-whatsapp-dashboard-backend.onrender.com
```

### 4. Usar esa URL en n8n

En el nodo HTTP Request de n8n usa:

```text
POST https://casona-whatsapp-dashboard-backend.onrender.com/api/webhook/incoming
```

Y en el `.env` del frontend local, si quieres que el panel local use el backend desplegado:

```env
VITE_API_URL=https://casona-whatsapp-dashboard-backend.onrender.com/api
```

Después recompila o reinicia el frontend.

## Endpoints principales

- `GET /api/conversations`
- `GET /api/conversations/:phone`
- `POST /api/conversations/:phone/escalate`
- `POST /api/conversations/:phone/resolve`
- `POST /api/conversations/:phone/send`
- `POST /api/webhook/incoming`
- `GET /api/stats`
- `GET /api/stats/overview`
- `GET /api/stats/hourly`
- `GET /api/stats/weekly`
- `GET /api/stats/escalation-reasons`
- `GET /api/stats/top-intents`
- `GET /api/stats/peak-hours`
- `GET /api/stats/ai-performance`
- `GET /api/stats/export?range=today|7d|30d&format=csv`
- `GET /api/health`
