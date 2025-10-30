"""
速率限制工具
用于API请求频率控制
"""
import time
import asyncio
from typing import Dict, Any, Optional
from collections import defaultdict, deque
import logging
from datetime import datetime, timedelta
import redis.asyncio as redis
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class RateLimiter:
    """速率限制器"""

    def __init__(self):
        self.memory_storage: Dict[str, deque] = defaultdict(deque)
        self.redis_client: Optional[redis.Redis] = None
        self.use_redis = False

        # 初始化Redis连接
        if settings.REDIS_URL:
            try:
                self.redis_client = redis.from_url(
                    settings.REDIS_URL,
                    encoding="utf-8",
                    decode_responses=True
                )
                self.use_redis = True
                logger.info("Redis速率限制器初始化成功")
            except Exception as e:
                logger.warning(f"Redis连接失败，使用内存存储: {str(e)}")
        else:
            logger.info("未配置Redis，使用内存存储速率限制")

    async def check_limit(
        self,
        key: str,
        limit: int,
        window: int,
        use_redis: Optional[bool] = None
    ) -> bool:
        """
        检查速率限制

        Args:
            key: 限制键（如用户ID、IP地址等）
            limit: 限制次数
            window: 时间窗口（秒）
            use_redis: 是否使用Redis存储

        Returns:
            是否允许请求
        """
        use_redis = use_redis if use_redis is not None else self.use_redis

        if use_redis and self.redis_client:
            return await self._check_redis_limit(key, limit, window)
        else:
            return self._check_memory_limit(key, limit, window)

    async def _check_redis_limit(self, key: str, limit: int, window: int) -> bool:
        """使用Redis检查速率限制"""
        try:
            current_time = int(time.time())
            window_start = current_time - window

            # 使用滑动窗口算法
            pipe = self.redis_client.pipeline()
            pipe.zremrangebyscore(key, 0, window_start)  # 移除过期记录
            pipe.zcard(key)  # 获取当前计数
            pipe.zadd(key, {str(current_time): current_time})  # 添加当前请求
            pipe.expire(key, window)  # 设置过期时间

            results = await pipe.execute()
            current_count = results[1]

            if current_count >= limit:
                logger.info(f"Redis速率限制触发: key={key}, count={current_count}, limit={limit}")
                return False

            return True

        except Exception as e:
            logger.error(f"Redis速率限制检查失败: {str(e)}")
            # 降级到内存存储
            return self._check_memory_limit(key, limit, window)

    def _check_memory_limit(self, key: str, limit: int, window: int) -> bool:
        """使用内存检查速率限制"""
        try:
            current_time = time.time()
            window_start = current_time - window

            # 获取该键的请求时间队列
            request_times = self.memory_storage[key]

            # 移除过期的请求记录
            while request_times and request_times[0] <= window_start:
                request_times.popleft()

            # 检查当前窗口内的请求数
            if len(request_times) >= limit:
                logger.info(f"内存速率限制触发: key={key}, count={len(request_times)}, limit={limit}")
                return False

            # 添加当前请求时间
            request_times.append(current_time)

            # 定期清理过期的键
            if len(self.memory_storage) > 10000:  # 存储超过10000个键时清理
                self._cleanup_expired_keys()

            return True

        except Exception as e:
            logger.error(f"内存速率限制检查失败: {str(e)}")
            return True  # 出错时允许请求

    def _cleanup_expired_keys(self):
        """清理过期的键"""
        try:
            current_time = time.time()
            expired_keys = []

            for key, request_times in self.memory_storage.items():
                # 如果最近的请求超过1小时前，则认为键已过期
                if request_times and request_times[-1] < current_time - 3600:
                    expired_keys.append(key)

            for key in expired_keys:
                del self.memory_storage[key]

            if expired_keys:
                logger.info(f"清理过期速率限制键: {len(expired_keys)}个")

        except Exception as e:
            logger.error(f"清理过期键失败: {str(e)}")

    async def get_current_count(self, key: str, window: int) -> int:
        """
        获取当前窗口内的请求计数

        Args:
            key: 限制键
            window: 时间窗口（秒）

        Returns:
            当前计数
        """
        if self.use_redis and self.redis_client:
            try:
                current_time = int(time.time())
                window_start = current_time - window
                count = await self.redis_client.zcount(key, window_start, current_time)
                return count
            except Exception as e:
                logger.error(f"获取Redis计数失败: {str(e)}")

        # 使用内存存储
        try:
            current_time = time.time()
            window_start = current_time - window
            request_times = self.memory_storage[key]

            # 计算窗口内的请求数
            count = sum(1 for req_time in request_times if req_time > window_start)
            return count
        except Exception as e:
            logger.error(f"获取内存计数失败: {str(e)}")
            return 0

    async def reset_limit(self, key: str) -> bool:
        """
        重置速率限制

        Args:
            key: 限制键

        Returns:
            是否重置成功
        """
        try:
            if self.use_redis and self.redis_client:
                await self.redis_client.delete(key)

            # 同时清理内存存储
            if key in self.memory_storage:
                del self.memory_storage[key]

            logger.info(f"重置速率限制成功: key={key}")
            return True

        except Exception as e:
            logger.error(f"重置速率限制失败: {str(e)}")
            return False

    async def get_limit_info(self, key: str, limit: int, window: int) -> Dict[str, Any]:
        """
        获取速率限制信息

        Args:
            key: 限制键
            limit: 限制次数
            window: 时间窗口（秒）

        Returns:
            限制信息
        """
        try:
            current_count = await self.get_current_count(key, window)
            remaining = max(0, limit - current_count)
            reset_time = time.time() + window

            return {
                "key": key,
                "limit": limit,
                "window": window,
                "current_count": current_count,
                "remaining": remaining,
                "reset_time": reset_time,
                "reset_time_formatted": datetime.fromtimestamp(reset_time).strftime("%Y-%m-%d %H:%M:%S"),
                "is_limited": current_count >= limit
            }

        except Exception as e:
            logger.error(f"获取限制信息失败: {str(e)}")
            return {
                "key": key,
                "limit": limit,
                "window": window,
                "current_count": 0,
                "remaining": limit,
                "reset_time": time.time() + window,
                "error": str(e)
            }

    async def update_limit_config(self, key: str, limit: int, window: int) -> Dict[str, Any]:
        """
        更新速率限制配置

        Args:
            key: 限制键
            limit: 新的限制次数
            window: 新的时间窗口

        Returns:
            更新结果
        """
        try:
            # 记录配置变更
            config_key = f"config:{key}"
            config_data = {
                "limit": limit,
                "window": window,
                "updated_at": datetime.utcnow().isoformat()
            }

            if self.use_redis and self.redis_client:
                await self.redis_client.hset(config_key, mapping=config_data)
                await self.redis_client.expire(config_key, 86400)  # 24小时过期

            logger.info(f"更新速率限制配置: key={key}, limit={limit}, window={window}")

            return {
                "key": key,
                "new_limit": limit,
                "new_window": window,
                "updated": True
            }

        except Exception as e:
            logger.error(f"更新限制配置失败: {str(e)}")
            return {
                "key": key,
                "error": str(e),
                "updated": False
            }

    async def get_all_active_limits(self) -> Dict[str, Dict[str, Any]]:
        """
        获取所有活跃的速率限制

        Returns:
            活跃限制列表
        """
        try:
            active_limits = {}

            if self.use_redis and self.redis_client:
                # 从Redis获取活跃限制
                config_keys = await self.redis_client.keys("config:*")

                for config_key in config_keys:
                    key = config_key.replace("config:", "")
                    config_data = await self.redis_client.hgetall(config_key)

                    current_count = await self.get_current_count(key, int(config_data.get("window", 60)))

                    active_limits[key] = {
                        "limit": int(config_data.get("limit", 100)),
                        "window": int(config_data.get("window", 60)),
                        "current_count": current_count,
                        "updated_at": config_data.get("updated_at")
                    }

            # 添加内存存储中的活跃限制
            for key, request_times in self.memory_storage.items():
                if key not in active_limits and request_times:
                    # 估算限制配置（基于最近的请求模式）
                    recent_requests = len(request_times)
                    estimated_limit = max(100, recent_requests * 2)
                    estimated_window = 60  # 默认1分钟窗口

                    active_limits[key] = {
                        "limit": estimated_limit,
                        "window": estimated_window,
                        "current_count": recent_requests,
                        "storage_type": "memory",
                        "estimated": True
                    }

            return active_limits

        except Exception as e:
            logger.error(f"获取活跃限制失败: {str(e)}")
            return {}

    async def cleanup_expired_data(self, max_age_hours: int = 24) -> Dict[str, Any]:
        """
        清理过期的速率限制数据

        Args:
            max_age_hours: 最大保留时间（小时）

        Returns:
            清理结果
        """
        try:
            cleanup_count = 0
            current_time = time.time()
            max_age_seconds = max_age_hours * 3600

            # 清理内存数据
            expired_keys = []
            for key, request_times in self.memory_storage.items():
                if request_times and (current_time - request_times[-1]) > max_age_seconds:
                    expired_keys.append(key)

            for key in expired_keys:
                del self.memory_storage[key]
                cleanup_count += 1

            # 清理Redis数据
            if self.use_redis and self.redis_client:
                # 清理过期的配置数据
                config_keys = await self.redis_client.keys("config:*")
                for config_key in config_keys:
                    updated_at = await self.redis_client.hget(config_key, "updated_at")
                    if updated_at:
                        try:
                            update_time = datetime.fromisoformat(updated_at)
                            if (current_time - update_time.timestamp()) > max_age_seconds:
                                await self.redis_client.delete(config_key)
                                cleanup_count += 1
                        except ValueError:
                            # 无效的时间格式，删除
                            await self.redis_client.delete(config_key)
                            cleanup_count += 1

            logger.info(f"清理过期速率限制数据完成: 清理{cleanup_count}个键")

            return {
                "cleaned_keys": cleanup_count,
                "max_age_hours": max_age_hours,
                "timestamp": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(f"清理过期数据失败: {str(e)}")
            return {
                "error": str(e),
                "cleaned_keys": 0
            }

    async def close(self):
        """关闭速率限制器，释放资源"""
        try:
            if self.redis_client:
                await self.redis_client.close()
                self.redis_client = None

            # 清空内存存储
            self.memory_storage.clear()

            logger.info("速率限制器已关闭")
        except Exception as e:
            logger.error(f"关闭速率限制器失败: {str(e)}")


class RateLimitMiddleware:
    """速率限制中间件（用于FastAPI）"""

    def __init__(self, limiter: RateLimiter):
        self.limiter = limiter

    async def check_rate_limit(
        self,
        key_func: callable,
        limit: int,
        window: int
    ):
        """
        检查速率限制的中间件函数

        Args:
            key_func: 生成限制键的函数
            limit: 限制次数
            window: 时间窗口

        Returns:
            检查结果
        """
        try:
            key = key_func()
            allowed = await self.limiter.check_limit(key, limit, window)

            if not allowed:
                # 获取限制信息
                limit_info = await self.limiter.get_limit_info(key, limit, window)
                return {
                    "allowed": False,
                    "limit_info": limit_info
                }

            return {
                "allowed": True,
                "key": key
            }

        except Exception as e:
            logger.error(f"速率限制中间件检查失败: {str(e)}")
            return {
                "allowed": True,  # 出错时允许请求
                "error": str(e)
            }


# 默认速率限制器实例
default_rate_limiter = RateLimiter()