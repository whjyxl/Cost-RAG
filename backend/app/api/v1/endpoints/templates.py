"""
项目模板管理API端点
"""
import os
import shutil
import tempfile
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.models.project_template import ProjectTemplate, ProjectTemplateCostItem
from app.schemas.template import (
    ProjectTemplate as ProjectTemplateSchema,
    ProjectTemplateList,
    ProjectTemplateUpdate,
    SaveParsedDataRequest,
    SaveParsedDataResponse,
)
from app.services.excel_parser.storage_service import storage_service
from app.services.excel_parser.parser import MultiProjectExcelParser, ParserConfig
from app.core.logging import logger

router = APIRouter()


@router.post("/upload", response_model=SaveParsedDataResponse)
async def upload_excel_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    上传Excel文件并解析为项目模板

    支持多项目Excel文件（最多7个项目），自动解析并保存14级成本结构
    """
    try:
        # 验证文件类型
        if not file.filename.endswith(('.xlsx', '.xls')):
            raise HTTPException(
                status_code=400,
                detail="只支持Excel文件（.xlsx, .xls）"
            )

        # 创建临时文件保存上传的Excel
        temp_dir = tempfile.gettempdir()
        temp_file_path = os.path.join(temp_dir, f"upload_{current_user.id}_{file.filename}")

        try:
            # 保存上传的文件
            with open(temp_file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            logger.info(f"Excel文件已保存到临时位置: {temp_file_path}")

            # 解析Excel文件
            parser = MultiProjectExcelParser(ParserConfig(skip_empty_projects=True))
            parsed_data = parser.parse(temp_file_path)

            logger.info(f"成功解析Excel，找到 {len(parsed_data.projects)} 个项目")

            # 保存到数据库
            template_ids = await storage_service.save_parsed_data(
                parsed_data=parsed_data,
                source_file=file.filename,  # 使用原始文件名
                user_id=current_user.id,
                db=db
            )

            logger.info(f"成功保存 {len(template_ids)} 个模板到数据库")

            return SaveParsedDataResponse(
                template_ids=template_ids,
                message=f"成功上传并解析 {len(template_ids)} 个项目模板"
            )

        finally:
            # 清理临时文件
            if os.path.exists(temp_file_path):
                try:
                    os.remove(temp_file_path)
                    logger.info(f"已清理临时文件: {temp_file_path}")
                except Exception as e:
                    logger.warning(f"清理临时文件失败: {e}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"上传Excel文件失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")


@router.post("/save", response_model=SaveParsedDataResponse)
async def save_parsed_excel_data(
    request: SaveParsedDataRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    保存Excel解析结果到数据库
    
    先解析Excel文件，然后将解析结果保存为项目模板
    """
    try:
        # 解析Excel文件
        parser = MultiProjectExcelParser(ParserConfig(skip_empty_projects=True))
        parsed_data = parser.parse(request.source_file)
        
        # 保存到数据库
        template_ids = await storage_service.save_parsed_data(
            parsed_data=parsed_data,
            source_file=request.source_file,
            user_id=current_user.id,
            db=db
        )
        
        return SaveParsedDataResponse(
            template_ids=template_ids,
            message=f"成功保存 {len(template_ids)} 个模板"
        )
        
    except Exception as e:
        logger.error(f"保存Excel解析结果失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"保存失败: {str(e)}")


@router.get("/", response_model=ProjectTemplateList)
async def get_templates(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    is_enabled: Optional[bool] = Query(None, description="是否启用"),
    project_type: Optional[str] = Query(None, description="项目类型"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取项目模板列表"""
    try:
        # 构建查询，预加载成本项
        query = select(ProjectTemplate).options(
            selectinload(ProjectTemplate.cost_items)
        )

        # 过滤条件
        if is_enabled is not None:
            query = query.where(ProjectTemplate.is_enabled == is_enabled)

        if project_type:
            query = query.where(ProjectTemplate.project_type == project_type)

        # 获取总数
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        # 分页查询
        skip = (page - 1) * size
        query = query.order_by(desc(ProjectTemplate.created_at)).offset(skip).limit(size)
        result = await db.execute(query)
        templates = result.scalars().all()

        pages = (total + size - 1) // size

        return ProjectTemplateList(
            templates=[ProjectTemplateSchema.model_validate(t) for t in templates],
            total=total,
            page=page,
            size=size,
            pages=pages
        )

    except Exception as e:
        logger.error(f"获取模板列表失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="获取模板列表失败")


@router.get("/{template_id}", response_model=ProjectTemplateSchema)
async def get_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取模板详情"""
    try:
        result = await db.execute(
            select(ProjectTemplate)
            .options(selectinload(ProjectTemplate.cost_items))
            .where(ProjectTemplate.id == template_id)
        )
        template = result.scalar_one_or_none()

        if not template:
            raise HTTPException(status_code=404, detail="模板不存在")

        return ProjectTemplateSchema.model_validate(template)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取模板详情失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="获取模板详情失败")


@router.put("/{template_id}", response_model=ProjectTemplateSchema)
async def update_template(
    template_id: int,
    template_update: ProjectTemplateUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """更新模板"""
    try:
        result = await db.execute(
            select(ProjectTemplate).where(ProjectTemplate.id == template_id)
        )
        template = result.scalar_one_or_none()
        
        if not template:
            raise HTTPException(status_code=404, detail="模板不存在")
        
        # 更新字段
        update_data = template_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(template, field, value)
        
        await db.commit()
        await db.refresh(template)
        
        return ProjectTemplateSchema.model_validate(template)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新模板失败: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="更新模板失败")


@router.delete("/{template_id}")
async def delete_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """删除模板"""
    try:
        result = await db.execute(
            select(ProjectTemplate).where(ProjectTemplate.id == template_id)
        )
        template = result.scalar_one_or_none()
        
        if not template:
            raise HTTPException(status_code=404, detail="模板不存在")
        
        await db.delete(template)
        await db.commit()
        
        return {"message": "模板删除成功"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除模板失败: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="删除模板失败")

