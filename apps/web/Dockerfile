# Etapa 1: Dependencias
FROM node:20-bullseye AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Etapa 2: Build
FROM node:20-bullseye AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 👇 Asegurarse de que la carpeta processor se copie aquí (ya está incluida por COPY . .)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Etapa 3: Producción
FROM node:20-bullseye AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
EXPOSE 3000

# ✅ Instala Python + pip + ffmpeg + todas las dependencias necesarias
RUN apt-get update && \
    apt-get install -y \
        python3 \
        python3-pip \
        python3-dev \
        ffmpeg \
        build-essential \
        libpq-dev \
        wget \
        ca-certificates && \
    pip3 install --upgrade pip setuptools wheel && \
    pip3 install --default-timeout=300 --no-cache-dir \
        requests \
        psycopg2-binary \
        python-docx \
        pdfplumber \
        pypdf && \
    pip3 install --default-timeout=600 --no-cache-dir openai-whisper && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*



# Copiar artefactos del build
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/next.config.js ./

# 👇 NUEVO: Copiar la carpeta processor también
COPY --from=builder /app/processor ./processor

RUN npm ci --omit=dev

CMD ["npm", "start"]

