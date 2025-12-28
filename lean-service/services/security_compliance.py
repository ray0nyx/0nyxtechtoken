"""
Security and Compliance System for Copy Trading
Handles encryption, audit trails, regulatory compliance, and security monitoring
"""

import os
import json
import hashlib
import hmac
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import jwt
from passlib.context import CryptContext

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class SecurityEvent:
    """Security event for audit trail"""
    event_id: str
    user_id: str
    event_type: str
    description: str
    ip_address: str
    user_agent: str
    timestamp: datetime
    severity: str
    metadata: Dict[str, Any]

@dataclass
class ComplianceRecord:
    """Compliance record for regulatory reporting"""
    record_id: str
    user_id: str
    record_type: str
    data: Dict[str, Any]
    created_at: datetime
    expires_at: Optional[datetime] = None

class EncryptionService:
    """Handles encryption and decryption of sensitive data"""
    
    def __init__(self, master_key: str):
        self.master_key = master_key.encode()
        self._fernet = None
        self._initialize_fernet()
    
    def _initialize_fernet(self):
        """Initialize Fernet encryption with derived key"""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b'copy_trading_salt',  # In production, use random salt per user
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(self.master_key))
        self._fernet = Fernet(key)
    
    def encrypt(self, data: str) -> str:
        """Encrypt sensitive data"""
        try:
            encrypted_data = self._fernet.encrypt(data.encode())
            return base64.urlsafe_b64encode(encrypted_data).decode()
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            raise
    
    def decrypt(self, encrypted_data: str) -> str:
        """Decrypt sensitive data"""
        try:
            decoded_data = base64.urlsafe_b64decode(encrypted_data.encode())
            decrypted_data = self._fernet.decrypt(decoded_data)
            return decrypted_data.decode()
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            raise

class AuditTrailService:
    """Manages comprehensive audit trail for regulatory compliance"""
    
    def __init__(self, db_engine):
        self.db_engine = db_engine
        self.Session = sessionmaker(bind=db_engine)
    
    def log_security_event(self, event: SecurityEvent):
        """Log security event to audit trail"""
        try:
            with self.Session() as session:
                query = text("""
                    INSERT INTO security_audit_log (
                        event_id, user_id, event_type, description, 
                        ip_address, user_agent, timestamp, severity, metadata
                    ) VALUES (
                        :event_id, :user_id, :event_type, :description,
                        :ip_address, :user_agent, :timestamp, :severity, :metadata
                    )
                """)
                
                session.execute(query, {
                    'event_id': event.event_id,
                    'user_id': event.user_id,
                    'event_type': event.event_type,
                    'description': event.description,
                    'ip_address': event.ip_address,
                    'user_agent': event.user_agent,
                    'timestamp': event.timestamp,
                    'severity': event.severity,
                    'metadata': json.dumps(event.metadata)
                })
                session.commit()
                logger.info(f"Security event logged: {event.event_type}")
        except Exception as e:
            logger.error(f"Failed to log security event: {e}")
            raise
    
    def get_audit_trail(self, user_id: str, start_date: datetime, end_date: datetime) -> List[Dict]:
        """Retrieve audit trail for user within date range"""
        try:
            with self.Session() as session:
                query = text("""
                    SELECT event_id, event_type, description, ip_address, 
                           user_agent, timestamp, severity, metadata
                    FROM security_audit_log
                    WHERE user_id = :user_id 
                    AND timestamp BETWEEN :start_date AND :end_date
                    ORDER BY timestamp DESC
                """)
                
                result = session.execute(query, {
                    'user_id': user_id,
                    'start_date': start_date,
                    'end_date': end_date
                })
                
                return [dict(row) for row in result]
        except Exception as e:
            logger.error(f"Failed to retrieve audit trail: {e}")
            raise
    
    def generate_compliance_report(self, user_id: str, report_type: str) -> Dict[str, Any]:
        """Generate compliance report for regulatory requirements"""
        try:
            with self.Session() as session:
                # Get user's copy trading activities
                activities_query = text("""
                    SELECT ct.id, ct.master_trader_id, ct.follower_id, ct.allocated_capital,
                           ct.position_sizing, ct.status, ct.started_at, ct.last_trade_at,
                           ct.total_trades, ct.successful_trades, ct.total_pnl
                    FROM copy_trading_profiles ct
                    WHERE ct.follower_id = :user_id
                """)
                
                activities = session.execute(activities_query, {'user_id': user_id}).fetchall()
                
                # Get trade history
                trades_query = text("""
                    SELECT mt.symbol, mt.side, mt.quantity, mt.price, mt.timestamp,
                           ft.executed_at, ft.status, ft.pnl
                    FROM master_trades mt
                    JOIN follower_trades ft ON mt.id = ft.master_trade_id
                    WHERE ft.follower_id = :user_id
                    AND mt.timestamp >= :start_date
                """)
                
                start_date = datetime.now() - timedelta(days=30)
                trades = session.execute(trades_query, {
                    'user_id': user_id,
                    'start_date': start_date
                }).fetchall()
                
                # Generate report
                report = {
                    'user_id': user_id,
                    'report_type': report_type,
                    'generated_at': datetime.now().isoformat(),
                    'period': {
                        'start': start_date.isoformat(),
                        'end': datetime.now().isoformat()
                    },
                    'summary': {
                        'total_relationships': len(activities),
                        'total_trades': len(trades),
                        'total_pnl': sum(trade.pnl or 0 for trade in trades),
                        'active_relationships': len([a for a in activities if a.status == 'active'])
                    },
                    'activities': [dict(activity) for activity in activities],
                    'trades': [dict(trade) for trade in trades]
                }
                
                return report
        except Exception as e:
            logger.error(f"Failed to generate compliance report: {e}")
            raise

