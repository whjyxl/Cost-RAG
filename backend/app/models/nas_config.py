"""
NAS配置数据模型
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from app.db.session import Base


class NASConfig(Base):
    """NAS配置模型"""
    __tablename__ = "nas_configs"

    id = Column(Integer, primary_key=True, index=True)
    host = Column(String(255), nullable=False, comment="NAS主机地址")
    port = Column(Integer, default=445, comment="SMB端口")
    share_name = Column(String(255), nullable=False, comment="共享文件夹名称")
    username = Column(String(255), nullable=False, comment="用户名")
    password = Column(String(255), nullable=False, comment="密码")
    auto_import = Column(Boolean, default=True, comment="是否启用自动导入")
    watch_interval = Column(Integer, default=60, comment="监控间隔（秒）")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), comment="更新时间")

    def __repr__(self):
        return f"<NASConfig(host='{self.host}', share_name='{self.share_name}')>"
