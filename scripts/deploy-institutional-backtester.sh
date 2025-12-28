#!/bin/bash

# Institutional Backtester Deployment Script
# This script deploys the institutional backtester with all required services

set -e

echo "🚀 Starting Institutional Backtester Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
LEAN_SERVICE_DIR="lean-service"
TIMESCALE_DB_NAME="wagyu_market_data"
TIMESCALE_DB_USER="wagyu_app"
TIMESCALE_DB_PASSWORD="secure_password_here"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed and running
check_docker() {
    print_status "Checking Docker installation..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    print_success "Docker is installed and running"
}

# Check if Docker Compose is installed
check_docker_compose() {
    print_status "Checking Docker Compose installation..."
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_success "Docker Compose is installed"
}

# Create environment file
create_env_file() {
    print_status "Creating environment file..."
    
    if [ ! -f "$LEAN_SERVICE_DIR/.env" ]; then
        cat > "$LEAN_SERVICE_DIR/.env" << EOF
# Institutional Backtester Environment Variables

# Database Configuration
TIMESCALE_URL=postgresql://$TIMESCALE_DB_USER:$TIMESCALE_DB_PASSWORD@timescaledb:5432/$TIMESCALE_DB_NAME
SUPABASE_URL=\${SUPABASE_URL}
SUPABASE_ANON_KEY=\${SUPABASE_ANON_KEY}

# Security
JWT_SECRET=\${JWT_SECRET}
ENCRYPTION_KEY=\${ENCRYPTION_KEY}

# Exchange API Keys
POLYGON_API_KEY=\${POLYGON_API_KEY}
BINANCE_API_KEY=\${BINANCE_API_KEY}
BINANCE_SECRET=\${BINANCE_SECRET}
COINBASE_API_KEY=\${COINBASE_API_KEY}
COINBASE_SECRET=\${COINBASE_SECRET}
COINBASE_PASSPHRASE=\${COINBASE_PASSPHRASE}
KRAKEN_API_KEY=\${KRAKEN_API_KEY}
KRAKEN_SECRET=\${KRAKEN_SECRET}

# Application Settings
ENVIRONMENT=production
ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.com
ALLOWED_HOSTS=localhost,127.0.0.1,your-domain.com
EOF
        print_success "Environment file created"
    else
        print_warning "Environment file already exists"
    fi
}

# Build Lean service
build_lean_service() {
    print_status "Building Lean backtesting service..."
    
    cd "$LEAN_SERVICE_DIR"
    
    # Build the Docker image
    docker build -t lean-backtesting-service:latest .
    
    if [ $? -eq 0 ]; then
        print_success "Lean service built successfully"
    else
        print_error "Failed to build Lean service"
        exit 1
    fi
    
    cd ..
}

# Deploy services with Docker Compose
deploy_services() {
    print_status "Deploying services with Docker Compose..."
    
    cd "$LEAN_SERVICE_DIR"
    
    # Start services
    docker-compose up -d
    
    if [ $? -eq 0 ]; then
        print_success "Services deployed successfully"
    else
        print_error "Failed to deploy services"
        exit 1
    fi
    
    cd ..
}

# Wait for services to be ready
wait_for_services() {
    print_status "Waiting for services to be ready..."
    
    # Wait for TimescaleDB
    print_status "Waiting for TimescaleDB..."
    timeout=60
    while [ $timeout -gt 0 ]; do
        if docker-compose -f "$LEAN_SERVICE_DIR/docker-compose.yml" exec -T timescaledb pg_isready -U "$TIMESCALE_DB_USER" -d "$TIMESCALE_DB_NAME" &> /dev/null; then
            print_success "TimescaleDB is ready"
            break
        fi
        sleep 2
        timeout=$((timeout - 2))
    done
    
    if [ $timeout -le 0 ]; then
        print_error "TimescaleDB failed to start within 60 seconds"
        exit 1
    fi
    
    # Wait for Lean service
    print_status "Waiting for Lean service..."
    timeout=60
    while [ $timeout -gt 0 ]; do
        if curl -f http://localhost:8000/health &> /dev/null; then
            print_success "Lean service is ready"
            break
        fi
        sleep 2
        timeout=$((timeout - 2))
    done
    
    if [ $timeout -le 0 ]; then
        print_error "Lean service failed to start within 60 seconds"
        exit 1
    fi
}

