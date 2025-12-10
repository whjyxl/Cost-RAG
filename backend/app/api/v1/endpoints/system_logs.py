"""
系统日志API端点
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime
import os
import re
from pathlib import Path

from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()


@router.get("/logs")
async def get_system_logs(
    level: Optional[str] = Query(None, description="日志级别过滤: INFO, WARNING, ERROR"),
    source: Optional[str] = Query(None, description="日志来源过滤"),
    limit: int = Query(100, ge=1, le=1000, description="返回日志条数"),
    current_user: User = Depends(get_current_user)
):
    """获取系统日志"""
    try:
        logs = []
        log_dir = Path("logs")
        
        # 读取最新的日志文件
        log_files = []
        if log_dir.exists():
            # 获取app.log和error.log
            if (log_dir / "app.log").exists():
                log_files.append(log_dir / "app.log")
            if (log_dir / "error.log").exists():
                log_files.append(log_dir / "error.log")
        
        # 解析日志
        for log_file in log_files:
            try:
                with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                    # 读取最后N行
                    lines = f.readlines()
                    for line in lines[-limit:]:
                        log_entry = parse_log_line(line, log_file.name)
                        if log_entry:
                            # 应用过滤
                            if level and log_entry['level'].upper() != level.upper():
                                continue
                            if source and log_entry['source'].lower() != source.lower():
                                continue
                            logs.append(log_entry)
            except Exception as e:
                print(f"读取日志文件失败 {log_file}: {str(e)}")
                continue
        
        # 按时间倒序排序
        logs.sort(key=lambda x: x['timestamp'], reverse=True)
        
        return {
            "success": True,
            "data": logs[:limit],
            "total": len(logs)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取系统日志失败: {str(e)}")


def parse_log_line(line: str, filename: str) -> Optional[dict]:
    """解析日志行"""
    try:
        line = line.strip()
        if not line:
            return None
        
        # 尝试解析标准格式: 2024-01-20 09:00:00,123 - INFO - message
        # 或者: INFO:     message
        # 或者: ERROR:    message
        
        log_entry = {
            'id': str(hash(line)),
            'level': 'INFO',
            'message': line,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'source': 'system'
        }
        
        # 尝试提取时间戳
        timestamp_pattern = r'(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})'
        timestamp_match = re.search(timestamp_pattern, line)
        if timestamp_match:
            log_entry['timestamp'] = timestamp_match.group(1)
        
        # 提取日志级别
        if 'ERROR' in line.upper() or 'error.log' in filename:
            log_entry['level'] = 'ERROR'
            log_entry['source'] = 'error'
        elif 'WARNING' in line.upper() or 'WARN' in line.upper():
            log_entry['level'] = 'WARNING'
            log_entry['source'] = 'warning'
        elif 'INFO' in line.upper():
            log_entry['level'] = 'INFO'
        
        # 提取来源
        if 'uvicorn' in line.lower():
            log_entry['source'] = 'uvicorn'
        elif 'fastapi' in line.lower():
            log_entry['source'] = 'fastapi'
        elif 'sqlalchemy' in line.lower():
            log_entry['source'] = 'database'
        elif 'redis' in line.lower():
            log_entry['source'] = 'redis'
        elif 'qdrant' in line.lower():
            log_entry['source'] = 'qdrant'
        elif 'neo4j' in line.lower():
            log_entry['source'] = 'neo4j'
        elif 'document' in line.lower():
            log_entry['source'] = 'document'
        elif 'auth' in line.lower() or 'login' in line.lower():
            log_entry['source'] = 'auth'
        
        # 清理消息内容
        # 移除时间戳和级别前缀
        message = line
        message = re.sub(r'^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}[,\.]?\d*\s*[-:]?\s*', '', message)
        message = re.sub(r'^(INFO|WARNING|ERROR|DEBUG)[\s:]*', '', message, flags=re.IGNORECASE)
        log_entry['message'] = message.strip() or line
        
        return log_entry
    except Exception as e:
        print(f"解析日志行失败: {str(e)}")
        return None


@router.get("/logs/stats")
async def get_log_stats(
    current_user: User = Depends(get_current_user)
):
    """获取日志统计信息"""
    try:
        log_dir = Path("logs")
        stats = {
            "total_files": 0,
            "total_size": 0,
            "error_count": 0,
            "warning_count": 0,
            "info_count": 0,
            "latest_error": None
        }
        
        if log_dir.exists():
            log_files = list(log_dir.glob("*.log"))
            stats["total_files"] = len(log_files)
            stats["total_size"] = sum(f.stat().st_size for f in log_files if f.exists())
            
            # 读取error.log统计错误
            error_log = log_dir / "error.log"
            if error_log.exists():
                with open(error_log, 'r', encoding='utf-8', errors='ignore') as f:
                    lines = f.readlines()
                    stats["error_count"] = len(lines)
                    if lines:
                        # 获取最新错误
                        for line in reversed(lines):
                            if line.strip():
                                stats["latest_error"] = line.strip()[:200]
                                break
        
        return {
            "success": True,
            "data": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取日志统计失败: {str(e)}")
