"""
成本估算系统测试
"""
import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.cost_estimation_service import cost_estimation_service
from app.models.project import Project, ProjectType, ComplexityLevel
from app.models.cost import CostEstimate, CostItem, CostType, CostCategory
from app.schemas.cost import (
    CostEstimateCreate, CostEstimateUpdate, CostAnalysisRequest,
    CostComparisonRequest, CostPredictionRequest, CostItemCreate
)
from app.core.security import get_password_hash


@pytest.mark.asyncio
async def test_cost_estimation_service_initialization():
    """测试成本估算服务初始化"""
    service = cost_estimation_service
    assert service is not None
    assert service.ml_models is not None
    assert 'linear_regression' in service.ml_models
    assert 'random_forest' in service.ml_models
    assert service.scaler is not None


@pytest.mark.asyncio
async def test_create_cost_estimate():
    """测试创建成本估算"""
    # 创建测试数据
    cost_items = [
        CostItemCreate(
            category=CostCategory.LABOR,
            name="开发人员",
            description="高级开发工程师",
            quantity=2,
            unit_price=800.0,
            unit_of_measure="人天",
            cost_type=CostType.DIRECT
        ),
        CostItemCreate(
            category=CostCategory.EQUIPMENT,
            name="服务器租赁",
            description="云服务器月租费用",
            quantity=3,
            unit_price=500.0,
            unit_of_measure="月",
            cost_type=CostType.VARIABLE
        )
    ]

    estimate_data = CostEstimateCreate(
        project_id=1,
        title="测试项目估算",
        description="这是一个测试项目的成本估算",
        estimated_budget=100000.0,
        estimation_method="parametric",
        confidence_level=0.85,
        risk_factors=["技术风险", "时间风险"],
        assumptions=["团队能力稳定", "需求不变更"],
        estimated_duration_days=90,
        team_size=5,
        complexity_level="medium",
        technology_stack=["Python", "React", "PostgreSQL"],
        cost_items=cost_items
    )

    # 模拟数据库会话
    mock_db = AsyncMock(spec=AsyncSession)

    with patch('sqlalchemy.ext.asyncio.AsyncSession.add'), \
         patch('sqlalchemy.ext.asyncio.AsyncSession.commit'), \
         patch('sqlalchemy.ext.asyncio.AsyncSession.refresh'), \
         patch('sqlalchemy.select') as mock_select:

        # 模拟项目查询
        mock_project = Project(
            id=1,
            name="测试项目",
            user_id=1,
            project_type=ProjectType.SOFTWARE_DEVELOPMENT
        )
        mock_project_result = Mock()
        mock_project_result.scalar_one_or_none.return_value = mock_project
        mock_db.execute.return_value = mock_project_result

        # 执行创建
        estimate = await cost_estimation_service.create_cost_estimate(
            estimate_data=estimate_data,
            user_id=1,
            db=mock_db
        )

        # 验证结果
        assert estimate is not None
        assert estimate.title == "测试项目估算"
        assert estimate.estimated_budget == 100000.0


@pytest.mark.asyncio
async def test_get_cost_estimates():
    """测试获取成本估算列表"""
    mock_db = AsyncMock(spec=AsyncSession)

    with patch('sqlalchemy.select') as mock_select, \
         patch('sqlalchemy.func') as mock_func:

        # 模拟查询结果
        mock_estimates = [
            CostEstimate(
                id=1,
                title="估算1",
                estimated_budget=50000.0,
                created_by=1
            ),
            CostEstimate(
                id=2,
                title="估算2",
                estimated_budget=75000.0,
                created_by=1
            )
        ]

        mock_count_result = Mock()
        mock_count_result.scalar.return_value = 2

        mock_result = Mock()
        mock_result.scalars.return_value.all.return_value = mock_estimates

        # 设置不同的执行结果
        mock_db.execute.side_effect = [mock_count_result, mock_result]

        estimates, total = await cost_estimation_service.get_cost_estimates(
            user_id=1,
            skip=0,
            limit=20,
            db=mock_db
        )

        assert len(estimates) == 2
        assert total == 2