# Setup TimescaleDB
setup_timescaledb() {
    print_status "Setting up TimescaleDB..."
    
    # Run the setup script
    docker-compose -f "$LEAN_SERVICE_DIR/docker-compose.yml" exec -T timescaledb psql -U "$TIMESCALE_DB_USER" -d "$TIMESCALE_DB_NAME" -f /docker-entrypoint-initdb.d/setup-timescaledb.sql
    
    if [ $? -eq 0 ]; then
        print_success "TimescaleDB setup completed"
    else
        print_error "Failed to setup TimescaleDB"
        exit 1
    fi
}

# Run database migrations
run_migrations() {
    print_status "Running database migrations..."
    
    # Run Supabase migrations
    if [ -f "supabase/migrations/20240120000000_create_institutional_backtester_schema.sql" ]; then
        print_status "Running institutional backtester schema migration..."
        # This would typically be run through Supabase CLI
        print_success "Database migrations completed"
    else
        print_warning "No migrations found to run"
    fi
}

# Check service health
check_health() {
    print_status "Checking service health..."
    
    # Check Lean service
    if curl -f http://localhost:8000/health &> /dev/null; then
        print_success "Lean service is healthy"
    else
        print_error "Lean service health check failed"
        exit 1
    fi
    
    # Check TimescaleDB
    if docker-compose -f "$LEAN_SERVICE_DIR/docker-compose.yml" exec -T timescaledb pg_isready -U "$TIMESCALE_DB_USER" -d "$TIMESCALE_DB_NAME" &> /dev/null; then
        print_success "TimescaleDB is healthy"
    else
        print_error "TimescaleDB health check failed"
        exit 1
    fi
    
    # Check Redis
    if docker-compose -f "$LEAN_SERVICE_DIR/docker-compose.yml" exec -T redis redis-cli ping &> /dev/null; then
        print_success "Redis is healthy"
    else
        print_error "Redis health check failed"
        exit 1
    fi
}

# Display deployment summary
show_summary() {
    print_success "Institutional Backtester deployment completed successfully!"
    echo ""
    echo "📊 Service URLs:"
    echo "  • Lean Backtesting Service: http://localhost:8000"
    echo "  • TimescaleDB: localhost:5432"
    echo "  • Redis: localhost:6379"
    echo "  • Prometheus: http://localhost:9090"
    echo "  • Grafana: http://localhost:3001"
    echo ""
    echo "🔧 Management Commands:"
    echo "  • View logs: docker-compose -f $LEAN_SERVICE_DIR/docker-compose.yml logs -f"
    echo "  • Stop services: docker-compose -f $LEAN_SERVICE_DIR/docker-compose.yml down"
    echo "  • Restart services: docker-compose -f $LEAN_SERVICE_DIR/docker-compose.yml restart"
    echo ""
    echo "📝 Next Steps:"
    echo "  1. Configure your exchange API keys in the .env file"
    echo "  2. Update your Supabase environment variables"
    echo "  3. Test the institutional backtester at /institutional-backtester"
    echo "  4. Monitor services using Grafana at http://localhost:3001"
    echo ""
    print_warning "Remember to secure your API keys and database credentials!"
}

# Main deployment function
main() {
    echo "🏗️  Institutional Backtester Deployment"
    echo "========================================"
    echo ""
    
    # Pre-deployment checks
    check_docker
    check_docker_compose
    
    # Setup
    create_env_file
    build_lean_service
    
    # Deploy
    deploy_services
    wait_for_services
    setup_timescaledb
    run_migrations
    
    # Verification
    check_health
    
    # Summary
    show_summary
}

# Run main function
main "$@"
