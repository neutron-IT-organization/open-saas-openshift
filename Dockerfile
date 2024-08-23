# Stage 1: Build the Wasp app
FROM  registry.access.redhat.com/ubi9/nodejs-20  as builder

USER 0

RUN SKIP_EMAIL_VERIFICATION_IN_DEV=true
# Install Wasp CLI
RUN curl -sSL https://get.wasp-lang.dev/installer.sh | sh

# Set the Wasp bin path
ENV PATH="${PATH}:/opt/app-root/src/.local/bin"

# Create app directory
WORKDIR /usr/src/app

# Copy app dependencies and install
#COPY template/app/package*.json ./

#RUN npm install

# Copy the entire app source code into the container
COPY template/app ./

# Set environment variable for the database URL
ENV DATABASE_URL="postgresql://quarkus:quarkus@postgres:5432/quarkus"

# Copy .env.server.example to .env.server and update DATABASE_URL
RUN cp .env.server.example .env.server && \
    sed -i "s|^# DATABASE_URL=.*|DATABASE_URL=${DATABASE_URL}|" .env.server

# Build the Wasp app
# RUN SKIP_EMAIL_VERIFICATION_IN_DEV=true wasp build

# Stage 2: Run the Wasp app
# FROM node:18

# Set Wasp bin path for runtime
#ENV PATH="${PATH}:/root/.wasp/cli"

# Copy the built app from the builder stage
# COPY --from=builder /usr/src/app /usr/src/app

# Set working directory
# WORKDIR /usr/src/app

# Expose the necessary port
EXPOSE 3000

# Run the Wasp app
CMD ["wasp", "start"]

