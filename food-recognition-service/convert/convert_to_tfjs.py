"""
將訓練好的 TensorFlow 模型轉換為 TensorFlow.js 格式
"""
import os
import sys
import warnings
from pathlib import Path
import json
import subprocess

# 修復 Windows 控制台編碼問題
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 在導入 tensorflowjs 之前，注入假的模塊來繞過導入錯誤
import types

# 創建假的 decision_forests 模塊（完整的模塊結構）
fake_decision_forests = types.ModuleType('tensorflow_decision_forests')
fake_decision_forests.__version__ = "1.8.1"

# 創建假的 keras 子模塊
fake_keras = types.ModuleType('tensorflow_decision_forests.keras')
fake_decision_forests.keras = fake_keras

# 創建假的 tensorflow.ops.inference 子模塊（避免加載 .so 文件）
fake_tf_ops = types.ModuleType('tensorflow_decision_forests.tensorflow')
fake_tf_ops_inference = types.ModuleType('tensorflow_decision_forests.tensorflow.ops')
fake_tf_ops_inference_api = types.ModuleType('tensorflow_decision_forests.tensorflow.ops.inference')
fake_tf_ops.ops = fake_tf_ops_inference
fake_tf_ops_inference.inference = fake_tf_ops_inference_api
fake_decision_forests.tensorflow = fake_tf_ops

# 注入到 sys.modules
sys.modules['tensorflow_decision_forests'] = fake_decision_forests
sys.modules['tensorflow_decision_forests.keras'] = fake_keras
sys.modules['tensorflow_decision_forests.tensorflow'] = fake_tf_ops
sys.modules['tensorflow_decision_forests.tensorflow.ops'] = fake_tf_ops_inference
sys.modules['tensorflow_decision_forests.tensorflow.ops.inference'] = fake_tf_ops_inference_api

# 修復 jax 導入問題（如果 jax 版本太舊）
try:
    import jax.experimental.jax2tf as jax2tf_module
    if not hasattr(jax2tf_module, 'shape_poly'):
        # 創建假的 shape_poly 函數
        def fake_shape_poly(*args, **kwargs):
            return None
        jax2tf_module.shape_poly = fake_shape_poly
except (ImportError, AttributeError):
    # 如果導入失敗，創建假的模塊
    try:
        import types
        fake_jax2tf = types.ModuleType('jax.experimental.jax2tf')
        fake_jax2tf.shape_poly = lambda *args, **kwargs: None
        import jax.experimental
        jax.experimental.jax2tf = fake_jax2tf
        sys.modules['jax.experimental.jax2tf'] = fake_jax2tf
    except:
        pass

# 設置環境變量減少警告
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
warnings.filterwarnings('ignore')

def convert_h5_to_tfjs(h5_path, output_path):
    """
    將 Keras H5 模型轉換為 TensorFlow.js 格式
    
    Args:
        h5_path: Keras H5 模型路徑
        output_path: TensorFlow.js 輸出路徑
    """
    print(f"🔄 轉換 H5 模型: {h5_path} -> {output_path}")
    
    # 確保輸出目錄存在
    Path(output_path).mkdir(parents=True, exist_ok=True)
    
    try:
        # 使用命令行工具轉換 H5 模型
        cmd = [
            sys.executable, '-m', 'tensorflowjs.converters.convert_keras',
            '--input_format=keras',
            '--output_format=tfjs_graph_model',
            str(h5_path),
            str(output_path)
        ]
        
        try:
            # 使用包裝腳本來避免導入錯誤
            wrapper_script = Path(__file__).parent / 'convert_wrapper.py'
            if wrapper_script.exists():
                # 使用包裝腳本
                cmd = [sys.executable, str(wrapper_script)] + cmd[2:]  # 跳過 python -m
            result = subprocess.run(cmd, check=True, capture_output=True, text=True)
            print(f"✅ H5 模型已轉換為 TensorFlow.js 格式: {output_path}")
            return True
        except subprocess.CalledProcessError as e:
            print(f"  命令行轉換失敗:")
            print(f"  錯誤代碼: {e.returncode}")
            if e.stdout:
                print(f"  標準輸出: {e.stdout[:500]}")
            if e.stderr:
                print(f"  錯誤輸出: {e.stderr[:500]}")
            print(f"  請檢查 tensorflowjs 是否正確安裝")
            return False
    except Exception as e:
        print(f"❌ 轉換失敗: {e}")
        import traceback
        traceback.print_exc()
        return False

