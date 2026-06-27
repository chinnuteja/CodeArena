FROM python:slim
RUN useradd -m -u 1000 runner
USER runner
WORKDIR /app
