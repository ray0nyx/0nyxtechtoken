"""
Enhanced LEAN Engine Wrapper with Auto-scaling
Handles Docker-based LEAN backtest execution with resource management
"""

import asyncio
import docker
import json
import logging
import os
import tempfile
import time
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from pathlib import Path
import yaml
import psutil
import redis
from prometheus_client import Counter, Histogram, Gauge, start_http_server

# Prometheus metrics
backtest_requests = Counter('backtest_requests_total', 'Total backtest requests', ['status'])
backtest_duration = Histogram('backtest_duration_seconds', 'Backtest duration in seconds')
active_containers = Gauge('active_containers_total', 'Number of active containers')
container_cpu_usage = Gauge('container_cpu_usage_percent', 'Container CPU usage percentage')
container_memory_usage = Gauge('container_memory_usage_bytes', 'Container memory usage in bytes')

@dataclass
class LeanConfig:
    """Configuration for LEAN backtest"""
    strategy_code: str
    symbols: List[str]
    start_date: str
    end_date: str
    initial_capital: float
    timeframe: str
    data_source: str
    parameters: Dict[str, Any]
    job_id: str
    user_id: str

@dataclass
class ContainerResource:
    """Container resource usage"""
    container_id: str
    cpu_usage: float
    memory_usage: int
    memory_limit: int
    status: str
    created_at: datetime