def convert_model_to_tfjs(saved_model_path, output_path):
    """
    將 TensorFlow SavedModel 轉換為 TensorFlow.js 格式
    
    Args:
        saved_model_path: TensorFlow SavedModel 路徑
        output_path: TensorFlow.js 輸出路徑
    """
    print(f"🔄 轉換模型: {saved_model_path} -> {output_path}")
    
    # 確保輸出目錄存在
    Path(output_path).mkdir(parents=True, exist_ok=True)
    
    try:
        # 優先使用命令行工具（避免 decision forests 導入問題）
        cmd = [
            sys.executable, '-m', 'tensorflowjs.converters.tf_saved_model_conversion_v2',
            '--input_format=tf_saved_model',
            '--saved_model_tags=serve',
            '--output_format=tfjs_graph_model',
            f'--saved_model_dir={str(saved_model_path)}',
            f'--output_dir={str(output_path)}'
        ]
        
        try:
            result = subprocess.run(cmd, check=True, capture_output=True, text=True)
            print(f"✅ 模型已轉換為 TensorFlow.js 格式: {output_path}")
            return True
        except subprocess.CalledProcessError as e:
            print(f"  命令行轉換失敗:")
            print(f"  錯誤代碼: {e.returncode}")
            if e.stdout:
                print(f"  標準輸出: {e.stdout[:500]}")
            if e.stderr:
                print(f"  錯誤輸出: {e.stderr[:500]}")
            print(f"  請檢查 tensorflowjs 是否正確安裝")
            return False
    except Exception as e:
        print(f"❌ 轉換失敗: {e}")
        import traceback
        traceback.print_exc()
        return False

def convert_all_models():
    """轉換所有三層模型"""
    base_dir = Path(__file__).parent.parent.parent  # 回到 PartyBillCalculator 根目錄
    models_dir = base_dir / 'models'  # 使用實際的模型目錄
    output_dir = base_dir / 'food-recognition-service' / 'models_tfjs'
    
    # 創建輸出目錄
    output_dir.mkdir(parents=True, exist_ok=True)
    
    models_to_convert = [
        ('level1', '第一層：食物檢測'),
        ('level2', '第二層：菜系分類'),
        ('level3', '第三層：細粒度分類')
    ]
    
    results = {}
    
    for level, description in models_to_convert:
        if level == 'level3':
            # level3 需要處理每個國家的模型
            level3_dir = models_dir / 'level3'
            if not level3_dir.exists():
                print(f"⚠️  Level3 模型目錄不存在: {level3_dir}")
                results[level] = False
                continue
            
            # 查找所有國家目錄
            countries = [d.name for d in level3_dir.iterdir() if d.is_dir()]
            if not countries:
                print(f"⚠️  Level3 沒有找到國家模型目錄")
                results[level] = False
                continue
            
            print(f"\n📦 {description}")
            level3_success = True
            for country in countries:
                model_path = level3_dir / country / 'final_model'
                output_path = output_dir / 'level3' / country
                
                if not model_path.exists():
                    print(f"  ⚠️  {country} 模型不存在: {model_path}")
                    level3_success = False
                    continue
                
                print(f"  🔄 轉換 {country} 模型...")
                success = convert_model_to_tfjs(str(model_path), str(output_path))
                if not success:
                    level3_success = False
            
            results[level] = level3_success
        else:
            # 先嘗試查找 final_model（SavedModel 格式）
            model_path = models_dir / level / 'final_model'
            h5_path = models_dir / level / 'best_model.h5'
            output_path = output_dir / level
            
            print(f"\n📦 {description}")
            
            # 如果存在 SavedModel 格式，優先使用
            if model_path.exists():
                print(f"  找到 SavedModel 格式: {model_path}")
                success = convert_model_to_tfjs(str(model_path), str(output_path))
                results[level] = success
            # 如果存在 H5 格式，轉換 H5
            elif h5_path.exists():
                print(f"  找到 H5 格式: {h5_path}")
                print(f"  將 H5 模型轉換為 TensorFlow.js 格式...")
                success = convert_h5_to_tfjs(str(h5_path), str(output_path))
                results[level] = success
            else:
                print(f"⚠️  模型不存在: {model_path} 或 {h5_path}")
                results[level] = False
    
    # 總結
    print("\n" + "="*50)
    print("轉換總結:")
    for level, success in results.items():
        status = "✅" if success else "❌"
        print(f"  {status} {level}")
    
    # 生成模型信息文件
    info = {
        'models': {
            level: {
                'path': f'models_tfjs/{level}/model.json',
                'converted': success
            }
            for level, success in results.items()
        }
    }
    
    with open(output_dir / 'models_info.json', 'w') as f:
        json.dump(info, f, indent=2)
    
    print(f"\n📄 模型信息已保存: {output_dir / 'models_info.json'}")

if __name__ == '__main__':
    # 嘗試使用直接轉換方法（推薦）
    try:
        print("嘗試使用直接轉換方法...")
        from convert_direct import convert_all_models_direct
        convert_all_models_direct()
    except ImportError:
        print("直接轉換方法不可用，使用命令行方法...")
        convert_all_models()


