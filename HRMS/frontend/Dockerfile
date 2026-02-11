# ============================================================
# Stage 1: Build — compile TypeScript and bundle with Vite
# ============================================================
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files first for layer caching
COPY package.json package-lock.json ./

# Install all dependencies (including devDeps for build tools)
RUN npm ci

# Copy source code
COPY . .

# Build-time environment variable for API URL
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Build the production bundle
RUN npm run build


# ============================================================
# Stage 2: Artifacts — minimal image holding build output
# Used with: docker build --output or docker cp to extract
# built assets for CDN/GCS upload
# ============================================================
FROM alpine:3.19 AS artifacts

COPY --from=build /app/dist /dist

# No CMD needed — this stage is only for artifact extraction
