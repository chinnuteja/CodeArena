FROM gcc:bookworm
RUN useradd -m -u 1000 runner
USER runner
WORKDIR /app
