#!/usr/bin/env python3
"""
API文档生成脚本
"""
import os
import sys
import json
from pathlib import Path

# 添加项目根目录到Python路径
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
from fastapi.openapi.utils import get_openapi
from app.main import app
from app.core.config import settings


async def generate_openapi_docs():
    """生成OpenAPI文档"""
    print("🚀 开始生成API文档...")

    # 生成OpenAPI规范
    openapi_schema = get_openapi(
        title="Cost-RAG API",
        version="1.0.0",
        description="""
        ## Cost-RAG 智能成本咨询系统API

        这是一个基于RAG（检索增强生成）技术的智能成本咨询系统，提供建筑工程成本估算、
        文档管理、知识图谱和智能问答等功能。

        ### 主要功能模块

        1. **用户认证与授权** - JWT认证，RBAC权限管理
        2. **文档管理** - 文档上传、解析、向量化存储
        3. **成本估算** - 智能成本计算、历史数据对比
        4. **知识图谱** - 实体识别、关系抽取、知识查询
        5. **AI模型集成** - 支持7个主流国产AI模型
        6. **智能问答** - 多源查询、答案融合

        ### 技术架构

        - **后端框架**: FastAPI + SQLAlchemy + PostgreSQL
        - **向量数据库**: Qdrant
        - **图数据库**: Neo4j
        - **缓存**: Redis
        - **AI模型**: 智谱AI、月之暗面、阿里通义千问、百度文心一言、深度求索、零一万物、科大讯飞星火
        """,
        routes=app.routes,
        servers=[
            {"url": "http://localhost:8000", "description": "开发环境"},
            {"url": "https://api.cost-rag.com", "description": "生产环境"},
        ]
    )

    # 添加自定义信息
    openapi_schema["info"]["contact"] = {
        "name": "Cost-RAG Team",
        "email": "support@cost-rag.com",
        "url": "https://cost-rag.com"
    }

    openapi_schema["info"]["license"] = {
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT"
    }

    # 添加标签分组
    openapi_schema["tags"] = [
        {
            "name": "认证",
            "description": "用户注册、登录、认证相关接口"
        },
        {
            "name": "用户管理",
            "description": "用户信息管理相关接口"
        },
        {
            "name": "文档管理",
            "description": "文档上传、处理、搜索相关接口"
        },
        {
            "name": "成本估算",
            "description": "成本估算和分析相关接口"
        },
        {
            "name": "知识图谱",
            "description": "知识图谱构建和查询相关接口"
        },
        {
            "name": "AI模型",
            "description": "AI模型调用和管理相关接口"
        },
        {
            "name": "智能问答",
            "description": "智能问答和对话相关接口"
        }
    ]

    # 保存OpenAPI JSON文件
    docs_dir = Path(__file__).parent.parent / "docs"
    docs_dir.mkdir(exist_ok=True)

    openapi_file = docs_dir / "openapi.json"
    with open(openapi_file, "w", encoding="utf-8") as f:
        json.dump(openapi_schema, f, ensure_ascii=False, indent=2)

    print(f"✅ OpenAPI文档已生成: {openapi_file}")

    # 生成Markdown文档
    await generate_markdown_docs(openapi_schema, docs_dir)

    print("🎉 API文档生成完成!")


async def generate_markdown_docs(openapi_schema, docs_dir):
    """生成Markdown格式的API文档"""
    markdown_content = f"""# Cost-RAG API 文档

## 概述

Cost-RAG 智能成本咨询系统API文档

**版本**: {openapi_schema['info']['version']}
**基础URL**: {openapi_schema['servers'][0]['url']}

## 认证

本API使用Bearer Token认证。获取token后，在请求头中添加：
```
Authorization: Bearer YOUR_TOKEN_HERE
```

## API接口

"""

    # 按标签分组接口
    paths = openapi_schema.get("paths", {})
    tags_info = {tag["name"]: tag["description"] for tag in openapi_schema.get("tags", [])}

    for path, path_item in paths.items():
        for method, operation in path_item.items():
            if method not in ["get", "post", "put", "delete", "patch"]:
                continue

            tags = operation.get("tags", ["未分类"])
            tag_name = tags[0] if tags else "未分类"
            tag_desc = tags_info.get(tag_name, "")

            summary = operation.get("summary", f"{method.upper()} {path}")
            description = operation.get("description", "")

            markdown_content += f"""
### {summary}

**标签**: {tag_name}
**路径**: `{method.upper()} {path}`

{description}

"""

            # 参数
            parameters = operation.get("parameters", [])
            if parameters:
                markdown_content += "**参数**:\n\n"
                for param in parameters:
                    param_name = param.get("name", "")
                    param_desc = param.get("description", "")
                    param_required = param.get("required", False)
                    param_type = param.get("schema", {}).get("type", "string")

                    markdown_content += f"- `{param_name}` ({param_type}){' - **必需**' if param_required else ''}: {param_desc}\n"
                markdown_content += "\n"

            # 请求体
            if "requestBody" in operation:
                request_body = operation["requestBody"]
                content = request_body.get("content", {})
                if "application/json" in content:
                    schema = content["application/json"].get("schema", {})
                    markdown_content += "**请求体**:\n\n```json\n"
                    markdown_content += json.dumps(schema, indent=2, ensure_ascii=False)
                    markdown_content += "\n```\n\n"

            # 响应
            responses = operation.get("responses", {})
            if responses:
                markdown_content += "**响应**:\n\n"
                for status_code, response in responses.items():
                    response_desc = response.get("description", "")
                    markdown_content += f"- **{status_code}**: {response_desc}\n"
                markdown_content += "\n"

    # 保存Markdown文档
    markdown_file = docs_dir / "API.md"
    with open(markdown_file, "w", encoding="utf-8") as f:
        f.write(markdown_content)

    print(f"✅ Markdown文档已生成: {markdown_file}")