class CredentialManager:
    """Manages encrypted storage of platform credentials"""
    
    def __init__(self, encryption_service: EncryptionService, db_engine):
        self.encryption_service = encryption_service
        self.db_engine = db_engine
        self.Session = sessionmaker(bind=db_engine)
    
    def store_credentials(self, user_id: str, platform: str, credentials: Dict[str, str]) -> str:
        """Store encrypted platform credentials"""
        try:
            # Encrypt credentials
            encrypted_creds = {}
            for key, value in credentials.items():
                encrypted_creds[key] = self.encryption_service.encrypt(value)
            
            # Generate credential ID
            cred_id = hashlib.sha256(f"{user_id}_{platform}_{time.time()}".encode()).hexdigest()[:16]
            
            with self.Session() as session:
                query = text("""
                    INSERT INTO encrypted_credentials (
                        id, user_id, platform, encrypted_data, created_at, updated_at
                    ) VALUES (
                        :id, :user_id, :platform, :encrypted_data, :created_at, :updated_at
                    )
                    ON CONFLICT (user_id, platform) 
                    DO UPDATE SET 
                        encrypted_data = :encrypted_data,
                        updated_at = :updated_at
                """)
                
                session.execute(query, {
                    'id': cred_id,
                    'user_id': user_id,
                    'platform': platform,
                    'encrypted_data': json.dumps(encrypted_creds),
                    'created_at': datetime.now(),
                    'updated_at': datetime.now()
                })
                session.commit()
                
                logger.info(f"Credentials stored for user {user_id} on platform {platform}")
                return cred_id
        except Exception as e:
            logger.error(f"Failed to store credentials: {e}")
            raise
    
    def retrieve_credentials(self, user_id: str, platform: str) -> Dict[str, str]:
        """Retrieve and decrypt platform credentials"""
        try:
            with self.Session() as session:
                query = text("""
                    SELECT encrypted_data FROM encrypted_credentials
                    WHERE user_id = :user_id AND platform = :platform
                """)
                
                result = session.execute(query, {
                    'user_id': user_id,
                    'platform': platform
                }).fetchone()
                
                if not result:
                    raise ValueError(f"No credentials found for user {user_id} on platform {platform}")
                
                # Decrypt credentials
                encrypted_data = json.loads(result.encrypted_data)
                decrypted_creds = {}
                for key, encrypted_value in encrypted_data.items():
                    decrypted_creds[key] = self.encryption_service.decrypt(encrypted_value)
                
                return decrypted_creds
        except Exception as e:
            logger.error(f"Failed to retrieve credentials: {e}")
            raise
    
    def delete_credentials(self, user_id: str, platform: str):
        """Delete platform credentials"""
        try:
            with self.Session() as session:
                query = text("""
                    DELETE FROM encrypted_credentials
                    WHERE user_id = :user_id AND platform = :platform
                """)
                
                session.execute(query, {
                    'user_id': user_id,
                    'platform': platform
                })
                session.commit()
                
                logger.info(f"Credentials deleted for user {user_id} on platform {platform}")
        except Exception as e:
            logger.error(f"Failed to delete credentials: {e}")
            raise

