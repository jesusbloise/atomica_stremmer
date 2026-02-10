# ARCHITECTURE (apps/web)

Este documento describe la estructura actual del proyecto y las reglas para mantenerlo entendible y escalable, sin necesidad de “adivinar” dónde va cada cosa.

## 1) Visión general del repo

Este repo es un monorepo simple:

- Raíz del repo: infraestructura y utilidades (Docker, SQL init, scripts sueltos).
- `apps/web`: aplicación principal Next.js (frontend + APIs en App Router).

Regla mental:
- Si es “producto” (UI / API / lógica de la app) -> `apps/web`
- Si es “infra / setup / utilidades” -> raíz del repo

## 2) Apps

### 2.1) `apps/web` (Next.js App Router)
Contiene:
- UI (rutas en `src/app`)
- APIs (route handlers en `src/app/api`)
- Componentes (`src/components`)
- Helpers y utilidades (`src/lib`, `src/hooks`, `src/constants`, `src/types`)
- Middleware global (`src/middleware.ts`)
- Procesamiento python local (`processor/`) y modelo (`yolov8n.pt`)
- Assets públicos (`public/`)

## 3) Estructura dentro de `apps/web`

### 3.1) `src/app` (rutas de UI)
Aquí viven las páginas del sitio (App Router). Rutas relevantes:
- `/` -> `src/app/page.tsx`
- `/login` -> `src/app/login/page.tsx`
- `/register` -> `src/app/register/page.tsx`
- `/subir` -> `src/app/subir/page.tsx` (y componentes internos de esa pantalla)
- `/videos/[id]` -> `src/app/videos/[id]/page.tsx` (incluye layout y modal segment)
- `/perfil`, `/perfiles`, `/explorar`, `/organizar`, `/admin`

Regla:
- En `src/app/**` solo debe vivir código de ruta/página y wiring mínimo.
- UI reutilizable debe ir en `src/components`.

### 3.2) `src/app/api` (APIs del backend en Next.js)
Aquí vive todo el backend HTTP (Route Handlers). Dominios actuales (nombres reales):
- Auth / sesión:
  - `/api/auth/[...nextauth]` (NextAuth)
  - `/api/login`, `/api/logout`, `/api/register`, `/api/me`
- Uploads / Videos:
  - `/api/uploads` (+ `ultimos`, `mas-vistos`, `[id]`)
  - `/api/videos`
  - `/api/views`
  - `/api/vimeo`
  - `/api/upload-minio`
  - `/api/save-upload`
- Procesamiento (hoy):
  - `/api/procesar-escenas/[id]`
  - `/api/procesar-objetos/[id]`
  - `/api/procesar-posturas/[id]`
  - `/api/procesar-subtitulos/[id]`
  - además: `/api/escenas`, `/api/objetos`, `/api/posturas`, `/api/subtitulos`
- Otros:
  - `/api/buscar`, `/api/comments`, `/api/documento`, `/api/frames`, `/api/fichas`
  - Admin: `/api/admin/users`, `/api/admin/users/[id]`
  - Perfiles: `/api/perfil`, `/api/perfiles`, `/api/perfiles/[user_id]`
  - Users: `/api/users`
  - Proxy: `/api/proxy`

Regla:
- Las APIs deben estar organizadas por “dominio”.
- En el futuro, el bloque “procesar-*” se recomienda agrupar bajo un dominio único, por ejemplo:
  - `/api/analysis/scenes`, `/api/analysis/objects`, `/api/analysis/poses`, `/api/analysis/subtitles`
  (No se cambia ahora; solo es regla de futuro para refactor ordenado).

### 3.3) `src/components` (UI reusable por feature)
Hoy existen:
- Componentes top-level (varios .tsx sueltos)
- Subcarpetas: `layout/`, `admin/`, `UploadVideo/`, `DocumentViewer/`

Regla:
- Componentes compartidos y reutilizables viven aquí.
- Convención recomendada (a futuro) para que sea fácil buscar:
  - `components/video/*`
  - `components/document/*`
  - `components/profile/*`
  - `components/layout/*`
  - `components/shared/*`
(De nuevo: no se mueve nada hoy; esto es guía para orden progresivo).

### 3.4) `src/lib` (helpers)
Contenido actual:
- `auth.ts` (helpers de sesión/JWT propios)
- `minioClient.js`, `generarSignedUrl.js`
- `highlight.ts`, `setupPdfWorker.ts`

Regla:
- `src/lib` es utilitario y agnóstico de UI.
- Si un helper es “server-only” (DB, MinIO, secrets), evitar importarlo desde componentes `use client`.

### 3.5) `src/hooks`
Hooks actuales:
- `usePdfSearch.ts`
- `useSubtitlesPolling.ts`

Regla:
- Hooks reutilizables para UI viven aquí.

### 3.6) `src/cons