class LeanEngineWrapper:
    """Enhanced LEAN engine wrapper with auto-scaling capabilities"""
    
    def __init__(self):
        self.docker_client = docker.from_env()
        self.redis_client = redis.Redis(
            host=os.getenv('REDIS_HOST', 'localhost'),
            port=int(os.getenv('REDIS_PORT', '6379')),
            password=os.getenv('REDIS_PASSWORD'),
            decode_responses=True
        )
        
        # Configuration
        self.max_containers = int(os.getenv('MAX_CONTAINERS', '10'))
        self.container_timeout = int(os.getenv('CONTAINER_TIMEOUT', '3600'))  # 1 hour
        self.lean_image = os.getenv('LEAN_IMAGE', 'quantconnect/lean:latest')
        self.lean_data_path = os.getenv('LEAN_DATA_PATH', '/lean/data')
        self.lean_results_path = os.getenv('LEAN_RESULTS_PATH', '/lean/results')
        
        # Active containers tracking
        self.active_containers: Dict[str, ContainerResource] = {}
        self.container_cleanup_interval = 30  # seconds
        
        # Start monitoring
        self.start_monitoring()
        
        # Start Prometheus metrics server
        start_http_server(8001)
        
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)

    def start_monitoring(self):
        """Start background monitoring tasks"""
        asyncio.create_task(self.monitor_containers())
        asyncio.create_task(self.cleanup_old_containers())

    async def run_backtest(self, config: LeanConfig) -> Dict[str, Any]:
        """Run a LEAN backtest with resource management"""
        start_time = time.time()
        container_id = None
        
        try:
            # Check if we can start a new container
            if len(self.active_containers) >= self.max_containers:
                raise Exception("Maximum container limit reached")
            
            # Create container
            container_id = await self.create_lean_container(config)
            
            # Start container
            await self.start_container(container_id)
            
            # Monitor progress
            progress = await self.monitor_backtest_progress(container_id, config.job_id)
            
            # Get results
            results = await self.get_backtest_results(container_id)
            
            # Calculate duration
            duration = time.time() - start_time
            backtest_duration.observe(duration)
            backtest_requests.labels(status='completed').inc()
            
            return {
                'success': True,
                'results': results,
                'duration': duration,
                'container_id': container_id,
                'progress': progress
            }
            
        except Exception as e:
            self.logger.error(f"Backtest failed: {str(e)}")
            backtest_requests.labels(status='failed').inc()
            
            return {
                'success': False,
                'error': str(e),
                'container_id': container_id,
                'duration': time.time() - start_time
            }
            
        finally:
            # Cleanup container
            if container_id:
                await self.cleanup_container(container_id)

    async def create_lean_container(self, config: LeanConfig) -> str:
        """Create a LEAN Docker container with proper configuration"""
        try:
            # Create temporary directory for this backtest
            temp_dir = tempfile.mkdtemp(prefix=f"lean_{config.job_id}_")
            
            # Write strategy code
            strategy_file = os.path.join(temp_dir, "strategy.py")
            with open(strategy_file, 'w') as f:
                f.write(config.strategy_code)
            
            # Create LEAN configuration
            lean_config = self.create_lean_config(config)
            config_file = os.path.join(temp_dir, "config.json")
            with open(config_file, 'w') as f:
                json.dump(lean_config, f, indent=2)
            
            # Create Docker volume mounts
            volumes = {
                temp_dir: {'bind': '/lean/strategy', 'mode': 'rw'},
                self.lean_data_path: {'bind': '/lean/data', 'mode': 'ro'},
                self.lean_results_path: {'bind': '/lean/results', 'mode': 'rw'}
            }
            
            # Create container
            container = self.docker_client.containers.create(
                image=self.lean_image,
                command=['dotnet', 'QuantConnect.Lean.Launcher.dll', '--config', '/lean/strategy/config.json'],
                volumes=volumes,
                environment={
                    'LEAN_DATA_FOLDER': '/lean/data',
                    'LEAN_RESULTS_FOLDER': '/lean/results',
                    'JOB_ID': config.job_id,
                    'USER_ID': config.user_id
                },
                mem_limit='2g',  # 2GB memory limit
                memswap_limit='2g',
                cpu_quota=100000,  # 1 CPU core
                cpu_period=100000,
                detach=True,
                name=f"lean_{config.job_id}_{uuid.uuid4().hex[:8]}"
            )
            
            container_id = container.id
            self.active_containers[container_id] = ContainerResource(
                container_id=container_id,
                cpu_usage=0.0,
                memory_usage=0,
                memory_limit=2 * 1024 * 1024 * 1024,  # 2GB
                status='created',
                created_at=datetime.utcnow()
            )
            
            active_containers.set(len(self.active_containers))
            
            self.logger.info(f"Created container {container_id} for job {config.job_id}")
            return container_id
            
        except Exception as e:
            self.logger.error(f"Failed to create container: {str(e)}")
            raise

    async def start_container(self, container_id: str):
        """Start a LEAN container"""
        try:
            container = self.docker_client.containers.get(container_id)
            container.start()
            
            self.active_containers[container_id].status = 'running'
            
            self.logger.info(f"Started container {container_id}")
            
        except Exception as e:
            self.logger.error(f"Failed to start container {container_id}: {str(e)}")
            raise

    async def monitor_backtest_progress(self, container_id: str, job_id: str) -> Dict[str, Any]:
        """Monitor backtest progress and send updates"""
        progress = {
            'percentage': 0,
            'status': 'running',
            'current_step': 'Initializing',
            'logs': [],
            'estimated_completion': None
        }
        
        try:
            container = self.docker_client.containers.get(container_id)
            
            # Monitor container logs
            for line in container.logs(stream=True, follow=True):
                log_line = line.decode('utf-8').strip()
                progress['logs'].append(log_line)
                
                # Parse progress from logs
                if 'Progress:' in log_line:
                    try:
                        percentage = float(log_line.split('Progress:')[1].split('%')[0].strip())
                        progress['percentage'] = min(100, max(0, percentage))
                    except:
                        pass
                
                # Update current step
                if 'Starting' in log_line:
                    progress['current_step'] = 'Starting backtest'
                elif 'Data' in log_line:
                    progress['current_step'] = 'Loading data'
                elif 'Strategy' in log_line:
                    progress['current_step'] = 'Running strategy'
                elif 'Results' in log_line:
                    progress['current_step'] = 'Calculating results'
                
                # Send progress update via Redis
                await self.send_progress_update(job_id, progress)
                
                # Check if container is still running
                container.reload()
                if container.status != 'running':
                    break
                    
        except Exception as e:
            self.logger.error(f"Failed to monitor container {container_id}: {str(e)}")
            progress['status'] = 'error'
            progress['error'] = str(e)
        
        return progress

    async def get_backtest_results(self, container_id: str) -> Dict[str, Any]:
        """Extract results from completed backtest"""
        try:
            # Look for results in the results directory
            results_dir = os.path.join(self.lean_results_path, container_id)
            
            if not os.path.exists(results_dir):
                raise Exception("Results directory not found")
            
            # Find the latest results file
            result_files = [f for f in os.listdir(results_dir) if f.endswith('.json')]
            if not result_files:
                raise Exception("No results file found")
            
            latest_result = max(result_files, key=lambda f: os.path.getctime(os.path.join(results_dir, f)))
            result_path = os.path.join(results_dir, latest_result)
            
            with open(result_path, 'r') as f:
                results = json.load(f)
            
            return results
            
        except Exception as e:
            self.logger.error(f"Failed to get results from container {container_id}: {str(e)}")
            raise

    async def cleanup_container(self, container_id: str):
        """Clean up a LEAN container and its resources"""
        try:
            if container_id in self.active_containers:
                del self.active_containers[container_id]
                active_containers.set(len(self.active_containers))
            
            container = self.docker_client.containers.get(container_id)
            
            # Stop container if running
            if container.status == 'running':
                container.stop(timeout=10)
            
            # Remove container
            container.remove(force=True)
            
            # Clean up temporary files
            temp_dir = f"/tmp/lean_{container_id}"
            if os.path.exists(temp_dir):
                import shutil
                shutil.rmtree(temp_dir, ignore_errors=True)
            
            self.logger.info(f"Cleaned up container {container_id}")
            
        except Exception as e:
            self.logger.error(f"Failed to cleanup container {container_id}: {str(e)}")

    async def monitor_containers(self):
        """Monitor active containers for resource usage"""
        while True:
            try:
                for container_id, resource in list(self.active_containers.items()):
                    try:
                        container = self.docker_client.containers.get(container_id)
                        stats = container.stats(stream=False)
                        
                        # Calculate CPU usage
                        cpu_delta = stats['cpu_stats']['cpu_usage']['total_usage'] - stats['precpu_stats']['cpu_usage']['total_usage']
                        system_delta = stats['cpu_stats']['system_cpu_usage'] - stats['precpu_stats']['system_cpu_usage']
                        cpu_usage = (cpu_delta / system_delta) * len(stats['cpu_stats']['cpu_usage']['percpu_usage']) * 100.0
                        
                        # Get memory usage
                        memory_usage = stats['memory_stats']['usage']
                        memory_limit = stats['memory_stats']['limit']
                        
                        # Update resource tracking
                        resource.cpu_usage = cpu_usage
                        resource.memory_usage = memory_usage
                        resource.memory_limit = memory_limit
                        
                        # Update Prometheus metrics
                        container_cpu_usage.labels(container_id=container_id).set(cpu_usage)
                        container_memory_usage.labels(container_id=container_id).set(memory_usage)
                        
                        # Check for resource limits
                        if cpu_usage > 90:
                            self.logger.warning(f"Container {container_id} high CPU usage: {cpu_usage}%")
                        
                        if memory_usage > memory_limit * 0.9:
                            self.logger.warning(f"Container {container_id} high memory usage: {memory_usage / (1024**3):.2f}GB")
                        
                    except Exception as e:
                        self.logger.error(f"Failed to monitor container {container_id}: {str(e)}")
                        # Remove from active containers if it no longer exists
                        if "No such container" in str(e):
                            del self.active_containers[container_id]
                            active_containers.set(len(self.active_containers))
                
                await asyncio.sleep(5)  # Monitor every 5 seconds
                
            except Exception as e:
                self.logger.error(f"Error in container monitoring: {str(e)}")
                await asyncio.sleep(10)

    async def cleanup_old_containers(self):
        """Clean up old containers that have been running too long"""
        while True:
            try:
                current_time = datetime.utcnow()
                containers_to_cleanup = []
                
                for container_id, resource in self.active_containers.items():
                    if resource.status == 'running':
                        age = current_time - resource.created_at
                        if age.total_seconds() > self.container_timeout:
                            containers_to_cleanup.append(container_id)
                
                for container_id in containers_to_cleanup:
                    self.logger.warning(f"Cleaning up old container {container_id}")
                    await self.cleanup_container(container_id)
                
                await asyncio.sleep(self.container_cleanup_interval)
                
            except Exception as e:
                self.logger.error(f"Error in container cleanup: {str(e)}")
                await asyncio.sleep(60)

    async def send_progress_update(self, job_id: str, progress: Dict[str, Any]):
        """Send progress update via Redis"""
        try:
            message = {
                'jobId': job_id,
                'progress': progress,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            await self.redis_client.publish('backtest:progress', json.dumps(message))
            
        except Exception as e:
            self.logger.error(f"Failed to send progress update: {str(e)}")

    def create_lean_config(self, config: LeanConfig) -> Dict[str, Any]:
        """Create LEAN configuration file"""
        return {
            "algorithm-type-name": "BasicTemplateAlgorithm",
            "algorithm-language": "Python",
            "algorithm-location": "/lean/strategy/strategy.py",
            "data-folder": "/lean/data",
            "results-destination-folder": "/lean/results",
            "environment": "backtesting",
            "data-feed-history-provider": "SubscriptionDataReaderHistoryProvider",
            "data-feed-live-provider": "LiveDataFeed",
            "data-feed-file-provider": "FileDataFeed",
            "messaging-handler": "Messaging",
            "api-handler": "Api",
            "job-user-id": config.user_id,
            "job-project-id": config.job_id,
            "job-organization-id": "backtesting",
            "job-version": "1.0.0",
            "job-name": f"Backtest_{config.job_id}",
            "job-time": datetime.utcnow().isoformat(),
            "algorithm-manager-type": "AlgorithmManager",
            "algorithm-manager-live-mode": False,
            "algorithm-manager-time-loop-maximum": 20,
            "algorithm-manager-time-loop-busy": 15,
            "algorithm-manager-time-loop-increment": TimeSpan.from_seconds(1),
            "algorithm-manager-data-queue-handler": "DataQueueHandler",
            "algorithm-manager-setup-handler": "SetupHandler",
            "algorithm-manager-real-time-handler": "RealTimeHandler",
            "algorithm-manager-history-provider": "SubscriptionDataReaderHistoryProvider",
            "algorithm-manager-transaction-handler": "BacktestingTransactionHandler",
            "algorithm-manager-results-handler": "BacktestingResultHandler",
            "algorithm-manager-real-time-handler": "BacktestingRealTimeHandler",
            "algorithm-manager-file-system": "LocalDiskFileSystem",
            "algorithm-manager-object-store": "LocalObjectStore",
            "algorithm-manager-api": "Api",
            "algorithm-manager-notify": "BacktestingNotificationManager",
            "algorithm-manager-parameters": config.parameters,
            "algorithm-manager-symbols": config.symbols,
            "algorithm-manager-start-date": config.start_date,
            "algorithm-manager-end-date": config.end_date,
            "algorithm-manager-initial-cash": config.initial_capital,
            "algorithm-manager-benchmark": "SPY",
            "algorithm-manager-brokerage-name": "Interactive Brokers",
            "algorithm-manager-brokerage-model": "DefaultBrokerageModel",
            "algorithm-manager-fill-model": "ImmediateFillModel",
            "algorithm-manager-fee-model": "InteractiveBrokersFeeModel",
            "algorithm-manager-slippage-model": "ConstantSlippageModel",
            "algorithm-manager-settlement-model": "ImmediateSettlementModel",
            "algorithm-manager-securities-manager": "SecurityManager",
            "algorithm-manager-portfolio-manager": "SecurityPortfolioManager",
            "algorithm-manager-transaction-manager": "SecurityTransactionManager",
            "algorithm-manager-risk-manager": "NullRiskManagementModel",
            "algorithm-manager-currency-converter": "CurrencyConverter",
            "algorithm-manager-cash-book": "CashBook",
            "algorithm-manager-account-currency": "USD",
            "algorithm-manager-time-zone": "America/New_York",
            "algorithm-manager-language": "Python",
            "algorithm-manager-parameters": config.parameters,
            "algorithm-manager-symbols": config.symbols,
            "algorithm-manager-start-date": config.start_date,
            "algorithm-manager-end-date": config.end_date,
            "algorithm-manager-initial-cash": config.initial_capital,
            "algorithm-manager-benchmark": "SPY",
            "algorithm-manager-brokerage-name": "Interactive Brokers",
            "algorithm-manager-brokerage-model": "DefaultBrokerageModel",
            "algorithm-manager-fill-model": "ImmediateFillModel",
            "algorithm-manager-fee-model": "InteractiveBrokersFeeModel",
            "algorithm-manager-slippage-model": "ConstantSlippageModel",
            "algorithm-manager-settlement-model": "ImmediateSettlementModel",
            "algorithm-manager-securities-manager": "SecurityManager",
            "algorithm-manager-portfolio-manager": "SecurityPortfolioManager",
            "algorithm-manager-transaction-manager": "SecurityTransactionManager",
            "algorithm-manager-risk-manager": "NullRiskManagementModel",
            "algorithm-manager-currency-converter": "CurrencyConverter",
            "algorithm-manager-cash-book": "CashBook",
            "algorithm-manager-account-currency": "USD",
            "algorithm-manager-time-zone": "America/New_York",
            "algorithm-manager-language": "Python"
        }

    def get_system_stats(self) -> Dict[str, Any]:
        """Get system statistics"""
        return {
            'active_containers': len(self.active_containers),
            'max_containers': self.max_containers,
            'container_utilization': len(self.active_containers) / self.max_containers,
            'system_cpu_percent': psutil.cpu_percent(),
            'system_memory_percent': psutil.virtual_memory().percent,
            'system_disk_percent': psutil.disk_usage('/').percent,
            'containers': [
                {
                    'id': container_id,
                    'cpu_usage': resource.cpu_usage,
                    'memory_usage': resource.memory_usage,
                    'memory_limit': resource.memory_limit,
                    'status': resource.status,
                    'age_seconds': (datetime.utcnow() - resource.created_at).total_seconds()
                }
                for container_id, resource in self.active_containers.items()
            ]
        }

# Export the wrapper class
__all__ = ['LeanEngineWrapper', 'LeanConfig', 'ContainerResource']
