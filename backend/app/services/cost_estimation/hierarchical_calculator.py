"""
层级递归计算引擎

严格按照README.md第7.2节的算法进行层级递归计算
"""
from typing import Dict, List, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class HierarchicalCalculator:
    """层级递归计算器"""
    
    def __init__(self, tolerance: float = 0.01):
        """
        初始化计算器
        
        Args:
            tolerance: 验证容差（默认0.01，即1分钱）
        """
        self.tolerance = tolerance
        self.logger = logging.getLogger(self.__class__.__name__)
    
    def calculate_project_cost(
        self,
        project_area: float,
        template_cost_items: List[Dict],
        adjustment_factor: float = 1.0
    ) -> Dict:
        """
        层级递归计算项目成本
        
        严格按照：二级分部 → 一级分部 → 项目总造价 的顺序
        
        Args:
            project_area: 新建项目建筑面积
            template_cost_items: 模板成本项列表（包含item_code, unit_price等）
            adjustment_factor: 调整系数（时间调整等）
            
        Returns:
            计算结果字典，包含各级单方造价和合价
        """
        try:
            # Step 1: 计算所有二级分部调整后单方造价
            secondary_unit_prices = {}
            for item in template_cost_items:
                if self._is_secondary_section(item['item_code']):
                    base_price = item.get('unit_price', 0.0) or 0.0
                    adjusted_price = base_price * adjustment_factor
                    secondary_unit_prices[item['item_code']] = adjusted_price
            
            # Step 2: 计算一级分部单方造价（其下所有二级分部求和）
            primary_unit_prices = {}
            for primary_num in range(1, 14):  # 1-13一级分部
                primary_code = f"{primary_num}.0"
                secondary_sum = 0.0
                
                # 查找该一级分部下的所有二级分部
                for sec_code, sec_price in secondary_unit_prices.items():
                    if sec_code.startswith(f"{primary_num}.") and sec_code != primary_code:
                        secondary_sum += sec_price
                
                # 如果一级分部本身有值，也加上
                for item in template_cost_items:
                    if item['item_code'] == primary_code:
                        base_price = item.get('unit_price', 0.0) or 0.0
                        adjusted_price = base_price * adjustment_factor
                        # 如果二级分部求和不为0，优先使用二级分部求和
                        if secondary_sum > 0:
                            primary_unit_prices[primary_code] = secondary_sum
                        else:
                            primary_unit_prices[primary_code] = adjusted_price
                        break
                else:
                    # 没有找到一级分部本身，使用二级分部求和
                    if secondary_sum > 0:
                        primary_unit_prices[primary_code] = secondary_sum
            
            # Step 3: 计算项目总单方造价（第14项 = 前13项一级分部求和）
            total_unit_price = sum(
                primary_unit_prices.get(f"{i}.0", 0.0)
                for i in range(1, 14)
            )
            
            # Step 4: 计算各层级合价（单方造价 × 建筑面积）
            secondary_total_costs = {
                code: price * project_area
                for code, price in secondary_unit_prices.items()
            }
            
            primary_total_costs = {
                code: price * project_area
                for code, price in primary_unit_prices.items()
            }
            
            total_project_cost = total_unit_price * project_area
            
            return {
                'secondary_unit_prices': secondary_unit_prices,
                'primary_unit_prices': primary_unit_prices,
                'total_unit_price': total_unit_price,
                'total_project_cost': total_project_cost,
                'secondary_total_costs': secondary_total_costs,
                'primary_total_costs': primary_total_costs,
                'project_area': project_area
            }
            
        except Exception as e:
            self.logger.error(f"层级递归计算失败: {str(e)}")
            raise
    
    def validate_calculation(
        self,
        calculation_result: Dict
    ) -> Dict[str, any]:
        """
        反向验证计算结果
        
        验证各层级数学关系是否正确
        """
        errors = []
        warnings = []
        
        try:
            secondary_unit_prices = calculation_result.get('secondary_unit_prices', {})
            primary_unit_prices = calculation_result.get('primary_unit_prices', {})
            total_unit_price = calculation_result.get('total_unit_price', 0.0)
            project_area = calculation_result.get('project_area', 0.0)
            total_project_cost = calculation_result.get('total_project_cost', 0.0)
            
            # 验证1: 二级分部求和 = 一级分部
            for primary_num in range(1, 14):
                primary_code = f"{primary_num}.0"
                expected_primary_price = 0.0
                
                # 计算该一级分部下所有二级分部的和
                for sec_code, sec_price in secondary_unit_prices.items():
                    if sec_code.startswith(f"{primary_num}.") and sec_code != primary_code:
                        expected_primary_price += sec_price
                
                actual_primary_price = primary_unit_prices.get(primary_code, 0.0)
                
                if expected_primary_price > 0 or actual_primary_price > 0:
                    diff = abs(expected_primary_price - actual_primary_price)
                    threshold = max(expected_primary_price, actual_primary_price) * self.tolerance
                    
                    if diff > threshold:
                        errors.append(
                            f"一级分部{primary_code}验证失败: "
                            f"期望{expected_primary_price:.2f}, 实际{actual_primary_price:.2f}, "
                            f"差异{diff:.2f}"
                        )
            
            # 验证2: 一级分部求和(1-13) = 项目总单方造价
            expected_total_unit_price = sum(
                primary_unit_prices.get(f"{i}.0", 0.0)
                for i in range(1, 14)
            )
            
            diff = abs(expected_total_unit_price - total_unit_price)
            threshold = max(expected_total_unit_price, total_unit_price) * self.tolerance
            
            if diff > threshold:
                errors.append(
                    f"项目总单方造价验证失败: "
                    f"期望{expected_total_unit_price:.2f}, 实际{total_unit_price:.2f}, "
                    f"差异{diff:.2f}"
                )
            
            # 验证3: 总造价计算验证
            expected_total_cost = total_unit_price * project_area
            diff = abs(expected_total_cost - total_project_cost)
            threshold = max(expected_total_cost, total_project_cost) * self.tolerance
            
            if diff > threshold:
                errors.append(
                    f"项目总造价验证失败: "
                    f"期望{expected_total_cost:.2f}, 实际{total_project_cost:.2f}, "
                    f"差异{diff:.2f}"
                )
            
            is_valid = len(errors) == 0
            
            return {
                'is_valid': is_valid,
                'errors': errors,
                'warnings': warnings
            }
            
        except Exception as e:
            self.logger.error(f"验证计算失败: {str(e)}")
            return {
                'is_valid': False,
                'errors': [f"验证过程出错: {str(e)}"],
                'warnings': []
            }
    
    def _is_secondary_section(self, item_code: str) -> bool:
        """判断是否为二级分部"""
        if "." in item_code and not item_code.endswith(".0"):
            parts = item_code.split(".")
            if len(parts) == 2:
                try:
                    int(parts[0])
                    int(parts[1])
                    return True
                except ValueError:
                    return False
        return False


# 全局计算器实例
hierarchical_calculator = HierarchicalCalculator()

