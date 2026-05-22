# ETAPA 1: Compilar el Frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app
# Copiamos archivos del frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# ETAPA 2: Compilar el Backend
FROM node:22-alpine AS backend-builder
WORKDIR /app
# Copiamos archivos del backend
COPY backend/package*.json ./backend/
RUN cd backend && npm install
COPY backend/ ./backend/
# Traemos el frontend compilado de la etapa anterior
COPY --from=frontend-builder /app/frontend/dist ./backend/frontend-dist
RUN cd backend && npm run build

# ETAPA 3: Ejecución (Imagen final ligera)
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# Copiamos solo lo necesario para ejecutar
COPY --from=backend-builder /app/backend/package*.json ./
RUN npm install --omit=dev
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/frontend-dist ./frontend-dist

EXPOSE 3001
# IMPORTANTE: Ejecutamos el archivo compilado en dist/src/index.js
CMD ["node", "dist/src/index.js"]
