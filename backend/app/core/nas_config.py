"""
群晖NAS配置
"""
from pydantic_settings import BaseSettings
from typing import Optional


class NASSettings(BaseSettings):
    """NAS连接配置"""
    
    # NAS连接信息
    NAS_HOST: str = "192.168.1.100"  # 群晖NAS IP地址
    NAS_PORT: int = 445  # SMB端口
    NAS_SHARE_NAME: str = "knowledge_data"  # 共享文件夹名称
    NAS_USERNAME: str = ""  # NAS用户名
    NAS_PASSWORD: str = ""  # NAS密码
    
    # 挂载路径配置
    NAS_MOUNT_POINT: str = "/mnt/nas_knowledge"  # Linux挂载点
    NAS_MOUNT_POINT_WIN: str = "Z:"  # Windows挂载点
    
    # 数据目录结构
    DATA_ROOT: str = "knowledge_data"
    
    # 专业分类目录
    DOOR_WINDOW_DIR: str = "door_window"
    PLUMBING_DIR: str = "plumbing"
    HVAC_DIR: str = "hvac"
    DECORATION_DIR: str = "decoration"
    
    # 数据类型子目录
    STANDARDS_DIR: str = "standards"  # 设计规范
    PROCESSES_DIR: str = "processes"  # 施工工艺
    MATERIALS_DIR: str = "materials"  # 材料数据
    COSTS_DIR: str = "costs"  # 成本数据
    OPTIMIZATIONS_DIR: str = "optimizations"  # 优化建议
    
    # 文件监控配置
    WATCH_INTERVAL: int = 60  # 监控间隔（秒）
    AUTO_IMPORT: bool = True  # 是否自动导入新文件
    
    # 支持的文件格式
    SUPPORTED_FORMATS: list = ["json", "xlsx", "csv", "md", "txt"]
    
    class Config:
        env_file = ".env"
        env_prefix = "NAS_"


nas_settings = NASSettings()