@pytest.mark.asyncio
async def test_update_cost_estimate():
    """测试更新成本估算"""
    estimate_update = CostEstimateUpdate(
        title="更新后的估算",
        estimated_budget=120000.0,
        confidence_level=0.9
    )

    mock_db = AsyncMock(spec=AsyncSession)

    with patch('sqlalchemy.select') as mock_select, \
         patch('sqlalchemy.ext.asyncio.AsyncSession.commit'), \
         patch('sqlalchemy.ext.asyncio.AsyncSession.refresh'):

        # 模拟现有估算
        mock_existing_estimate = CostEstimate(
            id=1,
            title="原始估算",
            estimated_budget=100000.0,
            created_by=1
        )

        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = mock_existing_estimate
        mock_db.execute.return_value = mock_result

        updated_estimate = await cost_estimation_service.update_cost_estimate(
            estimate_id=1,
            estimate_update=estimate_update,
            user_id=1,
            db=mock_db
        )

        assert updated_estimate is not None
        assert updated_estimate.title == "更新后的估算"
        assert updated_estimate.estimated_budget == 120000.0


@pytest.mark.asyncio
async def test_analyze_cost_performance():
    """测试成本绩效分析"""
    analysis_request = CostAnalysisRequest(
        project_type="software_development",
        date_from=datetime.utcnow() - timedelta(days=90),
        date_to=datetime.utcnow()
    )

    mock_db = AsyncMock(spec=AsyncSession)

    with patch('sqlalchemy.select') as mock_select:
        # 模拟项目数据
        mock_projects = [
            Project(
                id=1,
                name="项目1",
                user_id=1,
                project_type=ProjectType.SOFTWARE_DEVELOPMENT,
                estimated_budget=100000.0,
                actual_cost=95000.0,
                created_at=datetime.utcnow() - timedelta(days=60)
            ),
            Project(
                id=2,
                name="项目2",
                user_id=1,
                project_type=ProjectType.SOFTWARE_DEVELOPMENT,
                estimated_budget=80000.0,
                actual_cost=85000.0,
                created_at=datetime.utcnow() - timedelta(days=30)
            )
        ]

        mock_result = Mock()
        mock_result.scalars.return_value.all.return_value = mock_projects
        mock_db.execute.return_value = mock_result

        analysis = await cost_estimation_service.analyze_cost_performance(
            analysis_request=analysis_request,
            user_id=1,
            db=mock_db
        )

        assert isinstance(analysis, dict)
        assert 'projects_analyzed' in analysis
        assert 'total_estimated_budget' in analysis
        assert 'total_actual_cost' in analysis
        assert 'average_cost_variance' in analysis
        assert analysis['projects_analyzed'] == 2


@pytest.mark.asyncio
async def test_compare_cost_estimates():
    """测试成本估算比较"""
    comparison_request = CostComparisonRequest(
        estimate_ids=[1, 2, 3],
        comparison_metrics=["budget", "confidence", "method"]
    )

    mock_db = AsyncMock(spec=AsyncSession)

    with patch('sqlalchemy.select') as mock_select:
        # 模拟估算数据
        mock_estimates = [
            CostEstimate(
                id=1,
                title="估算A",
                estimated_budget=100000.0,
                confidence_level=0.8,
                created_by=1
            ),
            CostEstimate(
                id=2,
                title="估算B",
                estimated_budget=120000.0,
                confidence_level=0.75,
                created_by=1
            ),
            CostEstimate(
                id=3,
                title="估算C",
                estimated_budget=95000.0,
                confidence_level=0.85,
                created_by=1
            )
        ]

        # 模拟成本项目
        mock_cost_items = [
            CostItem(
                id=1,
                estimate_id=1,
                category=CostCategory.LABOR,
                total_cost=50000.0
            ),
            CostItem(
                id=2,
                estimate_id=1,
                category=CostCategory.EQUIPMENT,
                total_cost=30000.0
            )
        ]

        # 设置不同的执行结果
        mock_estimates_result = Mock()
        mock_estimates_result.scalars.return_value.all.return_value = mock_estimates
        mock_cost_items_result = Mock()
        mock_cost_items_result.scalars.return_value.all.return_value = mock_cost_items
        mock_db.execute.side_effect = [mock_estimates_result, mock_cost_items_result]

        comparison = await cost_estimation_service.compare_cost_estimates(
            comparison_request=comparison_request,
            user_id=1,
            db=mock_db
        )

        assert isinstance(comparison, dict)
        assert 'estimates' in comparison
        assert 'summary' in comparison
        assert 'category_comparison' in comparison
        assert 'recommendations' in comparison
        assert len(comparison['estimates']) == 3


