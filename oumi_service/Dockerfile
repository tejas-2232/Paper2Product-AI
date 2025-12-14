FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Service bind for deployment
ENV OUMI_SERVICE_HOST=0.0.0.0
ENV OUMI_SERVICE_PORT=8001

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY main.py /app/main.py

EXPOSE 8001

CMD ["python", "/app/main.py"]