async def generate_client_sdk():
    """生成客户端SDK示例"""
    print("📦 生成客户端SDK示例...")

    sdk_dir = Path(__file__).parent.parent / "sdk"
    sdk_dir.mkdir(exist_ok=True)

    # Python SDK示例
    python_sdk = '''"""
Cost-RAG API Python客户端SDK
"""
import httpx
from typing import Optional, Dict, Any
from pydantic import BaseModel


class CostRAGClient:
    """Cost-RAG API客户端"""

    def __init__(self, base_url: str = "http://localhost:8000", api_key: Optional[str] = None):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.client = httpx.Client()

    def _get_headers(self) -> Dict[str, str]:
        """获取请求头"""
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def register_user(self, username: str, email: str, password: str) -> Dict[str, Any]:
        """用户注册"""
        data = {
            "username": username,
            "email": email,
            "password": password
        }
        response = self.client.post(
            f"{self.base_url}/api/v1/auth/register",
            json=data,
            headers=self._get_headers()
        )
        response.raise_for_status()
        return response.json()

    async def login(self, username: str, password: str) -> Dict[str, Any]:
        """用户登录"""
        data = {"username": username, "password": password}
        response = self.client.post(
            f"{self.base_url}/api/v1/auth/login",
            data=data
        )
        response.raise_for_status()
        return response.json()

    async def ask_question(self, question: str, query_type: str = "simple") -> Dict[str, Any]:
        """智能问答"""
        data = {
            "question": question,
            "query_type": query_type
        }
        response = self.client.post(
            f"{self.base_url}/api/v1/qa/query",
            json=data,
            headers=self._get_headers()
        )
        response.raise_for_status()
        return response.json()

    async def upload_document(self, file_path: str, title: str) -> Dict[str, Any]:
        """上传文档"""
        with open(file_path, "rb") as f:
            files = {"file": (Path(file_path).name, f, "application/octet-stream")}
            data = {"title": title}
            response = self.client.post(
                f"{self.base_url}/api/v1/documents/upload",
                files=files,
                data=data,
                headers={"Authorization": f"Bearer {self.api_key}"}
            )
            response.raise_for_status()
            return response.json()


# 使用示例
async def main():
    client = CostRAGClient()

    # 用户注册
    # user = await client.register_user("testuser", "test@example.com", "password123")

    # 用户登录
    # login_result = await client.login("testuser", "password123")
    # client.api_key = login_result["access_token"]

    # 智能问答
    # answer = await client.ask_question("建筑材料的价格是多少？")
    # print(answer["answer"]["answer"])

    print("SDK示例代码已准备就绪")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
'''

    python_file = sdk_dir / "python_client.py"
    with open(python_file, "w", encoding="utf-8") as f:
        f.write(python_sdk)

    print(f"✅ Python SDK示例已生成: {python_file}")


def main():
    """主函数"""
    print("📚 Cost-RAG API文档生成工具")
    print("=" * 50)

    try:
        asyncio.run(generate_openapi_docs())
        asyncio.run(generate_client_sdk())

        print("\n🎯 后续步骤:")
        print("1. 查看 docs/openapi.json 获取完整API规范")
        print("2. 查看 docs/API.md 获取Markdown格式文档")
        print("3. 查看 sdk/python_client.py 获取Python客户端示例")
        print("4. 可以使用 Swagger UI: http://localhost:8000/docs")
        print("5. 可以使用 ReDoc: http://localhost:8000/redoc")

    except Exception as e:
        print(f"❌ 生成文档时出错: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()