@pytest.mark.asyncio
async def test_predict_cost():
    """测试成本预测"""
    prediction_request = CostPredictionRequest(
        project_type="software_development",
        estimated_budget=100000.0,
        estimated_duration_days=90,
        complexity_level="medium",
        team_size=5,
        technology_stack=["Python", "React"],
        model_type="random_forest"
    )

    mock_db = AsyncMock(spec=AsyncSession)

    with patch('sqlalchemy.select') as mock_select, \
         patch('numpy.array') as mock_np_array, \
         patch('sklearn.preprocessing.StandardScaler') as mock_scaler, \
         patch('sklearn.ensemble.RandomForestRegressor') as mock_rf:

        # 模拟历史项目数据
        mock_projects = [
            Project(
                id=1,
                user_id=1,
                project_type=ProjectType.SOFTWARE_DEVELOPMENT,
                estimated_budget=80000.0,
                actual_cost=85000.0,
                estimated_duration_days=60,
                complexity_level=ComplexityLevel.MEDIUM,
                team_size=4,
                created_at=datetime.utcnow() - timedelta(days=120)
            ),
            Project(
                id=2,
                user_id=1,
                project_type=ProjectType.SOFTWARE_DEVELOPMENT,
                estimated_budget=120000.0,
                actual_cost=115000.0,
                estimated_duration_days=100,
                complexity_level=ComplexityLevel.HIGH,
                team_size=6,
                created_at=datetime.utcnow() - timedelta(days=60)
            )
        ]

        mock_result = Mock()
        mock_result.scalars.return_value.all.return_value = mock_projects
        mock_db.execute.return_value = mock_result

        # 模拟机器学习组件
        mock_scaler_instance = Mock()
        mock_scaler_instance.fit_transform.return_value = [[1, 2, 3], [4, 5, 6]]
        mock_scaler_instance.transform.return_value = [[7, 8, 9]]
        mock_scaler.return_value = mock_scaler_instance

        mock_model = Mock()
        mock_model.fit.return_value = None
        mock_model.predict.return_value = [105000.0]
        mock_model.feature_importances_ = [0.3, 0.2, 0.1, 0.15, 0.25]
        mock_rf.return_value = mock_model

        mock_np_array.side_effect = [
            [[1, 2, 3], [4, 5, 6]],  # 训练特征
            [85000.0, 115000.0],       # 目标值
            [[7, 8, 9]]               # 预测特征
        ]

        prediction = await cost_estimation_service.predict_cost(
            prediction_request=prediction_request,
            user_id=1,
            db=mock_db
        )

        assert isinstance(prediction, dict)
        assert 'predicted_cost' in prediction
        assert 'prediction_interval' in prediction
        assert 'model_metrics' in prediction
        assert 'confidence_level' in prediction
        assert prediction['predicted_cost'] == 105000.0


