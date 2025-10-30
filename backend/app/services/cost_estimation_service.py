"""
成本估算服务模块 - 智能算法和历史数据对比
"""
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc, asc
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import pandas as pd

from app.models.project import Project, CostEstimate, CostItem, ProjectType
from app.models.document import Document
from app.schemas.cost import (
    CostEstimateCreate, CostEstimateUpdate, CostAnalysisRequest,
    CostComparisonRequest, CostPredictionRequest
)
from app.core.logging import logger


class CostEstimationService:
    """成本估算服务类"""

    def __init__(self):
        self.ml_models = {
            'linear_regression': LinearRegression(),
            'random_forest': RandomForestRegressor(n_estimators=100, random_state=42)
        }
        self.scaler = StandardScaler()
        self.model_trained = False

    async def create_cost_estimate(
        self,
        estimate_data: CostEstimateCreate,
        user_id: int,
        db: AsyncSession
    ) -> CostEstimate:
        """
        创建成本估算

        Args:
            estimate_data: 估算数据
            user_id: 用户ID
            db: 数据库会话

        Returns:
            创建的估算记录
        """
        try:
            # 验证项目存在
            project_result = await db.execute(
                select(Project).where(
                    and_(
                        Project.id == estimate_data.project_id,
                        Project.user_id == user_id
                    )
                )
            )
            project = project_result.scalar_one_or_none()
            if not project:
                raise ValueError("项目不存在或无权限访问")

            # 创建估算记录
            cost_estimate = CostEstimate(
                project_id=estimate_data.project_id,
                title=estimate_data.title,
                description=estimate_data.description,
                estimated_budget=estimate_data.estimated_budget,
                currency=estimate_data.currency,
                estimation_method=estimate_data.estimation_method,
                confidence_level=estimate_data.confidence_level,
                risk_factors=estimate_data.risk_factors or [],
                assumptions=estimate_data.assumptions or [],
                constraints=estimate_data.constraints or [],
                estimated_duration_days=estimate_data.estimated_duration_days,
                estimated_start_date=estimate_data.estimated_start_date,
                estimated_end_date=estimate_data.estimated_end_date,
                team_size=estimate_data.team_size,
                complexity_level=estimate_data.complexity_level,
                technology_stack=estimate_data.technology_stack or [],
                created_by=user_id
            )

            db.add(cost_estimate)
            await db.commit()
            await db.refresh(cost_estimate)

            # 创建成本项目
            if estimate_data.cost_items:
                for item_data in estimate_data.cost_items:
                    cost_item = CostItem(
                        estimate_id=cost_estimate.id,
                        category=item_data.category,
                        name=item_data.name,
                        description=item_data.description,
                        quantity=item_data.quantity,
                        unit_price=item_data.unit_price,
                        total_cost=item_data.quantity * item_data.unit_price,
                        unit_of_measure=item_data.unit_of_measure,
                        cost_type=item_data.cost_type,
                        is_optional=item_data.is_optional,
                        dependencies=item_data.dependencies or []
                    )
                    db.add(cost_item)

                await db.commit()

            logger.info(f"成本估算创建成功: {cost_estimate.id}")
            return cost_estimate

        except Exception as e:
            logger.error(f"创建成本估算失败: {str(e)}")
            await db.rollback()
            raise

    async def get_cost_estimates(
        self,
        user_id: int,
        project_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 20,
        db: AsyncSession
    ) -> Tuple[List[CostEstimate], int]:
        """获取成本估算列表"""
        query = select(CostEstimate).where(CostEstimate.created_by == user_id)

        if project_id:
            query = query.where(CostEstimate.project_id == project_id)

        # 获取总数
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar()

        # 分页查询
        query = query.order_by(desc(CostEstimate.created_at)).offset(skip).limit(limit)
        result = await db.execute(query)
        estimates = result.scalars().all()

        return list(estimates), total

    async def get_cost_estimate(
        self,
        estimate_id: int,
        user_id: int,
        db: AsyncSession
    ) -> Optional[CostEstimate]:
        """获取成本估算详情"""
        result = await db.execute(
            select(CostEstimate).where(
                and_(
                    CostEstimate.id == estimate_id,
                    CostEstimate.created_by == user_id
                )
            )
        )
        return result.scalar_one_or_none()

    async def update_cost_estimate(
        self,
        estimate_id: int,
        estimate_update: CostEstimateUpdate,
        user_id: int,
        db: AsyncSession
    ) -> Optional[CostEstimate]:
        """更新成本估算"""
        result = await db.execute(
            select(CostEstimate).where(
                and_(
                    CostEstimate.id == estimate_id,
                    CostEstimate.created_by == user_id
                )
            )
        )
        estimate = result.scalar_one_or_none()

        if not estimate:
            return None

        # 更新字段
        update_data = estimate_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(estimate, field, value)

        estimate.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(estimate)

        return estimate

    async def analyze_cost_performance(
        self,
        analysis_request: CostAnalysisRequest,
        user_id: int,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        分析成本绩效

        Args:
            analysis_request: 分析请求
            user_id: 用户ID
            db: 数据库会话

        Returns:
            分析结果
        """
        try:
            # 获取项目数据
            project_query = select(Project).where(
                and_(
                    Project.user_id == user_id,
                    Project.actual_cost.isnot(None),
                    Project.estimated_budget.isnot(None)
                )
            )

            if analysis_request.project_type:
                project_query = project_query.where(
                    Project.project_type == analysis_request.project_type
                )

            if analysis_request.date_from:
                project_query = project_query.where(
                    Project.created_at >= analysis_request.date_from
                )

            if analysis_request.date_to:
                project_query = project_query.where(
                    Project.created_at <= analysis_request.date_to
                )

            result = await db.execute(project_query)
            projects = result.scalars().all()

            if not projects:
                return {
                    "message": "没有找到符合条件的项目数据",
                    "projects_analyzed": 0
                }

            # 计算成本绩效指标
            data = []
            for project in projects:
                cost_variance = project.actual_cost - project.estimated_budget
                cost_variance_percentage = (cost_variance / project.estimated_budget) * 100 if project.estimated_budget > 0 else 0

                data.append({
                    "project_id": project.id,
                    "project_name": project.name,
                    "project_type": project.project_type.value,
                    "estimated_budget": project.estimated_budget,
                    "actual_cost": project.actual_cost,
                    "cost_variance": cost_variance,
                    "cost_variance_percentage": cost_variance_percentage,
                    "duration_variance_days": (project.actual_end_date - project.estimated_end_date).days if project.actual_end_date and project.estimated_end_date else None,
                    "created_at": project.created_at
                })

            df = pd.DataFrame(data)

            # 统计分析
            analysis = {
                "projects_analyzed": len(projects),
                "total_estimated_budget": df["estimated_budget"].sum(),
                "total_actual_cost": df["actual_cost"].sum(),
                "average_cost_variance": df["cost_variance"].mean(),
                "average_cost_variance_percentage": df["cost_variance_percentage"].mean(),
                "cost_accuracy_rate": len(df[df["cost_variance_percentage"].abs() <= 10]) / len(df) * 100,
                "projects_over_budget": len(df[df["cost_variance"] > 0]),
                "projects_under_budget": len(df[df["cost_variance"] < 0]),
                "cost_variance_std": df["cost_variance_percentage"].std(),
                "analysis_period": {
                    "from": analysis_request.date_from,
                    "to": analysis_request.date_to
                }
            }

            # 按项目类型分析
            if "project_type" in df.columns:
                type_analysis = df.groupby("project_type").agg({
                    "estimated_budget": ["sum", "mean"],
                    "actual_cost": ["sum", "mean"],
                    "cost_variance_percentage": ["mean", "std"]
                }).round(2)
                analysis["by_project_type"] = type_analysis.to_dict()

            # 趋势分析
            df["created_month"] = pd.to_datetime(df["created_at"]).dt.to_period("M")
            monthly_analysis = df.groupby("created_month").agg({
                "cost_variance_percentage": "mean",
                "project_id": "count"
            }).round(2)
            analysis["monthly_trends"] = monthly_analysis.to_dict()

            # 风险因素分析
            high_variance_projects = df[df["cost_variance_percentage"].abs() > 20]
            analysis["high_variance_projects"] = {
                "count": len(high_variance_projects),
                "percentage": len(high_variance_projects) / len(df) * 100,
                "average_variance": high_variance_projects["cost_variance_percentage"].mean()
            }

            return analysis

        except Exception as e:
            logger.error(f"成本绩效分析失败: {str(e)}")
            raise

    async def compare_cost_estimates(
        self,
        comparison_request: CostComparisonRequest,
        user_id: int,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        比较成本估算

        Args:
            comparison_request: 比较请求
            user_id: 用户ID
            db: 数据库会话

        Returns:
            比较结果
        """
        try:
            # 获取要比较的估算
            result = await db.execute(
                select(CostEstimate).where(
                    and_(
                        CostEstimate.id.in_(comparison_request.estimate_ids),
                        CostEstimate.created_by == user_id
                    )
                )
            )
            estimates = result.scalars().all()

            if len(estimates) < 2:
                raise ValueError("至少需要选择两个估算进行比较")

            # 获取成本项目
            estimate_ids = [e.id for e in estimates]
            cost_items_result = await db.execute(
                select(CostItem).where(CostItem.estimate_id.in_(estimate_ids))
            )
            all_cost_items = cost_items_result.scalars().all()

            # 组织数据
            comparison_data = {}
            for estimate in estimates:
                items = [item for item in all_cost_items if item.estimate_id == estimate.id]
                comparison_data[estimate.id] = {
                    "estimate": estimate,
                    "total_cost": sum(item.total_cost for item in items),
                    "cost_items": items,
                    "categories": list(set(item.category for item in items))
                }

            # 比较分析
            comparison_result = {
                "estimates": [],
                "summary": {},
                "category_comparison": {},
                "recommendations": []
            }

            # 估算详情
            for estimate_id, data in comparison_data.items():
                estimate = data["estimate"]
                comparison_result["estimates"].append({
                    "id": estimate.id,
                    "title": estimate.title,
                    "estimated_budget": estimate.estimated_budget,
                    "calculated_total": data["total_cost"],
                    "difference": estimate.estimated_budget - data["total_cost"],
                    "confidence_level": estimate.confidence_level,
                    "estimation_method": estimate.estimation_method,
                    "created_at": estimate.created_at
                })

            # 汇总统计
            budgets = [e["estimated_budget"] for e in comparison_result["estimates"]]
            totals = [e["calculated_total"] for e in comparison_result["estimates"]]

            comparison_result["summary"] = {
                "budget_range": {"min": min(budgets), "max": max(budgets), "mean": np.mean(budgets)},
                "total_range": {"min": min(totals), "max": max(totals), "mean": np.mean(totals)},
                "budget_variance": np.std(budgets),
                "total_variance": np.std(totals)
            }

            # 分类比较
            all_categories = set()
            for data in comparison_data.values():
                all_categories.update(data["categories"])

            for category in all_categories:
                category_data = []
                for estimate_id, data in comparison_data.items():
                    category_items = [item for item in data["cost_items"] if item.category == category]
                    category_total = sum(item.total_cost for item in category_items)
                    category_data.append({
                        "estimate_id": estimate_id,
                        "total": category_total,
                        "percentage": (category_total / data["total_cost"] * 100) if data["total_cost"] > 0 else 0
                    })

                comparison_result["category_comparison"][category] = category_data

            # 生成建议
            recommendations = []
            budget_variance = np.std(budgets)
            if budget_variance > np.mean(budgets) * 0.3:  # 方差超过平均值的30%
                recommendations.append("估算预算差异较大，建议重新评估和统一估算方法")

            confidence_levels = [e["confidence_level"] for e in comparison_result["estimates"]]
            avg_confidence = np.mean(confidence_levels)
            if avg_confidence < 0.7:
                recommendations.append("平均置信度较低，建议收集更多历史数据以提高估算准确性")

            comparison_result["recommendations"] = recommendations

            return comparison_result

        except Exception as e:
            logger.error(f"成本估算比较失败: {str(e)}")
            raise

    async def predict_cost(
        self,
        prediction_request: CostPredictionRequest,
        user_id: int,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        基于历史数据预测成本

        Args:
            prediction_request: 预测请求
            user_id: 用户ID
            db: 数据库会话

        Returns:
            预测结果
        """
        try:
            # 获取历史项目数据用于训练模型
            result = await db.execute(
                select(Project).where(
                    and_(
                        Project.user_id == user_id,
                        Project.actual_cost.isnot(None),
                        Project.estimated_budget.isnot(None),
                        Project.project_type == prediction_request.project_type
                    )
                )
            )
            historical_projects = result.scalars().all()

            if len(historical_projects) < 3:
                return {
                    "error": "历史数据不足，需要至少3个同类型项目才能进行预测",
                    "available_projects": len(historical_projects)
                }

            # 准备训练数据
            features = []
            targets = []

            for project in historical_projects:
                # 提取特征
                feature = [
                    float(project.estimated_budget),
                    float(project.estimated_duration_days or 0),
                    float(project.complexity_level.value if project.complexity_level else 1),
                    len(project.technology_stack) if project.technology_stack else 0,
                    float(project.team_size or 1)
                ]

                # 时间特征
                if project.created_at:
                    feature.extend([
                        project.created_at.year,
                        project.created_at.month,
                        project.created_at.day
                    ])
                else:
                    feature.extend([2024, 1, 1])

                features.append(feature)
                targets.append(float(project.actual_cost))

            X = np.array(features)
            y = np.array(targets)

            # 标准化特征
            X_scaled = self.scaler.fit_transform(X)

            # 训练模型
            model = self.ml_models[prediction_request.model_type or 'random_forest']
            model.fit(X_scaled, y)

            # 准备预测特征
            prediction_features = [
                float(prediction_request.estimated_budget),
                float(prediction_request.estimated_duration_days or 0),
                float(prediction_request.complexity_level.value if prediction_request.complexity_level else 1),
                len(prediction_request.technology_stack or []),
                float(prediction_request.team_size or 1),
                datetime.now().year,
                datetime.now().month,
                datetime.now().day
            ]

            # 预测
            prediction_features_scaled = self.scaler.transform([prediction_features])
            predicted_cost = model.predict(prediction_features_scaled)[0]

            # 计算预测区间
            train_predictions = model.predict(X_scaled)
            mae = mean_absolute_error(y, train_predictions)
            mse = mean_squared_error(y, train_predictions)
            r2 = r2_score(y, train_predictions)

            # 预测区间（95%置信度）
            prediction_interval = {
                "lower": max(0, predicted_cost - 2 * mae),
                "upper": predicted_cost + 2 * mae,
                "predicted": predicted_cost
            }

            # 特征重要性
            feature_names = [
                "estimated_budget", "duration_days", "complexity_level",
                "technology_stack_size", "team_size", "year", "month", "day"
            ]

            feature_importance = {}
            if hasattr(model, 'feature_importances_'):
                for name, importance in zip(feature_names, model.feature_importances_):
                    feature_importance[name] = float(importance)

            return {
                "predicted_cost": float(predicted_cost),
                "prediction_interval": prediction_interval,
                "model_metrics": {
                    "mae": float(mae),
                    "mse": float(mse),
                    "r2_score": float(r2)
                },
                "feature_importance": feature_importance,
                "training_data_size": len(historical_projects),
                "model_type": prediction_request.model_type or 'random_forest',
                "confidence_level": "high" if r2 > 0.8 else "medium" if r2 > 0.6 else "low"
            }

        except Exception as e:
            logger.error(f"成本预测失败: {str(e)}")
            raise

    async def get_cost_benchmarks(
        self,
        project_type: ProjectType,
        user_id: int,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        获取成本基准数据

        Args:
            project_type: 项目类型
            user_id: 用户ID
            db: 数据库会话

        Returns:
            基准数据
        """
        try:
            # 获取同类型项目数据
            result = await db.execute(
                select(Project).where(
                    and_(
                        Project.user_id == user_id,
                        Project.project_type == project_type,
                        Project.actual_cost.isnot(None),
                        Project.estimated_budget.isnot(None)
                    )
                )
            )
            projects = result.scalars().all()

            if not projects:
                return {
                    "message": "没有找到该类型项目的历史数据",
                    "project_type": project_type.value,
                    "data_points": 0
                }

            # 计算基准指标
            budgets = [p.estimated_budget for p in projects]
            actuals = [p.actual_cost for p in projects]
            variances = [(a - b) / b * 100 for a, b in zip(actuals, budgets) if b > 0]

            benchmarks = {
                "project_type": project_type.value,
                "data_points": len(projects),
                "budget_benchmarks": {
                    "min": min(budgets),
                    "max": max(budgets),
                    "mean": np.mean(budgets),
                    "median": np.median(budgets),
                    "std": np.std(budgets),
                    "percentile_25": np.percentile(budgets, 25),
                    "percentile_75": np.percentile(budgets, 75)
                },
                "actual_cost_benchmarks": {
                    "min": min(actuals),
                    "max": max(actuals),
                    "mean": np.mean(actuals),
                    "median": np.median(actuals),
                    "std": np.std(actuals),
                    "percentile_25": np.percentile(actuals, 25),
                    "percentile_75": np.percentile(actuals, 75)
                },
                "variance_benchmarks": {
                    "mean": np.mean(variances),
                    "median": np.median(variances),
                    "std": np.std(variances),
                    "min": min(variances),
                    "max": max(variances)
                },
                "accuracy_rate": len([v for v in variances if abs(v) <= 10]) / len(variances) * 100
            }

            # 复杂度分析
            complexity_data = {}
            for project in projects:
                complexity = project.complexity_level.value if project.complexity_level else 1
                if complexity not in complexity_data:
                    complexity_data[complexity] = []
                complexity_data[complexity].append(project.actual_cost)

            complexity_analysis = {}
            for complexity, costs in complexity_data.items():
                complexity_analysis[complexity] = {
                    "count": len(costs),
                    "mean_cost": np.mean(costs),
                    "std_cost": np.std(costs)
                }

            benchmarks["complexity_analysis"] = complexity_analysis

            return benchmarks

        except Exception as e:
            logger.error(f"获取成本基准失败: {str(e)}")
            raise

    async def generate_cost_report(
        self,
        project_id: int,
        user_id: int,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        生成成本报告

        Args:
            project_id: 项目ID
            user_id: 用户ID
            db: 数据库会话

        Returns:
            成本报告
        """
        try:
            # 获取项目信息
            project_result = await db.execute(
                select(Project).where(
                    and_(
                        Project.id == project_id,
                        Project.user_id == user_id
                    )
                )
            )
            project = project_result.scalar_one_or_none()

            if not project:
                raise ValueError("项目不存在或无权限访问")

            # 获取估算记录
            estimates_result = await db.execute(
                select(CostEstimate).where(
                    CostEstimate.project_id == project_id
                ).order_by(desc(CostEstimate.created_at))
            )
            estimates = estimates_result.scalars().all()

            # 获取成本项目
            if estimates:
                latest_estimate = estimates[0]
                cost_items_result = await db.execute(
                    select(CostItem).where(
                        CostItem.estimate_id == latest_estimate.id
                    )
                )
                cost_items = cost_items_result.scalars().all()
            else:
                latest_estimate = None
                cost_items = []

            # 生成报告
            report = {
                "project_info": {
                    "id": project.id,
                    "name": project.name,
                    "type": project.project_type.value,
                    "created_at": project.created_at,
                    "status": project.status
                },
                "cost_summary": {
                    "estimated_budget": project.estimated_budget,
                    "actual_cost": project.actual_cost,
                    "cost_variance": (project.actual_cost - project.estimated_budget) if project.actual_cost and project.estimated_budget else None,
                    "cost_variance_percentage": ((project.actual_cost - project.estimated_budget) / project.estimated_budget * 100) if project.actual_cost and project.estimated_budget and project.estimated_budget > 0 else None
                },
                "latest_estimate": {
                    "id": latest_estimate.id if latest_estimate else None,
                    "title": latest_estimate.title if latest_estimate else None,
                    "created_at": latest_estimate.created_at if latest_estimate else None,
                    "confidence_level": latest_estimate.confidence_level if latest_estimate else None,
                    "estimated_budget": latest_estimate.estimated_budget if latest_estimate else None
                } if latest_estimate else None,
                "cost_breakdown": {},
                "historical_comparison": {},
                "recommendations": []
            }

            # 成本分解
            if cost_items:
                total_by_category = {}
                for item in cost_items:
                    if item.category not in total_by_category:
                        total_by_category[item.category] = 0
                    total_by_category[item.category] += item.total_cost

                report["cost_breakdown"] = {
                    "categories": total_by_category,
                    "total_items": len(cost_items),
                    "estimated_total": sum(item.total_cost for item in cost_items)
                }

            # 历史对比
            benchmarks = await self.get_cost_benchmarks(project.project_type, user_id, db)
            if "budget_benchmarks" in benchmarks:
                project_budget = project.estimated_budget or 0
                percentile = (sum(1 for b in benchmarks["budget_benchmarks"]["data_points"] if b <= project_budget) / len(benchmarks["budget_benchmarks"]["data_points"])) * 100 if benchmarks["data_points"] > 0 else 50

                report["historical_comparison"] = {
                    "percentile": percentile,
                    "benchmark_mean": benchmarks["budget_benchmarks"]["mean"],
                    "difference_from_mean": project_budget - benchmarks["budget_benchmarks"]["mean"]
                }

            # 生成建议
            recommendations = []
            if project.actual_cost and project.estimated_budget:
                variance_percentage = ((project.actual_cost - project.estimated_budget) / project.estimated_budget * 100)
                if variance_percentage > 20:
                    recommendations.append("实际成本超出预算较多，建议审查成本控制措施")
                elif variance_percentage < -20:
                    recommendations.append("实际成本低于预算较多，可能存在估算过于保守的问题")
                else:
                    recommendations.append("成本控制良好，实际成本与预算基本一致")

            if latest_estimate and latest_estimate.confidence_level < 0.7:
                recommendations.append("估算置信度较低，建议收集更多历史数据以提高准确性")

            report["recommendations"] = recommendations

            return report

        except Exception as e:
            logger.error(f"生成成本报告失败: {str(e)}")
            raise


# 全局成本估算服务实例
cost_estimation_service = CostEstimationService()