class SecurityMonitor:
    """Monitors system for security threats and anomalies"""
    
    def __init__(self, db_engine):
        self.db_engine = db_engine
        self.Session = sessionmaker(bind=db_engine)
        self.suspicious_activities = []
    
    def detect_anomalies(self, user_id: str) -> List[Dict[str, Any]]:
        """Detect suspicious trading patterns and activities"""
        try:
            anomalies = []
            
            with self.Session() as session:
                # Check for unusual trading volume
                volume_query = text("""
                    SELECT DATE(timestamp) as trade_date, COUNT(*) as trade_count,
                           SUM(quantity * price) as total_volume
                    FROM master_trades mt
                    JOIN follower_trades ft ON mt.id = ft.master_trade_id
                    WHERE ft.follower_id = :user_id
                    AND mt.timestamp >= :start_date
                    GROUP BY DATE(timestamp)
                    ORDER BY trade_date DESC
                """)
                
                start_date = datetime.now() - timedelta(days=7)
                volume_data = session.execute(volume_query, {
                    'user_id': user_id,
                    'start_date': start_date
                }).fetchall()
                
                # Detect volume spikes
                if len(volume_data) > 1:
                    avg_volume = sum(row.total_volume for row in volume_data) / len(volume_data)
                    for row in volume_data:
                        if row.total_volume > avg_volume * 3:  # 3x average volume
                            anomalies.append({
                                'type': 'volume_spike',
                                'severity': 'high',
                                'description': f"Unusual trading volume detected: {row.total_volume} on {row.trade_date}",
                                'data': dict(row)
                            })
                
                # Check for rapid-fire trades
                rapid_trades_query = text("""
                    SELECT COUNT(*) as rapid_count
                    FROM master_trades mt
                    JOIN follower_trades ft ON mt.id = ft.master_trade_id
                    WHERE ft.follower_id = :user_id
                    AND mt.timestamp >= :start_time
                """)
                
                start_time = datetime.now() - timedelta(minutes=5)
                rapid_count = session.execute(rapid_trades_query, {
                    'user_id': user_id,
                    'start_time': start_time
                }).fetchone()
                
                if rapid_count.rapid_count > 10:  # More than 10 trades in 5 minutes
                    anomalies.append({
                        'type': 'rapid_trading',
                        'severity': 'medium',
                        'description': f"Rapid trading detected: {rapid_count.rapid_count} trades in 5 minutes",
                        'data': {'count': rapid_count.rapid_count}
                    })
                
                # Check for failed trades
                failed_trades_query = text("""
                    SELECT COUNT(*) as failed_count
                    FROM follower_trades
                    WHERE follower_id = :user_id
                    AND status = 'failed'
                    AND executed_at >= :start_date
                """)
                
                failed_count = session.execute(failed_trades_query, {
                    'user_id': user_id,
                    'start_date': start_date
                }).fetchone()
                
                if failed_count.failed_count > 5:  # More than 5 failed trades
                    anomalies.append({
                        'type': 'high_failure_rate',
                        'severity': 'medium',
                        'description': f"High failure rate detected: {failed_count.failed_count} failed trades",
                        'data': {'count': failed_count.failed_count}
                    })
            
            return anomalies
        except Exception as e:
            logger.error(f"Failed to detect anomalies: {e}")
            return []
    
    def check_risk_limits(self, user_id: str) -> List[Dict[str, Any]]:
        """Check if user has exceeded risk limits"""
        try:
            violations = []
            
            with self.Session() as session:
                # Get user's risk limits
                limits_query = text("""
                    SELECT max_daily_loss, max_drawdown, max_position_size
                    FROM risk_limits
                    WHERE user_id = :user_id
                """)
                
                limits = session.execute(limits_query, {'user_id': user_id}).fetchone()
                if not limits:
                    return violations
                
                # Check daily loss
                daily_loss_query = text("""
                    SELECT SUM(pnl) as daily_pnl
                    FROM follower_trades
                    WHERE follower_id = :user_id
                    AND DATE(executed_at) = CURRENT_DATE
                """)
                
                daily_loss = session.execute(daily_loss_query, {'user_id': user_id}).fetchone()
                if daily_loss.daily_pnl and daily_loss.daily_pnl < -limits.max_daily_loss:
                    violations.append({
                        'type': 'daily_loss_exceeded',
                        'severity': 'critical',
                        'description': f"Daily loss limit exceeded: ${daily_loss.daily_pnl}",
                        'data': {'limit': limits.max_daily_loss, 'actual': daily_loss.daily_pnl}
                    })
                
                # Check position size
                position_query = text("""
                    SELECT MAX(quantity * price) as max_position
                    FROM follower_trades
                    WHERE follower_id = :user_id
                    AND executed_at >= :start_date
                """)
                
                start_date = datetime.now() - timedelta(days=1)
                max_position = session.execute(position_query, {
                    'user_id': user_id,
                    'start_date': start_date
                }).fetchone()
                
                if max_position.max_position and max_position.max_position > limits.max_position_size:
                    violations.append({
                        'type': 'position_size_exceeded',
                        'severity': 'high',
                        'description': f"Position size limit exceeded: ${max_position.max_position}",
                        'data': {'limit': limits.max_position_size, 'actual': max_position.max_position}
                    })
            
            return violations
        except Exception as e:
            logger.error(f"Failed to check risk limits: {e}")
            return []

