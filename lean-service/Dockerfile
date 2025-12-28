# QuantConnect Lean Backtesting Service
FROM quantconnect/lean:latest

# Set working directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install additional system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Copy application code
COPY . .

# Create directories for data and results
RUN mkdir -p /app/data /app/results /app/strategies /app/logs

# Set environment variables
ENV PYTHONPATH=/app:/Lean
ENV LEAN_DATA_FOLDER=/app/data
ENV LEAN_RESULTS_FOLDER=/app/results
ENV LEAN_STRATEGIES_FOLDER=/app/strategies

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start the service
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
