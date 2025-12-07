"""
創建一個假的 tensorflow_decision_forests 模塊來滿足 tensorflowjs 的導入需求
這個模塊不會被實際使用，只是為了讓 tensorflowjs 能夠正常導入
"""
import sys
from types import ModuleType

# 創建一個假的模塊
fake_module = ModuleType('tensorflow_decision_forests')
fake_module.__version__ = '1.0.0'

# 添加一個假的 keras 子模塊
fake_keras = ModuleType('tensorflow_decision_forests.keras')
fake_module.keras = fake_keras

# 將假模塊注入到 sys.modules
sys.modules['tensorflow_decision_forests'] = fake_module
sys.modules['tensorflow_decision_forests.keras'] = fake_keras

