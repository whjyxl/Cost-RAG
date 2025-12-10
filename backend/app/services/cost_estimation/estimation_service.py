"""
成本估算主流程服务

整合模板匹配、价格调整、层级计算等功能，提供完整的估算流程
"""
from typing import Dict, Optional, List
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging

from app.models.project_template import ProjectTemplate, ProjectTemplateCostItem
from app.models.project import CostEstimate, Project, CostItem
from app.services.cost_estimation.template_matcher import template_matcher
from app.services.cost_estimation.price_adjustment_service import price_adjustment_service
from app.services.cost_estimation.hierarchical_calculator import hierarchical_calculator

logger = logging.getLogger(__name__)


class EstimationService:
    """成本估算服务"""
    
    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
    
    async def estimate_from_template(
        self,
        project_name: str,
        area: float,
        user_id: int,
        db: AsyncSession,
        floors: Optional[str] = None,
        underground_floors: Optional[int] = None,
        aboveground_floors: Optional[int] = None,
        start_date: Optional[str] = None,
        project_type: Optional[str] = None,
        template_id: Optional[int] = None,
        auto_match: bool = True,
        labor_growth_rate: Optional[float] = None,
        material_growth_rate: Optional[float] = None,
        equipment_growth_rate: Optional[float] = None,
        region_factor: float = 1.0,
        quality_factor: float = 1.0,
        project_id: Optional[int] = None
    ) -> Dict:
        """
        基于模板进行成本估算
        
        完整流程：
        1. 选择或匹配模板
        2. 计算时间调整系数
        3. 执行层级递归计算
        4. 反向验证
        5. 保存估算记录
        """
        try:
            # Step 1: 选择模板
            if template_id:
                template = await self._get_template(template_id, db)
                if not template:
                    raise ValueError(f"模板不存在: {template_id}")
                similarity_score = None
            elif auto_match:
                matched = await template_matcher.match_templates(
                    area=area,
                    underground_floors=underground_floors,
                    aboveground_floors=aboveground_floors,
                    project_type=project_type,
                    top_n=1,
                    db=db
                )
                if not matched:
                    raise ValueError("未找到匹配的模板")
                template = matched[0]['template']
                similarity_score = matched[0]['similarity_score']
            else:
                raise ValueError("必须指定template_id或启用auto_match")
            
            # Step 2: 加载模板成本项
            template_items = await self._get_template_cost_items(template.id, db)
            
            # Step 3: 计算时间调整系数
            adjustment_result = price_adjustment_service.calculate_time_adjustment_factor(
                reference_start_date=template.start_date,
                new_start_date=start_date,
                labor_growth_rate=labor_growth_rate,
                material_growth_rate=material_growth_rate,
                equipment_growth_rate=equipment_growth_rate
            )
            
            time_adjustment_factor = adjustment_result['adjustment_factor']
            
            # Step 4: 应用所有调整系数
            final_adjustment_factor = (
                time_adjustment_factor *
                region_factor *
                quality_factor
            )
            
            # Step 5: 执行层级递归计算
            calculation_result = hierarchical_calculator.calculate_project_cost(
                project_area=area,
                template_cost_items=template_items,
                adjustment_factor=final_adjustment_factor
            )
            
            # Step 6: 反向验证
            validation_result = hierarchical_calculator.validate_calculation(
                calculation_result
            )
            
            # Step 7: 计算置信度
            confidence_score = self._calculate_confidence_score(
                similarity_score=similarity_score,
                validation_result=validation_result,
                area_match=abs(area - template.area) / max(area, template.area) if template.area > 0 else 1.0
            )

            # Step 8: 构建项目名称映射
            item_names = {item['item_code']: item['item_name'] for item in template_items}

            # Step 9: 构建返回结果（包含项目名称和第14项）
            primary_sections_result = {}
            for code, price in calculation_result['primary_unit_prices'].items():
                primary_sections_result[code] = {
                    'item_name': item_names.get(code, f'一级分部{code}'),
                    'unit_price': price,
                    'total_price': calculation_result['primary_total_costs'].get(code, 0.0)
                }

            # 添加第14项（项目总造价）
            primary_sections_result['14.0'] = {
                'item_name': item_names.get('14.0', '项目总开发成本'),
                'unit_price': calculation_result['total_unit_price'],
                'total_price': calculation_result['total_project_cost']
            }

            secondary_sections_result = {}
            for code, price in calculation_result['secondary_unit_prices'].items():
                secondary_sections_result[code] = {
                    'item_name': item_names.get(code, f'二级分部{code}'),
                    'unit_price': price,
                    'total_price': calculation_result['secondary_total_costs'].get(code, 0.0)
                }

            # Step 10: 保存估算记录（包含明细数据）
            estimate_record = await self._save_estimation(
                project_name=project_name,
                project_id=project_id,
                template_id=template.id,
                template_name=template.name,
                area=area,
                total_cost=calculation_result['total_project_cost'],
                unit_cost=calculation_result['total_unit_price'],
                time_adjustment_factor=time_adjustment_factor,
                years_difference=adjustment_result['years_difference'],
                adjustment_config={
                    'labor_growth_rate': labor_growth_rate,
                    'material_growth_rate': material_growth_rate,
                    'equipment_growth_rate': equipment_growth_rate,
                    'region_factor': region_factor,
                    'quality_factor': quality_factor
                },
                validation_status='validated' if validation_result['is_valid'] else 'failed',
                validation_errors=validation_result['errors'],
                confidence_score=confidence_score,
                user_id=user_id,
                primary_sections=primary_sections_result,  # 传递明细数据
                secondary_sections=secondary_sections_result,  # 传递明细数据
                db=db
            )

            # Step 11: 返回完整估算结果
            return {
                'estimation_id': estimate_record.id,
                'project_name': project_name,
                'area': area,
                'template_id': template.id,
                'template_name': template.name,
                'similarity_score': similarity_score,
                'reference_start_date': template.start_date,
                'reference_completion_date': template.completion_date,  # ✅ 新增：参考模板竣工时间
                'new_start_date': start_date,
                'years_difference': adjustment_result['years_difference'],
                'time_adjustment_factor': time_adjustment_factor,
                'total_cost': calculation_result['total_project_cost'],
                'unit_cost': calculation_result['total_unit_price'],
                'primary_sections': primary_sections_result,
                'secondary_sections': secondary_sections_result,
                'validation_status': validation_result['is_valid'],
                'validation_errors': validation_result['errors'],
                'confidence_score': confidence_score,
                'created_at': estimate_record.created_at.isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"成本估算失败: {str(e)}")
            raise
    
    async def _get_template(self, template_id: int, db: AsyncSession) -> Optional[ProjectTemplate]:
        """获取模板"""
        result = await db.execute(
            select(ProjectTemplate).where(ProjectTemplate.id == template_id)
        )
        return result.scalar_one_or_none()
    
    async def _get_template_cost_items(
        self,
        template_id: int,
        db: AsyncSession
    ) -> List[Dict]:
        """获取模板成本项"""
        result = await db.execute(
            select(ProjectTemplateCostItem).where(
                ProjectTemplateCostItem.template_id == template_id
            ).order_by(ProjectTemplateCostItem.item_code)
        )
        items = result.scalars().all()
        
        return [
            {
                'item_code': item.item_code,
                'item_name': item.item_name,
                'unit_price': item.unit_price,
                'total_price': item.total_price,
                'is_primary_section': item.is_primary_section,
                'is_secondary_section': item.is_secondary_section,
                'primary_section_code': item.primary_section_code
            }
            for item in items
        ]
    
    def _calculate_confidence_score(
        self,
        similarity_score: Optional[float],
        validation_result: Dict,
        area_match: float
    ) -> float:
        """计算置信度分数（0-1）"""
        score = 0.5  # 基础分数
        
        # 相似度贡献（如果有）
        if similarity_score is not None:
            score += similarity_score * 0.3
        
        # 面积匹配度贡献
        score += (1 - area_match) * 0.2
        
        # 验证结果贡献
        if validation_result['is_valid']:
            score += 0.3
        else:
            # 有错误，降低分数
            error_count = len(validation_result['errors'])
            score -= min(error_count * 0.1, 0.3)
        
        return max(0.0, min(1.0, score))
    
    async def _save_estimation(
        self,
        project_name: str,
        project_id: Optional[int],
        template_id: int,
        template_name: str,
        area: float,
        total_cost: float,
        unit_cost: float,
        time_adjustment_factor: float,
        years_difference: float,
        adjustment_config: Dict,
        validation_status: str,
        validation_errors: List[str],
        confidence_score: float,
        user_id: int,
        primary_sections: Dict,  # 新增参数
        secondary_sections: Dict,  # 新增参数
        db: AsyncSession
    ) -> CostEstimate:
        """保存估算记录"""
        # 如果没有project_id，创建一个临时项目
        if not project_id:
            project = Project(
                name=project_name,
                building_area=area,
                owner_id=user_id,
                project_type="OTHER"  # 默认类型
            )
            db.add(project)
            await db.flush()
            project_id = project.id

        estimate = CostEstimate(
            name=f"{project_name} - 成本估算",
            project_id=project_id,
            created_by=user_id,
            total_cost=total_cost,
            cost_per_unit=unit_cost,
            template_id=template_id,
            reference_template_name=template_name,
            time_adjustment_factor=time_adjustment_factor,
            years_difference=years_difference,
            adjustment_config=adjustment_config,
            validation_status=validation_status,
            validation_errors=validation_errors if validation_errors else None,
            confidence_score=confidence_score
        )

        db.add(estimate)
        await db.flush()

        # 新增：保存一级分部明细
        for code, data in primary_sections.items():
            cost_item = CostItem(
                estimate_id=estimate.id,
                category="一级分部",
                item_code=code,
                item_name=data['item_name'],
                unit="元/m²",
                quantity=area,
                unit_price=data['unit_price'],
                total_price=data['total_price']
            )
            db.add(cost_item)

        # 新增：保存二级分部明细
        for code, data in secondary_sections.items():
            cost_item = CostItem(
                estimate_id=estimate.id,
                category="二级分部",
                item_code=code,
                item_name=data['item_name'],
                unit="元/m²",
                quantity=area,
                unit_price=data['unit_price'],
                total_price=data['total_price']
            )
            db.add(cost_item)

        # 提交事务（确保数据持久化）
        await db.commit()
        await db.refresh(estimate)

        return estimate

    async def save_ai_estimation(
        self,
        project_name: str,
        project_type: str,
        area: float,
        location: str,
        estimated_unit_cost: float,
        estimated_total_cost: float,
        confidence: float,
        breakdown: List[Dict],
        rationale: str,
        model_used: str,
        ai_provider: str,
        user_id: int,
        db: AsyncSession,
        quality_level: Optional[str] = None,
        construction_year: Optional[int] = None,
        cost_breakdown: Optional[Dict] = None  # ✅ 新增：14级成本明细
    ) -> CostEstimate:
        """
        保存AI估算结果到数据库

        Args:
            project_name: 项目名称
            project_type: 项目类型
            area: 建筑面积
            location: 项目位置
            estimated_unit_cost: 估算单位造价
            estimated_total_cost: 估算总造价
            confidence: AI置信度
            breakdown: 成本构成明细（4大类）
            rationale: 估算依据
            model_used: 使用的AI模型
            ai_provider: AI提供商
            user_id: 用户ID
            db: 数据库会话
            quality_level: 质量等级（可选）
            construction_year: 建设年份（可选）

        Returns:
            保存的CostEstimate对象
        """
        try:
            self.logger.info(f"开始保存AI估算结果: {project_name}")

            # Step 1: 创建估算记录
            estimate = CostEstimate(
                name=f"{project_name} - AI估算",
                total_cost=estimated_total_cost,
                cost_per_unit=estimated_unit_cost,
                confidence_score=confidence,
                cost_breakdown={
                    'breakdown': breakdown,
                    'rationale': rationale,
                    'model_used': model_used,
                    'ai_provider': ai_provider,
                    'quality_level': quality_level,
                    'construction_year': construction_year
                },
                validation_status='AI估算',
                template_id=None,  # AI估算没有模板
                reference_template_name=f'AI模型: {model_used}',
                time_adjustment_factor=1.0,
                years_difference=0,
                created_by=user_id,
                created_at=datetime.now()
            )

            db.add(estimate)
            await db.flush()  # 获取estimate.id

            # Step 2: 将4大类成本拆分为成本项保存
            # 注意：AI估算返回的是4大类（建安工程、配套设施、管理费用、其他），
            # 我们将这些作为成本项保存
            for idx, item in enumerate(breakdown):
                cost_item = CostItem(
                    estimate_id=estimate.id,
                    item_code=f"AI_{idx+1}",
                    item_name=item.get('category', f'成本项{idx+1}'),
                    category="AI估算类别",
                    unit_price=item.get('unit_cost', 0),
                    quantity=area,
                    total_price=item.get('unit_cost', 0) * area,
                    notes=item.get('description', ''),
                    created_at=datetime.now()
                )
                db.add(cost_item)

            # ✅ 新增：保存14级成本明细（如果有）
            if cost_breakdown:
                # 保存一级分部（1.0-14.0）
                primary_sections = cost_breakdown.get('primary_sections', {})
                for code, data in primary_sections.items():
                    cost_item = CostItem(
                        estimate_id=estimate.id,
                        item_code=code,
                        item_name=data.get('item_name', ''),
                        category="一级分部",
                        unit_price=data.get('unit_price', 0),
                        quantity=area,
                        total_price=data.get('total_price', 0),
                        notes="14级成本结构 - 一级分部",
                        created_at=datetime.now()
                    )
                    db.add(cost_item)

                # 保存二级分部（2.1, 2.2, 4.1-4.6等）
                secondary_sections = cost_breakdown.get('secondary_sections', {})
                for code, data in secondary_sections.items():
                    cost_item = CostItem(
                        estimate_id=estimate.id,
                        item_code=code,
                        item_name=data.get('item_name', ''),
                        category="二级分部",
                        unit_price=data.get('unit_price', 0),
                        quantity=area,
                        total_price=data.get('total_price', 0),
                        notes="14级成本结构 - 二级分部",
                        created_at=datetime.now()
                    )
                    db.add(cost_item)

                self.logger.info(f"已保存14级成本明细: {len(primary_sections)}个一级分部, {len(secondary_sections)}个二级分部")

            # Step 3: 提交事务
            await db.commit()
            await db.refresh(estimate)

            self.logger.info(f"AI估算结果保存成功，ID: {estimate.id}")
            return estimate

        except Exception as e:
            self.logger.error(f"保存AI估算结果失败: {str(e)}")
            await db.rollback()
            raise


# 全局服务实例
estimation_service = EstimationService()

