# Build en dos fases: primero compilamos el frontend (Vite) y luego lo
# empaquetamos junto al backend en una imagen final que sirve las dos
# cosas por el mismo puerto (el backend sirve frontend/dist como estático).

FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
# /api es relativo: el frontend y la API quedan en el mismo origen, así
# no hay que tocar nada al cambiar de IP/puerto/dominio más adelante.
ENV VITE_API_URL=/api
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist ../frontend/dist
COPY database/ ../database/

EXPOSE 3000
CMD ["sh", "-c", "node scripts/migrar.js && node src/server.js"]