@pytest.mark.asyncio
async def test_get_cost_benchmarks():
    """测试获取成本基准"""
    mock_db = AsyncMock(spec=AsyncSession)

    with patch('sqlalchemy.select') as mock_select:
        # 模拟历史项目数据
        mock_projects = [
            Project(
                id=1,
                user_id=1,
                project_type=ProjectType.SOFTWARE_DEVELOPMENT,
                estimated_budget=80000.0,
                actual_cost=85000.0,
                complexity_level=ComplexityLevel.LOW
            ),
            Project(
                id=2,
                user_id=1,
                project_type=ProjectType.SOFTWARE_DEVELOPMENT,
                estimated_budget=120000.0,
                actual_cost=110000.0,
                complexity_level=ComplexityLevel.HIGH
            )
        ]

        mock_result = Mock()
        mock_result.scalars.return_value.all.return_value = mock_projects
        mock_db.execute.return_value = mock_result

        benchmarks = await cost_estimation_service.get_cost_benchmarks(
            project_type=ProjectType.SOFTWARE_DEVELOPMENT,
            user_id=1,
            db=mock_db
        )

        assert isinstance(benchmarks, dict)
        assert 'project_type' in benchmarks
        assert 'data_points' in benchmarks
        assert 'budget_benchmarks' in benchmarks
        assert 'actual_cost_benchmarks' in benchmarks
        assert 'accuracy_rate' in benchmarks
        assert benchmarks['data_points'] == 2


@pytest.mark.asyncio
async def test_generate_cost_report():
    """测试生成成本报告"""
    mock_db = AsyncMock(spec=AsyncSession)

    with patch('sqlalchemy.select') as mock_select:
        # 模拟项目数据
        mock_project = Project(
            id=1,
            name="测试项目",
            user_id=1,
            project_type=ProjectType.SOFTWARE_DEVELOPMENT,
            estimated_budget=100000.0,
            actual_cost=95000.0,
            created_at=datetime.utcnow() - timedelta(days=60)
        )

        # 模拟估算数据
        mock_estimate = CostEstimate(
            id=1,
            project_id=1,
            title="项目估算",
            estimated_budget=100000.0,
            confidence_level=0.8,
            created_by=1,
            created_at=datetime.utcnow() - timedelta(days=50)
        )

        # 模拟成本项目
        mock_cost_items = [
            CostItem(
                id=1,
                estimate_id=1,
                category=CostCategory.LABOR,
                name="开发人员",
                total_cost=60000.0
            ),
            CostItem(
                id=2,
                estimate_id=1,
                category=CostCategory.EQUIPMENT,
                name="服务器",
                total_cost=20000.0
            )
        ]

        # 设置不同的执行结果
        mock_project_result = Mock()
        mock_project_result.scalar_one_or_none.return_value = mock_project

        mock_estimates_result = Mock()
        mock_estimates_result.scalars.return_value.all.return_value = [mock_estimate]

        mock_cost_items_result = Mock()
        mock_cost_items_result.scalars.return_value.all.return_value = mock_cost_items

        mock_db.execute.side_effect = [
            mock_project_result,
            mock_estimates_result,
            mock_cost_items_result,
            Mock()  # 基准查询
        ]

        report = await cost_estimation_service.generate_cost_report(
            project_id=1,
            user_id=1,
            db=mock_db
        )

        assert isinstance(report, dict)
        assert 'project_info' in report
        assert 'cost_summary' in report
        assert 'latest_estimate' in report
        assert 'cost_breakdown' in report
        assert 'recommendations' in report
        assert 'generated_at' in report


@pytest.mark.asyncio
async def test_insufficient_historical_data_for_prediction():
    """测试历史数据不足时的预测"""
    prediction_request = CostPredictionRequest(
        project_type="software_development",
        estimated_budget=100000.0
    )

    mock_db = AsyncMock(spec=AsyncSession)

    with patch('sqlalchemy.select') as mock_select:
        # 模拟数据不足（只有1个项目）
        mock_projects = [
            Project(
                id=1,
                user_id=1,
                project_type=ProjectType.SOFTWARE_DEVELOPMENT,
                estimated_budget=80000.0,
                actual_cost=85000.0
            )
        ]

        mock_result = Mock()
        mock_result.scalars.return_value.all.return_value = mock_projects
        mock_db.execute.return_value = mock_result

        with pytest.raises(Exception) as exc_info:
            await cost_estimation_service.predict_cost(
                prediction_request=prediction_request,
                user_id=1,
                db=mock_db
            )

        assert "历史数据不足" in str(exc_info.value)


