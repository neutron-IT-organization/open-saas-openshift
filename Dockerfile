# Stage 1: Build the Wasp app
FROM  registry.access.redhat.com/ubi9/nodejs-20  as builder

USER 0

# Install Wasp CLI
RUN curl -sSL https://get.wasp-lang.dev/installer.sh | sh

# Set the Wasp bin path
ENV PATH="${PATH}:/opt/app-root/src/.local/bin"

# Create app directory
WORKDIR /usr/src/app


# Copy the entire app source code into the container
COPY template/app ./

# Set environment variable for the database URL
ENV DATABASE_URL="postgresql://quarkus:quarkus@postgres:5432/quarkus"

# Copy .env.server.example to .env.server and update DATABASE_URL
RUN cp .env.server.example .env.server && \
    sed -i "s|^# DATABASE_URL=.*|DATABASE_URL=${DATABASE_URL}|" .env.server

# Copy .env.server.example to .env.server and update DATABASE_URL
RUN cp .env.client.example .env.client && \
    sed -i "s|^# DATABASE_URL=.*|DATABASE_URL=${DATABASE_URL}|" .env.server

# Expose the necessary port
EXPOSE 3000

# Run the Wasp app
ENTRYPOINT ["SKIP_EMAIL_VERIFICATION_IN_DEV=true","wasp", "start"]

