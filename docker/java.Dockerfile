FROM eclipse-temurin:21-jdk-alpine

RUN addgroup -S appgroup && adduser -S 1000 -G appgroup

WORKDIR /app
USER 1000
