"""
檢查 GPU 可用性和 TensorFlow GPU 配置
"""
import tensorflow as tf
import sys

print("=" * 60)
print("TensorFlow GPU 配置檢查")
print("=" * 60)

print(f"\nTensorFlow 版本: {tf.__version__}")
print(f"Python 版本: {sys.version}")

# 檢查 GPU
gpus = tf.config.list_physical_devices('GPU')
print(f"\n檢測到的 GPU 設備: {len(gpus)} 個")
for i, gpu in enumerate(gpus):
    print(f"  GPU {i}: {gpu}")

# 檢查 CUDA
print(f"\nCUDA 編譯支持: {tf.test.is_built_with_cuda()}")
print(f"cuDNN 編譯支持: {tf.test.is_built_with_cuda()}")

# 檢查 GPU 內存
if gpus:
    for i, gpu in enumerate(gpus):
        print(f"\nGPU {i} 配置:")
        try:
            details = tf.config.experimental.get_device_details(gpu)
            print(f"  設備詳情: {details}")
        except:
            pass
        
        # 檢查內存
        try:
            memory_info = tf.config.experimental.get_memory_info(gpu)
            print(f"  當前內存使用: {memory_info['current'] / 1024**3:.2f} GB")
            print(f"  峰值內存使用: {memory_info['peak'] / 1024**3:.2f} GB")
        except:
            pass
else:
    print("\n[WARNING] 未檢測到 GPU 設備")
    print("\n可能的原因:")
    print("  1. 未安裝 CUDA Toolkit")
    print("  2. 未安裝 cuDNN")
    print("  3. CUDA 環境變量未設置")
    print("  4. TensorFlow 是 CPU 版本")
    print("\n解決方案請參考: docs/GPU_SETUP_GUIDE.md")

# 測試 GPU 計算
print("\n" + "=" * 60)
print("GPU 計算測試")
print("=" * 60)

if gpus:
    try:
        with tf.device('/GPU:0'):
            a = tf.constant([[1.0, 2.0], [3.0, 4.0]])
            b = tf.constant([[1.0, 1.0], [0.0, 1.0]])
            c = tf.matmul(a, b)
            print(f"\n[SUCCESS] GPU 計算成功")
            print(f"結果: {c.numpy()}")
            print(f"設備: {c.device}")
    except Exception as e:
        print(f"\n[ERROR] GPU 計算失敗: {e}")
else:
    print("\n[WARNING] 無法測試 GPU 計算（未檢測到 GPU）")
    print("將使用 CPU 進行計算（較慢）")

print("\n" + "=" * 60)

