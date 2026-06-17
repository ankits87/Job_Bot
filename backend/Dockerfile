FROM mcr.microsoft.com/playwright/python:v1.44.0-jammy

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY backend/ .

RUN mkdir -p /app/uploads && chmod +x /app/start.sh

CMD ["/app/start.sh"]
