"""
价格调整服务

根据时间差和其他因素计算价格调整系数
"""
from datetime import datetime
from typing import Optional, Dict
import logging

logger = logging.getLogger(__name__)


class PriceAdjustmentService:
    """价格调整服务"""
    
    # 默认年增长率（小数形式，如0.06表示6%）
    DEFAULT_GROWTH_RATES = {
        'labor': 0.06,      # 人工费年增长率6%
        'material': 0.04,   # 材料费年增长率4%
        'equipment': 0.03   # 机械费年增长率3%
    }
    
    # 默认权重（用于综合系数）
    DEFAULT_WEIGHTS = {
        'labor': 0.3,       # 人工费权重30%
        'material': 0.6,    # 材料费权重60%
        'equipment': 0.1    # 机械费权重10%
    }
    
    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
    
    def calculate_time_adjustment_factor(
        self,
        reference_start_date: Optional[str],
        new_start_date: Optional[str],
        labor_growth_rate: Optional[float] = None,
        material_growth_rate: Optional[float] = None,
        equipment_growth_rate: Optional[float] = None,
        labor_weight: Optional[float] = None,
        material_weight: Optional[float] = None,
        equipment_weight: Optional[float] = None
    ) -> Dict[str, float]:
        """
        计算时间调整系数
        
        Args:
            reference_start_date: 参考项目开工时间（字符串格式）
            new_start_date: 新建项目开工时间（字符串格式）
            labor_growth_rate: 人工费年增长率（可选，默认6%）
            material_growth_rate: 材料费年增长率（可选，默认4%）
            equipment_growth_rate: 机械费年增长率（可选，默认3%）
            labor_weight: 人工费权重（可选，默认30%）
            material_weight: 材料费权重（可选，默认60%）
            equipment_weight: 机械费权重（可选，默认10%）
            
        Returns:
            包含调整系数和详细信息的字典
        """
        try:
            # 解析时间
            ref_date = self._parse_date(reference_start_date)
            new_date = self._parse_date(new_start_date)
            
            if not ref_date or not new_date:
                self.logger.warning("无法解析时间，返回默认调整系数1.0")
                return {
                    'adjustment_factor': 1.0,
                    'years_difference': 0.0,
                    'labor_factor': 1.0,
                    'material_factor': 1.0,
                    'equipment_factor': 1.0,
                    'composite_factor': 1.0
                }
            
            # 计算年数差
            years_diff = self._calculate_years_difference(ref_date, new_date)
            
            # 使用默认值或提供的值
            labor_rate = labor_growth_rate if labor_growth_rate is not None else self.DEFAULT_GROWTH_RATES['labor']
            material_rate = material_growth_rate if material_growth_rate is not None else self.DEFAULT_GROWTH_RATES['material']
            equipment_rate = equipment_growth_rate if equipment_growth_rate is not None else self.DEFAULT_GROWTH_RATES['equipment']
            
            labor_w = labor_weight if labor_weight is not None else self.DEFAULT_WEIGHTS['labor']
            material_w = material_weight if material_weight is not None else self.DEFAULT_WEIGHTS['material']
            equipment_w = equipment_weight if equipment_weight is not None else self.DEFAULT_WEIGHTS['equipment']
            
            # 计算各类型调整系数
            labor_factor = (1 + labor_rate) ** years_diff
            material_factor = (1 + material_rate) ** years_diff
            equipment_factor = (1 + equipment_rate) ** years_diff
            
            # 计算综合调整系数（加权平均）
            composite_factor = (
                labor_factor * labor_w +
                material_factor * material_w +
                equipment_factor * equipment_w
            )
            
            return {
                'adjustment_factor': round(composite_factor, 6),
                'years_difference': round(years_diff, 2),
                'labor_factor': round(labor_factor, 6),
                'material_factor': round(material_factor, 6),
                'equipment_factor': round(equipment_factor, 6),
                'composite_factor': round(composite_factor, 6),
                'reference_date': reference_start_date,
                'new_date': new_start_date
            }
            
        except Exception as e:
            self.logger.error(f"计算时间调整系数失败: {str(e)}")
            raise
    
    def apply_adjustments(
        self,
        base_unit_price: float,
        time_adjustment_factor: float,
        region_factor: float = 1.0,
        quality_factor: float = 1.0
    ) -> float:
        """
        应用所有调整系数到单价
        
        Args:
            base_unit_price: 基准单方造价
            time_adjustment_factor: 时间调整系数
            region_factor: 地区系数（默认1.0）
            quality_factor: 质量等级系数（默认1.0）
            
        Returns:
            调整后的单方造价
        """
        adjusted_price = base_unit_price * time_adjustment_factor * region_factor * quality_factor
        return round(adjusted_price, 2)
    
    def _parse_date(self, date_str: Optional[str]) -> Optional[datetime]:
        """解析时间字符串"""
        if not date_str:
            return None
        
        import re
        
        # 匹配年份：2011年12月
        year_match = re.search(r'(\d{4})年', date_str)
        month_match = re.search(r'(\d{1,2})月', date_str)
        
        if year_match:
            year = int(year_match.group(1))
            month = int(month_match.group(1)) if month_match else 1
            day = 1
            
            try:
                return datetime(year, month, day)
            except ValueError:
                pass
        
        return None
    
    def _calculate_years_difference(
        self,
        date1: datetime,
        date2: datetime
    ) -> float:
        """计算两个日期之间的年数差"""
        delta = date2 - date1
        days = delta.days
        years = days / 365.25  # 考虑闰年
        return years


# 全局服务实例
price_adjustment_service = PriceAdjustmentService()