class ComplianceService:
    """Handles regulatory compliance and reporting"""
    
    def __init__(self, db_engine):
        self.db_engine = db_engine
        self.Session = sessionmaker(bind=db_engine)
    
    def generate_trade_report(self, user_id: str, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Generate trade report for regulatory compliance"""
        try:
            with self.Session() as session:
                # Get all trades for the period
                trades_query = text("""
                    SELECT mt.symbol, mt.side, mt.quantity, mt.price, mt.timestamp,
                           ft.executed_at, ft.status, ft.pnl, ft.fees,
                           ct.allocated_capital, ct.position_sizing
                    FROM master_trades mt
                    JOIN follower_trades ft ON mt.id = ft.master_trade_id
                    JOIN copy_trading_profiles ct ON ft.follower_relationship_id = ct.id
                    WHERE ft.follower_id = :user_id
                    AND ft.executed_at BETWEEN :start_date AND :end_date
                    ORDER BY ft.executed_at DESC
                """)
                
                trades = session.execute(trades_query, {
                    'user_id': user_id,
                    'start_date': start_date,
                    'end_date': end_date
                }).fetchall()
                
                # Calculate summary statistics
                total_trades = len(trades)
                successful_trades = len([t for t in trades if t.status == 'completed'])
                total_pnl = sum(t.pnl or 0 for t in trades)
                total_fees = sum(t.fees or 0 for t in trades)
                
                report = {
                    'user_id': user_id,
                    'report_type': 'trade_report',
                    'period': {
                        'start': start_date.isoformat(),
                        'end': end_date.isoformat()
                    },
                    'summary': {
                        'total_trades': total_trades,
                        'successful_trades': successful_trades,
                        'success_rate': (successful_trades / total_trades * 100) if total_trades > 0 else 0,
                        'total_pnl': total_pnl,
                        'total_fees': total_fees,
                        'net_pnl': total_pnl - total_fees
                    },
                    'trades': [dict(trade) for trade in trades]
                }
                
                return report
        except Exception as e:
            logger.error(f"Failed to generate trade report: {e}")
            raise
    
    def validate_kyc_requirements(self, user_id: str) -> Dict[str, Any]:
        """Validate KYC requirements for copy trading"""
        try:
            with self.Session() as session:
                # Check user's KYC status
                kyc_query = text("""
                    SELECT kyc_status, verification_level, compliance_score
                    FROM user_verification
                    WHERE user_id = :user_id
                """)
                
                kyc_data = session.execute(kyc_query, {'user_id': user_id}).fetchone()
                
                if not kyc_data:
                    return {
                        'status': 'incomplete',
                        'requirements': ['identity_verification', 'address_verification', 'financial_verification'],
                        'message': 'KYC verification required before copy trading'
                    }
                
                requirements = []
                if kyc_data.kyc_status != 'verified':
                    requirements.append('identity_verification')
                if kyc_data.verification_level < 2:
                    requirements.append('address_verification')
                if kyc_data.compliance_score < 80:
                    requirements.append('financial_verification')
                
                return {
                    'status': 'complete' if not requirements else 'incomplete',
                    'requirements': requirements,
                    'kyc_status': kyc_data.kyc_status,
                    'verification_level': kyc_data.verification_level,
                    'compliance_score': kyc_data.compliance_score
                }
        except Exception as e:
            logger.error(f"Failed to validate KYC requirements: {e}")
            raise

class SecurityComplianceManager:
    """Main security and compliance manager"""
    
    def __init__(self, db_engine, master_key: str):
        self.db_engine = db_engine
        self.encryption_service = EncryptionService(master_key)
        self.audit_trail = AuditTrailService(db_engine)
        self.credential_manager = CredentialManager(self.encryption_service, db_engine)
        self.security_monitor = SecurityMonitor(db_engine)
        self.compliance_service = ComplianceService(db_engine)
    
    def log_user_action(self, user_id: str, action: str, ip_address: str, user_agent: str, metadata: Dict[str, Any] = None):
        """Log user action for audit trail"""
        event = SecurityEvent(
            event_id=hashlib.sha256(f"{user_id}_{action}_{time.time()}".encode()).hexdigest()[:16],
            user_id=user_id,
            event_type=action,
            description=f"User {action}",
            ip_address=ip_address,
            user_agent=user_agent,
            timestamp=datetime.now(),
            severity='info',
            metadata=metadata or {}
        )
        self.audit_trail.log_security_event(event)
    
    def store_platform_credentials(self, user_id: str, platform: str, credentials: Dict[str, str]):
        """Store encrypted platform credentials"""
        return self.credential_manager.store_credentials(user_id, platform, credentials)
    
    def get_platform_credentials(self, user_id: str, platform: str) -> Dict[str, str]:
        """Retrieve decrypted platform credentials"""
        return self.credential_manager.retrieve_credentials(user_id, platform)
    
    def monitor_user_activity(self, user_id: str) -> Dict[str, Any]:
        """Monitor user activity for security threats"""
        anomalies = self.security_monitor.detect_anomalies(user_id)
        risk_violations = self.security_monitor.check_risk_limits(user_id)
        
        return {
            'anomalies': anomalies,
            'risk_violations': risk_violations,
            'monitoring_timestamp': datetime.now().isoformat()
        }
    
    def generate_compliance_report(self, user_id: str, report_type: str) -> Dict[str, Any]:
        """Generate compliance report"""
        return self.compliance_service.generate_trade_report(
            user_id, 
            datetime.now() - timedelta(days=30), 
            datetime.now()
        )
    
    def validate_user_compliance(self, user_id: str) -> Dict[str, Any]:
        """Validate user compliance status"""
        kyc_status = self.compliance_service.validate_kyc_requirements(user_id)
        monitoring_results = self.monitor_user_activity(user_id)
        
        return {
            'kyc_status': kyc_status,
            'monitoring_results': monitoring_results,
            'compliance_status': 'compliant' if kyc_status['status'] == 'complete' and not monitoring_results['risk_violations'] else 'non_compliant'
        }




