FROM python:3.12-slim
WORKDIR /app
COPY server.py ./
COPY static ./static
ENV TS_DATA_DIR=/data \
    TS_PORT=8000 \
    PYTHONUNBUFFERED=1
VOLUME /data
EXPOSE 8000
CMD ["python", "server.py"]
