"""
轉換工具的包裝腳本
在調用 tensorflowjs 轉換工具之前注入假的模塊
"""
import sys
import types
import subprocess

# 在導入 tensorflowjs 之前，注入假的模塊
# 創建假的 decision_forests 模塊
fake_decision_forests = types.ModuleType('tensorflow_decision_forests')
fake_decision_forests.__version__ = "1.8.1"
sys.modules['tensorflow_decision_forests'] = fake_decision_forests

# 修復 jax 導入問題
try:
    import jax.experimental
    fake_jax2tf = types.ModuleType('jax.experimental.jax2tf')
    # 創建假的 shape_poly 模塊
    fake_shape_poly = types.ModuleType('jax.experimental.jax2tf.shape_poly')
    # 添加需要的類
    class FakePolyShape:
        pass
    fake_shape_poly.PolyShape = FakePolyShape
    fake_jax2tf.shape_poly = fake_shape_poly
    jax.experimental.jax2tf = fake_jax2tf
    sys.modules['jax.experimental.jax2tf'] = fake_jax2tf
    sys.modules['jax.experimental.jax2tf.shape_poly'] = fake_shape_poly
except Exception as e:
    print(f"警告: 無法修復 jax 導入: {e}")
    pass

# 現在可以安全導入 tensorflowjs（只是為了確保模塊已加載）
try:
    import tensorflowjs
    print("✅ tensorflowjs 模塊已成功加載")
except Exception as e:
    print(f"⚠️  tensorflowjs 導入警告: {e}")

# 調用原始的命令行工具
if __name__ == '__main__':
    # 重新執行命令行工具
    if 'convert_keras' in sys.argv[0] or '--input_format=keras' in sys.argv:
        cmd = [sys.executable, '-m', 'tensorflowjs.converters.convert_keras'] + sys.argv[1:]
    else:
        cmd = [sys.executable, '-m', 'tensorflowjs.converters.tf_saved_model_conversion_v2'] + sys.argv[1:]
    result = subprocess.run(cmd)
    sys.exit(result.returncode)