@pytest.mark.asyncio
async def test_cost_estimate_validation():
    """测试成本估算数据验证"""
    # 测试无效的估算方法
    with pytest.raises(ValueError):
        CostEstimateCreate(
            project_id=1,
            title="测试",
            estimated_budget=-1000.0,  # 负数
            estimation_method="invalid_method"  # 无效方法
        )

    # 测试无效的置信度
    with pytest.raises(ValueError):
        CostEstimateCreate(
            project_id=1,
            title="测试",
            estimated_budget=100000.0,
            estimation_method="parametric",
            confidence_level=1.5  # 超出范围
        )

    # 测试日期验证
    with pytest.raises(ValueError):
        CostEstimateCreate(
            project_id=1,
            title="测试",
            estimated_budget=100000.0,
            estimation_method="parametric",
            estimated_start_date=datetime(2024, 1, 15),
            estimated_end_date=datetime(2024, 1, 10)  # 早于开始日期
        )


@pytest.mark.asyncio
async def test_cost_item_validation():
    """测试成本项目数据验证"""
    # 测试负数量
    with pytest.raises(ValueError):
        CostItemCreate(
            category=CostCategory.LABOR,
            name="测试",
            quantity=-1,  # 负数
            unit_price=100.0,
            unit_of_measure="个",
            cost_type=CostType.DIRECT
        )

    # 测试负单价
    with pytest.raises(ValueError):
        CostItemCreate(
            category=CostCategory.LABOR,
            name="测试",
            quantity=1,
            unit_price=-100.0,  # 负数
            unit_of_measure="个",
            cost_type=CostType.DIRECT
        )


@pytest.mark.asyncio
async def test_concurrent_cost_estimation():
    """测试并发成本估算处理"""
    # 创建多个估算任务
    tasks = []

    for i in range(3):
        estimate_data = CostEstimateCreate(
            project_id=1,
            title=f"并发估算{i}",
            estimated_budget=100000.0 + i * 10000,
            estimation_method="parametric"
        )

        mock_db = AsyncMock(spec=AsyncSession)

        with patch('sqlalchemy.ext.asyncio.AsyncSession.add'), \
             patch('sqlalchemy.ext.asyncio.AsyncSession.commit'), \
             patch('sqlalchemy.ext.asyncio.AsyncSession.refresh'), \
             patch('sqlalchemy.select') as mock_select:

            # 模拟项目存在
            mock_project = Project(id=1, name="项目", user_id=1)
            mock_result = Mock()
            mock_result.scalar_one_or_none.return_value = mock_project
            mock_db.execute.return_value = mock_result

            task = cost_estimation_service.create_cost_estimate(
                estimate_data=estimate_data,
                user_id=1,
                db=mock_db
            )
            tasks.append(task)

    # 并发执行
    results = await asyncio.gather(*tasks)

    # 验证结果
    assert len(results) == 3
    for i, result in enumerate(results):
        assert result.title == f"并发估算{i}"


@pytest.mark.asyncio
async def test_error_handling():
    """测试错误处理"""
    mock_db = AsyncMock(spec=AsyncSession)

    # 测试项目不存在
    with patch('sqlalchemy.select') as mock_select:
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        estimate_data = CostEstimateCreate(
            project_id=999,
            title="测试",
            estimated_budget=100000.0,
            estimation_method="parametric"
        )

        with pytest.raises(ValueError) as exc_info:
            await cost_estimation_service.create_cost_estimate(
                estimate_data=estimate_data,
                user_id=1,
                db=mock_db
            )

        assert "项目不存在" in str(exc_info.value)

    # 测试比较时估算数量不足
    comparison_request = CostComparisonRequest(
        estimate_ids=[1]  # 只有一个估算
    )

    with pytest.raises(ValueError) as exc_info:
        await cost_estimation_service.compare_cost_estimates(
            comparison_request=comparison_request,
            user_id=1,
            db=mock_db
        )

    assert "至少需要选择两个估算" in str(exc_info.value)