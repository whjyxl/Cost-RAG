"""
Excel多项目对比解析器 - 核心解析类

实现完整的Excel解析逻辑。

Author: Cost-RAG Team
Created: 2025-11-06
"""

import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import pandas as pd
import logging

from .models import (
    ItemType,
    ProjectBasicInfo,
    CostItemValue,
    CostItem,
    ProjectCostData,
    ProjectComparisonData,
    ParserConfig,
)
from .exceptions import (
    FileNotFoundError,
    InvalidFileFormatError,
    InvalidExcelStructureError,
    ProjectAreaInvalidError,
)

logger = logging.getLogger(__name__)


class MultiProjectExcelParser:
    """多项目对比Excel文件解析器"""
    
    PROJECT_COLUMN_CONFIG = {
        # 每个项目占3列: 总价列, 单方造价列(元/m²), 备注列
        # 项目1: 列1(总价), 列2(元/m²), 列3(备注)
        # 项目2: 列4(总价), 列5(元/m²), 列6(备注)
        # 第1行的name_col用于读取项目名称和建筑面积
        1: {'name_col': 1, 'value_col': 1, 'unit_col': 2, 'remark_col': 3},
        2: {'name_col': 4, 'value_col': 4, 'unit_col': 5, 'remark_col': 6},
        3: {'name_col': 7, 'value_col': 7, 'unit_col': 8, 'remark_col': 9},
        4: {'name_col': 10, 'value_col': 10, 'unit_col': 11, 'remark_col': 12},
        5: {'name_col': 13, 'value_col': 13, 'unit_col': 14, 'remark_col': 15},
        6: {'name_col': 16, 'value_col': 16, 'unit_col': 17, 'remark_col': 18},
        7: {'name_col': 19, 'value_col': 19, 'unit_col': 20, 'remark_col': 21},
    }
    
    def __init__(self, config: Optional[ParserConfig] = None):
        """初始化解析器"""
        self.config = config or ParserConfig()
        self.project_areas: Dict[str, float] = {}
        self.logger = logging.getLogger(self.__class__.__name__)
    
    def parse(self, file_path: str) -> ProjectComparisonData:
        """解析Excel文件"""
        self.logger.info(f"开始解析Excel文件: {file_path}")
        
        file_path_obj = self._validate_file(file_path)
        df = self._read_excel(file_path_obj)
        project_configs = self._identify_projects(df)
        projects_data = self._extract_all_projects(df, project_configs)
        
        result = ProjectComparisonData(
            projects=projects_data,
            source_file=str(file_path_obj)
        )
        
        if self.config.validate_math_relationships:
            validation = result.validate_all_projects(self.config.tolerance)
            if not validation["is_valid"]:
                self.logger.warning(
                    f"数据验证发现问题: "
                    f"{validation['summary']['invalid_projects']} 个项目验证失败"
                )
        
        self.logger.info(f"解析完成: {len(result.projects)} 个项目")
        return result
    
    def _validate_file(self, file_path: str) -> Path:
        """验证文件存在且格式正确"""
        path = Path(file_path)
        
        if not path.exists():
            raise FileNotFoundError(
                f"文件不存在: {file_path}",
                {"file_path": file_path}
            )
        
        if not path.is_file():
            raise InvalidFileFormatError(
                f"不是有效的文件: {file_path}",
                {"file_path": file_path}
            )
        
        valid_extensions = {'.xlsx', '.xls'}
        if path.suffix.lower() not in valid_extensions:
            raise InvalidFileFormatError(
                f"不支持的文件格式: {path.suffix}",
                {"file_path": file_path, "extension": path.suffix}
            )
        
        return path
    
    def _read_excel(self, file_path: Path) -> pd.DataFrame:
        """读取Excel文件"""
        try:
            df = pd.read_excel(
                file_path,
                engine='openpyxl',
                header=None,
                dtype=str,
            )
            
            self.logger.info(f"成功读取Excel: {df.shape[0]} 行 x {df.shape[1]} 列")
            
            if df.empty:
                raise InvalidFileFormatError(
                    "Excel文件为空",
                    {"file_path": str(file_path)}
                )
            
            if df.shape[0] < 5:
                raise InvalidExcelStructureError(
                    "Excel文件行数不足",
                    {"rows": df.shape[0]}
                )
            
            return df
            
        except Exception as e:
            if isinstance(e, (InvalidFileFormatError, InvalidExcelStructureError)):
                raise
            raise InvalidFileFormatError(
                f"读取Excel文件失败: {str(e)}",
                {"file_path": str(file_path), "error": str(e)}
            )
    
    def _identify_projects(self, df: pd.DataFrame) -> Dict[int, Dict[str, any]]:
        """识别Excel中的所有项目"""
        self.logger.info("开始识别项目结构...")
        
        projects = {}
        row1 = df.iloc[0]
        row2 = df.iloc[1] if len(df) > 1 else pd.Series()
        
        for project_id, col_config in self.PROJECT_COLUMN_CONFIG.items():
            name_col = col_config['name_col']
            
            if name_col >= len(row1):
                break
            
            project_name = self._extract_text(row1.iloc[name_col])
            if not project_name:
                continue
            
            # 从第2行的name_col（同一列）读取建筑面积
            project_area = 0.0
            if name_col < len(row2):
                area_str = row2.iloc[name_col]
                project_area = self._safe_float_conversion(area_str, 0.0)
            
            if project_area <= 0 and not self.config.skip_empty_projects:
                raise ProjectAreaInvalidError(
                    f"项目 '{project_name}' 的面积无效: {project_area}",
                    {"project_name": project_name, "area": project_area}
                )
            
            projects[project_id] = {
                "id": project_id,
                "name": project_name,
                "area": project_area,
                "column_config": col_config
            }
            
            self.project_areas[project_name] = project_area
            self.logger.info(f"识别到项目{project_id}: {project_name}, 面积: {project_area:.2f} m²")
        
        if not projects:
            raise InvalidExcelStructureError(
                "未识别到任何有效项目",
                {"total_columns": len(df.columns)}
            )
        
        return projects
    
    def _extract_all_projects(
        self,
        df: pd.DataFrame,
        project_configs: Dict[int, Dict[str, any]]
    ) -> List[ProjectCostData]:
        """提取所有项目的数据"""
        projects_data = []
        
        for project_id, config in project_configs.items():
            project_data = self._extract_single_project(df, config)
            if project_data:
                projects_data.append(project_data)
        
        return projects_data
    
    def _extract_single_project(
        self,
        df: pd.DataFrame,
        project_config: Dict[str, any]
    ) -> Optional[ProjectCostData]:
        """提取单个项目的完整数据"""
        project_name = project_config["name"]
        
        self.logger.info(f"开始提取项目数据: {project_name}")
        
        basic_info = self._extract_basic_info(df, project_config)
        cost_items = self._extract_cost_items(df, project_config)
        
        if not cost_items:
            self.logger.warning(f"项目 {project_name} 没有成本数据")
            if self.config.skip_empty_projects:
                return None
        
        project_data = ProjectCostData(
            basic_info=basic_info,
            cost_items=cost_items
        )
        
        return project_data
    
    def _extract_basic_info(
        self,
        df: pd.DataFrame,
        project_config: Dict[str, any]
    ) -> ProjectBasicInfo:
        """提取项目基本信息"""
        project_name = project_config["name"]
        project_area = project_config["area"]
        col_config = project_config["column_config"]
        value_col = col_config["value_col"]
        
        floors = None
        if len(df) > 2:
            floors_value = df.iloc[2].iloc[value_col] if value_col < len(df.iloc[2]) else None
            floors = self._extract_text(floors_value)
        
        start_date = None
        completion_date = None
        if len(df) > 3:
            dates_value = df.iloc[3].iloc[value_col] if value_col < len(df.iloc[3]) else None
            dates_text = self._extract_text(dates_value)
            if dates_text:
                start_date = dates_text
                completion_date = dates_text
        
        return ProjectBasicInfo(
            name=project_name,
            area=project_area,
            floors=floors,
            start_date=start_date,
            completion_date=completion_date
        )
    
    def _extract_cost_items(
        self,
        df: pd.DataFrame,
        project_config: Dict[str, any]
    ) -> List[CostItem]:
        """提取项目的所有成本项目
        
        Excel结构:
        - 第1行(索引0): 项目名称
        - 第2行(索引1): 建筑面积
        - 第3行(索引2): 层数
        - 第4行(索引3): 开竣工时间
        - 第5行(索引4): 建造成本（表头）
        - 第6行(索引5): 分部分项，总价，元/m²，备注（列标题）
        - 第7行(索引6)开始: 具体成本项
        """
        project_name = project_config["name"]
        col_config = project_config["column_config"]
        value_col = col_config["value_col"]  # 总价列
        unit_col = col_config["unit_col"]    # 单方列（元/m²）
        remark_col = col_config.get("remark_col", unit_col + 1)  # 备注列
        
        cost_items = []
        
        # 从第7行（索引6）开始读取成本项
        for row_idx in range(6, len(df)):
            row = df.iloc[row_idx]
            
            # 从第0列读取成本项代码和名称（如 "1.工程地质勘察"）
            item_code = self._extract_text(row.iloc[0])
            if not item_code:
                continue
            
            code, name = self._parse_item_code_and_name(item_code)
            if not code:
                continue
            
            item_type = self._determine_item_type(code)
            
            # 读取总价（保留0值，不要转为None）
            value = None
            if value_col < len(row):
                value = self._safe_float_conversion(row.iloc[value_col])
            
            # 读取单方造价（元/m²）
            unit = None
            if unit_col < len(row):
                unit = self._extract_text(row.iloc[unit_col])
            
            # 读取备注
            notes = None
            if remark_col < len(row):
                notes = self._extract_text(row.iloc[remark_col])
            
            cost_value = CostItemValue(
                value=value,  # 保留0值，不转为None
                unit=unit,
                notes=notes
            )
            
            cost_item = CostItem(
                row_number=row_idx + 1,
                item_type=item_type,
                item_code=code,
                item_name=name,
                project_values={project_name: cost_value}
            )
            
            cost_items.append(cost_item)
        
        return cost_items
    
    def _parse_item_code_and_name(self, text: str) -> Tuple[str, str]:
        """解析项目代码和名称
        
        支持格式:
        - "1.工程地质勘察" (无空格)
        - "1. 工程地质勘察" (有空格)
        - "2.1土石方开挖" (无空格)
        - "2.1 土石方开挖" (有空格)
        """
        text = text.strip()
        
        # 支持有空格或无空格的格式
        patterns = [
            r'^(\d+\.\d+)\s*(.+)$',  # 匹配 "2.1土石方" 或 "2.1 土石方"
            r'^(\d+\.0)\s*(.+)$',    # 匹配 "1.0工程" 或 "1.0 工程"
            r'^(\d+)\.\s*(.+)$',     # 匹配 "1.工程" 或 "1. 工程"
            r'^(\d+)\s+(.+)$',       # 匹配 "1 工程"
        ]
        
        for pattern in patterns:
            match = re.match(pattern, text)
            if match:
                code = match.group(1)
                name = match.group(2).strip()
                # 统一格式：确保都有小数点
                if '.' not in code:
                    code = f"{code}.0"
                return code, name
        
        self.logger.warning(f"无法解析项目代码: {text}")
        return text, text
    
    def _determine_item_type(self, code: str) -> ItemType:
        """确定项目类型"""
        if code.lower() in ('area', '面积'):
            return ItemType.AREA
        if code.lower() in ('floors', '层数'):
            return ItemType.FLOORS
        if code.lower() in ('dates', '时间', '日期'):
            return ItemType.DATES
        
        if '.' in code:
            parts = code.split('.')
            try:
                primary = int(parts[0])
                secondary = int(parts[1]) if parts[1] != '0' else 0
                
                if 1 <= primary <= 14:
                    if secondary == 0:
                        return ItemType.COST_SECTION
                    else:
                        return ItemType.COST_ITEM
            except ValueError:
                pass
        
        return ItemType.COST_ITEM
    
    def _extract_text(self, value) -> Optional[str]:
        """从单元格提取文本"""
        if pd.isna(value):
            return None
        
        text = str(value).strip()
        if not text or text.lower() in ('nan', 'none', ''):
            return None
        
        return text
    
    def _safe_float_conversion(self, value, default: float = 0.0) -> float:
        """安全的浮点数转换"""
        if value is None or pd.isna(value):
            return default
        
        if isinstance(value, (int, float)):
            return float(value)
        
        if isinstance(value, str):
            cleaned = re.sub(r'[^\d.-]', '', value.strip())
            if cleaned:
                try:
                    return float(cleaned)
                except ValueError:
                    return default
        
        return default


__all__ = ["MultiProjectExcelParser"]
